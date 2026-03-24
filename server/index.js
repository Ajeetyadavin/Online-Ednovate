import "dotenv/config";
import cors from "cors";
import express from "express";
import nodemailer from "nodemailer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkDatabaseConnection, ensureSchema, pool } from "./db.js";

const app = express();
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const bodyLimit = process.env.BODY_LIMIT || "25mb";

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

const mapStudentRow = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  mobile: row.mobile || "",
  city: row.city || "",
  state: row.state || "",
  country: row.country || "",
  status: row.status === "Inactive" ? "Inactive" : "Active",
  joinDate: row.join_date,
  coursesEnrolled: Number(row.courses_enrolled || 0),
  coursesCompleted: Number(row.courses_completed || 0),
  bio: row.bio || "",
  educationLevel: row.education_level || "",
});

const mapStudentCourseAccess = (row) => ({
  id: Number(row.id),
  studentId: row.student_id,
  courseId: row.course_id,
  courseTitle: row.course_title,
  purchaseDate: row.purchase_date,
  durationDays: Number(row.duration_days || 0),
  expiresAt: row.expires_at,
  totalViews: Number(row.total_views || 0),
  usedViews: Number(row.used_views || 0),
  isUnlimitedViews: row.is_unlimited_views === true,
  remainingViews: Math.max(0, Number(row.total_views || 0) - Number(row.used_views || 0)),
  courseDurationSeconds: Math.max(0, Number(row.course_duration_seconds || 0)),
  allowedWatchSeconds: Math.max(0, Number(row.allowed_watch_seconds || 0)),
  usedWatchSeconds: Math.max(0, Number(row.used_watch_seconds || 0)),
  remainingWatchSeconds: Math.max(0, Number(row.allowed_watch_seconds || 0) - Number(row.used_watch_seconds || 0)),
  isEnabled: row.is_enabled !== false,
  preferredVideoQuality: ["auto", "high", "medium", "low"].includes(String(row.preferred_video_quality || "").toLowerCase())
    ? String(row.preferred_video_quality || "auto").toLowerCase()
    : "auto",
  notes: row.notes || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeVideoQualityPreference = (value) => {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (["auto", "high", "medium", "low"].includes(normalized)) return normalized;
  return "auto";
};

const mapStudentOrderLine = (row) => ({
  id: Number(row.id),
  orderId: String(row.order_id || ""),
  studentId: String(row.student_id || ""),
  customerName: String(row.customer_name || ""),
  customerEmail: String(row.customer_email || ""),
  customerPhone: String(row.customer_phone || ""),
  shippingAddressLine1: String(row.shipping_address_line1 || ""),
  shippingAddressLine2: String(row.shipping_address_line2 || ""),
  shippingCity: String(row.shipping_city || ""),
  shippingState: String(row.shipping_state || ""),
  shippingCountry: String(row.shipping_country || ""),
  shippingPincode: String(row.shipping_pincode || ""),
  courseId: String(row.course_id || ""),
  courseTitle: String(row.course_title || ""),
  parentPackageId: String(row.parent_package_id || ""),
  parentPackageTitle: String(row.parent_package_title || ""),
  packageCourseIds: Array.isArray(row.package_course_ids)
    ? row.package_course_ids.map((item) => String(item || "")).filter(Boolean)
    : [],
  orderDate: row.order_date,
  paymentMethod: String(row.payment_method || ""),
  amount: Number(row.amount || 0),
  currency: String(row.currency || "INR"),
  status: String(row.status || "completed"),
  itemType: String(row.item_type || "course"),
  modeLabel: String(row.mode_label || ""),
  bookLabel: String(row.book_label || ""),
  isEbook: row.is_ebook === true,
  dispatchStatus: String(row.dispatch_status || "pending"),
  trackingId: String(row.tracking_id || ""),
  dispatchNote: String(row.dispatch_note || ""),
  dispatchedAt: row.dispatched_at,
  refundNote: String(row.refund_note || ""),
  refundedAt: row.refunded_at,
  refundedBy: String(row.refunded_by || ""),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const groupStudentOrders = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const line = mapStudentOrderLine(row);
    const key = line.orderId || `ORDER-${line.id}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push({
        id: line.id,
        courseId: line.courseId,
        title: line.courseTitle,
        price: line.amount,
        itemType: line.itemType,
        modeLabel: line.modeLabel,
        bookLabel: line.bookLabel,
        isEbook: line.isEbook,
        dispatchStatus: line.dispatchStatus,
        trackingId: line.trackingId,
      });
      existing.total += line.amount;
      existing.updatedAt = existing.updatedAt > line.updatedAt ? existing.updatedAt : line.updatedAt;
      if (line.dispatchStatus !== "delivered") {
        existing.dispatchStatus = line.dispatchStatus;
      }
      if (line.trackingId) {
        existing.trackingId = line.trackingId;
      }
      if (line.dispatchNote) {
        existing.dispatchNote = line.dispatchNote;
      }
      return;
    }

    grouped.set(key, {
      id: key,
      date: line.orderDate || (line.createdAt ? new Date(line.createdAt).toISOString().slice(0, 10) : ""),
      status: line.status,
      dispatchStatus: line.dispatchStatus,
      trackingId: line.trackingId,
      dispatchNote: line.dispatchNote,
      paymentMethod: line.paymentMethod,
      total: line.amount,
      updatedAt: line.updatedAt,
      items: [
        {
          id: line.id,
          courseId: line.courseId,
          title: line.courseTitle,
          price: line.amount,
          itemType: line.itemType,
          modeLabel: line.modeLabel,
          bookLabel: line.bookLabel,
          isEbook: line.isEbook,
          dispatchStatus: line.dispatchStatus,
          trackingId: line.trackingId,
        },
      ],
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const ad = new Date(a.date || a.updatedAt || 0).getTime();
    const bd = new Date(b.date || b.updatedAt || 0).getTime();
    return bd - ad;
  });
};

const mapStudentLoginLog = (row) => ({
  id: Number(row.id),
  studentId: row.student_id,
  ipAddress: row.ip_address || "",
  userAgent: row.user_agent || "",
  source: row.source || "student_login",
  createdAt: row.created_at,
});

const mapStudentVideoActivity = (row) => ({
  id: Number(row.id),
  studentId: row.student_id,
  courseId: row.course_id || "",
  chapterTitle: row.chapter_title || "",
  lessonTitle: row.lesson_title || "",
  progressPercent: Number(row.progress_percent || 0),
  viewedSeconds: Number(row.viewed_seconds || 0),
  lastViewedAt: row.last_viewed_at,
});

const mapStudentNotification = (row) => ({
  id: Number(row.id),
  studentId: row.student_id,
  channel: row.channel,
  subject: row.subject || "",
  message: row.message || "",
  status: row.status || "queued",
  sentBy: row.sent_by || "",
  createdAt: row.created_at,
});

const mapSupportTicket = (row) => ({
  id: Number(row.id),
  ticketCode: row.ticket_code,
  studentId: row.student_id,
  studentName: row.student_name,
  studentEmail: row.student_email,
  courseId: row.course_id,
  courseTitle: row.course_title,
  subject: row.subject,
  issueCategory: row.issue_category,
  priority: row.priority,
  lessonTitle: row.lesson_title || "",
  issueDetails: row.issue_details,
  screenshotUrl: row.screenshot_url || "",
  status: row.status,
  lastReplyAt: row.last_reply_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSupportMessage = (row) => ({
  id: Number(row.id),
  ticketId: Number(row.ticket_id),
  senderRole: row.sender_role,
  senderId: row.sender_id || "",
  senderName: row.sender_name || "",
  message: row.message,
  attachmentUrl: row.attachment_url || "",
  createdAt: row.created_at,
});

const mapStudentSelf = (row) => ({
  studentId: row.id,
  name: row.name,
  email: row.email,
  mobile: row.mobile || "",
  country: row.country || "",
  state: row.state || "",
  city: row.city || "",
  level: row.education_level || "",
  attemptYear: "",
  gender: "",
  pin: "",
  course: "",
});

const normalizeStringList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const normalizeLowerList = (value) => normalizeStringList(value).map((item) => item.toLowerCase());

const LEAD_ALLOWED_STATUSES = ["fresh", "contacted", "follow_up", "qualified", "won", "lost"];
const LEAD_CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "select"];

const sanitizeLeadCustomFieldKey = (value, fallback = "custom_field") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return normalized || fallback;
};

const getDefaultLeadFormSettings = () => ({
  fields: [
    { key: "name", label: "Full Name", type: "text", enabled: true, mandatory: true },
    { key: "address", label: "Address", type: "text", enabled: true, mandatory: true },
    { key: "mobile", label: "Mobile Number", type: "phone", enabled: true, mandatory: true },
    { key: "email", label: "Email Address", type: "email", enabled: true, mandatory: false },
    { key: "message", label: "Message", type: "textarea", enabled: true, mandatory: false },
  ],
  customFields: [],
  stream: {
    enabled: true,
    label: "Interested Stream",
    mandatory: false,
    allowMultiple: true,
    options: ["Science", "Commerce", "Arts"],
  },
});

const normalizeLeadFormSettings = (input) => {
  const fallback = getDefaultLeadFormSettings();
  const source = input && typeof input === "object" ? input : {};
  const sourceFields = Array.isArray(source.fields) ? source.fields : fallback.fields;

  const normalizedFields = sourceFields
    .map((field) => ({
      key: String(field?.key || "").trim().toLowerCase(),
      label: String(field?.label || "").trim(),
      type: String(field?.type || "text").trim().toLowerCase(),
      enabled: field?.enabled !== false,
      mandatory: field?.mandatory === true,
    }))
    .filter((field) => ["name", "address", "mobile", "email", "message"].includes(field.key));

  const ensureRequiredField = (key, fallbackLabel, fallbackType, mandatory = false) => {
    const existing = normalizedFields.find((field) => field.key === key);
    if (existing) {
      existing.enabled = true;
      if (mandatory) existing.mandatory = true;
      if (!existing.label) existing.label = fallbackLabel;
      if (!existing.type) existing.type = fallbackType;
      return;
    }

    normalizedFields.push({
      key,
      label: fallbackLabel,
      type: fallbackType,
      enabled: true,
      mandatory,
    });
  };

  ensureRequiredField("name", "Full Name", "text", true);
  ensureRequiredField("address", "Address", "text", true);
  ensureRequiredField("mobile", "Mobile Number", "phone", true);

  const sourceCustomFields = Array.isArray(source.customFields) ? source.customFields : [];
  const usedCustomKeys = new Set();
  const normalizedCustomFields = sourceCustomFields
    .map((field, index) => {
      const label = String(field?.label || "").trim();
      const type = String(field?.type || "text").trim().toLowerCase();
      const baseKey = sanitizeLeadCustomFieldKey(field?.key || label || `custom_field_${index + 1}`, `custom_field_${index + 1}`);

      let key = baseKey;
      let duplicateCounter = 2;
      while (usedCustomKeys.has(key)) {
        key = `${baseKey}_${duplicateCounter}`;
        duplicateCounter += 1;
      }
      usedCustomKeys.add(key);

      const normalizedType = LEAD_CUSTOM_FIELD_TYPES.includes(type) ? type : "text";
      const options = normalizeStringList(field?.options);

      return {
        key,
        label: label || `Custom Field ${index + 1}`,
        type: normalizedType,
        enabled: field?.enabled !== false,
        mandatory: field?.mandatory === true,
        options: normalizedType === "select" ? options : [],
        placeholder: String(field?.placeholder || "").trim(),
      };
    })
    .slice(0, 20);

  const streamInput = source.stream && typeof source.stream === "object" ? source.stream : fallback.stream;
  const streamOptions = normalizeStringList(streamInput.options || fallback.stream.options);

  return {
    fields: normalizedFields,
    customFields: normalizedCustomFields,
    stream: {
      enabled: streamInput.enabled !== false,
      label: String(streamInput.label || fallback.stream.label).trim() || fallback.stream.label,
      mandatory: streamInput.mandatory === true,
      allowMultiple: streamInput.allowMultiple !== false,
      options: streamOptions.length > 0 ? streamOptions : fallback.stream.options,
    },
  };
};

const mapLeadRow = (row) => ({
  id: Number(row.id),
  source: String(row.source || "enquiry_now"),
  name: String(row.name || ""),
  address: String(row.address || ""),
  mobile: String(row.mobile || ""),
  email: String(row.email || ""),
  streams: Array.isArray(row.streams) ? row.streams.map((item) => String(item || "")).filter(Boolean) : [],
  status: LEAD_ALLOWED_STATUSES.includes(String(row.status || "").toLowerCase())
    ? String(row.status || "fresh").toLowerCase()
    : "fresh",
  enquiryMessage: String(row.enquiry_message || ""),
  extraData: row.extra_data && typeof row.extra_data === "object" ? row.extra_data : {},
  lastFollowUpAt: row.last_follow_up_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapLeadFollowUpRow = (row) => ({
  id: Number(row.id),
  leadId: Number(row.lead_id),
  commentText: String(row.comment_text || ""),
  nextFollowUpAt: row.next_follow_up_at,
  status: String(row.status || "follow_up"),
  createdBy: String(row.created_by || ""),
  createdAt: row.created_at,
});

const normalizeLeadStatus = (value) => {
  const normalized = String(value || "fresh").trim().toLowerCase();
  return LEAD_ALLOWED_STATUSES.includes(normalized) ? normalized : "fresh";
};

const mapMarketingCampaign = (row) => ({
  id: Number(row.id),
  campaignKey: row.campaign_key,
  title: row.title || "",
  message: row.message || "",
  contentType: row.content_type || "text",
  mediaUrl: row.media_url || "",
  ctaText: row.cta_text || "",
  ctaUrl: row.cta_url || "",
  pageScope: row.page_scope || "global",
  pagePaths: normalizeStringList(row.page_paths),
  targetStudentIds: normalizeStringList(row.target_student_ids),
  targetCourseIds: normalizeStringList(row.target_course_ids),
  targetSubjects: normalizeLowerList(row.target_subjects),
  targetLanguages: normalizeLowerList(row.target_languages),
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  showDelaySeconds: Math.max(0, Number(row.show_delay_seconds || 0)),
  repeatAfterCloseMinutes: Math.max(0, Number(row.repeat_after_close_minutes || 0)),
  maxImpressionsPerUser: Math.max(0, Number(row.max_impressions_per_user || 0)),
  isDismissible: row.is_dismissible !== false,
  isEnabled: row.is_enabled !== false,
  createdBy: row.created_by || "",
  updatedBy: row.updated_by || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseMarketingCampaignPayload = (payload = {}, actor = "") => {
  const contentTypeRaw = String(payload.contentType || "text").trim().toLowerCase();
  const contentType = ["text", "banner", "video", "pdf", "alert", "enquiry_form"].includes(contentTypeRaw) ? contentTypeRaw : "text";
  const pageScopeRaw = String(payload.pageScope || "global").trim().toLowerCase();
  const pageScope = pageScopeRaw === "specific" ? "specific" : "global";
  const title = String(payload.title || "").trim();

  if (!title) {
    throw new Error("Campaign title is required");
  }

  return {
    title,
    message: String(payload.message || "").trim(),
    contentType,
    mediaUrl: String(payload.mediaUrl || "").trim(),
    ctaText: String(payload.ctaText || "").trim(),
    ctaUrl: String(payload.ctaUrl || "").trim(),
    pageScope,
    pagePaths: normalizeStringList(payload.pagePaths),
    targetStudentIds: normalizeStringList(payload.targetStudentIds),
    targetCourseIds: normalizeStringList(payload.targetCourseIds),
    targetSubjects: normalizeLowerList(payload.targetSubjects),
    targetLanguages: normalizeLowerList(payload.targetLanguages),
    startsAt: payload.startsAt ? new Date(payload.startsAt).toISOString() : null,
    endsAt: payload.endsAt ? new Date(payload.endsAt).toISOString() : null,
    showDelaySeconds: Math.max(0, Number(payload.showDelaySeconds || 0)),
    repeatAfterCloseMinutes: Math.max(0, Number(payload.repeatAfterCloseMinutes || 0)),
    maxImpressionsPerUser: Math.max(0, Number(payload.maxImpressionsPerUser || 0)),
    isDismissible: payload.isDismissible !== false,
    isEnabled: payload.isEnabled !== false,
    actor,
  };
};

const matchPathPattern = (candidatePath, pattern) => {
  const pathName = String(candidatePath || "").trim();
  const rule = String(pattern || "").trim();
  if (!pathName || !rule) return false;
  if (rule.endsWith("*")) {
    return pathName.startsWith(rule.slice(0, -1));
  }
  return pathName === rule;
};

const decodeBase64File = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return null;
  const base64 = input.includes(",") ? input.split(",")[1] : input;
  return Buffer.from(base64, "base64");
};

const sanitizeFileName = (fileName) =>
  String(fileName || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);

const parseDurationToSeconds = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) return 0;
    return value > 1000 ? Math.floor(value) : Math.floor(value * 60);
  }

  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return 0;

  if (/^\d+$/.test(raw)) {
    const asNum = Number(raw);
    return asNum > 1000 ? asNum : asNum * 60;
  }

  if (raw.includes(":")) {
    const parts = raw.split(":").map((part) => Number(part.trim()));
    if (parts.every((part) => Number.isFinite(part) && part >= 0)) {
      if (parts.length === 3) {
        const [h, m, s] = parts;
        return h * 3600 + m * 60 + s;
      }
      if (parts.length === 2) {
        const [m, s] = parts;
        return m * 60 + s;
      }
    }
  }

  const hoursMatch = raw.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutesMatch = raw.match(/(\d+(?:\.\d+)?)\s*m/);
  const secondsMatch = raw.match(/(\d+(?:\.\d+)?)\s*s/);

  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  const seconds = secondsMatch ? Number(secondsMatch[1]) : 0;

  const total = Math.floor(hours * 3600 + minutes * 60 + seconds);
  if (total > 0) return total;

  const numberMatch = raw.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) {
    return Math.floor(Number(numberMatch[1]) * 60);
  }

  return 0;
};

const getCourseDurationSeconds = async (dbClient, courseId) => {
  const result = await dbClient.query("SELECT chapters FROM course_curricula WHERE course_id = $1", [courseId]);
  const chapters = Array.isArray(result.rows[0]?.chapters) ? result.rows[0].chapters : [];

  return chapters.reduce((courseSeconds, chapter) => {
    const lessons = Array.isArray(chapter?.lessons) ? chapter.lessons : [];
    const chapterSeconds = lessons.reduce((lessonSeconds, lesson) => {
      const durationValue = lesson?.durationSeconds ?? lesson?.duration;
      return lessonSeconds + parseDurationToSeconds(durationValue);
    }, 0);
    return courseSeconds + chapterSeconds;
  }, 0);
};

const ensureAccessWatchBudgetRow = async (dbClient, accessRow) => {
  if (!accessRow) return accessRow;

  const existingDuration = Math.max(0, Number(accessRow.course_duration_seconds || 0));
  const existingAllowed = Math.max(0, Number(accessRow.allowed_watch_seconds || 0));
  const existingUsed = Math.max(0, Number(accessRow.used_watch_seconds || 0));
  const isUnlimitedViews = accessRow.is_unlimited_views === true;
  const totalViews = Math.max(1, Number(accessRow.total_views || 1));

  if (isUnlimitedViews) {
    return accessRow;
  }

  if (existingDuration > 0 && existingAllowed > 0) {
    return accessRow;
  }

  const fromCurriculum = await getCourseDurationSeconds(dbClient, String(accessRow.course_id || ""));
  const inferredDuration = existingAllowed > 0
    ? Math.floor(existingAllowed / Math.max(1, totalViews))
    : 0;
  const safeDuration = Math.max(0, Math.floor(existingDuration || fromCurriculum || inferredDuration || 0));
  const computedAllowed = safeDuration > 0 ? safeDuration * totalViews : existingAllowed;

  if (safeDuration <= 0 && existingAllowed <= 0) {
    console.warn("[access-budget] Unable to compute duration/budget", {
      studentId: accessRow.student_id,
      courseId: accessRow.course_id,
      accessId: accessRow.id,
    });
    return accessRow;
  }

  const nextUsed = Math.min(computedAllowed, existingUsed);

  await dbClient.query(
    `
    UPDATE student_course_access
    SET course_duration_seconds = $3,
        allowed_watch_seconds = $4,
        used_watch_seconds = $5,
        updated_at = NOW()
    WHERE id = $1
      AND student_id = $2
    `,
    [accessRow.id, accessRow.student_id, safeDuration, computedAllowed, nextUsed],
  );

  return {
    ...accessRow,
    course_duration_seconds: safeDuration,
    allowed_watch_seconds: computedAllowed,
    used_watch_seconds: nextUsed,
  };
};

const getPlatformSettings = async () => {
  const result = await pool.query("SELECT data FROM platform_settings WHERE id = 1");
  return (result.rows[0]?.data && typeof result.rows[0].data === "object") ? result.rows[0].data : {};
};

const setPlatformSettings = async (nextData) => {
  await pool.query(
    `
    INSERT INTO platform_settings (id, data, updated_at)
    VALUES (1, $1::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [JSON.stringify(nextData || {})],
  );
};

const sanitizePlatformSettings = (payload) => {
  const data = payload && typeof payload === "object" ? payload : {};
  const bunny = data.bunnyStreamApi && typeof data.bunnyStreamApi === "object" ? data.bunnyStreamApi : {};
  const siteSettings = data.siteSettings && typeof data.siteSettings === "object" ? data.siteSettings : {};
  const homepage = data.homepage && typeof data.homepage === "object" ? data.homepage : {};
  const smtp = data.smtp && typeof data.smtp === "object" ? data.smtp : {};
  const emailAutomation = data.emailAutomation && typeof data.emailAutomation === "object" ? data.emailAutomation : {};
  const templates = emailAutomation.templates && typeof emailAutomation.templates === "object" ? emailAutomation.templates : {};

  const toTemplate = (value, fallbackSubject, fallbackBody) => {
    const row = value && typeof value === "object" ? value : {};
    return {
      enabled: row.enabled !== false,
      subject: String(row.subject || fallbackSubject).trim() || fallbackSubject,
      body: String(row.body || fallbackBody).trim() || fallbackBody,
    };
  };

  const safePort = Math.max(1, Math.min(65535, Number(smtp.port || 587)));
  const smtpSecure = smtp.secure === true || safePort === 465;

  return {
    bunnyStreamApi: {
      enabled: bunny.enabled === true,
      libraryId: String(bunny.libraryId || "").trim(),
      apiKey: String(bunny.apiKey || "").trim(),
      cdnHostname: String(bunny.cdnHostname || "")
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, ""),
      pullZone: String(bunny.pullZone || "").trim(),
    },
    smtp: {
      enabled: smtp.enabled === true,
      host: String(smtp.host || "").trim(),
      port: safePort,
      secure: smtpSecure,
      username: String(smtp.username || "").trim(),
      password: String(smtp.password || "").trim(),
      fromName: String(smtp.fromName || "Ednovate").trim() || "Ednovate",
      fromEmail: String(smtp.fromEmail || "").trim().toLowerCase(),
      replyTo: String(smtp.replyTo || "").trim().toLowerCase(),
    },
    emailAutomation: {
      enabled: emailAutomation.enabled !== false,
      templates: {
        user_purchase: toTemplate(
          templates.user_purchase,
          "Purchase confirmation - {{platformName}}",
          "Hello {{studentName}},\n\nYour purchase {{orderId}} is confirmed.\nItems: {{itemsSummary}}\nAmount: {{amount}}\n\nThanks,\n{{platformName}}",
        ),
        user_login: toTemplate(
          templates.user_login,
          "Login alert - {{platformName}}",
          "Hello {{studentName}},\n\nA new login was detected on {{loginAt}} from IP {{ipAddress}}.\nIf this wasn't you, change password immediately.\n\n{{platformName}}",
        ),
        course_complete: toTemplate(
          templates.course_complete,
          "Course milestone reached - {{platformName}}",
          "Hello {{studentName}},\n\nYou completed: {{lessonTitle}} in course {{courseTitle}}.\nKeep going!\n\n{{platformName}}",
        ),
        user_notification: toTemplate(
          templates.user_notification,
          "Notification from {{platformName}}",
          "Hello {{studentName}},\n\n{{notificationMessage}}\n\n{{platformName}}",
        ),
        password_reset: toTemplate(
          templates.password_reset,
          "Password changed - {{platformName}}",
          "Hello {{studentName}},\n\nYour account password was changed on {{changedAt}}.\nIf this wasn't you, contact support immediately.\n\n{{platformName}}",
        ),
        new_account: toTemplate(
          templates.new_account,
          "Welcome to {{platformName}}",
          "Hello {{studentName}},\n\nYour new account is ready.\nStart learning now.\n\n{{platformName}}",
        ),
      },
    },
    siteSettings,
    homepage: {
      exploreCategoryIds: Array.isArray(homepage.exploreCategoryIds)
        ? homepage.exploreCategoryIds.map((item) => String(item).trim()).filter(Boolean)
        : [],
    },
  };
};

const fillTemplate = (value, variables) => {
  const source = String(value || "");
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const next = variables?.[key];
    return next === undefined || next === null ? "" : String(next);
  });
};

const buildEmailFromField = (name, email) => {
  const safeEmail = String(email || "").trim();
  const safeName = String(name || "").trim();
  if (!safeEmail) return "";
  if (!safeName) return safeEmail;
  return `${safeName} <${safeEmail}>`;
};

const sendAutomatedMail = async ({ eventKey, toEmail, variables = {}, fallbackSubject = "Notification" }) => {
  const settings = sanitizePlatformSettings(await getPlatformSettings());
  const smtp = settings.smtp;
  if (!smtp.enabled || !smtp.host || !smtp.username || !smtp.password || !toEmail) {
    return { sent: false, reason: "SMTP not configured" };
  }

  if (settings.emailAutomation.enabled === false) {
    return { sent: false, reason: "Email automation disabled" };
  }

  const template = settings.emailAutomation?.templates?.[eventKey];
  if (!template || template.enabled === false) {
    return { sent: false, reason: `Template disabled: ${eventKey}` };
  }

  const platformName = String(settings.siteSettings?.platformName || "Ednovate");
  const mergedVars = {
    platformName,
    ...variables,
  };

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure === true,
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  await transporter.sendMail({
    from: buildEmailFromField(smtp.fromName || platformName, smtp.fromEmail || smtp.username),
    to: String(toEmail).trim().toLowerCase(),
    replyTo: smtp.replyTo || undefined,
    subject: fillTemplate(template.subject || fallbackSubject, mergedVars),
    text: fillTemplate(template.body || "", mergedVars),
  });

  return { sent: true };
};

const sendSmtpMail = async ({ toEmail, subject, text, html }) => {
  const settings = sanitizePlatformSettings(await getPlatformSettings());
  const smtp = settings.smtp;
  if (!smtp.enabled || !smtp.host || !smtp.username || !smtp.password || !toEmail) {
    return { sent: false, reason: "SMTP not configured" };
  }

  const platformName = String(settings.siteSettings?.platformName || "Ednovate");
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure === true,
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  await transporter.sendMail({
    from: buildEmailFromField(smtp.fromName || platformName, smtp.fromEmail || smtp.username),
    to: String(toEmail).trim().toLowerCase(),
    replyTo: smtp.replyTo || undefined,
    subject: String(subject || "Invoice"),
    text: String(text || ""),
    html: String(html || ""),
  });

  return { sent: true };
};

const formatMoneyInr = (value) => {
  const amount = Math.max(0, Number(value || 0));
  return `INR ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const buildInvoiceDocument = ({ orderId, studentName, studentEmail, orderDate, paymentMethod, currency, items, platformName, logoUrl }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const rowsHtml = safeItems.map((item, index) => {
    const details = [
      item.itemType ? `Type: ${item.itemType}` : "",
      item.modeLabel ? `Mode: ${item.modeLabel}` : "",
      item.bookLabel ? `Book: ${item.bookLabel}` : "",
    ].filter(Boolean).join(" | ");

    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${String(item.courseTitle || "Course")}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#4b5563;">${details || "-"}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoneyInr(item.amount)}</td>
      </tr>
    `;
  }).join("");

  const headerLogoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${platformName}" style="height:36px;object-fit:contain;" />`
    : `<div style="font-weight:800;font-size:18px;letter-spacing:.08em;color:#1f3c88;">${platformName}</div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:780px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>${headerLogoHtml}</div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#6b7280;">TAX INVOICE</div>
            <div style="font-size:14px;font-weight:700;color:#111827;">Order ${String(orderId || "")}</div>
          </div>
        </div>
        <div style="padding:18px 20px;display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;color:#374151;">
          <div>
            <div style="font-size:11px;color:#6b7280;">BILLED TO</div>
            <div style="font-weight:700;color:#111827;">${String(studentName || "Student")}</div>
            <div>${String(studentEmail || "")}</div>
          </div>
          <div style="text-align:right;">
            <div><span style="color:#6b7280;">Date:</span> ${String(orderDate || "")}</div>
            <div><span style="color:#6b7280;">Payment:</span> ${String(paymentMethod || "Online")}</div>
            <div><span style="color:#6b7280;">Currency:</span> ${String(currency || "INR")}</div>
          </div>
        </div>
        <div style="padding:0 20px 20px 20px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;color:#334155;text-align:left;">
                <th style="padding:10px;">#</th>
                <th style="padding:10px;">Item</th>
                <th style="padding:10px;">Details</th>
                <th style="padding:10px;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="margin-top:16px;text-align:right;">
            <div style="font-size:12px;color:#6b7280;">Total Payable</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;">${formatMoneyInr(total)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    `${platformName} Invoice`,
    `Order: ${String(orderId || "")}`,
    `Student: ${String(studentName || "Student")}`,
    `Email: ${String(studentEmail || "")}`,
    `Date: ${String(orderDate || "")}`,
    `Payment: ${String(paymentMethod || "Online")}`,
    "",
    ...safeItems.map((item, index) => `${index + 1}. ${String(item.courseTitle || "Course")} - ${formatMoneyInr(item.amount)}`),
    "",
    `Total: ${formatMoneyInr(total)}`,
  ].join("\n");

  return { html, text, total };
};

const toBase64Url = (buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const buildBunnyToken = (securityKey, urlPath, expires) => {
  const payload = `${securityKey}${urlPath}${expires}`;
  const hash = createHash("sha256").update(payload).digest();
  return toBase64Url(hash);
};

const ADMIN_MODULES = [
  "dashboard",
  "courses",
  "course-content",
  "categories",
  "coupons",
  "faculty",
  "homepage",
  "users",
  "orders",
  "leads",
  "announcements",
  "technical-support",
  "marketing",
  "settings",
  "subadmins",
  "logs",
];

const defaultModulePermission = {
  read: false,
  create: false,
  edit: false,
  delete: false,
};

const fullPermissions = () =>
  Object.fromEntries(ADMIN_MODULES.map((module) => [
    module,
    { read: true, create: true, edit: true, delete: true },
  ]));

const normalizePermissions = (permissions) => {
  const base = fullPermissions();
  if (!permissions || typeof permissions !== "object") return base;

  ADMIN_MODULES.forEach((module) => {
    const incoming = permissions[module] || defaultModulePermission;
    base[module] = {
      read: Boolean(incoming.read),
      create: Boolean(incoming.create),
      edit: Boolean(incoming.edit),
      delete: Boolean(incoming.delete),
    };
  });

  return base;
};

const mapAdminAccount = (row) => {
  const isSuperAdmin = row.role === "super_admin";
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active !== false,
    isSuperAdmin,
    permissions: isSuperAdmin ? fullPermissions() : normalizePermissions(row.permissions),
    lastLoginAt: row.last_login_at || null,
    lastLoginIp: row.last_login_ip || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by || "",
  };
};

const getIpAddress = (request) => {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.ip || "";
};

const hashPassword = (value) => createHash("sha256").update(String(value || "")).digest("hex");

const isSha256Hash = (value) => /^[a-f0-9]{64}$/i.test(String(value || ""));

const verifyPassword = (inputPassword, storedPassword) => {
  const incoming = String(inputPassword || "");
  const stored = String(storedPassword || "");
  if (!stored) return false;
  if (isSha256Hash(stored)) {
    return hashPassword(incoming) === stored;
  }
  // Backward compatibility for legacy plaintext rows; will be migrated on successful login.
  return incoming === stored;
};

const buildForcedLogoutMessage = (replacedIp, replacedAt) => {
  const ipText = replacedIp ? ` IP: ${replacedIp}.` : "";
  const atText = replacedAt ? ` Time: ${new Date(replacedAt).toLocaleString("en-IN")}.` : "";
  return `This account was logged in from another place.${ipText}${atText}`;
};

const buildActiveSessionPrompt = (activeIp, activeAt) => {
  const ipText = activeIp ? ` IP: ${activeIp}.` : "";
  const atText = activeAt ? ` Time: ${new Date(activeAt).toLocaleString("en-IN")}.` : "";
  return `This account is already logged in from another place.${ipText}${atText} Do you want to login here?`;
};

const extractAdminToken = (request) => {
  const authHeader = String(request.headers.authorization || "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
};

const writeAdminAuditLog = async ({
  adminId,
  adminEmail,
  action,
  moduleKey,
  targetType,
  targetId,
  ipAddress,
  userAgent,
  details,
}) => {
  await pool.query(
    `
    INSERT INTO admin_audit_logs
    (admin_id, admin_email, action, module_key, target_type, target_id, ip_address, user_agent, details)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    `,
    [
      adminId || null,
      adminEmail || null,
      action,
      moduleKey,
      targetType || null,
      targetId || null,
      ipAddress || null,
      userAgent || null,
      JSON.stringify(details || {}),
    ],
  );
};

const requireAdminPermission = (moduleKey, action = "read") => {
  return async (request, response, next) => {
    try {
      const token = extractAdminToken(request);
      if (!token) {
        response.status(401).json({ message: "Admin authorization required" });
        return;
      }

      const result = await pool.query(
        `
        SELECT s.token, s.expires_at, s.is_active, s.revoked_reason, s.revoked_at, s.replaced_by_token, s.login_ip,
               r.login_ip AS replaced_login_ip, r.created_at AS replaced_login_at,
               a.*
        FROM admin_sessions s
        JOIN admin_accounts a ON a.id = s.admin_id
        LEFT JOIN admin_sessions r ON r.token = s.replaced_by_token
        WHERE s.token = $1
        `,
        [token],
      );

      const row = result.rows[0];
      if (!row) {
        response.status(401).json({ message: "Invalid admin session" });
        return;
      }

      if (row.is_active === false) {
        const message = row.revoked_reason === "logged_in_elsewhere"
          ? buildForcedLogoutMessage(row.replaced_login_ip || row.login_ip, row.replaced_login_at || row.revoked_at)
          : "Admin session is no longer active";
        response.status(401).json({ message, reason: row.revoked_reason || "session_revoked", forcedLogout: true });
        return;
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        await pool.query(
          `
          UPDATE admin_sessions
          SET is_active = FALSE,
              revoked_reason = 'session_expired',
              revoked_at = NOW()
          WHERE token = $1
          `,
          [token],
        );
        response.status(401).json({ message: "Admin session expired" });
        return;
      }

      if (row.is_active === false) {
        response.status(403).json({ message: "Admin account is disabled" });
        return;
      }

      const admin = mapAdminAccount(row);
      const allowed = admin.isSuperAdmin || Boolean(admin.permissions?.[moduleKey]?.[action]);

      if (!allowed) {
        response.status(403).json({ message: `Permission denied for ${moduleKey}:${action}` });
        return;
      }

      request.adminSession = {
        token,
        admin,
      };

      next();
    } catch (error) {
      response.status(500).json({ message: error instanceof Error ? error.message : "Authorization failed" });
    }
  };
};

const requireStudentSession = async (request, response, next) => {
  try {
    const token = extractAdminToken(request);
    if (!token) {
      response.status(401).json({ message: "Student authorization required" });
      return;
    }

    const sessionResult = await pool.query(
      `
      SELECT s.token, s.expires_at, s.is_active, s.revoked_reason, s.revoked_at, s.replaced_by_token, s.login_ip,
             r.login_ip AS replaced_login_ip, r.created_at AS replaced_login_at,
             st.*
      FROM auth_sessions s
      JOIN students st ON st.id = s.student_id
      LEFT JOIN auth_sessions r ON r.token = s.replaced_by_token
      WHERE s.token = $1
      `,
      [token],
    );

    const row = sessionResult.rows[0];
    if (!row) {
      response.status(401).json({ message: "Invalid student session" });
      return;
    }

    if (row.is_active === false) {
      const message = row.revoked_reason === "logged_in_elsewhere"
        ? buildForcedLogoutMessage(row.replaced_login_ip || row.login_ip, row.replaced_login_at || row.revoked_at)
        : "Student session is no longer active";
      response.status(401).json({ message, reason: row.revoked_reason || "session_revoked", forcedLogout: true });
      return;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await pool.query(
        `
        UPDATE auth_sessions
        SET is_active = FALSE,
            revoked_reason = 'session_expired',
            revoked_at = NOW()
        WHERE token = $1
        `,
        [token],
      );
      response.status(401).json({ message: "Student session expired" });
      return;
    }

    if (row.status === "Inactive") {
      response.status(403).json({ message: "Student account is inactive" });
      return;
    }

    request.studentSession = {
      token,
      student: mapStudentSelf(row),
      studentId: row.id,
    };

    next();
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Student auth failed" });
  }
};

const resolveStudentSessionFromRequest = async (request) => {
  const token = extractAdminToken(request);
  if (!token) return null;

  const sessionResult = await pool.query(
    `
    SELECT s.token, s.expires_at, st.*
    FROM auth_sessions s
    JOIN students st ON st.id = s.student_id
    WHERE s.token = $1
    `,
    [token],
  );

  const row = sessionResult.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.status === "Inactive") return null;

  return {
    token,
    studentId: String(row.id),
    student: mapStudentSelf(row),
  };
};

const getModuleFromPath = (pathName) => {
  if (pathName.startsWith("/api/students") || pathName.startsWith("/api/admin/quick-login")) return "users";
  if (pathName.startsWith("/api/auth/student/support") || pathName.startsWith("/api/admin/technical-support")) return "technical-support";
  if (pathName.startsWith("/api/admin/lead-form-settings")) return "leads";
  if (pathName.startsWith("/api/admin/leads")) return "leads";
  if (pathName.startsWith("/api/admin/marketing")) return "marketing";
  if (pathName.startsWith("/api/admin/faculty")) return "faculty";
  if (pathName.startsWith("/api/courses/")) return "courses";
  if (pathName === "/api/courses/upsert") return "courses";
  if (pathName.startsWith("/api/homepage")) return "homepage";
  if (pathName.startsWith("/api/uploads") || pathName.startsWith("/api/bunny")) return "course-content";
  if (pathName.startsWith("/api/admin/activity-logs")) return "logs";
  if (pathName.startsWith("/api/admin/subadmins") || pathName.startsWith("/api/admin/audit-logs")) return "subadmins";
  return "dashboard";
};

const sanitizeAuditBody = (body) => {
  if (!body || typeof body !== "object") return {};
  const clone = { ...body };
  ["password", "password_hash", "apiKey", "bunnyStreamApiKey"].forEach((key) => {
    if (key in clone) clone[key] = "[REDACTED]";
  });
  return clone;
};

app.use((request, response, next) => {
  response.on("finish", async () => {
    try {
      const method = String(request.method || "GET").toUpperCase();
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
      if (!request.adminSession?.admin) return;
      if (response.statusCode >= 500) return;

      await writeAdminAuditLog({
        adminId: request.adminSession.admin.id,
        adminEmail: request.adminSession.admin.email,
        action: method.toLowerCase(),
        moduleKey: getModuleFromPath(request.path),
        targetType: "api",
        targetId: request.path,
        ipAddress: getIpAddress(request),
        userAgent: String(request.headers["user-agent"] || ""),
        details: {
          statusCode: response.statusCode,
          method,
          path: request.path,
          query: request.query || {},
          body: sanitizeAuditBody(request.body),
        },
      });
    } catch {
      // Never block API response due to audit issues.
    }
  });

  next();
});

app.post("/api/admin/login", async (request, response) => {
  try {
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const forceLogin = request.body?.forceLogin === true;

    if (!email || !password) {
      response.status(400).json({ message: "email and password are required" });
      return;
    }

    const result = await pool.query("SELECT * FROM admin_accounts WHERE LOWER(email) = $1", [email]);
    const account = result.rows[0];

    if (!account) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (account.is_active === false) {
      response.status(403).json({ message: "Account is disabled" });
      return;
    }

    const incomingHash = hashPassword(password);
    if (incomingHash !== account.password_hash) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const activeSessionResult = await pool.query(
      `
      SELECT token, login_ip, created_at
      FROM admin_sessions
      WHERE admin_id = $1 AND is_active = TRUE AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [account.id],
    );
    const activeSession = activeSessionResult.rows[0];
    if (activeSession && !forceLogin) {
      response.status(409).json({
        message: buildActiveSessionPrompt(activeSession.login_ip, activeSession.created_at),
        requiresConfirmation: true,
        reason: "active_session_exists",
        activeSession: {
          ipAddress: activeSession.login_ip || null,
          loginAt: activeSession.created_at || null,
        },
      });
      return;
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const ipAddress = getIpAddress(request);
    const userAgent = String(request.headers["user-agent"] || "");

    await pool.query(
      `
      UPDATE admin_sessions
      SET is_active = FALSE,
          revoked_reason = 'logged_in_elsewhere',
          revoked_at = NOW(),
          replaced_by_token = $2
      WHERE admin_id = $1 AND is_active = TRUE
      `,
      [account.id, token],
    );
    await pool.query(
      "INSERT INTO admin_sessions (token, admin_id, role, expires_at, is_active, login_ip, login_user_agent) VALUES ($1, $2, $3, $4, TRUE, $5, $6)",
      [token, account.id, account.role, expiresAt, ipAddress, userAgent],
    );

    await pool.query(
      "UPDATE admin_accounts SET last_login_at = NOW(), last_login_ip = $2, updated_at = NOW() WHERE id = $1",
      [account.id, ipAddress],
    );

    const admin = mapAdminAccount({
      ...account,
      last_login_at: new Date().toISOString(),
      last_login_ip: ipAddress,
    });

    await writeAdminAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "login",
      moduleKey: "dashboard",
      targetType: "admin_account",
      targetId: admin.id,
      ipAddress,
      userAgent: String(request.headers["user-agent"] || ""),
      details: { success: true },
    });

    response.json({ token, user: admin });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Admin login failed" });
  }
});

app.use((error, _request, response, next) => {
  if (error?.type === "entity.too.large") {
    response.status(413).json({
      message: `Upload too large. Max payload is ${bodyLimit}.`,
    });
    return;
  }
  next(error);
});

app.get("/api/admin/subadmins", requireAdminPermission("subadmins", "read"), async (_request, response) => {
  try {
    const result = await pool.query("SELECT * FROM admin_accounts ORDER BY created_at DESC");
    response.json({ items: result.rows.map(mapAdminAccount) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load sub-admins" });
  }
});

app.post("/api/admin/subadmins", requireAdminPermission("subadmins", "create"), async (request, response) => {
  try {
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const role = String(request.body?.role || "sub_admin").trim() || "sub_admin";
    const isActive = request.body?.isActive !== false;
    const permissions = normalizePermissions(request.body?.permissions || {});

    if (!name || !email || !password) {
      response.status(400).json({ message: "name, email and password are required" });
      return;
    }

    const id = `subadmin-${Date.now()}`;
    const passwordHash = hashPassword(password);
    const createdBy = request.adminSession?.admin?.email || "system";

    await pool.query(
      `
      INSERT INTO admin_accounts
      (id, name, email, password_hash, role, is_active, permissions, created_by, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,NOW())
      `,
      [id, name, email, passwordHash, role, isActive, JSON.stringify(permissions), createdBy],
    );

    const result = await pool.query("SELECT * FROM admin_accounts WHERE id = $1", [id]);
    const item = mapAdminAccount(result.rows[0]);

    await writeAdminAuditLog({
      adminId: request.adminSession?.admin?.id,
      adminEmail: request.adminSession?.admin?.email,
      action: "create",
      moduleKey: "subadmins",
      targetType: "admin_account",
      targetId: id,
      ipAddress: getIpAddress(request),
      userAgent: String(request.headers["user-agent"] || ""),
      details: { email, role, isActive },
    });

    response.json({ item });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to create sub-admin" });
  }
});

app.put("/api/admin/subadmins/:id", requireAdminPermission("subadmins", "edit"), async (request, response) => {
  try {
    const id = String(request.params.id || "").trim();
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const role = String(request.body?.role || "sub_admin").trim() || "sub_admin";
    const isActive = request.body?.isActive !== false;
    const permissions = normalizePermissions(request.body?.permissions || {});
    const password = String(request.body?.password || "");

    if (!id || !name || !email) {
      response.status(400).json({ message: "id, name and email are required" });
      return;
    }

    const existingResult = await pool.query("SELECT * FROM admin_accounts WHERE id = $1", [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      response.status(404).json({ message: "Sub-admin not found" });
      return;
    }

    if (existing.role === "super_admin" && request.adminSession?.admin?.role !== "super_admin") {
      response.status(403).json({ message: "Only super admin can edit super admin account" });
      return;
    }

    const passwordHash = password ? hashPassword(password) : existing.password_hash;

    await pool.query(
      `
      UPDATE admin_accounts
      SET name = $2,
          email = $3,
          role = $4,
          is_active = $5,
          permissions = $6::jsonb,
          password_hash = $7,
          updated_at = NOW()
      WHERE id = $1
      `,
      [id, name, email, role, isActive, JSON.stringify(permissions), passwordHash],
    );

    const result = await pool.query("SELECT * FROM admin_accounts WHERE id = $1", [id]);
    const item = mapAdminAccount(result.rows[0]);

    await writeAdminAuditLog({
      adminId: request.adminSession?.admin?.id,
      adminEmail: request.adminSession?.admin?.email,
      action: "edit",
      moduleKey: "subadmins",
      targetType: "admin_account",
      targetId: id,
      ipAddress: getIpAddress(request),
      userAgent: String(request.headers["user-agent"] || ""),
      details: { email, role, isActive, passwordChanged: Boolean(password) },
    });

    response.json({ item });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update sub-admin" });
  }
});

app.delete("/api/admin/subadmins/:id", requireAdminPermission("subadmins", "delete"), async (request, response) => {
  try {
    const id = String(request.params.id || "").trim();
    if (!id) {
      response.status(400).json({ message: "id is required" });
      return;
    }

    const existingResult = await pool.query("SELECT * FROM admin_accounts WHERE id = $1", [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      response.status(404).json({ message: "Sub-admin not found" });
      return;
    }

    if (existing.role === "super_admin") {
      response.status(403).json({ message: "Super admin account cannot be deleted" });
      return;
    }

    await pool.query("DELETE FROM admin_sessions WHERE admin_id = $1", [id]);
    await pool.query("DELETE FROM admin_accounts WHERE id = $1", [id]);

    await writeAdminAuditLog({
      adminId: request.adminSession?.admin?.id,
      adminEmail: request.adminSession?.admin?.email,
      action: "delete",
      moduleKey: "subadmins",
      targetType: "admin_account",
      targetId: id,
      ipAddress: getIpAddress(request),
      userAgent: String(request.headers["user-agent"] || ""),
      details: { email: existing.email },
    });

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete sub-admin" });
  }
});

app.get("/api/admin/audit-logs", requireAdminPermission("subadmins", "read"), async (request, response) => {
  try {
    const limit = Math.max(10, Math.min(500, Number(request.query.limit || 100)));
    const result = await pool.query(
      `
      SELECT *
      FROM admin_audit_logs
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit],
    );

    response.json({ items: result.rows });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load audit logs" });
  }
});

app.get("/api/admin/activity-logs", requireAdminPermission("logs", "read"), async (request, response) => {
  try {
    const limit = Math.max(20, Math.min(2000, Number(request.query.limit || 300)));
    const actorType = String(request.query.actorType || "all").trim().toLowerCase();
    const actionType = String(request.query.actionType || "all").trim().toLowerCase();
    const actorId = String(request.query.actorId || "").trim();
    const actorName = String(request.query.actorName || "").trim().toLowerCase();
    const actorEmail = String(request.query.actorEmail || "").trim().toLowerCase();
    const search = String(request.query.search || "").trim().toLowerCase();
    const fromRaw = String(request.query.from || "").trim();
    const toRaw = String(request.query.to || "").trim();

    const whereParts = [];
    const params = [];
    let index = 1;

    if (fromRaw) {
      const parsed = new Date(fromRaw);
      if (!Number.isNaN(parsed.getTime())) {
        whereParts.push(`created_at >= $${index}`);
        params.push(parsed.toISOString());
        index += 1;
      }
    }

    if (toRaw) {
      const parsed = new Date(toRaw);
      if (!Number.isNaN(parsed.getTime())) {
        whereParts.push(`created_at <= $${index}`);
        params.push(parsed.toISOString());
        index += 1;
      }
    }

    if (actorType === "admin") {
      whereParts.push("actor_role = 'super_admin'");
    } else if (actorType === "subadmin") {
      whereParts.push("actor_role = 'sub_admin'");
    } else if (actorType === "student") {
      whereParts.push("actor_role = 'student'");
    }

    if (actionType !== "all") {
      whereParts.push(`LOWER(action) = $${index}`);
      params.push(actionType);
      index += 1;
    }

    if (actorId) {
      whereParts.push(`LOWER(COALESCE(actor_id, '')) LIKE $${index}`);
      params.push(`%${actorId.toLowerCase()}%`);
      index += 1;
    }

    if (actorName) {
      whereParts.push(`LOWER(COALESCE(actor_name, '')) LIKE $${index}`);
      params.push(`%${actorName}%`);
      index += 1;
    }

    if (actorEmail) {
      whereParts.push(`LOWER(COALESCE(actor_email, '')) LIKE $${index}`);
      params.push(`%${actorEmail}%`);
      index += 1;
    }

    if (search) {
      whereParts.push(`(
        LOWER(COALESCE(actor_name, '')) LIKE $${index}
        OR LOWER(COALESCE(actor_email, '')) LIKE $${index}
        OR LOWER(COALESCE(actor_id, '')) LIKE $${index}
        OR LOWER(COALESCE(target_id, '')) LIKE $${index}
        OR LOWER(COALESCE(course_title, '')) LIKE $${index}
        OR LOWER(COALESCE(module_key, '')) LIKE $${index}
        OR LOWER(COALESCE(action, '')) LIKE $${index}
      )`);
      params.push(`%${search}%`);
      index += 1;
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    params.push(limit);
    const listResult = await pool.query(
      `
      WITH events AS (
        SELECT
          'admin'::text AS actor_type,
          COALESCE(a.id, l.admin_id, '') AS actor_id,
          COALESCE(a.name, l.admin_email, 'System') AS actor_name,
          COALESCE(l.admin_email, a.email, '') AS actor_email,
          COALESCE(a.role, 'super_admin') AS actor_role,
          LOWER(COALESCE(l.action, '')) AS action,
          l.module_key,
          l.target_type,
          l.target_id,
          l.ip_address,
          l.user_agent,
          l.details,
          l.created_at,
          NULL::text AS course_id,
          NULL::text AS course_title,
          NULL::numeric AS amount
        FROM admin_audit_logs l
        LEFT JOIN admin_accounts a ON a.id = l.admin_id

        UNION ALL

        SELECT
          'student'::text AS actor_type,
          s.id AS actor_id,
          s.name AS actor_name,
          s.email AS actor_email,
          'student'::text AS actor_role,
          'login'::text AS action,
          'auth'::text AS module_key,
          'student_session'::text AS target_type,
          sl.id::text AS target_id,
          sl.ip_address,
          sl.user_agent,
          jsonb_build_object('source', COALESCE(sl.source, 'student_login')) AS details,
          sl.created_at,
          NULL::text AS course_id,
          NULL::text AS course_title,
          NULL::numeric AS amount
        FROM student_login_logs sl
        JOIN students s ON s.id = sl.student_id

        UNION ALL

        SELECT
          'student'::text AS actor_type,
          s.id AS actor_id,
          s.name AS actor_name,
          s.email AS actor_email,
          'student'::text AS actor_role,
          'purchase'::text AS action,
          'orders'::text AS module_key,
          'order'::text AS target_type,
          COALESCE(o.order_id, o.id::text) AS target_id,
          NULL::text AS ip_address,
          NULL::text AS user_agent,
          jsonb_build_object(
            'itemType', COALESCE(o.item_type, 'course'),
            'paymentMethod', COALESCE(o.payment_method, ''),
            'dispatchStatus', COALESCE(o.dispatch_status, 'pending')
          ) AS details,
          o.created_at,
          o.course_id,
          o.course_title,
          o.amount
        FROM student_orders o
        JOIN students s ON s.id = o.student_id

        UNION ALL

        SELECT
          'student'::text AS actor_type,
          s.id AS actor_id,
          s.name AS actor_name,
          s.email AS actor_email,
          'student'::text AS actor_role,
          'video_watch'::text AS action,
          'course-content'::text AS module_key,
          'lesson'::text AS target_type,
          v.id::text AS target_id,
          NULL::text AS ip_address,
          NULL::text AS user_agent,
          jsonb_build_object(
            'chapterTitle', COALESCE(v.chapter_title, ''),
            'lessonTitle', COALESCE(v.lesson_title, ''),
            'progressPercent', COALESCE(v.progress_percent, 0),
            'viewedSeconds', COALESCE(v.viewed_seconds, 0)
          ) AS details,
          v.last_viewed_at AS created_at,
          v.course_id,
          COALESCE(v.lesson_title, '') AS course_title,
          NULL::numeric AS amount
        FROM student_video_activity v
        JOIN students s ON s.id = v.student_id
      )
      SELECT *
      FROM events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${index}
      `,
      params,
    );

    response.json({ items: listResult.rows });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load activity logs" });
  }
});

app.post("/api/auth/student/signup", async (request, response) => {
  try {
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const mobile = String(request.body?.mobile || "").trim();
    const password = String(request.body?.password || "").trim();
    const city = String(request.body?.city || "").trim();
    const state = String(request.body?.state || "").trim();
    const country = String(request.body?.country || "").trim();
    const educationLevel = String(request.body?.level || "").trim();

    if (!name || !email || !password) {
      response.status(400).json({ message: "name, email and password are required" });
      return;
    }

    const existingResult = await pool.query(
      "SELECT id FROM students WHERE LOWER(email) = $1 OR mobile = $2 LIMIT 1",
      [email, mobile || null],
    );
    if (existingResult.rowCount > 0) {
      response.status(409).json({ message: "Account already exists. Please login." });
      return;
    }

    const id = `std-${Date.now()}`;
    const passwordHash = hashPassword(password);

    await pool.query(
      `
      INSERT INTO students
      (id, name, email, mobile, city, state, country, status, education_level, password, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Active',$8,$9,NOW())
      `,
      [id, name, email, mobile || null, city || null, state || null, country || null, educationLevel || null, passwordHash],
    );

    void sendAutomatedMail({
      eventKey: "new_account",
      toEmail: email,
      variables: {
        studentName: name || "Student",
      },
      fallbackSubject: "Welcome to Ednovate",
    }).catch(() => {});

    response.json({ ok: true, message: "Signup successful. Please login." });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Signup failed" });
  }
});

app.post("/api/auth/student/login", async (request, response) => {
  try {
    const identifier = String(request.body?.identifier || request.body?.emailOrMobile || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const forceLogin = request.body?.forceLogin === true;
    if (!identifier || !password) {
      response.status(400).json({ message: "identifier and password are required" });
      return;
    }

    const result = await pool.query(
      `
      SELECT *
      FROM students
      WHERE LOWER(email) = $1 OR mobile = $2
      LIMIT 1
      `,
      [identifier, identifier.replace(/\D/g, "").slice(-10)],
    );
    const student = result.rows[0];

    if (!student || !verifyPassword(password, student.password)) {
      response.status(401).json({ message: "Invalid email/mobile or password." });
      return;
    }

    if (!isSha256Hash(student.password)) {
      await pool.query("UPDATE students SET password = $2, updated_at = NOW() WHERE id = $1", [
        student.id,
        hashPassword(password),
      ]);
    }

    if (student.status === "Inactive") {
      response.status(403).json({ message: "Student account is inactive" });
      return;
    }

    const activeSessionResult = await pool.query(
      `
      SELECT token, login_ip, created_at
      FROM auth_sessions
      WHERE student_id = $1 AND is_active = TRUE AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [student.id],
    );
    const activeSession = activeSessionResult.rows[0];
    if (activeSession && !forceLogin) {
      response.status(409).json({
        message: buildActiveSessionPrompt(activeSession.login_ip, activeSession.created_at),
        requiresConfirmation: true,
        reason: "active_session_exists",
        activeSession: {
          ipAddress: activeSession.login_ip || null,
          loginAt: activeSession.created_at || null,
        },
      });
      return;
    }

    const token = randomUUID();
    const ipAddress = getIpAddress(request);
    const userAgent = String(request.headers["user-agent"] || "");

    await pool.query(
      `
      UPDATE auth_sessions
      SET is_active = FALSE,
          revoked_reason = 'logged_in_elsewhere',
          revoked_at = NOW(),
          replaced_by_token = $2
      WHERE student_id = $1 AND is_active = TRUE
      `,
      [student.id, token],
    );
    await pool.query(
      "INSERT INTO auth_sessions (token, student_id, role, expires_at, is_active, login_ip, login_user_agent) VALUES ($1,$2,'student',$3,TRUE,$4,$5)",
      [token, student.id, new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), ipAddress, userAgent],
    );

    await pool.query(
      "UPDATE students SET updated_at = NOW() WHERE id = $1",
      [student.id],
    );

    await pool.query(
      "INSERT INTO student_login_logs (student_id, ip_address, user_agent, source) VALUES ($1,$2,$3,$4)",
      [student.id, ipAddress, userAgent, "student_password_login"],
    );

    void sendAutomatedMail({
      eventKey: "user_login",
      toEmail: student.email,
      variables: {
        studentName: student.name || "Student",
        loginAt: new Date().toLocaleString("en-IN"),
        ipAddress,
      },
      fallbackSubject: "Login alert",
    }).catch(() => {});

    response.json({
      token,
      user: mapStudentSelf(student),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Login failed" });
  }
});

app.get("/api/admin/session-status", async (request, response) => {
  try {
    const token = extractAdminToken(request);
    if (!token) {
      response.status(401).json({ active: false, message: "Missing admin token", reason: "missing_token" });
      return;
    }

    const result = await pool.query(
      `
      SELECT s.token, s.expires_at, s.is_active, s.revoked_reason, s.revoked_at, s.login_ip,
             r.login_ip AS replaced_login_ip, r.created_at AS replaced_login_at
      FROM admin_sessions s
      LEFT JOIN admin_sessions r ON r.token = s.replaced_by_token
      WHERE s.token = $1
      LIMIT 1
      `,
      [token],
    );

    const row = result.rows[0];
    if (!row) {
      response.status(401).json({ active: false, message: "Admin session not found", reason: "session_not_found" });
      return;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      response.status(401).json({ active: false, message: "Admin session expired", reason: "session_expired" });
      return;
    }

    if (row.is_active === false) {
      const message = row.revoked_reason === "logged_in_elsewhere"
        ? buildForcedLogoutMessage(row.replaced_login_ip || row.login_ip, row.replaced_login_at || row.revoked_at)
        : "Admin session revoked";
      response.status(401).json({ active: false, message, reason: row.revoked_reason || "session_revoked", forcedLogout: true });
      return;
    }

    response.json({ active: true });
  } catch (error) {
    response.status(500).json({ active: false, message: error instanceof Error ? error.message : "Failed to validate admin session" });
  }
});

app.get("/api/auth/student/session-status", async (request, response) => {
  try {
    const token = extractAdminToken(request);
    if (!token) {
      response.status(401).json({ active: false, message: "Missing student token", reason: "missing_token" });
      return;
    }

    const result = await pool.query(
      `
      SELECT s.token, s.expires_at, s.is_active, s.revoked_reason, s.revoked_at, s.login_ip,
             r.login_ip AS replaced_login_ip, r.created_at AS replaced_login_at
      FROM auth_sessions s
      LEFT JOIN auth_sessions r ON r.token = s.replaced_by_token
      WHERE s.token = $1
      LIMIT 1
      `,
      [token],
    );

    const row = result.rows[0];
    if (!row) {
      response.status(401).json({ active: false, message: "Student session not found", reason: "session_not_found" });
      return;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      response.status(401).json({ active: false, message: "Student session expired", reason: "session_expired" });
      return;
    }

    if (row.is_active === false) {
      const message = row.revoked_reason === "logged_in_elsewhere"
        ? buildForcedLogoutMessage(row.replaced_login_ip || row.login_ip, row.replaced_login_at || row.revoked_at)
        : "Student session revoked";
      response.status(401).json({ active: false, message, reason: row.revoked_reason || "session_revoked", forcedLogout: true });
      return;
    }

    response.json({ active: true });
  } catch (error) {
    response.status(500).json({ active: false, message: error instanceof Error ? error.message : "Failed to validate student session" });
  }
});

app.get("/api/auth/student/profile", requireStudentSession, async (request, response) => {
  response.json({ user: request.studentSession.student });
});

app.put("/api/auth/student/profile", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const mobile = String(request.body?.mobile || "").trim();

    await pool.query(
      `
      UPDATE students
      SET name = COALESCE(NULLIF($2, ''), name),
          email = COALESCE(NULLIF($3, ''), email),
          mobile = COALESCE(NULLIF($4, ''), mobile),
          updated_at = NOW()
      WHERE id = $1
      `,
      [studentId, name, email, mobile],
    );

    const updated = await pool.query("SELECT * FROM students WHERE id = $1", [studentId]);
    response.json({ user: mapStudentSelf(updated.rows[0]) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update profile" });
  }
});

app.post("/api/auth/student/change-password", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const currentPassword = String(request.body?.currentPassword || "").trim();
    const newPassword = String(request.body?.newPassword || "").trim();

    if (!newPassword || newPassword.length < 6) {
      response.status(400).json({ message: "New password must be at least 6 characters" });
      return;
    }

    const result = await pool.query("SELECT password FROM students WHERE id = $1", [studentId]);
    const existing = String(result.rows[0]?.password || "");
    if (!verifyPassword(currentPassword, existing)) {
      response.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    await pool.query("UPDATE students SET password = $2, updated_at = NOW() WHERE id = $1", [studentId, hashPassword(newPassword)]);

    void sendAutomatedMail({
      eventKey: "password_reset",
      toEmail: request.studentSession?.student?.email,
      variables: {
        studentName: request.studentSession?.student?.name || "Student",
        changedAt: new Date().toLocaleString("en-IN"),
      },
      fallbackSubject: "Password changed",
    }).catch(() => {});

    response.json({ ok: true, message: "Password updated successfully" });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to change password" });
  }
});

app.get("/api/auth/student/dashboard", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const [studentResult, accessResult, loginResult, notificationResult, videoResult, orderResult] = await Promise.all([
      pool.query("SELECT * FROM students WHERE id = $1", [studentId]),
      pool.query("SELECT * FROM student_course_access WHERE student_id = $1 ORDER BY created_at DESC", [studentId]),
      pool.query("SELECT * FROM student_login_logs WHERE student_id = $1 ORDER BY created_at DESC LIMIT 30", [studentId]),
      pool.query("SELECT * FROM student_notifications WHERE student_id = $1 ORDER BY created_at DESC LIMIT 30", [studentId]),
      pool.query("SELECT * FROM student_video_activity WHERE student_id = $1 ORDER BY last_viewed_at DESC LIMIT 200", [studentId]),
      pool.query("SELECT * FROM student_orders WHERE student_id = $1 ORDER BY created_at DESC LIMIT 500", [studentId]),
    ]);

    const student = studentResult.rows[0];
    if (!student) {
      response.status(404).json({ message: "Student not found" });
      return;
    }

    const courseAccess = accessResult.rows.map(mapStudentCourseAccess);
    const orders = orderResult.rows.length > 0
      ? groupStudentOrders(orderResult.rows)
      : courseAccess.map((item) => ({
          id: `ORD-${item.studentId}-${item.courseId}`,
          date: item.purchaseDate || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : ""),
          total: 0,
          status: item.isEnabled ? "completed" : "processing",
          dispatchStatus: item.isEnabled ? "delivered" : "processing",
          trackingId: "",
          dispatchNote: "",
          paymentMethod: "",
          items: [
            {
              id: item.id,
              courseId: item.courseId,
              title: item.courseTitle,
              price: 0,
              itemType: "course",
              modeLabel: "",
              bookLabel: "",
              isEbook: false,
              dispatchStatus: item.isEnabled ? "delivered" : "processing",
              trackingId: "",
            },
          ],
        }));

    response.json({
      student: mapStudentSelf(student),
      courseAccess,
      loginLogs: loginResult.rows.map(mapStudentLoginLog),
      notifications: notificationResult.rows.map(mapStudentNotification),
      videoActivity: videoResult.rows.map(mapStudentVideoActivity),
      orders,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load dashboard" });
  }
});

app.get("/api/auth/student/orders", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const courseId = String(request.query.courseId || "").trim();

    const params = [studentId];
    let whereClause = "WHERE student_id = $1";
    if (courseId) {
      params.push(courseId);
      whereClause += ` AND (course_id = $${params.length} OR package_course_ids @> to_jsonb(ARRAY[$${params.length}]::text[]))`;
    }

    const result = await pool.query(
      `
      SELECT *
      FROM student_orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 500
      `,
      params,
    );

    response.json({
      lines: result.rows.map(mapStudentOrderLine),
      grouped: groupStudentOrders(result.rows),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load order history" });
  }
});

app.get("/api/auth/student/support/courses", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const result = await pool.query(
      `
      SELECT course_id, course_title, is_enabled, expires_at
      FROM student_course_access
      WHERE student_id = $1
      ORDER BY updated_at DESC
      `,
      [studentId],
    );

    const items = result.rows
      .filter((row) => row.is_enabled !== false)
      .map((row) => ({
        courseId: row.course_id,
        courseTitle: row.course_title,
        expiresAt: row.expires_at,
      }));

    response.json({ items });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load support courses" });
  }
});

app.get("/api/auth/student/support/tickets", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const result = await pool.query(
      `
      SELECT
        t.*, 
        COUNT(m.id)::int AS message_count
      FROM technical_support_tickets t
      LEFT JOIN technical_support_messages m ON m.ticket_id = t.id
      WHERE t.student_id = $1
      GROUP BY t.id
      ORDER BY t.updated_at DESC
      `,
      [studentId],
    );

    const items = result.rows.map((row) => ({
      ...mapSupportTicket(row),
      messageCount: Number(row.message_count || 0),
    }));

    response.json({ items });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load support tickets" });
  }
});

app.get("/api/auth/student/support/tickets/:id", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const ticketId = Number(request.params.id || 0);
    if (!ticketId) {
      response.status(400).json({ message: "Ticket id is required" });
      return;
    }

    const ticketResult = await pool.query(
      "SELECT * FROM technical_support_tickets WHERE id = $1 AND student_id = $2",
      [ticketId, studentId],
    );

    if (ticketResult.rowCount === 0) {
      response.status(404).json({ message: "Ticket not found" });
      return;
    }

    const messageResult = await pool.query(
      "SELECT * FROM technical_support_messages WHERE ticket_id = $1 ORDER BY created_at ASC",
      [ticketId],
    );

    response.json({
      ticket: mapSupportTicket(ticketResult.rows[0]),
      messages: messageResult.rows.map(mapSupportMessage),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load ticket details" });
  }
});

app.post("/api/auth/student/support/screenshot", requireStudentSession, async (request, response) => {
  try {
    const fileName = sanitizeFileName(request.body?.fileName || `support-${Date.now()}.png`);
    const binary = decodeBase64File(request.body?.base64Data);
    if (!binary) {
      response.status(400).json({ message: "base64Data is required" });
      return;
    }

    const targetDir = path.join(uploadsDir, "support-screenshots");
    await mkdir(targetDir, { recursive: true });
    const finalName = `${Date.now()}-${fileName}`;
    const finalPath = path.join(targetDir, finalName);
    await writeFile(finalPath, binary);

    response.json({ url: `/uploads/support-screenshots/${finalName}` });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Screenshot upload failed" });
  }
});

app.post("/api/auth/student/support/tickets", requireStudentSession, async (request, response) => {
  const client = await pool.connect();
  try {
    const studentId = request.studentSession.studentId;
    const studentName = String(request.studentSession.student?.name || "Student").trim();
    const studentEmail = String(request.studentSession.student?.email || "").trim();
    const courseId = String(request.body?.courseId || "").trim();
    const subject = String(request.body?.subject || "").trim();
    const issueDetails = String(request.body?.issueDetails || "").trim();
    const issueCategory = String(request.body?.issueCategory || "other").trim().toLowerCase();
    const priority = String(request.body?.priority || "medium").trim().toLowerCase();
    const lessonTitle = String(request.body?.lessonTitle || "").trim();
    const screenshotUrl = String(request.body?.screenshotUrl || "").trim();

    const allowedCategories = ["video", "audio", "access", "content", "payment", "other"];
    const allowedPriorities = ["low", "medium", "high"];

    if (!courseId || !subject || !issueDetails) {
      response.status(400).json({ message: "courseId, subject and issueDetails are required" });
      return;
    }

    const category = allowedCategories.includes(issueCategory) ? issueCategory : "other";
    const safePriority = allowedPriorities.includes(priority) ? priority : "medium";

    const courseResult = await client.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2 LIMIT 1",
      [studentId, courseId],
    );
    const course = courseResult.rows[0];
    if (!course) {
      response.status(404).json({ message: "Purchased course not found" });
      return;
    }

    const ticketCode = `TS-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;

    await client.query("BEGIN");

    const ticketInsert = await client.query(
      `
      INSERT INTO technical_support_tickets
      (ticket_code, student_id, student_name, student_email, course_id, course_title, subject, issue_category, priority, lesson_title, issue_details, screenshot_url, status, last_reply_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open',NOW(),NOW())
      RETURNING *
      `,
      [
        ticketCode,
        studentId,
        studentName || "Student",
        studentEmail,
        courseId,
        String(course.course_title || courseId),
        subject,
        category,
        safePriority,
        lessonTitle || null,
        issueDetails,
        screenshotUrl || null,
      ],
    );

    const ticket = ticketInsert.rows[0];

    await client.query(
      `
      INSERT INTO technical_support_messages
      (ticket_id, sender_role, sender_id, sender_name, message)
      VALUES ($1,'student',$2,$3,$4)
      `,
      [ticket.id, studentId, studentName || "Student", issueDetails],
    );

    await client.query("COMMIT");
    response.json({ ok: true, ticket: mapSupportTicket(ticket) });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to create support ticket" });
  } finally {
    client.release();
  }
});

app.post("/api/auth/student/support/tickets/:id/reply", requireStudentSession, async (request, response) => {
  const client = await pool.connect();
  try {
    const studentId = request.studentSession.studentId;
    const studentName = String(request.studentSession.student?.name || "Student").trim();
    const ticketId = Number(request.params.id || 0);
    const message = String(request.body?.message || "").trim();

    if (!ticketId || !message) {
      response.status(400).json({ message: "ticket id and message are required" });
      return;
    }

    await client.query("BEGIN");

    const ticketResult = await client.query(
      "SELECT * FROM technical_support_tickets WHERE id = $1 AND student_id = $2 FOR UPDATE",
      [ticketId, studentId],
    );

    if (ticketResult.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Ticket not found" });
      return;
    }

    await client.query(
      `
      INSERT INTO technical_support_messages
      (ticket_id, sender_role, sender_id, sender_name, message)
      VALUES ($1,'student',$2,$3,$4)
      `,
      [ticketId, studentId, studentName || "Student", message],
    );

    await client.query(
      `
      UPDATE technical_support_tickets
      SET status = CASE WHEN status = 'closed' THEN 'in_progress' ELSE status END,
          last_reply_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [ticketId],
    );

    await client.query("COMMIT");
    response.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to send reply" });
  } finally {
    client.release();
  }
});

app.get("/api/auth/student/course-access", requireStudentSession, async (request, response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 ORDER BY updated_at DESC",
      [request.studentSession.studentId],
    );

    const hydratedRows = [];
    for (const row of result.rows) {
      // Backfill legacy rows lazily so existing purchases also get time budgets.
      const withBudget = await ensureAccessWatchBudgetRow(pool, row);
      hydratedRows.push(withBudget);
    }

    response.json({ items: hydratedRows.map(mapStudentCourseAccess) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load course access" });
  }
});

app.patch("/api/auth/student/course-access/:courseId/video-quality", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const courseId = String(request.params.courseId || "").trim();
    const preferredVideoQuality = normalizeVideoQualityPreference(request.body?.preferredVideoQuality);

    if (!courseId) {
      response.status(400).json({ message: "courseId is required" });
      return;
    }

    const updateResult = await pool.query(
      `
      UPDATE student_course_access
      SET preferred_video_quality = $3,
          updated_at = NOW()
      WHERE student_id = $1 AND course_id = $2
      RETURNING *
      `,
      [studentId, courseId, preferredVideoQuality],
    );

    if (updateResult.rowCount === 0) {
      response.status(404).json({ message: "Course access not found" });
      return;
    }

    response.json({
      ok: true,
      item: mapStudentCourseAccess(updateResult.rows[0]),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update video quality preference" });
  }
});

app.post("/api/auth/student/purchase", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const items = Array.isArray(request.body?.items) ? request.body.items : [];
    const purchaseDate = String(request.body?.purchaseDate || "").trim() || new Date().toISOString().slice(0, 10);
    const orderId = String(request.body?.orderId || `EDN-${Date.now()}`).trim();
    const paymentMethod = String(request.body?.paymentMethod || "").trim();
    const customerName = String(request.body?.customerName || "").trim();
    const customerEmail = String(request.body?.customerEmail || "").trim();
    const customerPhone = String(request.body?.customerPhone || "").trim();
    const shippingAddressLine1 = String(request.body?.shippingAddressLine1 || "").trim();
    const shippingAddressLine2 = String(request.body?.shippingAddressLine2 || "").trim();
    const shippingCity = String(request.body?.shippingCity || "").trim();
    const shippingState = String(request.body?.shippingState || "").trim();
    const shippingCountry = String(request.body?.shippingCountry || "").trim();
    const shippingPincode = String(request.body?.shippingPincode || "").trim();
    const purchasedTitles = [];
    let purchaseAmountTotal = 0;

    if (items.length === 0) {
      response.status(400).json({ message: "items are required" });
      return;
    }

    for (const rawItem of items) {
      const courseId = String(rawItem?.courseId || "").trim();
      const courseTitle = String(rawItem?.courseTitle || "").trim();
      const parentPackageId = String(rawItem?.parentPackageId || "").trim();
      const parentPackageTitle = String(rawItem?.parentPackageTitle || "").trim();
      const packageCourseIds = Array.isArray(rawItem?.packageCourseIds)
        ? rawItem.packageCourseIds.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      const durationDays = Math.max(1, Number(rawItem?.durationDays || 180));
      const explicitUnlimited = typeof rawItem?.isUnlimitedViews === "boolean" ? rawItem.isUnlimitedViews : null;
      const totalViews = Math.max(1, Number(rawItem?.totalViews || 2));
      const usedViews = Math.max(0, Number(rawItem?.usedViews || 0));
      const isEnabled = rawItem?.isEnabled !== false;
      const amount = Math.max(0, Number(rawItem?.amount || 0));
      const modeLabel = String(rawItem?.modeLabel || "").trim();
      const bookLabel = String(rawItem?.bookLabel || "").trim();
      const itemType = String(rawItem?.itemType || "course").trim().toLowerCase() || "course";
      const isEbook = rawItem?.isEbook === true
        || /e\s*-?book/i.test(modeLabel)
        || /e\s*-?book/i.test(bookLabel)
        || itemType === "ebook";
      const grantAccess = rawItem?.grantAccess !== false;
      const createOrderLine = rawItem?.createOrderLine !== false;

      if (!courseId) continue;

      let isUnlimitedViews = explicitUnlimited === true;
      if (explicitUnlimited === null) {
        const courseResult = await pool.query("SELECT payload FROM courses WHERE id = $1 LIMIT 1", [courseId]);
        const payload = courseResult.rows[0]?.payload;
        if (payload && typeof payload === "object" && payload.unlimitedViewsEnabled === true) {
          isUnlimitedViews = true;
        }
      }

      const title = courseTitle || courseId;
      purchasedTitles.push(title);
      purchaseAmountTotal += amount;

      if (grantAccess) {
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        const courseDurationSeconds = await getCourseDurationSeconds(pool, courseId);
        const allowedWatchSeconds = isUnlimitedViews ? 0 : Math.max(0, courseDurationSeconds) * totalViews;
        const usedWatchSeconds = isUnlimitedViews ? 0 : Math.min(allowedWatchSeconds, Math.max(0, courseDurationSeconds) * usedViews);

        await pool.query(
          `
          INSERT INTO student_course_access
          (student_id, course_id, course_title, purchase_date, duration_days, expires_at, total_views, is_unlimited_views, used_views, course_duration_seconds, allowed_watch_seconds, used_watch_seconds, is_enabled, notes, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
          ON CONFLICT (student_id, course_id)
          DO UPDATE SET
            course_title = EXCLUDED.course_title,
            purchase_date = EXCLUDED.purchase_date,
            duration_days = GREATEST(student_course_access.duration_days, EXCLUDED.duration_days),
            expires_at = GREATEST(COALESCE(student_course_access.expires_at, NOW()), EXCLUDED.expires_at),
            is_unlimited_views = (student_course_access.is_unlimited_views OR EXCLUDED.is_unlimited_views),
            total_views = GREATEST(student_course_access.total_views, EXCLUDED.total_views),
            course_duration_seconds = GREATEST(student_course_access.course_duration_seconds, EXCLUDED.course_duration_seconds),
            allowed_watch_seconds = CASE
              WHEN (student_course_access.is_unlimited_views OR EXCLUDED.is_unlimited_views) THEN 0
              ELSE GREATEST(student_course_access.allowed_watch_seconds, EXCLUDED.allowed_watch_seconds)
            END,
            used_watch_seconds = CASE
              WHEN (student_course_access.is_unlimited_views OR EXCLUDED.is_unlimited_views) THEN 0
              ELSE LEAST(
                GREATEST(student_course_access.allowed_watch_seconds, EXCLUDED.allowed_watch_seconds),
                GREATEST(student_course_access.used_watch_seconds, EXCLUDED.used_watch_seconds)
              )
            END,
            is_enabled = TRUE,
            updated_at = NOW()
          `,
          [
            studentId,
            courseId,
            title,
            purchaseDate,
            durationDays,
            expiresAt,
            totalViews,
            isUnlimitedViews,
            usedViews,
            courseDurationSeconds,
            allowedWatchSeconds,
            usedWatchSeconds,
            isEnabled,
            parentPackageTitle ? `Purchased via package: ${parentPackageTitle}` : "Purchased via checkout",
          ],
        );
      }

      if (createOrderLine) {
        const initialDispatchStatus = isEbook ? "pending" : itemType === "package" ? "processing" : "delivered";
        await pool.query(
          `
          INSERT INTO student_orders
          (order_id, student_id, customer_name, customer_email, customer_phone, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_pincode, course_id, course_title, parent_package_id, parent_package_title, package_course_ids, order_date, payment_method, amount, currency, status, item_type, mode_label, book_label, is_ebook, dispatch_status, dispatch_note, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,'INR','completed',$20,$21,$22,$23,$24,$25,NOW())
          ON CONFLICT (order_id, student_id, course_id)
          DO UPDATE SET
            customer_name = EXCLUDED.customer_name,
            customer_email = EXCLUDED.customer_email,
            customer_phone = EXCLUDED.customer_phone,
            shipping_address_line1 = EXCLUDED.shipping_address_line1,
            shipping_address_line2 = EXCLUDED.shipping_address_line2,
            shipping_city = EXCLUDED.shipping_city,
            shipping_state = EXCLUDED.shipping_state,
            shipping_country = EXCLUDED.shipping_country,
            shipping_pincode = EXCLUDED.shipping_pincode,
            course_title = EXCLUDED.course_title,
            parent_package_id = EXCLUDED.parent_package_id,
            parent_package_title = EXCLUDED.parent_package_title,
            package_course_ids = EXCLUDED.package_course_ids,
            payment_method = EXCLUDED.payment_method,
            amount = EXCLUDED.amount,
            status = EXCLUDED.status,
            item_type = EXCLUDED.item_type,
            mode_label = EXCLUDED.mode_label,
            book_label = EXCLUDED.book_label,
            is_ebook = EXCLUDED.is_ebook,
            dispatch_status = EXCLUDED.dispatch_status,
            dispatch_note = EXCLUDED.dispatch_note,
            updated_at = NOW()
          `,
          [
            orderId,
            studentId,
            customerName || null,
            customerEmail || null,
            customerPhone || null,
            shippingAddressLine1 || null,
            shippingAddressLine2 || null,
            shippingCity || null,
            shippingState || null,
            shippingCountry || null,
            shippingPincode || null,
            courseId,
            title,
            parentPackageId || null,
            parentPackageTitle || null,
            JSON.stringify(packageCourseIds),
            purchaseDate,
            paymentMethod || null,
            amount,
            itemType,
            modeLabel || null,
            bookLabel || null,
            isEbook,
            initialDispatchStatus,
            itemType === "package"
              ? `Package order placed (${packageCourseIds.length} courses included)`
              : isEbook
                ? "Awaiting dispatch"
                : "Access delivered online",
          ],
        );
      }
    }

    await pool.query(
      `
      UPDATE students
      SET courses_enrolled = (
        SELECT COUNT(*)::int FROM student_course_access WHERE student_id = $1 AND is_enabled = TRUE
      ),
      updated_at = NOW()
      WHERE id = $1
      `,
      [studentId],
    );

    void sendAutomatedMail({
      eventKey: "user_purchase",
      toEmail: request.studentSession?.student?.email || customerEmail,
      variables: {
        studentName: request.studentSession?.student?.name || customerName || "Student",
        orderId,
        itemsSummary: purchasedTitles.join(", "),
        amount: purchaseAmountTotal.toFixed(2),
      },
      fallbackSubject: "Purchase confirmation",
    }).catch(() => {});

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to persist purchase" });
  }
});

app.post("/api/auth/student/video-activity", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const courseId = String(request.body?.courseId || "").trim();
    const chapterTitle = String(request.body?.chapterTitle || "").trim();
    const lessonTitle = String(request.body?.lessonTitle || "").trim();
    const progressPercent = Math.max(0, Math.min(100, Number(request.body?.progressPercent || 0)));
    const viewedSeconds = Math.max(0, Number(request.body?.viewedSeconds || 0));

    await pool.query(
      `
      INSERT INTO student_video_activity
      (student_id, course_id, chapter_title, lesson_title, progress_percent, viewed_seconds, last_viewed_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      `,
      [studentId, courseId || null, chapterTitle || null, lessonTitle || null, progressPercent, viewedSeconds],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to log video activity" });
  }
});

app.get("/api/auth/student/lesson-note", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const courseId = String(request.query?.courseId || "").trim();
    const lessonId = String(request.query?.lessonId || "").trim();

    if (!courseId || !lessonId) {
      response.status(400).json({ message: "courseId and lessonId are required" });
      return;
    }

    const result = await pool.query(
      `
      SELECT note_text, updated_at
      FROM student_lesson_notes
      WHERE student_id = $1 AND course_id = $2 AND lesson_id = $3
      LIMIT 1
      `,
      [studentId, courseId, lessonId],
    );

    response.json({
      noteText: String(result.rows[0]?.note_text || ""),
      updatedAt: result.rows[0]?.updated_at || null,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load lesson note" });
  }
});

app.post("/api/auth/student/lesson-note", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const courseId = String(request.body?.courseId || "").trim();
    const lessonId = String(request.body?.lessonId || "").trim();
    const chapterTitle = String(request.body?.chapterTitle || "").trim();
    const lessonTitle = String(request.body?.lessonTitle || "").trim();
    const noteText = String(request.body?.noteText || "").slice(0, 20000);

    if (!courseId || !lessonId) {
      response.status(400).json({ message: "courseId and lessonId are required" });
      return;
    }

    const upsertResult = await pool.query(
      `
      INSERT INTO student_lesson_notes
      (student_id, course_id, lesson_id, chapter_title, lesson_title, note_text, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT (student_id, course_id, lesson_id)
      DO UPDATE SET
        chapter_title = EXCLUDED.chapter_title,
        lesson_title = EXCLUDED.lesson_title,
        note_text = EXCLUDED.note_text,
        updated_at = NOW()
      RETURNING note_text, updated_at
      `,
      [studentId, courseId, lessonId, chapterTitle || null, lessonTitle || null, noteText],
    );

    response.json({
      ok: true,
      noteText: String(upsertResult.rows[0]?.note_text || ""),
      updatedAt: upsertResult.rows[0]?.updated_at || null,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save lesson note" });
  }
});

app.post("/api/auth/student/watch-progress", requireStudentSession, async (request, response) => {
  const client = await pool.connect();
  try {
    const studentId = request.studentSession.studentId;
    const courseId = String(request.body?.courseId || "").trim();
    const chapterTitle = String(request.body?.chapterTitle || "").trim();
    const lessonTitle = String(request.body?.lessonTitle || "").trim();
    const progressPercent = Math.max(0, Math.min(100, Number(request.body?.progressPercent || 0)));
    const watchedSeconds = Math.max(0, Math.floor(Number(request.body?.watchedSeconds || 0)));

    if (!courseId) {
      response.status(400).json({ message: "courseId is required" });
      return;
    }

    await client.query("BEGIN");

    const accessResult = await client.query(
      `
      SELECT *
      FROM student_course_access
      WHERE student_id = $1 AND course_id = $2
      FOR UPDATE
      `,
      [studentId, courseId],
    );

    const accessRow = accessResult.rows[0];
    if (!accessRow) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Course access not found" });
      return;
    }

    const hydratedRow = await ensureAccessWatchBudgetRow(client, accessRow);
    const isEnabled = hydratedRow.is_enabled !== false;
    const expiresAt = hydratedRow.expires_at ? new Date(hydratedRow.expires_at) : null;
    const isExpired = Boolean(expiresAt && expiresAt.getTime() <= Date.now());

    if (!isEnabled) {
      await client.query("ROLLBACK");
      response.status(403).json({ message: "Course access disabled" });
      return;
    }

    if (isExpired) {
      await client.query("ROLLBACK");
      response.status(403).json({ message: "Course validity expired" });
      return;
    }

    const allowedWatchSeconds = Math.max(0, Number(hydratedRow.allowed_watch_seconds || 0));
    const usedWatchSeconds = Math.max(0, Number(hydratedRow.used_watch_seconds || 0));
    const remainingWatchSeconds = Math.max(0, allowedWatchSeconds - usedWatchSeconds);
    const isUnlimitedViews = hydratedRow.is_unlimited_views === true;

    if (!isUnlimitedViews && remainingWatchSeconds <= 0) {
      await client.query("ROLLBACK");
      response.status(403).json({ message: "Watch-time budget exhausted" });
      return;
    }

    const consumedSeconds = isUnlimitedViews
      ? Math.max(0, watchedSeconds)
      : Math.min(remainingWatchSeconds, watchedSeconds);

    if (consumedSeconds > 0) {
      await client.query(
        `
        UPDATE student_course_access
        SET used_watch_seconds = LEAST(allowed_watch_seconds, used_watch_seconds + $3),
            updated_at = NOW()
        WHERE student_id = $1 AND course_id = $2
        `,
        [studentId, courseId, consumedSeconds],
      );

      await client.query(
        `
        INSERT INTO student_video_activity
        (student_id, course_id, chapter_title, lesson_title, progress_percent, viewed_seconds, last_viewed_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW())
        `,
        [studentId, courseId, chapterTitle || null, lessonTitle || null, progressPercent, consumedSeconds],
      );
    }

    const nextAccessResult = await client.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );
    const access = mapStudentCourseAccess(nextAccessResult.rows[0]);
    const accessActive =
      access.isEnabled !== false &&
      (!access.expiresAt || new Date(access.expiresAt).getTime() > Date.now()) &&
      (access.isUnlimitedViews === true || Math.max(0, Number(access.remainingWatchSeconds || 0)) > 0);

    await client.query("COMMIT");

    response.json({
      ok: true,
      consumedSeconds,
      access,
      accessActive,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to sync watch progress" });
  } finally {
    client.release();
  }
});

app.post("/api/auth/student/lesson-complete", requireStudentSession, async (request, response) => {
  const client = await pool.connect();
  try {
    const studentId = request.studentSession.studentId;
    const courseId = String(request.body?.courseId || "").trim();
    const lessonId = String(request.body?.lessonId || "").trim();
    const chapterTitle = String(request.body?.chapterTitle || "").trim();
    const lessonTitle = String(request.body?.lessonTitle || "").trim();

    if (!courseId || !lessonId || !lessonTitle) {
      response.status(400).json({ message: "courseId, lessonId, and lessonTitle are required" });
      return;
    }

    await client.query("BEGIN");

    const accessResult = await client.query(
      `
      SELECT *
      FROM student_course_access
      WHERE student_id = $1 AND course_id = $2
      FOR UPDATE
      `,
      [studentId, courseId],
    );

    const accessRow = accessResult.rows[0];
    if (!accessRow) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Course access not found" });
      return;
    }

    const isEnabled = accessRow.is_enabled !== false;
    const expiresAt = accessRow.expires_at ? new Date(accessRow.expires_at) : null;
    const isExpired = Boolean(expiresAt && expiresAt.getTime() <= Date.now());
    const hydratedRow = await ensureAccessWatchBudgetRow(client, accessRow);
    const allowedWatchSeconds = Math.max(0, Number(hydratedRow.allowed_watch_seconds || 0));
    const usedWatchSeconds = Math.max(0, Number(hydratedRow.used_watch_seconds || 0));
    const remainingWatchSeconds = Math.max(0, allowedWatchSeconds - usedWatchSeconds);
    const isUnlimitedViews = hydratedRow.is_unlimited_views === true;

    if (!isEnabled) {
      await client.query("ROLLBACK");
      response.status(403).json({ message: "Course access disabled" });
      return;
    }

    if (isExpired) {
      await client.query("ROLLBACK");
      response.status(403).json({ message: "Course validity expired" });
      return;
    }

    if (!isUnlimitedViews && remainingWatchSeconds <= 0) {
      await client.query("ROLLBACK");
      response.status(403).json({ message: "Watch-time budget exhausted" });
      return;
    }

    await client.query(
      `
      INSERT INTO student_video_activity
      (student_id, course_id, chapter_title, lesson_title, progress_percent, viewed_seconds, last_viewed_at)
      VALUES ($1,$2,$3,$4,100,$5,NOW())
      `,
      [studentId, courseId, chapterTitle || null, lessonTitle, 0],
    );

    const nextAccessResult = await client.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );

    await client.query("COMMIT");

    const access = mapStudentCourseAccess(nextAccessResult.rows[0]);
    const accessActive =
      access.isEnabled !== false &&
      (!access.expiresAt || new Date(access.expiresAt).getTime() > Date.now()) &&
      (access.isUnlimitedViews === true || Math.max(0, Number(access.remainingWatchSeconds || 0)) > 0);

    void sendAutomatedMail({
      eventKey: "course_complete",
      toEmail: request.studentSession?.student?.email,
      variables: {
        studentName: request.studentSession?.student?.name || "Student",
        courseTitle: access.courseTitle || courseId,
        lessonTitle,
      },
      fallbackSubject: "Course milestone reached",
    }).catch(() => {});

    response.json({
      ok: true,
      consumedView: true,
      access,
      accessActive,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to complete lesson" });
  } finally {
    client.release();
  }
});

app.get("/api/students", requireAdminPermission("users", "read"), async (request, response) => {
  try {
    const search = String(request.query.search || "").trim().toLowerCase();
    const query = search
      ? `
        SELECT * FROM students
        WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $1
        ORDER BY created_at DESC
      `
      : "SELECT * FROM students ORDER BY created_at DESC";

    const params = search ? [`%${search}%`] : [];
    const result = await pool.query(query, params);
    response.json({ students: result.rows.map(mapStudentRow) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load students" });
  }
});

app.get("/api/admin/student-access-summary", requireAdminPermission("users", "read"), async (request, response) => {
  try {
    const limit = Math.max(10, Math.min(500, Number(request.query.limit || 100)));
    const search = String(request.query.search || "").trim().toLowerCase();
    const status = String(request.query.status || "all").trim().toLowerCase();

    const whereParts = [];
    const params = [];
    let index = 1;

    if (search) {
      whereParts.push(`(LOWER(s.name) LIKE $${index} OR LOWER(s.email) LIKE $${index} OR LOWER(a.course_title) LIKE $${index})`);
      params.push(`%${search}%`);
      index += 1;
    }

    if (status === "disabled") {
      whereParts.push("a.is_enabled = FALSE");
    } else if (status === "expired") {
      whereParts.push("a.expires_at IS NOT NULL AND a.expires_at < NOW()");
    } else if (status === "out_of_views") {
      whereParts.push("a.is_unlimited_views = FALSE AND (a.allowed_watch_seconds - a.used_watch_seconds) <= 0");
    } else if (status === "active") {
      whereParts.push("a.is_enabled = TRUE AND (a.expires_at IS NULL OR a.expires_at > NOW()) AND (a.is_unlimited_views = TRUE OR (a.allowed_watch_seconds - a.used_watch_seconds) > 0)");
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    params.push(limit);
    const listResult = await pool.query(
      `
      SELECT
        a.id,
        a.student_id,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_mobile,
        a.course_id,
        a.course_title,
        a.purchase_date,
        a.duration_days,
        a.expires_at,
        a.total_views,
        a.is_unlimited_views,
        a.used_views,
        a.course_duration_seconds,
        a.allowed_watch_seconds,
        a.used_watch_seconds,
        a.is_enabled,
        a.updated_at,
        MAX(v.last_viewed_at) AS last_viewed_at
      FROM student_course_access a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN student_video_activity v ON v.student_id = a.student_id AND v.course_id = a.course_id
      ${whereClause}
      GROUP BY
        a.id,
        a.student_id,
        s.name,
        s.email,
        s.mobile,
        a.course_id,
        a.course_title,
        a.purchase_date,
        a.duration_days,
        a.expires_at,
        a.total_views,
        a.is_unlimited_views,
        a.used_views,
        a.course_duration_seconds,
        a.allowed_watch_seconds,
        a.used_watch_seconds,
        a.is_enabled,
        a.updated_at
      ORDER BY a.updated_at DESC
      LIMIT $${index}
      `,
      params,
    );

    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE a.is_enabled = TRUE
            AND (a.expires_at IS NULL OR a.expires_at > NOW())
            AND (a.is_unlimited_views = TRUE OR (a.allowed_watch_seconds - a.used_watch_seconds) > 0)
        )::int AS active,
        COUNT(*) FILTER (WHERE a.is_enabled = FALSE)::int AS disabled,
        COUNT(*) FILTER (WHERE a.expires_at IS NOT NULL AND a.expires_at < NOW())::int AS expired,
        COUNT(*) FILTER (WHERE a.is_unlimited_views = FALSE AND (a.allowed_watch_seconds - a.used_watch_seconds) <= 0)::int AS out_of_views
      FROM student_course_access a
      `,
    );

    const summary = summaryResult.rows[0] || {
      total: 0,
      active: 0,
      disabled: 0,
      expired: 0,
      out_of_views: 0,
    };

    const items = listResult.rows.map((row) => {
      const remainingViews = Math.max(0, Number(row.total_views || 0) - Number(row.used_views || 0));
      const remainingWatchSeconds = Math.max(0, Number(row.allowed_watch_seconds || 0) - Number(row.used_watch_seconds || 0));
      const isUnlimitedViews = row.is_unlimited_views === true;
      const isExpired = Boolean(row.expires_at) && new Date(row.expires_at).getTime() < Date.now();
      const isEnabled = row.is_enabled !== false;
      const isOutOfViews = !isUnlimitedViews && remainingWatchSeconds <= 0;
      const effectiveStatus = !isEnabled
        ? "disabled"
        : isExpired
          ? "expired"
          : isOutOfViews
            ? "out_of_views"
            : "active";

      return {
        id: Number(row.id),
        studentId: row.student_id,
        studentName: row.student_name,
        studentEmail: row.student_email,
        studentMobile: row.student_mobile || "",
        courseId: row.course_id,
        courseTitle: row.course_title,
        purchaseDate: row.purchase_date,
        durationDays: Number(row.duration_days || 0),
        expiresAt: row.expires_at,
        totalViews: Number(row.total_views || 0),
        usedViews: Number(row.used_views || 0),
        isUnlimitedViews,
        remainingViews,
        courseDurationSeconds: Math.max(0, Number(row.course_duration_seconds || 0)),
        allowedWatchSeconds: Math.max(0, Number(row.allowed_watch_seconds || 0)),
        usedWatchSeconds: Math.max(0, Number(row.used_watch_seconds || 0)),
        remainingWatchSeconds,
        isEnabled,
        status: effectiveStatus,
        lastViewedAt: row.last_viewed_at,
        updatedAt: row.updated_at,
      };
    });

    response.json({
      summary: {
        total: Number(summary.total || 0),
        active: Number(summary.active || 0),
        disabled: Number(summary.disabled || 0),
        expired: Number(summary.expired || 0),
        outOfViews: Number(summary.out_of_views || 0),
      },
      items,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load access summary" });
  }
});

app.get("/api/admin/orders", requireAdminPermission("orders", "read"), async (request, response) => {
  try {
    const search = String(request.query.search || "").trim().toLowerCase();
    const dispatchStatus = String(request.query.dispatchStatus || "all").trim().toLowerCase();
    const itemType = String(request.query.itemType || "all").trim().toLowerCase();
    const from = String(request.query.from || "").trim();
    const to = String(request.query.to || "").trim();
    const limit = Math.max(10, Math.min(10000, Number(request.query.limit || 300)));

    const where = [];
    const params = [];
    let idx = 1;

    if (search) {
      where.push(`(
        LOWER(o.order_id) LIKE $${idx}
        OR LOWER(s.name) LIKE $${idx}
        OR LOWER(s.email) LIKE $${idx}
        OR LOWER(o.course_title) LIKE $${idx}
        OR LOWER(COALESCE(o.tracking_id, '')) LIKE $${idx}
      )`);
      params.push(`%${search}%`);
      idx += 1;
    }

    if (dispatchStatus !== "all") {
      where.push(`LOWER(o.dispatch_status) = $${idx}`);
      params.push(dispatchStatus);
      idx += 1;
    }

    if (itemType === "ebook") {
      where.push("o.is_ebook = TRUE");
    } else if (itemType === "package") {
      where.push("LOWER(o.item_type) = 'package'");
    } else if (itemType === "course") {
      where.push("o.is_ebook = FALSE AND LOWER(o.item_type) <> 'package'");
    }

    if (from) {
      const parsedFrom = new Date(from);
      if (!Number.isNaN(parsedFrom.getTime())) {
        where.push(`o.created_at >= $${idx}`);
        params.push(parsedFrom.toISOString());
        idx += 1;
      }
    }

    if (to) {
      const parsedTo = new Date(to);
      if (!Number.isNaN(parsedTo.getTime())) {
        where.push(`o.created_at <= $${idx}`);
        params.push(parsedTo.toISOString());
        idx += 1;
      }
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    params.push(limit);

    const result = await pool.query(
      `
      SELECT
        o.*,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_mobile
      FROM student_orders o
      JOIN students s ON s.id = o.student_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${idx}
      `,
      params,
    );

    const items = result.rows.map((row) => ({
      ...mapStudentOrderLine(row),
      studentName: String(row.student_name || ""),
      studentEmail: String(row.student_email || ""),
      studentMobile: String(row.student_mobile || ""),
    }));

    response.json({ items });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load orders" });
  }
});

app.get("/api/admin/orders/student/:studentId", requireAdminPermission("orders", "read"), async (request, response) => {
  try {
    const studentId = String(request.params.studentId || "").trim();
    if (!studentId) {
      response.status(400).json({ message: "studentId is required" });
      return;
    }

    const result = await pool.query(
      `
      SELECT
        o.*,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_mobile
      FROM student_orders o
      JOIN students s ON s.id = o.student_id
      WHERE o.student_id = $1
      ORDER BY o.created_at DESC
      LIMIT 1000
      `,
      [studentId],
    );

    const lines = result.rows.map((row) => ({
      ...mapStudentOrderLine(row),
      studentName: String(row.student_name || ""),
      studentEmail: String(row.student_email || ""),
      studentMobile: String(row.student_mobile || ""),
    }));

    response.json({ lines, grouped: groupStudentOrders(result.rows) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load student order history" });
  }
});

app.patch("/api/admin/orders/:id/dispatch", requireAdminPermission("orders", "edit"), async (request, response) => {
  try {
    const orderLineId = Number(request.params.id || 0);
    if (!orderLineId || Number.isNaN(orderLineId)) {
      response.status(400).json({ message: "Valid order line id is required" });
      return;
    }

    const rawStatus = String(request.body?.dispatchStatus || "").trim().toLowerCase();
    const allowedStatuses = ["pending", "processing", "dispatched", "delivered", "cancelled", "refunded"];
    const dispatchStatus = allowedStatuses.includes(rawStatus) ? rawStatus : "pending";
    const trackingId = String(request.body?.trackingId || "").trim();
    const dispatchNote = String(request.body?.dispatchNote || "").trim();
    const status = String(request.body?.status || "completed").trim().toLowerCase() || "completed";

    const updateResult = await pool.query(
      `
      UPDATE student_orders
      SET
        dispatch_status = $2,
        tracking_id = $3,
        dispatch_note = $4,
        status = $5,
        dispatched_at = CASE WHEN $2 = 'dispatched' OR $2 = 'delivered' THEN NOW() ELSE dispatched_at END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [orderLineId, dispatchStatus, trackingId || null, dispatchNote || null, status],
    );

    if (updateResult.rowCount === 0) {
      response.status(404).json({ message: "Order line not found" });
      return;
    }

    const updated = updateResult.rows[0];
    const notificationSubject = `Order Update: ${String(updated.course_title || "Course")}`;
    const notificationMessage = [
      `Your order ${String(updated.order_id || "")} is now ${dispatchStatus}.`,
      trackingId ? `Tracking ID: ${trackingId}.` : "",
      dispatchNote ? `Note: ${dispatchNote}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    await pool.query(
      `
      INSERT INTO student_notifications (student_id, channel, subject, message, status, sent_by)
      VALUES ($1, 'in_app', $2, $3, 'sent', 'admin')
      `,
      [String(updated.student_id || ""), notificationSubject, notificationMessage || "Your order details have been updated."],
    );

    response.json({ item: mapStudentOrderLine(updated) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update dispatch status" });
  }
});

app.delete("/api/admin/orders/:id", requireAdminPermission("orders", "edit"), async (request, response) => {
  try {
    const orderLineId = Number(request.params.id || 0);
    if (!orderLineId || Number.isNaN(orderLineId)) {
      response.status(400).json({ message: "Valid order line id is required" });
      return;
    }

    const deletedResult = await pool.query(
      `
      DELETE FROM student_orders
      WHERE id = $1
      RETURNING *
      `,
      [orderLineId],
    );

    if (deletedResult.rowCount === 0) {
      response.status(404).json({ message: "Order line not found" });
      return;
    }

    const deleted = deletedResult.rows[0];
    await pool.query(
      `
      INSERT INTO student_notifications (student_id, channel, subject, message, status, sent_by)
      VALUES ($1, 'in_app', $2, $3, 'sent', 'admin')
      `,
      [
        String(deleted.student_id || ""),
        `Order Removed: ${String(deleted.course_title || "Course")}`,
        `Order ${String(deleted.order_id || "")} has been removed by admin support. Contact support if this was unexpected.`,
      ],
    );

    response.json({ ok: true, item: mapStudentOrderLine(deleted) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete order" });
  }
});

app.post("/api/admin/orders/:id/send-invoice", requireAdminPermission("orders", "edit"), async (request, response) => {
  try {
    const orderLineId = Number(request.params.id || 0);
    if (!orderLineId || Number.isNaN(orderLineId)) {
      response.status(400).json({ message: "Valid order line id is required" });
      return;
    }

    const lineResult = await pool.query(
      `
      SELECT o.*, s.name AS student_name, s.email AS student_email
      FROM student_orders o
      JOIN students s ON s.id = o.student_id
      WHERE o.id = $1
      LIMIT 1
      `,
      [orderLineId],
    );

    if (lineResult.rowCount === 0) {
      response.status(404).json({ message: "Order line not found" });
      return;
    }

    const line = lineResult.rows[0];
    const allLinesResult = await pool.query(
      `
      SELECT * FROM student_orders
      WHERE order_id = $1 AND student_id = $2
      ORDER BY id ASC
      `,
      [String(line.order_id || ""), String(line.student_id || "")],
    );

    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const platformName = String(settings.siteSettings?.platformName || "Ednovate");
    const logoUrlRaw = String(settings.siteSettings?.logo || "").trim();
    const logoUrl = logoUrlRaw && /^https?:\/\//i.test(logoUrlRaw)
      ? logoUrlRaw
      : (logoUrlRaw ? `${request.protocol}://${request.get("host")}${logoUrlRaw.startsWith("/") ? "" : "/"}${logoUrlRaw}` : "");

    const invoice = buildInvoiceDocument({
      orderId: String(line.order_id || ""),
      studentName: String(line.student_name || "Student"),
      studentEmail: String(line.student_email || ""),
      orderDate: String(line.order_date || ""),
      paymentMethod: String(line.payment_method || "Online"),
      currency: String(line.currency || "INR"),
      platformName,
      logoUrl,
      items: allLinesResult.rows.map((row) => ({
        courseTitle: String(row.course_title || "Course"),
        itemType: String(row.item_type || "course"),
        modeLabel: String(row.mode_label || ""),
        bookLabel: String(row.book_label || ""),
        amount: Number(row.amount || 0),
      })),
    });

    const sendResult = await sendSmtpMail({
      toEmail: String(line.student_email || "").trim().toLowerCase(),
      subject: `Invoice ${String(line.order_id || "")} - ${platformName}`,
      text: invoice.text,
      html: invoice.html,
    });

    if (!sendResult.sent) {
      response.status(400).json({ message: sendResult.reason || "Unable to send invoice email" });
      return;
    }

    await pool.query(
      `
      INSERT INTO student_notifications (student_id, channel, subject, message, status, sent_by)
      VALUES ($1, 'email', $2, $3, 'sent', 'admin')
      `,
      [
        String(line.student_id || ""),
        `Invoice Sent: ${String(line.order_id || "")}`,
        "Your invoice has been sent to your registered email address.",
      ],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to send invoice" });
  }
});

app.post("/api/admin/orders/:id/refund", requireAdminPermission("orders", "edit"), async (request, response) => {
  const client = await pool.connect();
  try {
    const orderLineId = Number(request.params.id || 0);
    const refundNote = String(request.body?.refundNote || "").trim();

    if (!orderLineId || Number.isNaN(orderLineId)) {
      response.status(400).json({ message: "Valid order line id is required" });
      return;
    }

    await client.query("BEGIN");

    const existingResult = await client.query(
      `
      SELECT *
      FROM student_orders
      WHERE id = $1
      FOR UPDATE
      `,
      [orderLineId],
    );

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Order line not found" });
      return;
    }

    const existing = existingResult.rows[0];
    const accessCourseIds = new Set();
    const directCourseId = String(existing.course_id || "").trim();
    if (directCourseId) accessCourseIds.add(directCourseId);
    if (Array.isArray(existing.package_course_ids)) {
      existing.package_course_ids
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .forEach((value) => accessCourseIds.add(value));
    }

    const updateResult = await client.query(
      `
      UPDATE student_orders
      SET
        status = 'refunded',
        dispatch_status = 'refunded',
        dispatch_note = CASE
          WHEN $2 <> '' THEN $2
          WHEN COALESCE(dispatch_note, '') = '' THEN 'Refunded by admin'
          ELSE dispatch_note
        END,
        refund_note = CASE WHEN $2 <> '' THEN $2 ELSE refund_note END,
        refunded_at = NOW(),
        refunded_by = 'admin',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [orderLineId, refundNote],
    );

    const updated = updateResult.rows[0];

    const accessIds = Array.from(accessCourseIds);
    if (accessIds.length > 0) {
      await client.query(
        `
        DELETE FROM student_course_access
        WHERE student_id = $1 AND course_id = ANY($2::text[])
        `,
        [String(updated.student_id || ""), accessIds],
      );
    }

    await client.query(
      `
      INSERT INTO student_notifications (student_id, channel, subject, message, status, sent_by)
      VALUES ($1, 'in_app', $2, $3, 'sent', 'admin')
      `,
      [
        String(updated.student_id || ""),
        `Refund Processed: ${String(updated.course_title || "Course")}`,
        `Your order ${String(updated.order_id || "")} has been refunded. Course access has been removed.`,
      ],
    );

    await client.query("COMMIT");
    response.json({ ok: true, item: mapStudentOrderLine(updated) });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to refund order" });
  } finally {
    client.release();
  }
});

app.post("/api/students", requireAdminPermission("users", "create"), async (request, response) => {
  try {
    const body = request.body || {};
    const id = String(body.id || `std-${Date.now()}`);
    const rawPassword = String(body.password || "student123");
    const storedPassword = hashPassword(rawPassword);
    await pool.query(
      `
      INSERT INTO students
      (id, name, email, mobile, city, state, country, status, courses_enrolled, courses_completed, bio, education_level, password, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        mobile = EXCLUDED.mobile,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        country = EXCLUDED.country,
        status = EXCLUDED.status,
        courses_enrolled = EXCLUDED.courses_enrolled,
        courses_completed = EXCLUDED.courses_completed,
        bio = EXCLUDED.bio,
        education_level = EXCLUDED.education_level,
        password = EXCLUDED.password,
        updated_at = NOW()
      `,
      [
        id,
        String(body.name || "Student"),
        String(body.email || `${id}@student.local`),
        String(body.mobile || ""),
        String(body.city || ""),
        String(body.state || ""),
        String(body.country || ""),
        body.status === "Inactive" ? "Inactive" : "Active",
        Number(body.coursesEnrolled || 0),
        Number(body.coursesCompleted || 0),
        String(body.bio || ""),
        String(body.educationLevel || ""),
        storedPassword,
      ],
    );

    const result = await pool.query("SELECT * FROM students WHERE id = $1", [id]);
    response.json({ student: mapStudentRow(result.rows[0]) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save student" });
  }
});

app.put("/api/students/:id", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const id = String(request.params.id);
    const body = request.body || {};
    await pool.query(
      `
      UPDATE students
      SET name=$2, email=$3, mobile=$4, city=$5, state=$6, country=$7,
          status=$8, courses_enrolled=$9, courses_completed=$10, bio=$11,
          education_level=$12, updated_at=NOW()
      WHERE id=$1
      `,
      [
        id,
        String(body.name || "Student"),
        String(body.email || `${id}@student.local`),
        String(body.mobile || ""),
        String(body.city || ""),
        String(body.state || ""),
        String(body.country || ""),
        body.status === "Inactive" ? "Inactive" : "Active",
        Number(body.coursesEnrolled || 0),
        Number(body.coursesCompleted || 0),
        String(body.bio || ""),
        String(body.educationLevel || ""),
      ],
    );

    const result = await pool.query("SELECT * FROM students WHERE id = $1", [id]);
    response.json({ student: mapStudentRow(result.rows[0]) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update student" });
  }
});

app.delete("/api/students/:id", requireAdminPermission("users", "delete"), async (request, response) => {
  try {
    await pool.query("DELETE FROM students WHERE id = $1", [String(request.params.id)]);
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete student" });
  }
});

app.post("/api/students/bulk-delete", requireAdminPermission("users", "delete"), async (request, response) => {
  try {
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.map(String) : [];
    if (ids.length === 0) {
      response.status(400).json({ message: "ids are required" });
      return;
    }
    await pool.query("DELETE FROM students WHERE id = ANY($1::text[])", [ids]);
    response.json({ ok: true, deletedCount: ids.length });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Bulk delete failed" });
  }
});

app.post("/api/students/bulk-update", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.map(String) : [];
    const updates = request.body?.updates || {};
    if (ids.length === 0) {
      response.status(400).json({ message: "ids are required" });
      return;
    }

    if (updates.status) {
      await pool.query(
        "UPDATE students SET status = $2, updated_at = NOW() WHERE id = ANY($1::text[])",
        [ids, updates.status === "Inactive" ? "Inactive" : "Active"],
      );
    }

    if (typeof updates.educationLevel === "string") {
      await pool.query(
        "UPDATE students SET education_level = $2, updated_at = NOW() WHERE id = ANY($1::text[])",
        [ids, updates.educationLevel],
      );
    }

    response.json({ ok: true, updatedCount: ids.length });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Bulk update failed" });
  }
});

app.post("/api/admin/quick-login", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.body?.studentId || "").trim();
    if (!studentId) {
      response.status(400).json({ message: "studentId is required" });
      return;
    }
    const result = await pool.query("SELECT * FROM students WHERE id = $1", [studentId]);
    if (result.rowCount === 0) {
      response.status(404).json({ message: "Student not found" });
      return;
    }

    const token = randomUUID();
    await pool.query(
      "INSERT INTO auth_sessions (token, student_id, role, expires_at) VALUES ($1,$2,'student',$3)",
      [token, studentId, new Date(Date.now() + 1000 * 60 * 60 * 24)],
    );

    await pool.query(
      "INSERT INTO student_login_logs (student_id, ip_address, user_agent, source) VALUES ($1,$2,$3,$4)",
      [studentId, getIpAddress(request), String(request.headers["user-agent"] || ""), "admin_quick_login"],
    );

    const row = result.rows[0];
    response.json({
      token,
      redirectPath: "/dashboard",
      student: {
        studentId: row.id,
        name: row.name,
        email: row.email,
        mobile: row.mobile || "",
        country: row.country || "",
        state: row.state || "",
        city: row.city || "",
        course: "",
        level: row.education_level || "",
        attemptYear: "",
      },
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Quick login failed" });
  }
});

app.get("/api/students/:id/details", requireAdminPermission("users", "read"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const [studentResult, courseAccessResult, loginResult, videoResult, notificationResult] = await Promise.all([
      pool.query("SELECT * FROM students WHERE id = $1", [studentId]),
      pool.query("SELECT * FROM student_course_access WHERE student_id = $1 ORDER BY updated_at DESC", [studentId]),
      pool.query("SELECT * FROM student_login_logs WHERE student_id = $1 ORDER BY created_at DESC LIMIT 200", [studentId]),
      pool.query("SELECT * FROM student_video_activity WHERE student_id = $1 ORDER BY last_viewed_at DESC LIMIT 500", [studentId]),
      pool.query("SELECT * FROM student_notifications WHERE student_id = $1 ORDER BY created_at DESC LIMIT 200", [studentId]),
    ]);

    if (studentResult.rowCount === 0) {
      response.status(404).json({ message: "Student not found" });
      return;
    }

    response.json({
      student: mapStudentRow(studentResult.rows[0]),
      courseAccess: courseAccessResult.rows.map(mapStudentCourseAccess),
      loginLogs: loginResult.rows.map(mapStudentLoginLog),
      videoActivity: videoResult.rows.map(mapStudentVideoActivity),
      notifications: notificationResult.rows.map(mapStudentNotification),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load student details" });
  }
});

app.post("/api/students/:id/course-access", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const action = String(request.body?.action || "").trim().toLowerCase();
    const courseId = String(request.body?.courseId || "").trim();

    if (action === "remove") {
      if (!courseId) {
        response.status(400).json({ message: "courseId is required" });
        return;
      }
      await pool.query(
        "DELETE FROM student_course_access WHERE student_id = $1 AND course_id = $2",
        [studentId, courseId],
      );
      response.json({ ok: true });
      return;
    }

    const existingResult = await pool.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );
    const existingRow = existingResult.rows[0];

    const courseTitle = String(request.body?.courseTitle || existingRow?.course_title || "").trim();
    const purchaseDate = String(request.body?.purchaseDate || "").trim();
    const durationDays = Math.max(
      1,
      Number(
        request.body?.durationDays ?? existingRow?.duration_days ?? 30,
      ),
    );
    const totalViews = Math.max(
      1,
      Number(
        request.body?.totalViews ?? existingRow?.total_views ?? 1,
      ),
    );
    const isUnlimitedViews =
      typeof request.body?.isUnlimitedViews === "boolean"
        ? request.body.isUnlimitedViews
        : existingRow?.is_unlimited_views === true;
    const usedViews = Math.max(
      0,
      Math.min(
        totalViews,
        Number(request.body?.usedViews ?? existingRow?.used_views ?? 0),
      ),
    );
    const isEnabled =
      typeof request.body?.isEnabled === "boolean"
        ? request.body.isEnabled
        : existingRow?.is_enabled !== false;
    const notes = String(request.body?.notes ?? existingRow?.notes ?? "").trim();

    if (!courseId || !courseTitle) {
      response.status(400).json({ message: "courseId and courseTitle are required" });
      return;
    }

    let expiresAt = existingRow?.expires_at || null;
    if (Object.prototype.hasOwnProperty.call(request.body || {}, "expiresAt")) {
      const rawExpiresAt = request.body?.expiresAt;
      if (!rawExpiresAt) {
        expiresAt = null;
      } else {
        const parsed = new Date(String(rawExpiresAt));
        if (Number.isNaN(parsed.getTime())) {
          response.status(400).json({ message: "Invalid expiresAt value" });
          return;
        }
        expiresAt = parsed.toISOString();
      }
    } else if (!expiresAt) {
      expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    }
    const courseDurationSeconds = await getCourseDurationSeconds(pool, courseId);
    const allowedWatchSeconds = isUnlimitedViews ? 0 : Math.max(0, courseDurationSeconds) * totalViews;
    const usedWatchSeconds = isUnlimitedViews ? 0 : Math.min(allowedWatchSeconds, Math.max(0, courseDurationSeconds) * usedViews);

    await pool.query(
      `
      INSERT INTO student_course_access
      (student_id, course_id, course_title, purchase_date, duration_days, expires_at, total_views, is_unlimited_views, used_views, course_duration_seconds, allowed_watch_seconds, used_watch_seconds, is_enabled, notes, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
      ON CONFLICT (student_id, course_id)
      DO UPDATE SET
        course_title = EXCLUDED.course_title,
        purchase_date = EXCLUDED.purchase_date,
        duration_days = EXCLUDED.duration_days,
        expires_at = EXCLUDED.expires_at,
        total_views = EXCLUDED.total_views,
        is_unlimited_views = EXCLUDED.is_unlimited_views,
        used_views = EXCLUDED.used_views,
        course_duration_seconds = EXCLUDED.course_duration_seconds,
        allowed_watch_seconds = EXCLUDED.allowed_watch_seconds,
        used_watch_seconds = LEAST(EXCLUDED.allowed_watch_seconds, EXCLUDED.used_watch_seconds),
        is_enabled = EXCLUDED.is_enabled,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      `,
      [
        studentId,
        courseId,
        courseTitle,
        purchaseDate || null,
        durationDays,
        expiresAt,
        totalViews,
        isUnlimitedViews,
        usedViews,
        courseDurationSeconds,
        allowedWatchSeconds,
        usedWatchSeconds,
        isEnabled,
        notes || null,
      ],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save course access" });
  }
});

app.post("/api/students/:id/course-access/:courseId/extend", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const courseId = String(request.params.courseId || "").trim();
    const extraDays = Number(request.body?.extraDays || 0);
    const extraViews = Number(request.body?.extraViews || 0);
    const extraWatchHours = Number(request.body?.extraWatchHours || 0);

    if (!Number.isFinite(extraDays) || !Number.isFinite(extraViews) || !Number.isFinite(extraWatchHours)) {
      response.status(400).json({ message: "extraDays, extraViews and extraWatchHours must be valid numbers" });
      return;
    }

    const accessResult = await pool.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );

    const row = accessResult.rows[0];
    if (!row) {
      response.status(404).json({ message: "Course access not found" });
      return;
    }

    const hydratedRow = await ensureAccessWatchBudgetRow(pool, row);
    const courseDurationSeconds = Math.max(0, Number(hydratedRow.course_duration_seconds || 0));
    const extraWatchSecondsFromViews = Math.floor(courseDurationSeconds * extraViews);
    const extraWatchSecondsManual = Math.floor(extraWatchHours * 3600);
    const extraWatchSeconds = extraWatchSecondsFromViews + extraWatchSecondsManual;

    await pool.query(
      `
      UPDATE student_course_access
      SET duration_days = GREATEST(1, duration_days + $3),
          total_views = GREATEST(1, total_views + $4),
          allowed_watch_seconds = GREATEST(0, allowed_watch_seconds + $5),
          used_watch_seconds = LEAST(GREATEST(0, allowed_watch_seconds + $5), used_watch_seconds),
          used_views = LEAST(GREATEST(1, total_views + $4), used_views),
          expires_at = COALESCE(expires_at, NOW()) + ($3 || ' days')::interval,
          updated_at = NOW()
      WHERE student_id = $1 AND course_id = $2
      `,
      [studentId, courseId, extraDays, extraViews, extraWatchSeconds],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to extend access" });
  }
});

app.post("/api/students/:id/course-access/:courseId/adjust-watch-time", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const courseId = String(request.params.courseId || "").trim();
    const deltaHours = Number(request.body?.deltaHours || 0);
    if (!Number.isFinite(deltaHours) || deltaHours === 0) {
      response.status(400).json({ message: "deltaHours must be a non-zero number" });
      return;
    }

    const accessResult = await pool.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );
    const row = accessResult.rows[0];
    if (!row) {
      response.status(404).json({ message: "Course access not found" });
      return;
    }

    const hydratedRow = await ensureAccessWatchBudgetRow(pool, row);
    const isUnlimitedViews = hydratedRow.is_unlimited_views === true;
    if (isUnlimitedViews) {
      response.status(400).json({ message: "Watch time adjustment is not needed for unlimited access" });
      return;
    }

    const allowedWatchSeconds = Math.max(0, Number(hydratedRow.allowed_watch_seconds || 0));
    const usedWatchSeconds = Math.max(0, Number(hydratedRow.used_watch_seconds || 0));
    const deltaSeconds = Math.floor(deltaHours * 3600);
    const nextUsedWatchSeconds = Math.max(0, Math.min(allowedWatchSeconds, usedWatchSeconds - deltaSeconds));

    const courseDurationSeconds = Math.max(0, Number(hydratedRow.course_duration_seconds || 0));
    const nextUsedViews = courseDurationSeconds > 0 ? Math.min(Number(hydratedRow.total_views || 0), Math.floor(nextUsedWatchSeconds / courseDurationSeconds)) : Math.max(0, Number(hydratedRow.used_views || 0));

    await pool.query(
      `
      UPDATE student_course_access
      SET used_watch_seconds = $3,
          used_views = $4,
          updated_at = NOW()
      WHERE student_id = $1 AND course_id = $2
      `,
      [studentId, courseId, nextUsedWatchSeconds, nextUsedViews],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to adjust watch time" });
  }
});

const updateStudentCourseAccessHandler = async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const courseId = String(request.params.courseId || "").trim();

    const accessResult = await pool.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );
    const row = accessResult.rows[0];
    if (!row) {
      response.status(404).json({ message: "Course access not found" });
      return;
    }

    const hasTotalViews = Object.prototype.hasOwnProperty.call(request.body || {}, "totalViews");
    const hasUsedViews = Object.prototype.hasOwnProperty.call(request.body || {}, "usedViews");
    const nextTotalViews = hasTotalViews
      ? Math.max(1, Number(request.body?.totalViews ?? row.total_views ?? 1))
      : Math.max(1, Number(row.total_views ?? 1));
    const nextIsUnlimitedViews =
      typeof request.body?.isUnlimitedViews === "boolean"
        ? request.body.isUnlimitedViews
        : row.is_unlimited_views === true;
    const nextUsedViews = hasUsedViews
      ? Math.max(0, Math.min(nextTotalViews, Number(request.body?.usedViews ?? row.used_views ?? 0)))
      : Math.max(0, Math.min(nextTotalViews, Number(row.used_views ?? 0)));
    const nextDurationDays = Math.max(1, Number(request.body?.durationDays ?? row.duration_days ?? 30));
    const nextIsEnabled = typeof request.body?.isEnabled === "boolean" ? request.body.isEnabled : row.is_enabled !== false;

    let nextExpiresAt = row.expires_at;
    if (Object.prototype.hasOwnProperty.call(request.body || {}, "expiresAt")) {
      const rawExpiresAt = request.body?.expiresAt;
      if (!rawExpiresAt) {
        nextExpiresAt = null;
      } else {
        const parsed = new Date(String(rawExpiresAt));
        if (Number.isNaN(parsed.getTime())) {
          response.status(400).json({ message: "Invalid expiresAt value" });
          return;
        }
        nextExpiresAt = parsed.toISOString();
      }
    }

    const hydratedRow = await ensureAccessWatchBudgetRow(pool, row);
    const previousDurationSeconds = Math.max(0, Number(hydratedRow.course_duration_seconds || 0));
    const previousAllowedWatchSeconds = Math.max(0, Number(hydratedRow.allowed_watch_seconds || 0));
    const previousUsedWatchSeconds = Math.max(0, Number(hydratedRow.used_watch_seconds || 0));
    const fromCurriculum = await getCourseDurationSeconds(pool, courseId);
    const inferredFromBudget = previousAllowedWatchSeconds > 0
      ? Math.floor(previousAllowedWatchSeconds / Math.max(1, Number(row.total_views || 1)))
      : 0;
    const requestedDurationSeconds = Math.max(0, Number(request.body?.courseDurationSeconds || 0));
    const resolvedDurationSeconds = Math.max(
      requestedDurationSeconds,
      previousDurationSeconds,
      Math.max(0, Number(fromCurriculum || 0)),
      inferredFromBudget,
    );

    if (!nextIsUnlimitedViews && resolvedDurationSeconds <= 0 && previousAllowedWatchSeconds <= 0) {
      response.status(400).json({ message: "Unable to resolve course duration for limited access. Update curriculum first." });
      return;
    }

    const nextAllowedWatchSeconds = nextIsUnlimitedViews
      ? 0
      : resolvedDurationSeconds > 0
        ? resolvedDurationSeconds * nextTotalViews
        : previousAllowedWatchSeconds;

    const requestedUsedWatchSeconds = hasUsedViews
      ? Math.max(0, nextUsedViews * resolvedDurationSeconds)
      : previousUsedWatchSeconds;

    const nextUsedWatchSeconds = nextIsUnlimitedViews
      ? 0
      : Math.min(nextAllowedWatchSeconds, requestedUsedWatchSeconds);

    const nextUsedViewsForStorage = nextIsUnlimitedViews
      ? 0
      : resolvedDurationSeconds > 0
        ? Math.max(0, Math.min(nextTotalViews, Math.floor(nextUsedWatchSeconds / resolvedDurationSeconds)))
        : nextUsedViews;

    await pool.query(
      `
      UPDATE student_course_access
      SET duration_days = $3,
          expires_at = $4,
          total_views = $5,
          is_unlimited_views = $6,
          used_views = $7,
          course_duration_seconds = $8,
          allowed_watch_seconds = $9,
          used_watch_seconds = $10,
          is_enabled = $11,
          updated_at = NOW()
      WHERE student_id = $1 AND course_id = $2
      `,
      [
        studentId,
        courseId,
        nextDurationDays,
        nextExpiresAt,
        nextTotalViews,
        nextIsUnlimitedViews,
        nextUsedViewsForStorage,
        resolvedDurationSeconds,
        nextAllowedWatchSeconds,
        nextUsedWatchSeconds,
        nextIsEnabled,
      ],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update course access" });
  }
};

app.patch("/api/students/:id/course-access/:courseId", requireAdminPermission("users", "edit"), updateStudentCourseAccessHandler);

const removeStudentCourseAccessHandler = async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const courseId = String(request.params.courseId || "").trim();
    await pool.query(
      "DELETE FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to remove course access" });
  }
};

app.delete("/api/students/:id/course-access/:courseId", requireAdminPermission("users", "edit"), removeStudentCourseAccessHandler);

app.post("/api/students/:id/password", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const password = String(request.body?.password || "").trim();
    if (!password || password.length < 6) {
      response.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    await pool.query("UPDATE students SET password = $2, updated_at = NOW() WHERE id = $1", [studentId, hashPassword(password)]);

    const studentResult = await pool.query("SELECT name, email FROM students WHERE id = $1 LIMIT 1", [studentId]);
    const student = studentResult.rows[0];
    void sendAutomatedMail({
      eventKey: "password_reset",
      toEmail: student?.email,
      variables: {
        studentName: student?.name || "Student",
        changedAt: new Date().toLocaleString("en-IN"),
      },
      fallbackSubject: "Password changed",
    }).catch(() => {});

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to change password" });
  }
});

app.post("/api/students/:id/course-access/:courseId/toggle", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const courseId = String(request.params.courseId || "").trim();
    const isEnabled = request.body?.isEnabled !== false;
    await pool.query(
      "UPDATE student_course_access SET is_enabled = $3, updated_at = NOW() WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId, isEnabled],
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update course state" });
  }
});

app.post("/api/students/:id/course-access/:courseId/reset-views", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const courseId = String(request.params.courseId || "").trim();
    const resetTo = Math.max(0, Number(request.body?.resetTo || 0));

    const accessResult = await pool.query(
      "SELECT * FROM student_course_access WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId],
    );
    const row = accessResult.rows[0];
    if (!row) {
      response.status(404).json({ message: "Course access not found" });
      return;
    }

    const hydratedRow = await ensureAccessWatchBudgetRow(pool, row);
    const courseDurationSeconds = Math.max(0, Number(hydratedRow.course_duration_seconds || 0));
    const usedWatchSeconds = Math.max(0, resetTo * courseDurationSeconds);

    await pool.query(
      `
      UPDATE student_course_access
      SET used_views = $3,
          used_watch_seconds = LEAST(allowed_watch_seconds, $4),
          updated_at = NOW()
      WHERE student_id = $1 AND course_id = $2
      `,
      [studentId, courseId, resetTo, usedWatchSeconds],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to reset views" });
  }
});

app.post("/api/students/:id/message", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const channel = String(request.body?.channel || "in_app").trim() || "in_app";
    const subject = String(request.body?.subject || "").trim();
    const message = String(request.body?.message || "").trim();
    const sentBy = String(request.adminSession?.admin?.email || "system");

    if (!message) {
      response.status(400).json({ message: "message is required" });
      return;
    }

    await pool.query(
      "INSERT INTO student_notifications (student_id, channel, subject, message, status, sent_by) VALUES ($1,$2,$3,$4,'queued',$5)",
      [studentId, channel, subject || null, message, sentBy],
    );

    const studentResult = await pool.query("SELECT name, email FROM students WHERE id = $1 LIMIT 1", [studentId]);
    const student = studentResult.rows[0];
    void sendAutomatedMail({
      eventKey: "user_notification",
      toEmail: student?.email,
      variables: {
        studentName: student?.name || "Student",
        notificationMessage: message,
      },
      fallbackSubject: subject || "Notification from Ednovate",
    }).catch(() => {});

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to send message" });
  }
});

app.delete("/api/students/:id/notifications/:notificationId", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const notificationId = Number(request.params.notificationId || 0);

    if (!studentId || !notificationId) {
      response.status(400).json({ message: "Valid student id and notification id are required" });
      return;
    }

    const result = await pool.query(
      "DELETE FROM student_notifications WHERE id = $1 AND student_id = $2 RETURNING id",
      [notificationId, studentId],
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Notification not found" });
      return;
    }

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete notification" });
  }
});

app.post("/api/students/:id/video-activity", requireAdminPermission("users", "edit"), async (request, response) => {
  try {
    const studentId = String(request.params.id || "").trim();
    const courseId = String(request.body?.courseId || "").trim();
    const chapterTitle = String(request.body?.chapterTitle || "").trim();
    const lessonTitle = String(request.body?.lessonTitle || "").trim();
    const progressPercent = Math.max(0, Math.min(100, Number(request.body?.progressPercent || 0)));
    const viewedSeconds = Math.max(0, Number(request.body?.viewedSeconds || 0));

    await pool.query(
      `
      INSERT INTO student_video_activity
      (student_id, course_id, chapter_title, lesson_title, progress_percent, viewed_seconds, last_viewed_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      `,
      [studentId, courseId || null, chapterTitle || null, lessonTitle || null, progressPercent, viewedSeconds],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to log video activity" });
  }
});

app.get("/api/admin/technical-support/tickets", requireAdminPermission("technical-support", "read"), async (request, response) => {
  try {
    const limit = Math.max(10, Math.min(500, Number(request.query.limit || 200)));
    const search = String(request.query.search || "").trim().toLowerCase();
    const status = String(request.query.status || "all").trim().toLowerCase();
    const priority = String(request.query.priority || "all").trim().toLowerCase();
    const issueCategory = String(request.query.issueCategory || "all").trim().toLowerCase();
    const courseId = String(request.query.courseId || "").trim();
    const subject = String(request.query.subject || "").trim().toLowerCase();

    const whereParts = [];
    const params = [];
    let index = 1;

    if (search) {
      whereParts.push(`(LOWER(t.ticket_code) LIKE $${index} OR LOWER(t.student_name) LIKE $${index} OR LOWER(t.student_email) LIKE $${index} OR LOWER(t.subject) LIKE $${index} OR LOWER(t.course_title) LIKE $${index})`);
      params.push(`%${search}%`);
      index += 1;
    }

    if (subject) {
      whereParts.push(`LOWER(t.subject) LIKE $${index}`);
      params.push(`%${subject}%`);
      index += 1;
    }

    if (status !== "all") {
      whereParts.push(`t.status = $${index}`);
      params.push(status);
      index += 1;
    }

    if (priority !== "all") {
      whereParts.push(`t.priority = $${index}`);
      params.push(priority);
      index += 1;
    }

    if (issueCategory !== "all") {
      whereParts.push(`t.issue_category = $${index}`);
      params.push(issueCategory);
      index += 1;
    }

    if (courseId) {
      whereParts.push(`t.course_id = $${index}`);
      params.push(courseId);
      index += 1;
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit);

    const listResult = await pool.query(
      `
      SELECT
        t.*,
        COUNT(m.id)::int AS message_count,
        MAX(m.created_at) AS latest_message_at
      FROM technical_support_tickets t
      LEFT JOIN technical_support_messages m ON m.ticket_id = t.id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.updated_at DESC
      LIMIT $${index}
      `,
      params,
    );

    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_count,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_count,
        COUNT(*) FILTER (WHERE priority = 'high' AND status NOT IN ('resolved', 'closed'))::int AS high_count,
        COUNT(*) FILTER (WHERE priority = 'medium' AND status NOT IN ('resolved', 'closed'))::int AS medium_count,
        COUNT(*) FILTER (WHERE priority = 'low' AND status NOT IN ('resolved', 'closed'))::int AS low_count
      FROM technical_support_tickets
      `,
    );

    const categoryResult = await pool.query(
      `
      SELECT issue_category, COUNT(*)::int AS total
      FROM technical_support_tickets
      GROUP BY issue_category
      ORDER BY total DESC
      `,
    );

    const courseResult = await pool.query(
      `
      SELECT course_id, course_title, COUNT(*)::int AS total
      FROM technical_support_tickets
      GROUP BY course_id, course_title
      ORDER BY total DESC, course_title ASC
      `,
    );

    response.json({
      items: listResult.rows.map((row) => ({
        ...mapSupportTicket(row),
        messageCount: Number(row.message_count || 0),
        latestMessageAt: row.latest_message_at,
      })),
      summary: summaryResult.rows[0] || {
        total: 0,
        open_count: 0,
        in_progress_count: 0,
        resolved_count: 0,
        closed_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
      },
      categories: categoryResult.rows.map((row) => ({
        issueCategory: row.issue_category,
        total: Number(row.total || 0),
      })),
      courses: courseResult.rows.map((row) => ({
        courseId: row.course_id,
        courseTitle: row.course_title,
        total: Number(row.total || 0),
      })),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load technical support tickets" });
  }
});

app.get("/api/admin/technical-support/tickets/:id", requireAdminPermission("technical-support", "read"), async (request, response) => {
  try {
    const ticketId = Number(request.params.id || 0);
    if (!ticketId) {
      response.status(400).json({ message: "Ticket id is required" });
      return;
    }

    const [ticketResult, messageResult] = await Promise.all([
      pool.query("SELECT * FROM technical_support_tickets WHERE id = $1", [ticketId]),
      pool.query("SELECT * FROM technical_support_messages WHERE ticket_id = $1 ORDER BY created_at ASC", [ticketId]),
    ]);

    if (ticketResult.rowCount === 0) {
      response.status(404).json({ message: "Ticket not found" });
      return;
    }

    response.json({
      ticket: mapSupportTicket(ticketResult.rows[0]),
      messages: messageResult.rows.map(mapSupportMessage),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load ticket details" });
  }
});

app.post("/api/admin/technical-support/tickets/:id/reply", requireAdminPermission("technical-support", "edit"), async (request, response) => {
  const client = await pool.connect();
  try {
    const ticketId = Number(request.params.id || 0);
    const message = String(request.body?.message || "").trim();
    const status = String(request.body?.status || "").trim().toLowerCase();
    const senderId = String(request.adminSession?.admin?.id || "").trim();
    const senderName = String(request.adminSession?.admin?.name || request.adminSession?.admin?.email || "Admin").trim();

    if (!ticketId || !message) {
      response.status(400).json({ message: "ticket id and message are required" });
      return;
    }

    const allowedStatus = ["open", "in_progress", "resolved", "closed"];
    const nextStatus = allowedStatus.includes(status) ? status : "in_progress";

    await client.query("BEGIN");
    const ticketResult = await client.query(
      "SELECT * FROM technical_support_tickets WHERE id = $1 FOR UPDATE",
      [ticketId],
    );

    if (ticketResult.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Ticket not found" });
      return;
    }

    await client.query(
      `
      INSERT INTO technical_support_messages
      (ticket_id, sender_role, sender_id, sender_name, message)
      VALUES ($1,'admin',$2,$3,$4)
      `,
      [ticketId, senderId || null, senderName || "Admin", message],
    );

    await client.query(
      `
      UPDATE technical_support_tickets
      SET status = $2,
          last_reply_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [ticketId, nextStatus],
    );

    await client.query("COMMIT");
    response.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to send admin reply" });
  } finally {
    client.release();
  }
});

app.post("/api/admin/technical-support/tickets/:id/status", requireAdminPermission("technical-support", "edit"), async (request, response) => {
  try {
    const ticketId = Number(request.params.id || 0);
    const status = String(request.body?.status || "").trim().toLowerCase();
    const allowedStatus = ["open", "in_progress", "resolved", "closed"];

    if (!ticketId || !allowedStatus.includes(status)) {
      response.status(400).json({ message: "Valid ticket id and status are required" });
      return;
    }

    await pool.query(
      `
      UPDATE technical_support_tickets
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [ticketId, status],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update ticket status" });
  }
});

app.delete("/api/admin/technical-support/tickets/:id", requireAdminPermission("technical-support", "delete"), async (request, response) => {
  try {
    const ticketId = Number(request.params.id || 0);
    if (!ticketId) {
      response.status(400).json({ message: "Valid ticket id is required" });
      return;
    }

    const ticketResult = await pool.query(
      "SELECT id, ticket_code, student_id FROM technical_support_tickets WHERE id = $1",
      [ticketId],
    );

    if (ticketResult.rowCount === 0) {
      response.status(404).json({ message: "Ticket not found" });
      return;
    }

    await pool.query("DELETE FROM technical_support_tickets WHERE id = $1", [ticketId]);

    await writeAdminAuditLog({
      adminId: request.adminSession?.admin?.id,
      adminEmail: request.adminSession?.admin?.email,
      action: "delete",
      moduleKey: "technical-support",
      targetType: "technical_support_ticket",
      targetId: String(ticketId),
      ipAddress: getIpAddress(request),
      userAgent: request.headers["user-agent"],
      details: {
        ticketCode: ticketResult.rows[0]?.ticket_code,
        studentId: ticketResult.rows[0]?.student_id,
      },
    });

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete ticket" });
  }
});

app.get("/api/admin/marketing/campaigns", requireAdminPermission("marketing", "read"), async (request, response) => {
  try {
    const search = String(request.query.search || "").trim().toLowerCase();
    const status = String(request.query.status || "all").trim().toLowerCase();
    const whereParts = [];
    const params = [];
    let idx = 1;

    if (search) {
      whereParts.push(`(LOWER(title) LIKE $${idx} OR LOWER(message) LIKE $${idx})`);
      params.push(`%${search}%`);
      idx += 1;
    }

    if (status === "enabled") {
      whereParts.push("is_enabled = TRUE");
    } else if (status === "disabled") {
      whereParts.push("is_enabled = FALSE");
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const result = await pool.query(
      `
      SELECT *
      FROM marketing_campaigns
      ${whereClause}
      ORDER BY updated_at DESC
      `,
      params,
    );

    response.json({ items: result.rows.map(mapMarketingCampaign) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load marketing campaigns" });
  }
});

app.post("/api/admin/marketing/campaigns", requireAdminPermission("marketing", "create"), async (request, response) => {
  try {
    const actor = String(request.adminSession?.admin?.email || "system");
    const payload = parseMarketingCampaignPayload(request.body || {}, actor);
    const campaignKey = `mkt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const insertResult = await pool.query(
      `
      INSERT INTO marketing_campaigns (
        campaign_key, title, message, content_type, media_url, cta_text, cta_url,
        page_scope, page_paths, target_student_ids, target_course_ids, target_subjects, target_languages,
        starts_at, ends_at, show_delay_seconds, repeat_after_close_minutes, max_impressions_per_user,
        is_dismissible, is_enabled, created_by, updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22
      )
      RETURNING *
      `,
      [
        campaignKey,
        payload.title,
        payload.message,
        payload.contentType,
        payload.mediaUrl,
        payload.ctaText,
        payload.ctaUrl,
        payload.pageScope,
        JSON.stringify(payload.pagePaths),
        JSON.stringify(payload.targetStudentIds),
        JSON.stringify(payload.targetCourseIds),
        JSON.stringify(payload.targetSubjects),
        JSON.stringify(payload.targetLanguages),
        payload.startsAt,
        payload.endsAt,
        payload.showDelaySeconds,
        payload.repeatAfterCloseMinutes,
        payload.maxImpressionsPerUser,
        payload.isDismissible,
        payload.isEnabled,
        payload.actor,
        payload.actor,
      ],
    );

    response.json({ ok: true, item: mapMarketingCampaign(insertResult.rows[0]) });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Failed to create campaign" });
  }
});

app.put("/api/admin/marketing/campaigns/:id", requireAdminPermission("marketing", "edit"), async (request, response) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      response.status(400).json({ message: "Invalid campaign id" });
      return;
    }

    const actor = String(request.adminSession?.admin?.email || "system");
    const payload = parseMarketingCampaignPayload(request.body || {}, actor);

    const updateResult = await pool.query(
      `
      UPDATE marketing_campaigns
      SET
        title = $2,
        message = $3,
        content_type = $4,
        media_url = $5,
        cta_text = $6,
        cta_url = $7,
        page_scope = $8,
        page_paths = $9::jsonb,
        target_student_ids = $10::jsonb,
        target_course_ids = $11::jsonb,
        target_subjects = $12::jsonb,
        target_languages = $13::jsonb,
        starts_at = $14,
        ends_at = $15,
        show_delay_seconds = $16,
        repeat_after_close_minutes = $17,
        max_impressions_per_user = $18,
        is_dismissible = $19,
        is_enabled = $20,
        updated_by = $21,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        payload.title,
        payload.message,
        payload.contentType,
        payload.mediaUrl,
        payload.ctaText,
        payload.ctaUrl,
        payload.pageScope,
        JSON.stringify(payload.pagePaths),
        JSON.stringify(payload.targetStudentIds),
        JSON.stringify(payload.targetCourseIds),
        JSON.stringify(payload.targetSubjects),
        JSON.stringify(payload.targetLanguages),
        payload.startsAt,
        payload.endsAt,
        payload.showDelaySeconds,
        payload.repeatAfterCloseMinutes,
        payload.maxImpressionsPerUser,
        payload.isDismissible,
        payload.isEnabled,
        payload.actor,
      ],
    );

    if (!updateResult.rows[0]) {
      response.status(404).json({ message: "Campaign not found" });
      return;
    }

    response.json({ ok: true, item: mapMarketingCampaign(updateResult.rows[0]) });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Failed to update campaign" });
  }
});

app.post("/api/admin/marketing/campaigns/:id/toggle", requireAdminPermission("marketing", "edit"), async (request, response) => {
  try {
    const id = Number(request.params.id);
    const enabled = request.body?.isEnabled !== false;
    const actor = String(request.adminSession?.admin?.email || "system");
    const updateResult = await pool.query(
      `
      UPDATE marketing_campaigns
      SET is_enabled = $2, updated_by = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, enabled, actor],
    );

    if (!updateResult.rows[0]) {
      response.status(404).json({ message: "Campaign not found" });
      return;
    }

    response.json({ ok: true, item: mapMarketingCampaign(updateResult.rows[0]) });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Failed to toggle campaign" });
  }
});

app.delete("/api/admin/marketing/campaigns/:id", requireAdminPermission("marketing", "delete"), async (request, response) => {
  try {
    const id = Number(request.params.id);
    await pool.query("DELETE FROM marketing_campaigns WHERE id = $1", [id]);
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete campaign" });
  }
});

app.get("/api/marketing/active", async (request, response) => {
  try {
    const now = new Date();
    const pathName = String(request.query.path || "/").trim() || "/";
    const courseId = String(request.query.courseId || "").trim();
    const subject = String(request.query.subject || "").trim().toLowerCase();
    const language = String(request.query.language || "").trim().toLowerCase();
    const pageSeconds = Math.max(0, Number(request.query.pageSeconds || 0));
    const sessionId = String(request.query.sessionId || "").trim();

    const optionalSession = await resolveStudentSessionFromRequest(request);
    const studentId = optionalSession?.studentId || "";

    const campaignResult = await pool.query(
      `
      SELECT *
      FROM marketing_campaigns
      WHERE is_enabled = TRUE
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
      ORDER BY updated_at DESC
      LIMIT 100
      `,
    );

    const campaigns = campaignResult.rows.map(mapMarketingCampaign);
    if (campaigns.length === 0) {
      response.json({ items: [] });
      return;
    }

    const campaignIds = campaigns.map((item) => item.id);
    const statsResult = await pool.query(
      `
      SELECT
        campaign_id,
        COUNT(*) FILTER (WHERE event_type = 'shown')::int AS shown_count,
        MAX(event_at) FILTER (WHERE event_type = 'dismissed') AS last_dismissed_at
      FROM marketing_campaign_events
      WHERE campaign_id = ANY($1)
        AND (
          ($2 <> '' AND student_id = $2)
          OR ($3 <> '' AND session_id = $3)
        )
      GROUP BY campaign_id
      `,
      [campaignIds, studentId, sessionId],
    );

    const statsByCampaign = Object.fromEntries(
      statsResult.rows.map((row) => [
        Number(row.campaign_id),
        {
          shownCount: Number(row.shown_count || 0),
          lastDismissedAt: row.last_dismissed_at ? new Date(row.last_dismissed_at) : null,
        },
      ]),
    );

    const activeItems = campaigns.filter((campaign) => {
      if (campaign.startsAt && new Date(campaign.startsAt) > now) return false;
      if (campaign.endsAt && new Date(campaign.endsAt) < now) return false;

      if (campaign.pageScope === "specific") {
        if (!campaign.pagePaths.some((rule) => matchPathPattern(pathName, rule))) return false;
      }

      if (campaign.targetStudentIds.length > 0 && !campaign.targetStudentIds.includes(studentId)) return false;
      if (campaign.targetCourseIds.length > 0 && !campaign.targetCourseIds.includes(courseId)) return false;
      if (campaign.targetSubjects.length > 0 && !campaign.targetSubjects.includes(subject)) return false;
      if (campaign.targetLanguages.length > 0 && !campaign.targetLanguages.includes(language)) return false;
      if (campaign.showDelaySeconds > 0 && pageSeconds < campaign.showDelaySeconds) return false;

      const stats = statsByCampaign[campaign.id] || { shownCount: 0, lastDismissedAt: null };
      if (campaign.maxImpressionsPerUser > 0 && stats.shownCount >= campaign.maxImpressionsPerUser) return false;

      if (campaign.repeatAfterCloseMinutes > 0 && stats.lastDismissedAt) {
        const nextEligibleAt = new Date(stats.lastDismissedAt.getTime() + campaign.repeatAfterCloseMinutes * 60 * 1000);
        if (nextEligibleAt > now) return false;
      }

      return true;
    });

    response.json({ items: activeItems.slice(0, 5) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load active marketing campaigns" });
  }
});

app.post("/api/marketing/events", async (request, response) => {
  try {
    const campaignId = Number(request.body?.campaignId);
    const eventType = String(request.body?.eventType || "").trim().toLowerCase();
    const sessionId = String(request.body?.sessionId || "").trim();
    const pathName = String(request.body?.pathName || "").trim();

    if (!Number.isFinite(campaignId) || campaignId <= 0) {
      response.status(400).json({ message: "Invalid campaign id" });
      return;
    }

    if (!["shown", "dismissed", "clicked"].includes(eventType)) {
      response.status(400).json({ message: "Invalid event type" });
      return;
    }

    const optionalSession = await resolveStudentSessionFromRequest(request);
    const studentId = optionalSession?.studentId || null;

    await pool.query(
      `
      INSERT INTO marketing_campaign_events (campaign_id, event_type, student_id, session_id, path_name)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [campaignId, eventType, studentId, sessionId || null, pathName || null],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to track marketing event" });
  }
});

app.get("/api/courses", async (_request, response) => {
  try {
    const courseResult = await pool.query("SELECT id, payload FROM courses ORDER BY updated_at DESC");
    const curriculumResult = await pool.query("SELECT course_id, chapters FROM course_curricula");
    response.json({
      courses: courseResult.rows.map((row) => row.payload),
      curricula: Object.fromEntries(curriculumResult.rows.map((row) => [row.course_id, row.chapters])),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load courses" });
  }
});

app.post("/api/courses/upsert", requireAdminPermission("courses", "edit"), async (request, response) => {
  try {
    const course = request.body?.course;
    if (!course?.id) {
      response.status(400).json({ message: "course.id is required" });
      return;
    }
    await pool.query(
      `
      INSERT INTO courses (id, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [String(course.id), JSON.stringify(course)],
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save course" });
  }
});

app.post("/api/courses/:id/duplicate", requireAdminPermission("courses", "edit"), async (request, response) => {
  const client = await pool.connect();
  try {
    const sourceCourseId = String(request.params.id || "").trim();
    const targetCourseId = String(request.body?.id || "").trim();
    const title = String(request.body?.title || "").trim();

    if (!sourceCourseId) {
      response.status(400).json({ message: "Source course id is required" });
      return;
    }

    if (!targetCourseId) {
      response.status(400).json({ message: "Target course id is required" });
      return;
    }

    if (!title) {
      response.status(400).json({ message: "Duplicate course title is required" });
      return;
    }

    await client.query("BEGIN");

    const sourceCourseResult = await client.query(
      "SELECT payload FROM courses WHERE id = $1",
      [sourceCourseId],
    );

    const sourceCourse = sourceCourseResult.rows[0]?.payload;
    if (!sourceCourse) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Source course not found" });
      return;
    }

    const duplicatedCourse = {
      ...sourceCourse,
      id: targetCourseId,
      title,
      isVisible: false,
      enrollmentCount: 0,
    };

    await client.query(
      `
      INSERT INTO courses (id, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [targetCourseId, JSON.stringify(duplicatedCourse)],
    );

    const sourceCurriculumResult = await client.query(
      "SELECT chapters FROM course_curricula WHERE course_id = $1",
      [sourceCourseId],
    );

    const sourceChapters = sourceCurriculumResult.rows[0]?.chapters;
    if (Array.isArray(sourceChapters)) {
      await client.query(
        `
        INSERT INTO course_curricula (course_id, chapters, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (course_id)
        DO UPDATE SET chapters = EXCLUDED.chapters, updated_at = NOW()
        `,
        [targetCourseId, JSON.stringify(sourceChapters)],
      );
    }

    await client.query("COMMIT");
    response.json({ ok: true, course: duplicatedCourse });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to duplicate course" });
  } finally {
    client.release();
  }
});

app.delete("/api/courses/:id", requireAdminPermission("courses", "delete"), async (request, response) => {
  try {
    const courseId = String(request.params.id);
    await pool.query("DELETE FROM course_curricula WHERE course_id = $1", [courseId]);
    await pool.query("DELETE FROM courses WHERE id = $1", [courseId]);
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete course" });
  }
});

app.get("/api/courses/:id/curriculum", async (request, response) => {
  try {
    const result = await pool.query(
      "SELECT chapters FROM course_curricula WHERE course_id = $1",
      [String(request.params.id)],
    );
    response.json({ chapters: result.rows[0]?.chapters || [] });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch curriculum" });
  }
});

app.post("/api/courses/:id/curriculum", requireAdminPermission("course-content", "edit"), async (request, response) => {
  try {
    const courseId = String(request.params.id);
    const chapters = Array.isArray(request.body?.chapters) ? request.body.chapters : [];
    await pool.query(
      `
      INSERT INTO course_curricula (course_id, chapters, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (course_id)
      DO UPDATE SET chapters = EXCLUDED.chapters, updated_at = NOW()
      `,
      [courseId, JSON.stringify(chapters)],
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save curriculum" });
  }
});

const buildCourseLookup = async () => {
  const courseResult = await pool.query("SELECT id, payload FROM courses");
  return courseResult.rows.reduce((acc, row) => {
    const payload = row.payload || {};
    const courseId = String(row.id || "");
    if (!courseId) return acc;
    acc[courseId] = {
      id: courseId,
      title: String(payload.title || "Untitled Course"),
      thumbnail: String(payload.thumbnail || payload.image || ""),
    };
    return acc;
  }, {});
};

const mapFacultyProfile = (row, courseLookup = {}) => {
  const courseIds = normalizeStringList(row.course_ids);
  return {
    id: String(row.id),
    name: String(row.name || ""),
    photoUrl: String(row.photo_url || ""),
    about: String(row.about || ""),
    courseIds,
    courses: courseIds
      .map((courseId) => courseLookup[courseId])
      .filter(Boolean),
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

app.get("/api/admin/faculty", requireAdminPermission("faculty", "read"), async (_request, response) => {
  try {
    const [facultyResult, courseLookup] = await Promise.all([
      pool.query("SELECT * FROM faculty_profiles ORDER BY sort_order ASC, created_at DESC"),
      buildCourseLookup(),
    ]);

    response.json({
      items: facultyResult.rows.map((row) => mapFacultyProfile(row, courseLookup)),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load faculty" });
  }
});

app.post("/api/admin/faculty", requireAdminPermission("faculty", "create"), async (request, response) => {
  try {
    const name = String(request.body?.name || "").trim();
    const photoUrl = String(request.body?.photoUrl || "").trim();
    const about = String(request.body?.about || "").trim();
    const courseIds = normalizeStringList(request.body?.courseIds);
    const isActive = request.body?.isActive !== false;
    const sortOrder = Number(request.body?.sortOrder || Date.now());

    if (!name) {
      response.status(400).json({ message: "Faculty name is required" });
      return;
    }

    const id = String(request.body?.id || `faculty-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    await pool.query(
      `
      INSERT INTO faculty_profiles (id, name, photo_url, about, course_ids, is_active, sort_order, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
      `,
      [id, name, photoUrl || null, about || null, JSON.stringify(courseIds), isActive, sortOrder],
    );

    const [itemResult, courseLookup] = await Promise.all([
      pool.query("SELECT * FROM faculty_profiles WHERE id = $1", [id]),
      buildCourseLookup(),
    ]);

    response.status(201).json({ item: mapFacultyProfile(itemResult.rows[0], courseLookup) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to create faculty" });
  }
});

app.put("/api/admin/faculty/:id", requireAdminPermission("faculty", "edit"), async (request, response) => {
  try {
    const id = String(request.params.id);
    const name = String(request.body?.name || "").trim();
    const photoUrl = String(request.body?.photoUrl || "").trim();
    const about = String(request.body?.about || "").trim();
    const courseIds = normalizeStringList(request.body?.courseIds);
    const isActive = request.body?.isActive !== false;
    const sortOrder = Number(request.body?.sortOrder || 0);

    if (!name) {
      response.status(400).json({ message: "Faculty name is required" });
      return;
    }

    const existing = await pool.query("SELECT id FROM faculty_profiles WHERE id = $1", [id]);
    if (!existing.rows[0]) {
      response.status(404).json({ message: "Faculty not found" });
      return;
    }

    await pool.query(
      `
      UPDATE faculty_profiles
      SET name = $2,
          photo_url = $3,
          about = $4,
          course_ids = $5::jsonb,
          is_active = $6,
          sort_order = $7,
          updated_at = NOW()
      WHERE id = $1
      `,
      [id, name, photoUrl || null, about || null, JSON.stringify(courseIds), isActive, sortOrder],
    );

    const [itemResult, courseLookup] = await Promise.all([
      pool.query("SELECT * FROM faculty_profiles WHERE id = $1", [id]),
      buildCourseLookup(),
    ]);

    response.json({ item: mapFacultyProfile(itemResult.rows[0], courseLookup) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update faculty" });
  }
});

app.delete("/api/admin/faculty/:id", requireAdminPermission("faculty", "delete"), async (request, response) => {
  try {
    const id = String(request.params.id);
    const result = await pool.query("DELETE FROM faculty_profiles WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      response.status(404).json({ message: "Faculty not found" });
      return;
    }
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete faculty" });
  }
});

app.get("/api/faculty", async (_request, response) => {
  try {
    const [facultyResult, courseLookup] = await Promise.all([
      pool.query("SELECT * FROM faculty_profiles WHERE is_active = TRUE ORDER BY sort_order ASC, created_at DESC"),
      buildCourseLookup(),
    ]);

    response.json({
      items: facultyResult.rows.map((row) => mapFacultyProfile(row, courseLookup)),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load faculty" });
  }
});

app.get("/api/homepage", async (_request, response) => {
  try {
    const result = await pool.query("SELECT banners, testimonials, announcements FROM homepage_content WHERE id = 1");
    const row = result.rows[0] || { banners: [], testimonials: [], announcements: [] };
    response.json({
      banners: row.banners || [],
      testimonials: row.testimonials || [],
      announcements: row.announcements || [],
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load homepage data" });
  }
});

app.put("/api/homepage", requireAdminPermission("homepage", "edit"), async (request, response) => {
  try {
    const banners = Array.isArray(request.body?.banners) ? request.body.banners : [];
    const testimonials = Array.isArray(request.body?.testimonials) ? request.body.testimonials : [];
    const announcements = Array.isArray(request.body?.announcements) ? request.body.announcements : [];

    await pool.query(
      `
      UPDATE homepage_content
      SET banners = $1::jsonb,
          testimonials = $2::jsonb,
          announcements = $3::jsonb,
          updated_at = NOW()
      WHERE id = 1
      `,
      [JSON.stringify(banners), JSON.stringify(testimonials), JSON.stringify(announcements)],
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update homepage" });
  }
});

app.get("/api/lead-form-settings", async (_request, response) => {
  try {
    const result = await pool.query("SELECT data FROM lead_form_settings WHERE id = 1 LIMIT 1");
    const normalized = normalizeLeadFormSettings(result.rows[0]?.data || {});
    response.json({ settings: normalized });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load lead form settings" });
  }
});

app.post("/api/leads/enquiry", async (request, response) => {
  try {
    const settingsResult = await pool.query("SELECT data FROM lead_form_settings WHERE id = 1 LIMIT 1");
    const settings = normalizeLeadFormSettings(settingsResult.rows[0]?.data || {});
    const body = request.body || {};
    const fieldMap = Object.fromEntries(settings.fields.map((field) => [field.key, field]));

    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();
    const mobile = String(body.mobile || "").replace(/\D/g, "").slice(-10);
    const email = String(body.email || "").trim();
    const enquiryMessage = String(body.message || "").trim();
    const source = String(body.source || "enquiry_now").trim().toLowerCase() || "enquiry_now";
    const streams = normalizeStringList(Array.isArray(body.streams) ? body.streams : [body.streams]);
    const submittedCustomValues = body.customFieldValues && typeof body.customFieldValues === "object"
      ? body.customFieldValues
      : {};

    if (fieldMap.name?.enabled !== false && fieldMap.name?.mandatory && !name) {
      response.status(400).json({ message: "Name is required" });
      return;
    }

    if (fieldMap.address?.enabled !== false && fieldMap.address?.mandatory && !address) {
      response.status(400).json({ message: "Address is required" });
      return;
    }

    if (fieldMap.mobile?.enabled !== false && fieldMap.mobile?.mandatory && mobile.length !== 10) {
      response.status(400).json({ message: "Valid 10-digit mobile number is required" });
      return;
    }

    if (fieldMap.email?.enabled !== false && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ message: "Enter a valid email address" });
      return;
    }

    const allowedStreamOptions = new Set(settings.stream.options.map((item) => item.toLowerCase()));
    const sanitizedStreams = streams.filter((item) => allowedStreamOptions.has(item.toLowerCase()));

    if (settings.stream.enabled && settings.stream.mandatory && sanitizedStreams.length === 0) {
      response.status(400).json({ message: "Please select at least one stream" });
      return;
    }

    const finalStreams = settings.stream.allowMultiple ? sanitizedStreams : sanitizedStreams.slice(0, 1);

    const customFieldValues = {};

    for (const customField of settings.customFields || []) {
      if (customField.enabled === false) continue;

      const rawValue = submittedCustomValues[customField.key];
      if (customField.type === "select") {
        const selected = String(rawValue || "").trim();
        if (customField.mandatory && !selected) {
          response.status(400).json({ message: `${customField.label} is required` });
          return;
        }

        if (selected) {
          const allowed = new Set((customField.options || []).map((item) => String(item || "").toLowerCase()));
          if (!allowed.has(selected.toLowerCase())) {
            response.status(400).json({ message: `Invalid value selected for ${customField.label}` });
            return;
          }
          customFieldValues[customField.key] = selected;
        }
        continue;
      }

      if (customField.type === "number") {
        const textValue = String(rawValue ?? "").trim();
        if (customField.mandatory && !textValue) {
          response.status(400).json({ message: `${customField.label} is required` });
          return;
        }
        if (textValue) {
          const numberValue = Number(textValue);
          if (!Number.isFinite(numberValue)) {
            response.status(400).json({ message: `${customField.label} must be a valid number` });
            return;
          }
          customFieldValues[customField.key] = numberValue;
        }
        continue;
      }

      const textValue = String(rawValue ?? "").trim();
      if (customField.mandatory && !textValue) {
        response.status(400).json({ message: `${customField.label} is required` });
        return;
      }
      if (textValue) {
        customFieldValues[customField.key] = textValue;
      }
    }

    const rawExtraData = body.extraData && typeof body.extraData === "object" ? body.extraData : {};
    const extraData = {
      ...rawExtraData,
      customFieldValues,
    };

    const insertResult = await pool.query(
      `
      INSERT INTO enquiry_leads
      (source, name, address, mobile, email, streams, status, enquiry_message, extra_data, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,'fresh',$7,$8::jsonb,NOW(),NOW())
      RETURNING *
      `,
      [
        source,
        name,
        address,
        mobile,
        email || null,
        JSON.stringify(finalStreams),
        enquiryMessage || null,
        JSON.stringify(extraData),
      ],
    );

    response.status(201).json({ ok: true, item: mapLeadRow(insertResult.rows[0]) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to submit enquiry" });
  }
});

app.get("/api/admin/lead-form-settings", requireAdminPermission("leads", "read"), async (_request, response) => {
  try {
    const result = await pool.query("SELECT data FROM lead_form_settings WHERE id = 1 LIMIT 1");
    const settings = normalizeLeadFormSettings(result.rows[0]?.data || {});
    response.json({ settings });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load lead form settings" });
  }
});

app.put("/api/admin/lead-form-settings", requireAdminPermission("leads", "edit"), async (request, response) => {
  try {
    const incoming = request.body?.settings && typeof request.body.settings === "object" ? request.body.settings : {};
    const settings = normalizeLeadFormSettings(incoming);

    await pool.query(
      `
      INSERT INTO lead_form_settings (id, data, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `,
      [JSON.stringify(settings)],
    );

    response.json({ ok: true, settings });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save lead form settings" });
  }
});

app.get("/api/admin/leads", requireAdminPermission("leads", "read"), async (request, response) => {
  try {
    const search = String(request.query.search || "").trim().toLowerCase();
    const status = normalizeLeadStatus(String(request.query.status || "all").trim().toLowerCase());
    const rawStatus = String(request.query.status || "all").trim().toLowerCase();
    const source = String(request.query.source || "all").trim().toLowerCase();
    const stream = String(request.query.stream || "").trim().toLowerCase();
    const from = String(request.query.from || "").trim();
    const to = String(request.query.to || "").trim();
    const limit = Math.max(10, Math.min(2000, Number(request.query.limit || 500)));

    const where = [];
    const params = [];
    let index = 1;

    if (search) {
      where.push(`(
        LOWER(l.name) LIKE $${index}
        OR LOWER(l.mobile) LIKE $${index}
        OR LOWER(COALESCE(l.email, '')) LIKE $${index}
        OR LOWER(COALESCE(l.address, '')) LIKE $${index}
      )`);
      params.push(`%${search}%`);
      index += 1;
    }

    if (rawStatus !== "all") {
      where.push(`LOWER(l.status) = $${index}`);
      params.push(status);
      index += 1;
    }

    if (source !== "all") {
      where.push(`LOWER(l.source) = $${index}`);
      params.push(source);
      index += 1;
    }

    if (stream) {
      where.push(`EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(l.streams, '[]'::jsonb)) AS s(value)
        WHERE LOWER(s.value) = $${index}
      )`);
      params.push(stream);
      index += 1;
    }

    if (from) {
      const parsed = new Date(from);
      if (!Number.isNaN(parsed.getTime())) {
        where.push(`l.created_at >= $${index}`);
        params.push(parsed.toISOString());
        index += 1;
      }
    }

    if (to) {
      const parsed = new Date(to);
      if (!Number.isNaN(parsed.getTime())) {
        where.push(`l.created_at <= $${index}`);
        params.push(parsed.toISOString());
        index += 1;
      }
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    params.push(limit);
    const listResult = await pool.query(
      `
      SELECT
        l.*,
        COUNT(f.id)::int AS follow_up_count,
        MAX(f.created_at) AS latest_follow_up_at
      FROM enquiry_leads l
      LEFT JOIN lead_follow_ups f ON f.lead_id = l.id
      ${whereClause}
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT $${index}
      `,
      params,
    );

    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(status) = 'fresh')::int AS fresh_count,
        COUNT(*) FILTER (WHERE LOWER(status) = 'follow_up')::int AS follow_up_count,
        COUNT(*) FILTER (WHERE LOWER(status) = 'qualified')::int AS qualified_count,
        COUNT(*) FILTER (WHERE LOWER(status) = 'won')::int AS won_count,
        COUNT(*) FILTER (WHERE LOWER(status) = 'lost')::int AS lost_count
      FROM enquiry_leads
      `,
    );

    const summary = summaryResult.rows[0] || {};
    const items = listResult.rows.map((row) => ({
      ...mapLeadRow(row),
      followUpCount: Number(row.follow_up_count || 0),
      latestFollowUpAt: row.latest_follow_up_at,
    }));

    response.json({
      items,
      summary: {
        total: Number(summary.total || 0),
        freshCount: Number(summary.fresh_count || 0),
        followUpCount: Number(summary.follow_up_count || 0),
        qualifiedCount: Number(summary.qualified_count || 0),
        wonCount: Number(summary.won_count || 0),
        lostCount: Number(summary.lost_count || 0),
      },
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load leads" });
  }
});

app.get("/api/admin/leads/:id", requireAdminPermission("leads", "read"), async (request, response) => {
  try {
    const leadId = Number(request.params.id || 0);
    if (!leadId || Number.isNaN(leadId)) {
      response.status(400).json({ message: "Valid lead id is required" });
      return;
    }

    const [leadResult, followUpsResult] = await Promise.all([
      pool.query("SELECT * FROM enquiry_leads WHERE id = $1 LIMIT 1", [leadId]),
      pool.query("SELECT * FROM lead_follow_ups WHERE lead_id = $1 ORDER BY created_at DESC", [leadId]),
    ]);

    if (leadResult.rowCount === 0) {
      response.status(404).json({ message: "Lead not found" });
      return;
    }

    response.json({
      lead: mapLeadRow(leadResult.rows[0]),
      followUps: followUpsResult.rows.map(mapLeadFollowUpRow),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load lead details" });
  }
});

app.patch("/api/admin/leads/:id", requireAdminPermission("leads", "edit"), async (request, response) => {
  try {
    const leadId = Number(request.params.id || 0);
    const nextStatus = normalizeLeadStatus(request.body?.status || "fresh");
    if (!leadId || Number.isNaN(leadId)) {
      response.status(400).json({ message: "Valid lead id is required" });
      return;
    }

    const updateResult = await pool.query(
      `
      UPDATE enquiry_leads
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [leadId, nextStatus],
    );

    if (updateResult.rowCount === 0) {
      response.status(404).json({ message: "Lead not found" });
      return;
    }

    response.json({ item: mapLeadRow(updateResult.rows[0]) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update lead" });
  }
});

app.post("/api/admin/leads/:id/follow-ups", requireAdminPermission("leads", "edit"), async (request, response) => {
  const client = await pool.connect();
  try {
    const leadId = Number(request.params.id || 0);
    const commentText = String(request.body?.commentText || "").trim();
    const status = normalizeLeadStatus(request.body?.status || "follow_up");
    const createdBy = String(request.adminSession?.admin?.email || request.adminSession?.admin?.id || "admin");
    const nextFollowUpRaw = String(request.body?.nextFollowUpAt || "").trim();
    const nextFollowUpAt = nextFollowUpRaw ? new Date(nextFollowUpRaw) : null;

    if (!leadId || Number.isNaN(leadId)) {
      response.status(400).json({ message: "Valid lead id is required" });
      return;
    }

    if (!commentText) {
      response.status(400).json({ message: "Follow-up comment is required" });
      return;
    }

    if (nextFollowUpAt && Number.isNaN(nextFollowUpAt.getTime())) {
      response.status(400).json({ message: "Invalid next follow-up date" });
      return;
    }

    await client.query("BEGIN");

    const leadResult = await client.query("SELECT id FROM enquiry_leads WHERE id = $1 FOR UPDATE", [leadId]);
    if (leadResult.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Lead not found" });
      return;
    }

    const followResult = await client.query(
      `
      INSERT INTO lead_follow_ups
      (lead_id, comment_text, next_follow_up_at, status, created_by, created_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      RETURNING *
      `,
      [leadId, commentText, nextFollowUpAt ? nextFollowUpAt.toISOString() : null, status, createdBy],
    );

    const leadUpdateResult = await client.query(
      `
      UPDATE enquiry_leads
      SET
        status = $2,
        last_follow_up_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [leadId, status],
    );

    await client.query("COMMIT");
    response.json({
      ok: true,
      followUp: mapLeadFollowUpRow(followResult.rows[0]),
      lead: mapLeadRow(leadUpdateResult.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to add follow-up" });
  } finally {
    client.release();
  }
});

app.post("/api/uploads/image", requireAdminPermission("course-content", "create"), async (request, response) => {
  try {
    const fileName = sanitizeFileName(request.body?.fileName || `image-${Date.now()}.png`);
    const folder = sanitizeFileName(request.body?.folder || "images");
    const binary = decodeBase64File(request.body?.base64Data);
    if (!binary) {
      response.status(400).json({ message: "base64Data is required" });
      return;
    }
    const targetDir = path.join(uploadsDir, folder);
    await mkdir(targetDir, { recursive: true });
    const finalName = `${Date.now()}-${fileName}`;
    const finalPath = path.join(targetDir, finalName);
    await writeFile(finalPath, binary);
    response.json({ url: `/uploads/${folder}/${finalName}` });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Image upload failed" });
  }
});

app.post("/api/uploads/bunny-video", requireAdminPermission("course-content", "create"), async (request, response) => {
  try {
    const platformSettings = await getPlatformSettings();
    const bunnySettings = sanitizePlatformSettings(platformSettings).bunnyStreamApi;
    const forceStorageUpload = String(request.headers["x-force-storage"] || request.body?.forceStorage || "") === "1";

    const rawFileNameHeader = String(request.headers["x-file-name"] || "").trim();
    const decodedFileName = (() => {
      if (!rawFileNameHeader) return "";
      try {
        return decodeURIComponent(rawFileNameHeader);
      } catch {
        return rawFileNameHeader;
      }
    })();
    const headerFolder = String(request.headers["x-upload-folder"] || "").trim();
    const fileName = sanitizeFileName(decodedFileName || request.body?.fileName || `video-${Date.now()}.mp4`);
    const isRawUpload = !request.body?.base64Data && Number(request.headers["content-length"] || 0) > 0;
    const binary = isRawUpload ? null : decodeBase64File(request.body?.base64Data);
    if (!isRawUpload && !binary) {
      response.status(400).json({ message: "base64Data is required" });
      return;
    }

    // Prefer Bunny Stream upload using admin-configured Library ID + API Key.
    if (!forceStorageUpload && bunnySettings.enabled && bunnySettings.libraryId && bunnySettings.apiKey) {
      const title = fileName.replace(/\.[a-z0-9]+$/i, "") || `video-${Date.now()}`;

      const createRes = await fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(bunnySettings.libraryId)}/videos`,
        {
          method: "POST",
          headers: {
            AccessKey: bunnySettings.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        },
      );

      if (!createRes.ok) {
        const raw = await createRes.text();
        response.status(502).json({ message: "Bunny Stream video create failed", details: raw.slice(0, 500) });
        return;
      }

      const created = await createRes.json().catch(() => ({}));
      const videoGuid = String(created?.guid || created?.videoId || created?.id || "").trim();
      if (!videoGuid) {
        response.status(502).json({ message: "Bunny Stream response missing video guid" });
        return;
      }

      const uploadRes = await fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(bunnySettings.libraryId)}/videos/${encodeURIComponent(videoGuid)}`,
        {
          method: "PUT",
          headers: {
            AccessKey: bunnySettings.apiKey,
            "Content-Type": String(request.headers["content-type"] || request.body?.mimeType || "application/octet-stream"),
          },
          body: isRawUpload ? request : binary,
          ...(isRawUpload ? { duplex: "half" } : {}),
        },
      );

      if (!uploadRes.ok) {
        const raw = await uploadRes.text();
        response.status(502).json({ message: "Bunny Stream upload failed", details: raw.slice(0, 500) });
        return;
      }

      response.json({ url: videoGuid, remotePath: videoGuid, source: "bunny-stream" });
      return;
    }

    const zone = process.env.BUNNY_STORAGE_ZONE;
    const accessKey = process.env.BUNNY_STORAGE_API_KEY;
    const region = process.env.BUNNY_STORAGE_REGION || "";
    const publicBase = process.env.BUNNY_PUBLIC_BASE_URL || "";

    if (!zone || !accessKey) {
      response.status(400).json({ message: "Missing BUNNY_STORAGE_ZONE or BUNNY_STORAGE_API_KEY" });
      return;
    }

    const folder = sanitizeFileName(headerFolder || request.body?.folder || "videos");
    const remotePath = `${folder}/${Date.now()}-${fileName}`;

    const host = region ? `${region}.storage.bunnycdn.com` : "storage.bunnycdn.com";
    const uploadUrl = `https://${host}/${zone}/${remotePath}`;
    const bunnyRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: accessKey,
        "Content-Type": String(request.headers["content-type"] || request.body?.mimeType || "application/octet-stream"),
      },
      body: isRawUpload ? request : binary,
      ...(isRawUpload ? { duplex: "half" } : {}),
    });

    if (!bunnyRes.ok) {
      const raw = await bunnyRes.text();
      response.status(502).json({ message: "Bunny upload failed", details: raw.slice(0, 500) });
      return;
    }

    const url = publicBase ? `${publicBase.replace(/\/$/, "")}/${remotePath}` : uploadUrl;
    response.json({ url, remotePath });
  } catch (error) {
    const base = error instanceof Error ? error.message : "Video upload failed";
    const cause = error && typeof error === "object" && "cause" in error
      ? (error.cause instanceof Error ? error.cause.message : String(error.cause || ""))
      : "";
    response.status(500).json({ message: cause ? `${base} | cause: ${cause}` : base });
  }
});

app.post("/api/bunny/signed-playback", async (request, response) => {
  try {
    const securityKey = String(process.env.BUNNY_TOKEN_SECURITY_KEY || "").trim();
    const envHostname = String(process.env.BUNNY_STREAM_CDN_HOSTNAME || "").trim();
    const requestHostname = String(request.body?.cdnHostname || "").trim();
    const rawVideoId = String(request.body?.videoId || "").trim();
    const expiresInSeconds = Math.max(60, Math.min(86400, Number(request.body?.expiresInSeconds || 900)));

    if (!securityKey) {
      response.status(400).json({ message: "Missing BUNNY_TOKEN_SECURITY_KEY on server" });
      return;
    }

    if (!rawVideoId) {
      response.status(400).json({ message: "videoId is required" });
      return;
    }

    const platformSettings = await getPlatformSettings();
    const settingsHostname = String(platformSettings?.bunnyStreamApi?.cdnHostname || "").trim();

    const cdnHostname = (requestHostname || envHostname || settingsHostname)
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");

    if (!cdnHostname || !/^[a-zA-Z0-9.-]+$/.test(cdnHostname)) {
      response.status(400).json({ message: "Valid cdnHostname is required" });
      return;
    }

    const videoId = sanitizeFileName(rawVideoId);
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const playlistPath = `/${videoId}/playlist.m3u8`;
    const tokenPath = `/${videoId}`;
    const token = buildBunnyToken(securityKey, playlistPath, expires);

    const playbackUrl = `https://${cdnHostname}${playlistPath}?token=${encodeURIComponent(token)}&expires=${expires}&token_path=${encodeURIComponent(tokenPath)}`;

    response.json({
      playbackUrl,
      expires,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate signed playback URL" });
  }
});

app.get("/api/admin/bunny/video-duration/:videoId", requireAdminPermission("course-content", "read"), async (request, response) => {
  try {
    const rawVideoId = String(request.params?.videoId || "").trim();
    if (!rawVideoId) {
      response.status(400).json({ message: "videoId is required" });
      return;
    }

    const videoId = sanitizeFileName(rawVideoId);
    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const bunny = settings.bunnyStreamApi || {};

    if (!bunny.enabled || !bunny.libraryId || !bunny.apiKey) {
      response.status(400).json({ message: "Bunny Stream is not configured" });
      return;
    }

    const metaRes = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/videos/${encodeURIComponent(videoId)}`,
      {
        method: "GET",
        headers: {
          AccessKey: bunny.apiKey,
          Accept: "application/json",
        },
      },
    );

    if (!metaRes.ok) {
      const raw = await metaRes.text();
      response.status(502).json({ message: "Bunny Stream metadata fetch failed", details: raw.slice(0, 500) });
      return;
    }

    const meta = await metaRes.json().catch(() => ({}));
    const durationCandidates = [
      Number(meta?.length),
      Number(meta?.duration),
      Number(meta?.videoLength),
      Number(meta?.metaTags?.duration),
    ].filter((value) => Number.isFinite(value) && value > 0);
    const durationSeconds = durationCandidates.length > 0 ? Math.floor(durationCandidates[0]) : 0;

    response.json({
      videoId,
      durationSeconds,
      ready: durationSeconds > 0,
      status: String(meta?.status || meta?.encodeProgress || "processing"),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load Bunny video duration" });
  }
});

app.get("/api/platform-settings", async (_request, response) => {
  try {
    const data = sanitizePlatformSettings(await getPlatformSettings());
    response.json({ settings: data });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load settings" });
  }
});

app.get("/api/admin/platform-settings", requireAdminPermission("settings", "read"), async (_request, response) => {
  try {
    const data = sanitizePlatformSettings(await getPlatformSettings());
    response.json({ settings: data });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load settings" });
  }
});

app.put("/api/admin/platform-settings", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const existingRaw = sanitizePlatformSettings(await getPlatformSettings());
    const incomingRaw = request.body?.settings && typeof request.body.settings === "object" ? request.body.settings : {};
    const incoming = sanitizePlatformSettings(incomingRaw);
    const nextData = sanitizePlatformSettings({
      ...existingRaw,
      ...incoming,
      bunnyStreamApi: {
        ...existingRaw.bunnyStreamApi,
        ...incoming.bunnyStreamApi,
      },
      smtp: {
        ...existingRaw.smtp,
        ...incoming.smtp,
      },
      emailAutomation: {
        ...(existingRaw.emailAutomation || {}),
        ...(incoming.emailAutomation || {}),
        templates: {
          ...((existingRaw.emailAutomation && existingRaw.emailAutomation.templates) || {}),
          ...((incoming.emailAutomation && incoming.emailAutomation.templates) || {}),
        },
      },
      siteSettings: {
        ...(existingRaw.siteSettings || {}),
        ...(incoming.siteSettings || {}),
      },
      homepage: {
        ...(existingRaw.homepage || {}),
        ...(incoming.homepage || {}),
      },
    });
    await setPlatformSettings(nextData);
    response.json({ ok: true, settings: nextData });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save settings" });
  }
});

app.post("/api/admin/smtp/test", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const toEmail = String(request.body?.toEmail || request.adminSession?.admin?.email || "").trim().toLowerCase();
    if (!toEmail) {
      response.status(400).json({ message: "toEmail is required" });
      return;
    }

    const result = await sendAutomatedMail({
      eventKey: "user_notification",
      toEmail,
      variables: {
        studentName: request.adminSession?.admin?.name || "Admin",
        notificationMessage: "SMTP test successful. Your Ednovate mail setup is working.",
      },
      fallbackSubject: "SMTP test - Ednovate",
    });

    if (!result.sent) {
      response.status(400).json({ ok: false, message: result.reason || "SMTP test failed" });
      return;
    }

    response.json({ ok: true, message: `Test mail sent to ${toEmail}` });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to send SMTP test mail" });
  }
});

app.get("/api/admin/homepage/platform-settings", requireAdminPermission("homepage", "read"), async (_request, response) => {
  try {
    const data = sanitizePlatformSettings(await getPlatformSettings());
    response.json({ settings: data });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load homepage settings" });
  }
});

app.put("/api/admin/homepage/platform-settings", requireAdminPermission("homepage", "edit"), async (request, response) => {
  try {
    const existingRaw = sanitizePlatformSettings(await getPlatformSettings());
    const incomingRaw = request.body?.settings && typeof request.body.settings === "object" ? request.body.settings : {};
    const incoming = sanitizePlatformSettings(incomingRaw);
    const nextData = sanitizePlatformSettings({
      ...existingRaw,
      ...incoming,
      bunnyStreamApi: {
        ...existingRaw.bunnyStreamApi,
        ...incoming.bunnyStreamApi,
      },
      smtp: {
        ...existingRaw.smtp,
        ...incoming.smtp,
      },
      emailAutomation: {
        ...(existingRaw.emailAutomation || {}),
        ...(incoming.emailAutomation || {}),
        templates: {
          ...((existingRaw.emailAutomation && existingRaw.emailAutomation.templates) || {}),
          ...((incoming.emailAutomation && incoming.emailAutomation.templates) || {}),
        },
      },
      siteSettings: {
        ...(existingRaw.siteSettings || {}),
        ...(incoming.siteSettings || {}),
      },
      homepage: {
        ...(existingRaw.homepage || {}),
        ...(incoming.homepage || {}),
      },
    });

    await setPlatformSettings(nextData);
    response.json({ ok: true, settings: nextData });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save homepage settings" });
  }
});

app.post("/api/analytics/events", async (request, response) => {
  try {
    const eventType = String(request.body?.eventType || "view");
    const courseId = String(request.body?.courseId || "");
    const userId = String(request.body?.userId || "");
    const metadata = request.body?.metadata || {};

    await pool.query(
      "INSERT INTO analytics_events (event_type, course_id, user_id, metadata) VALUES ($1, $2, $3, $4::jsonb)",
      [eventType, courseId || null, userId || null, JSON.stringify(metadata)],
    );

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to track event" });
  }
});

app.get("/api/analytics/top-content", async (request, response) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(request.query.limit || 10)));
    const result = await pool.query(
      `
      SELECT course_id, COUNT(*)::int AS views
      FROM analytics_events
      WHERE event_type IN ('course_view', 'lesson_view', 'demo_view')
        AND course_id IS NOT NULL
      GROUP BY course_id
      ORDER BY views DESC
      LIMIT $1
      `,
      [limit],
    );

    response.json({ items: result.rows });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch analytics" });
  }
});

app.get("/api/analytics/summary", async (_request, response) => {
  try {
    const [eventsResult, usersResult] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total_events FROM analytics_events"),
      pool.query("SELECT COUNT(*)::int AS total_students FROM students"),
    ]);
    response.json({
      totalEvents: eventsResult.rows[0]?.total_events || 0,
      totalStudents: usersResult.rows[0]?.total_students || 0,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch summary" });
  }
});

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "ednovate-node-api",
  });
});

app.get("/api/db-check", async (_request, response) => {
  try {
    const details = await checkDatabaseConnection();

    response.json({
      status: "ok",
      ...details,
    });
  } catch (error) {
    response.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Database connection failed",
    });
  }
});

const shutdown = async () => {
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const start = async () => {
  await ensureSchema();
  await mkdir(uploadsDir, { recursive: true });

  app.listen(port, () => {
    console.log(`Node API running on http://localhost:${port}`);
    console.log("Try /api/health and /api/db-check");
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
