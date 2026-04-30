import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, writeFile } from "node:fs/promises";
import multer from "multer";
// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkDatabaseConnection, ensureSchema, pool } from "./db.js";
import { sanitizeRequest, schemas, adminRateLimiter, loginRateLimiter, maskSensitiveSettings, processIncomingSettings, decryptPassword } from "./sanitize.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production, .env is usually in the same directory as the package.json (one level up from server/)
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
// Fallback to workspace root for development
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

console.log(`[DEBUG] Backend CWD: ${process.cwd()}`);
console.log(`[DEBUG] ADMIN_EMAIL: ${process.env.ADMIN_EMAIL || "NOT SET"}`);
console.log(`[DEBUG] CORS_ORIGIN: ${process.env.CORS_ORIGIN || "NOT SET"}`);


const app = express();
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const bodyLimit = process.env.BODY_LIMIT || "25mb";

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Static uploads are public assets (thumbnails, images) — allow any origin so Flutter app + browsers can load them.
const uploadsCors = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
};

const uploadsDir = path.join(__dirname, "uploads");

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

const mapStudentTestSeriesAccess = (row) => {
  const attemptsAllowed = Math.max(0, Number(row.attempts_allowed || 0));
  const attemptsUsed = Math.max(0, Number(row.attempts_used || 0));
  return {
    id: Number(row.id),
    studentId: row.student_id,
    paperId: row.paper_id,
    paperCode: row.paper_code || "",
    title: row.title || "Test Paper",
    description: row.description || "",
    totalTime: Math.max(0, Number(row.total_time || 0)),
    questionTimeLimitSeconds: Math.max(0, Number(row.question_time_limit_seconds || 0)),
    thumbnailUrl: row.thumbnail_url || "",
    price: Math.max(0, Number(row.price || 0)),
    attemptsAllowed,
    attemptsUsed,
    remainingAttempts: attemptsAllowed > 0 ? Math.max(0, attemptsAllowed - attemptsUsed) : 0,
    purchasedAt: row.purchased_at,
    expiresAt: row.expires_at,
    isEnabled: row.is_enabled !== false,
    isVisible: row.is_visible !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const normalizeVideoQualityPreference = (value) => {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (["auto", "high", "medium", "low"].includes(normalized)) return normalized;
  return "auto";
};

const INT32_MAX = 2147483647;

const toSafeInt = (value, fallback = 0, options = {}) => {
  const min = Number.isFinite(Number(options.min)) ? Number(options.min) : 0;
  const max = Number.isFinite(Number(options.max)) ? Number(options.max) : INT32_MAX;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
};

const mapStudentOrderLine = (row) => {
  const grossAmount = Math.max(0, Number(row.amount || 0));
  const storedTaxAmount = Math.max(0, Number(row.tax_amount || 0));
  const storedBaseAmount = Math.max(0, Number(row.base_amount || 0));
  const baseAmount = (storedBaseAmount > 0 || storedTaxAmount > 0)
    ? storedBaseAmount
    : Math.max(0, grossAmount - storedTaxAmount);
  const totalViews = Math.max(0, Number(row.access_total_views || 0));
  const usedViews = Math.max(0, Number(row.access_used_views || 0));
  const remainingViews = Math.max(0, totalViews - usedViews);
  const expiresAt = row.access_expires_at || null;
  const isExpired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  const isEnabled = row.access_is_enabled !== false;
  const accessStatus = !isEnabled
    ? "disabled"
    : isExpired
      ? "expired"
      : totalViews > 0 && usedViews >= totalViews
        ? "out_of_views"
        : "active";

  return {
    id: Number(row.id),
    orderId: String(row.order_id || ""),
    studentId: String(row.student_id || ""),
    studentName: String(row.student_name || ""),
    studentEmail: String(row.student_email || ""),
    studentMobile: String(row.student_mobile || ""),
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
    purchaseDate: row.access_purchase_date || row.order_date || null,
    expiresAt,
    totalViews,
    usedViews,
    remainingViews,
    accessStatus,
    paymentMethod: String(row.payment_method || ""),
    baseAmount,
    taxAmount: storedTaxAmount,
    amount: grossAmount,
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
  };
};

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
        baseAmount: line.baseAmount,
        taxAmount: line.taxAmount,
        itemType: line.itemType,
        modeLabel: line.modeLabel,
        bookLabel: line.bookLabel,
        isEbook: line.isEbook,
        dispatchStatus: line.dispatchStatus,
        trackingId: line.trackingId,
      });
      existing.total += line.amount;
      existing.baseAmount += line.baseAmount;
      existing.taxAmount += line.taxAmount;
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
      customerName: line.customerName,
      customerEmail: line.customerEmail,
      customerPhone: line.customerPhone,
      studentName: line.studentName,
      studentEmail: line.studentEmail,
      studentMobile: line.studentMobile,
      shippingAddressLine1: line.shippingAddressLine1,
      shippingAddressLine2: line.shippingAddressLine2,
      shippingCity: line.shippingCity,
      shippingState: line.shippingState,
      shippingCountry: line.shippingCountry,
      shippingPincode: line.shippingPincode,
      baseAmount: line.baseAmount,
      taxAmount: line.taxAmount,
      total: line.amount,
      updatedAt: line.updatedAt,
      items: [
        {
          id: line.id,
          courseId: line.courseId,
          title: line.courseTitle,
          price: line.amount,
          baseAmount: line.baseAmount,
          taxAmount: line.taxAmount,
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
  studentId: String(row.id || ""),
  name: row.name,
  email: row.email,
  mobile: row.mobile || "",
  address: row.address || "",
  country: row.country || "",
  state: row.state || "",
  city: row.city || "",
  level: row.education_level || "",
  attemptYear: "",
  gender: "",
  pin: row.pin || "",
  course: "",
});

const withOrderLocationFallback = async (studentRow) => {
  const profile = studentRow;
  const needsFallback = !profile.pin || !profile.city || !profile.state || !profile.country;
  if (!needsFallback) return profile;

  try {
    const locationResult = await pool.query(
      `
      SELECT shipping_pincode, shipping_city, shipping_state, shipping_country
      FROM student_orders
      WHERE student_id = $1
        AND (
          COALESCE(NULLIF(shipping_pincode, ''), NULL) IS NOT NULL
          OR COALESCE(NULLIF(shipping_city, ''), NULL) IS NOT NULL
          OR COALESCE(NULLIF(shipping_state, ''), NULL) IS NOT NULL
          OR COALESCE(NULLIF(shipping_country, ''), NULL) IS NOT NULL
        )
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [String(profile.studentId)],
    );

    const latest = locationResult.rows[0];
    if (!latest) return profile;

    const fallbackPin = String(latest.shipping_pincode || "");
    const fallbackCity = String(latest.shipping_city || "");
    const fallbackState = String(latest.shipping_state || "");
    const fallbackCountry = String(latest.shipping_country || "");

    const nextProfile = {
      ...profile,
      pin: profile.pin || fallbackPin,
      city: profile.city || fallbackCity,
      state: profile.state || fallbackState,
      country: profile.country || fallbackCountry,
    };

    await pool.query(
      `
      UPDATE students
      SET pin = COALESCE(NULLIF(pin, ''), NULLIF($2, ''), pin),
          city = COALESCE(NULLIF(city, ''), NULLIF($3, ''), city),
          state = COALESCE(NULLIF(state, ''), NULLIF($4, ''), state),
          country = COALESCE(NULLIF(country, ''), NULLIF($5, ''), country),
          updated_at = NOW()
      WHERE id = $1
      `,
      [String(profile.studentId), fallbackPin, fallbackCity, fallbackState, fallbackCountry],
    );

    return nextProfile;
  } catch {
    return profile;
  }
};

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

const mapCourseCategoryRow = (row) => ({
  id: String(row.id || ""),
  name: String(row.name || ""),
  slug: String(row.slug || ""),
  color: String(row.color || "#475569"),
  isVisible: row.is_visible !== false,
  parentId: row.parent_id ? String(row.parent_id) : null,
  sortOrder: Number(row.sort_order || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeCategorySlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const normalizeCategoryPayload = (payload = {}) => {
  const id = String(payload.id || "").trim();
  const name = String(payload.name || "").trim();
  const slug = normalizeCategorySlug(payload.slug || name);
  const color = String(payload.color || "#475569").trim() || "#475569";
  const parentRaw = String(payload.parentId || "").trim();
  const parentId = parentRaw ? parentRaw : null;
  const sortOrder = Number(payload.sortOrder || 0);
  const isVisible = payload.isVisible !== false;

  return {
    id,
    name,
    slug,
    color,
    parentId,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isVisible,
  };
};

const normalizeMasterId = (value, fallbackPrefix, index) => {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `${fallbackPrefix}-${index + 1}`;
};

const normalizeCourseMasterViewModes = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const name = String(row.name || "").trim();
      const maxViewsRaw = Number(row.maxViews);
      const isLifetime = row.isLifetime === true;
      if (!name) return null;
      return {
        id: normalizeMasterId(row.id || name, "view-mode", index),
        name,
        // Preserve fractional values like 1.5 views while normalizing noisy float precision.
        maxViews: Number.isFinite(maxViewsRaw) && maxViewsRaw > 0 ? Number(maxViewsRaw.toFixed(2)) : null,
        isLifetime,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

const normalizeCourseMasterValidityOptions = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const label = String(row.label || row.name || "").trim();
      const daysRaw = Number(row.days);
      const isLifetime = row.isLifetime === true;
      if (!label) return null;
      return {
        id: normalizeMasterId(row.id || label, "validity", index),
        label,
        days: Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : null,
        isLifetime,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

const normalizeCourseMasterAttemptOptions = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const label = String(row.label || row.name || "").trim();
      const rawEndDate = String(row.endDate || row.attemptEndDate || "").trim();
      const parsedEndDate = new Date(rawEndDate);
      if (!label) return null;
      if (!rawEndDate || !Number.isFinite(parsedEndDate.getTime())) return null;
      const endDate = parsedEndDate.toISOString();
      return {
        id: normalizeMasterId(row.id || label, "attempt", index),
        label,
        endDate,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

const normalizeCourseMasterDeliveryModes = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const name = String(row.name || row.label || "").trim();
      if (!name) return null;
      return {
        id: normalizeMasterId(row.id || name, "delivery-mode", index),
        name,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

const normalizeCourseMasterLanguages = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const name = String(row.name || row.label || "").trim();
      if (!name) return null;
      return {
        id: normalizeMasterId(row.id || name, "language", index),
        name,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

const normalizeCourseMasterSubjectChapters = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const name = String(row.name || row.label || "").trim();
      if (!name) return null;
      return {
        id: normalizeMasterId(row.id || name, "chapter", index),
        name,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

const normalizeCourseMasterSubjects = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const name = String(row.name || row.label || "").trim();
      if (!name) return null;
      return {
        id: normalizeMasterId(row.id || name, "subject", index),
        name,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
        courseIds: normalizeStringList(row.courseIds),
        levelIds: normalizeStringList(row.levelIds),
        chapters: normalizeCourseMasterSubjectChapters(row.chapters),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

const normalizeCourseMasterPricingCombinations = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const viewModeId = String(row.viewModeId || "").trim();
      const validityOptionId = String(row.validityOptionId || "").trim();
      const attemptOptionId = String(row.attemptOptionId || "").trim();
      const deliveryModeId = String(row.deliveryModeId || "").trim();
      const languageId = String(row.languageId || "").trim();
      const label = String(row.label || "").trim();
      const price = Number(row.price);
      const originalPrice = Number(row.originalPrice);
      const hasAtLeastOneDimension = Boolean(viewModeId || validityOptionId || attemptOptionId || deliveryModeId || languageId);
      if (!hasAtLeastOneDimension || !Number.isFinite(price) || price <= 0) return null;
      return {
        id: normalizeMasterId(row.id || `${viewModeId || "any"}-${validityOptionId || "any"}-${attemptOptionId || "any"}-${deliveryModeId || "any"}-${languageId || "any"}-${index + 1}`, "combo", index),
        label,
        viewModeId: viewModeId || null,
        validityOptionId: validityOptionId || null,
        attemptOptionId: attemptOptionId || null,
        deliveryModeId: deliveryModeId || null,
        languageId: languageId || null,
        price: Math.round(price),
        originalPrice: Number.isFinite(originalPrice) && originalPrice >= price ? Math.round(originalPrice) : null,
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

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
    showDelaySeconds: toSafeInt(payload.showDelaySeconds, 0),
    repeatAfterCloseMinutes: toSafeInt(payload.repeatAfterCloseMinutes, 0),
    maxImpressionsPerUser: toSafeInt(payload.maxImpressionsPerUser, 0),
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

const syncSmsEnvFromSettings = (settingsPayload) => {
  const normalized = sanitizePlatformSettings(settingsPayload || {});
  const sms = normalized?.siteSettings?.smsOtp && typeof normalized.siteSettings.smsOtp === "object"
    ? normalized.siteSettings.smsOtp
    : {};

  const apiUrl = String(sms.apiUrl || "").trim();
  let apiDomain = String(sms.apiDomain || "").trim();
  let apiPath = String(sms.apiPath || "").trim();

  if ((!apiDomain || !apiPath) && apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      if (!apiDomain) apiDomain = parsed.host;
      if (!apiPath) apiPath = parsed.pathname || "/api/v1/message";
    } catch {
      // Ignore URL parsing errors; existing fields will still be used if valid.
    }
  }

  process.env.SMS_API_DOMAIN = apiDomain || process.env.SMS_API_DOMAIN || "";
  process.env.SMS_API_PATH = apiPath || process.env.SMS_API_PATH || "/api/v1/message";
  process.env.SMS_API_USERNAME = String(sms.apiUsername || process.env.SMS_API_USERNAME || "").trim();
  process.env.SMS_API_PASSWORD = String(sms.apiPassword || process.env.SMS_API_PASSWORD || "").trim();
  process.env.SMS_SENDER_ID = String(sms.senderId || process.env.SMS_SENDER_ID || "").trim();
  process.env.SMS_DLT_CONTENT_ID = String(sms.dltContentId || sms.templateId || process.env.SMS_DLT_CONTENT_ID || "").trim();
  process.env.SMS_UNICODE = String(sms.unicode === true);
  process.env.SMS_OTP_TEMPLATE = String(sms.messageTemplate || process.env.SMS_OTP_TEMPLATE || "").trim();
};

const getSmsEnvPreview = () => ({
  SMS_API_DOMAIN: String(process.env.SMS_API_DOMAIN || "").trim(),
  SMS_API_PATH: String(process.env.SMS_API_PATH || "").trim(),
  SMS_API_USERNAME: String(process.env.SMS_API_USERNAME || "").trim(),
  SMS_API_PASSWORD: String(process.env.SMS_API_PASSWORD || "").trim() ? "******" : "",
  SMS_SENDER_ID: String(process.env.SMS_SENDER_ID || "").trim(),
  SMS_DLT_CONTENT_ID: String(process.env.SMS_DLT_CONTENT_ID || "").trim(),
  SMS_OTP_TEMPLATE: String(process.env.SMS_OTP_TEMPLATE || "").trim(),
});

const sanitizePlatformSettings = (payload) => {
  const data = payload && typeof payload === "object" ? payload : {};
  const bunny = data.bunnyStreamApi && typeof data.bunnyStreamApi === "object" ? data.bunnyStreamApi : {};
  const siteSettings = data.siteSettings && typeof data.siteSettings === "object" ? data.siteSettings : {};
  const socialLinks = siteSettings.socialLinks && typeof siteSettings.socialLinks === "object" ? siteSettings.socialLinks : {};
  const socialIconUrls = siteSettings.socialIconUrls && typeof siteSettings.socialIconUrls === "object" ? siteSettings.socialIconUrls : {};
  const smsOtp = siteSettings.smsOtp && typeof siteSettings.smsOtp === "object" ? siteSettings.smsOtp : {};
  const smsDomain = String(process.env.SMS_API_DOMAIN || "").trim();
  const smsPath = String(process.env.SMS_API_PATH || "").trim();
  const smsUrl = String(process.env.SMS_OTP_API_URL || "").trim();
  const smsUrlObject = smsUrl ? new URL(smsUrl) : null;
  const smsOtpEnvDefaults = {
    enabled: String(process.env.SMS_OTP_ENABLED || "true").toLowerCase() === "true",
    apiDomain: smsDomain || (smsUrlObject ? smsUrlObject.host : "sms.timesapi.in"),
    apiPath: smsPath || (smsUrlObject ? smsUrlObject.pathname : "/api/v1/message"),
    apiUrl: smsDomain || smsPath
      ? `https://${smsDomain || (smsUrlObject ? smsUrlObject.host : "sms.timesapi.in")}${smsPath || (smsUrlObject ? smsUrlObject.pathname : "/api/v1/message")}`
      : smsUrl || "https://sms.timesapi.in/api/v1/message",
    apiUsername: String(process.env.SMS_API_USERNAME || process.env.SMS_OTP_API_USERNAME || process.env.SMS_OTP_USERNAME || "").trim(),
    apiPassword: String(process.env.SMS_API_PASSWORD || process.env.SMS_OTP_API_PASSWORD || process.env.SMS_OTP_PASSWORD || "").trim(),
    senderId: String(process.env.SMS_SENDER_ID || process.env.SMS_OTP_SENDER_ID || "EDNVTE").trim(),
    dltContentId: String(process.env.SMS_DLT_CONTENT_ID || process.env.SMS_OTP_TEMPLATE_ID || process.env.SMS_OTP_ENTITY_ID || "").trim(),
    unicode: String(process.env.SMS_UNICODE || "false").toLowerCase() === "true",
    platformName: String(process.env.SMS_PLATFORM_NAME || "Ednovate").trim() || "Ednovate",
    timeoutMs: Math.max(1000, Math.min(60000, Number(process.env.SMS_TIMEOUT_MS || 12000))),
    countryCode: String(process.env.SMS_OTP_COUNTRY_CODE || "91").replace(/\D/g, "") || "91",
    messageTemplate:
      String(process.env.SMS_OTP_TEMPLATE || process.env.SMS_OTP_MESSAGE_TEMPLATE || "Your OTP for Ednovate is {{otp}}. It is valid for 10 minutes.").trim()
      || "Your OTP for Ednovate is {{otp}}. It is valid for 10 minutes.",
    includeCorrelationId: String(process.env.SMS_INCLUDE_CORRELATION_ID || "false").toLowerCase() === "true",
    apiKey: String(process.env.SMS_OTP_API_KEY || "").trim(),
    route: String(process.env.SMS_OTP_ROUTE || "").trim(),
    otpTtlSeconds: Math.max(60, Math.min(900, Number(process.env.SMS_OTP_TTL_SECONDS || 300))),
    entityId: String(process.env.SMS_OTP_ENTITY_ID || "").trim(),
  };
  const normalizedSiteSettings = {
    ...siteSettings,
    logo: String(siteSettings.logo || "/ednovate-logo.svg").trim() || "/ednovate-logo.svg",
    smsOtp: {
      enabled: typeof smsOtp.enabled === "boolean" ? smsOtp.enabled : smsOtpEnvDefaults.enabled,
      apiDomain: String(smsOtp.apiDomain || smsOtpEnvDefaults.apiDomain || "").trim(),
      apiPath: String(smsOtp.apiPath || smsOtpEnvDefaults.apiPath || "").trim(),
      apiUrl: String(smsOtp.apiUrl || smsOtpEnvDefaults.apiUrl || "").trim(),
      apiUsername: String(smsOtp.apiUsername || smsOtpEnvDefaults.apiUsername || "").trim(),
      apiPassword: String(smsOtp.apiPassword || smsOtpEnvDefaults.apiPassword || "").trim(),
      apiKey: String(smsOtp.apiKey || smsOtpEnvDefaults.apiKey || "").trim(),
      senderId: String(smsOtp.senderId || smsOtpEnvDefaults.senderId || "").trim(),
      dltContentId: String(smsOtp.dltContentId || smsOtp.templateId || smsOtpEnvDefaults.dltContentId || "").trim(),
      templateId: String(smsOtp.templateId || smsOtp.dltContentId || smsOtpEnvDefaults.dltContentId || "").trim(),
      entityId: String(smsOtp.entityId || smsOtpEnvDefaults.entityId || "").trim(),
      route: String(smsOtp.route || smsOtpEnvDefaults.route || "").trim(),
      unicode: typeof smsOtp.unicode === "boolean" ? smsOtp.unicode : smsOtpEnvDefaults.unicode,
      platformName: String(smsOtp.platformName || smsOtpEnvDefaults.platformName || "Ednovate").trim() || "Ednovate",
      timeoutMs: Math.max(1000, Math.min(60000, Number(smsOtp.timeoutMs || smsOtpEnvDefaults.timeoutMs || 12000))),
      countryCode: String(smsOtp.countryCode || smsOtpEnvDefaults.countryCode || "91").replace(/\D/g, "") || "91",
      otpTtlSeconds: Math.max(60, Math.min(900, Number(smsOtp.otpTtlSeconds || smsOtpEnvDefaults.otpTtlSeconds || 300))),
      messageTemplate:
        String(smsOtp.messageTemplate || smsOtpEnvDefaults.messageTemplate || "").trim()
        || "Your OTP for Ednovate is {{otp}}. It is valid for 10 minutes.",
      includeCorrelationId: typeof smsOtp.includeCorrelationId === "boolean" ? smsOtp.includeCorrelationId : smsOtpEnvDefaults.includeCorrelationId,
    },
    socialLinks: {
      facebook: String(socialLinks.facebook || ""),
      instagram: String(socialLinks.instagram || ""),
      youtube: String(socialLinks.youtube || ""),
      twitter: String(socialLinks.twitter || ""),
      linkedin: String(socialLinks.linkedin || ""),
      whatsapp: String(socialLinks.whatsapp || ""),
    },
    socialIconUrls: {
      facebook: String(socialIconUrls.facebook || ""),
      instagram: String(socialIconUrls.instagram || ""),
      youtube: String(socialIconUrls.youtube || ""),
      twitter: String(socialIconUrls.twitter || ""),
      linkedin: String(socialIconUrls.linkedin || ""),
      whatsapp: String(socialIconUrls.whatsapp || ""),
    },
    courseMasters: siteSettings.courseMasters || { subjects: [] },
  };
  const homepage = data.homepage && typeof data.homepage === "object" ? data.homepage : {};
  const smtp = data.smtp && typeof data.smtp === "object" ? data.smtp : {};
  const emailAutomation = data.emailAutomation && typeof data.emailAutomation === "object" ? data.emailAutomation : {};
  const templates = emailAutomation.templates && typeof emailAutomation.templates === "object" ? emailAutomation.templates : {};
  const aiExtraction = data.aiExtraction && typeof data.aiExtraction === "object" ? data.aiExtraction : {};
  const selectedAiProvider = ["gemini", "grok", "openrouter"].includes(String(aiExtraction.provider || "").toLowerCase())
    ? String(aiExtraction.provider || "").toLowerCase()
    : "gemini";

  const normalizeEmailList = (value) => {
    const raw = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[\n,;]+/)
        : [];
    return Array.from(
      new Set(
        raw
          .map((item) => String(item || "").trim().toLowerCase())
          .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)),
      ),
    ).slice(0, 30);
  };

  const toTemplate = (value, fallbackSubject, fallbackBody) => {
    const row = value && typeof value === "object" ? value : {};
    return {
      enabled: row.enabled !== false,
      subject: String(row.subject || fallbackSubject).trim() || fallbackSubject,
      body: String(row.body || fallbackBody).trim() || fallbackBody,
      sendToAdmin: row.sendToAdmin === true,
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
      adminRecipients: normalizeEmailList(emailAutomation.adminRecipients),
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
    aiExtraction: {
      provider: selectedAiProvider,
      geminiApiKey: String(aiExtraction.geminiApiKey || "").trim(),
      geminiModel: normalizeGeminiModelName(aiExtraction.geminiModel || process.env.GEMINI_MODEL || "gemini-1.5-flash"),
      grokApiKey: String(aiExtraction.grokApiKey || "").trim(),
      grokModel: String(aiExtraction.grokModel || process.env.GROK_MODEL || "grok-2-vision-latest").trim() || "grok-2-vision-latest",
      openRouterApiKey: String(aiExtraction.openRouterApiKey || "").trim(),
      openRouterModel: String(aiExtraction.openRouterModel || process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001").trim() || "google/gemini-2.0-flash-001",
    },
    siteSettings: normalizedSiteSettings,
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

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), Math.max(1000, Number(timeoutMs || 15000)));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const mapSmtpError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "SMTP test failed");

  if (message.includes("SMTP send timed out") || code === "ETIMEDOUT" || code === "ESOCKET") {
    return {
      status: 504,
      message: "SMTP connection timed out. Check host, port, secure mode, and firewall/network rules.",
    };
  }

  if (code === "EAUTH") {
    return {
      status: 400,
      message: "SMTP authentication failed. Verify username/password and app password settings.",
    };
  }

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EHOSTUNREACH") {
    return {
      status: 502,
      message: "SMTP server is unreachable. Verify SMTP host/port and server accessibility.",
    };
  }

  return {
    status: 500,
    message,
  };
};

const isSmtpConnectivityError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  return (
    message.includes("SMTP send timed out")
    || code === "ETIMEDOUT"
    || code === "ESOCKET"
    || code === "ECONNREFUSED"
    || code === "EHOSTUNREACH"
    || code === "ENETUNREACH"
  );
};

const normalizeMobile10 = (value) => String(value || "").replace(/\D/g, "").slice(-10);

const getOtpConfig = async () => {
  const settings = sanitizePlatformSettings(await getPlatformSettings());
  const smsOtp = settings?.siteSettings && typeof settings.siteSettings === "object" && settings.siteSettings.smsOtp && typeof settings.siteSettings.smsOtp === "object"
    ? settings.siteSettings.smsOtp
    : {};

  return {
    enabled: smsOtp.enabled === true,
    apiDomain: String(smsOtp.apiDomain || "").trim(),
    apiPath: String(smsOtp.apiPath || "").trim(),
    apiUrl: String(smsOtp.apiUrl || "").trim(),
    apiUsername: String(smsOtp.apiUsername || "").trim(),
    apiPassword: String(smsOtp.apiPassword || "").trim(),
    apiKey: String(smsOtp.apiKey || "").trim(),
    senderId: String(smsOtp.senderId || "").trim(),
    dltContentId: String(smsOtp.dltContentId || smsOtp.templateId || "").trim(),
    templateId: String(smsOtp.templateId || smsOtp.dltContentId || "").trim(),
    entityId: String(smsOtp.entityId || "").trim(),
    route: String(smsOtp.route || "").trim(),
    unicode: smsOtp.unicode === true,
    timeoutMs: Math.max(1000, Math.min(60000, Number(smsOtp.timeoutMs || 12000))),
    countryCode: String(smsOtp.countryCode || "91").replace(/\D/g, "") || "91",
    otpTtlSeconds: Math.max(60, Math.min(900, Number(smsOtp.otpTtlSeconds || 300))),
    messageTemplate:
      String(smsOtp.messageTemplate || "").trim()
      || "Your OTP for {{platformName}} is {{otp}}. It is valid for {{minutes}} minutes.",
    includeCorrelationId: smsOtp.includeCorrelationId === true,
    // Use SMS-specific platform name to avoid DLT template mismatch with branded site title.
    platformName: String(smsOtp.platformName || settings?.siteSettings?.platformName || "Ednovate").trim() || "Ednovate",
  };
};

const renderOtpMessage = (template, values) =>
  String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const next = values?.[key];
    return next === undefined || next === null ? "" : String(next);
  });

const sendTimesMobileOtp = async ({ mobile, otp, config }) => {
  if (!config.enabled) {
    return { sent: false, reason: "TimesMobile OTP is disabled in Settings." };
  }
  if (!config.senderId) {
    return { sent: false, reason: "TimesMobile Sender ID is required." };
  }
  if (!config.apiUsername || !config.apiPassword) {
    return { sent: false, reason: "TimesMobile API Username and API Password are required." };
  }

  const minutes = Math.max(1, Math.round(Number(config.otpTtlSeconds || 300) / 60));
  const message = renderOtpMessage(config.messageTemplate, {
    otp,
    minutes,
    platformName: config.platformName || "Ednovate",
    mobile,
  });

  const fullMobile = `${config.countryCode}${mobile}`;
  const apiUrl = String(config.apiUrl || `https://${String(config.apiDomain || "sms.timesapi.in").replace(/^https?:\/\//i, "")}${String(config.apiPath || "/api/v1/message")}`).trim();
  const requestBody = {
    sender: config.senderId,
    unicode: config.unicode === true,
    message: {
      recipient: fullMobile,
      text: message,
    },
  };

  const extra = {};
  if (config.dltContentId) {
    extra.dltContentId = config.dltContentId;
  }
  if (config.includeCorrelationId) {
    extra.corelationid = randomUUID();
  }
  if (Object.keys(extra).length > 0) {
    requestBody.extra = extra;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("TimesMobile request timed out")), Number(config.timeoutMs || 12000));
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${config.apiUsername}:${config.apiPassword}`).toString("base64")}`,
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  const raw = await response.text().catch(() => "");
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    return {
      sent: false,
      reason: (parsed && (parsed.description || parsed.message || parsed.error)) || raw || `TimesMobile request failed with status ${response.status}`,
    };
  }

  // Times Mobile can return HTTP 200 with a failed semantic state.
  const providerState = String(parsed?.state || "").trim().toUpperCase();
  if (providerState && providerState !== "SUBMIT_ACCEPTED") {
    return {
      sent: false,
      reason: String(parsed?.description || parsed?.message || `TimesMobile rejected message with state ${providerState}`),
      raw: parsed || raw,
    };
  }

  return { sent: true, raw: parsed || raw };
};

const getResendConfig = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromEmail = String(process.env.RESEND_FROM_EMAIL || "").trim().toLowerCase();
  return {
    enabled: Boolean(apiKey && fromEmail),
    apiKey,
    fromEmail,
  };
};

const sendMailViaResend = async ({ toEmail, subject, text, html, replyTo, fromName }) => {
  const resend = getResendConfig();
  if (!resend.enabled) {
    throw new Error("SMTP unreachable and Resend fallback is not configured");
  }

  const from = fromName
    ? `${String(fromName).trim()} <${resend.fromEmail}>`
    : resend.fromEmail;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [String(toEmail || "").trim().toLowerCase()],
      subject: String(subject || "Notification"),
      text: String(text || ""),
      html: String(html || "") || undefined,
      reply_to: replyTo ? String(replyTo).trim().toLowerCase() : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Resend API failed with status ${response.status}`);
  }

  return { sent: true, provider: "resend" };
};

const resolveSmtpHostCandidates = async (host) => {
  const normalizedHost = String(host || "").trim();
  if (!normalizedHost) return [];

  try {
    const records = await lookup(normalizedHost, { all: true });
    if (!Array.isArray(records) || records.length === 0) return [normalizedHost];

    const addresses = records.map((item) => String(item.address || "").trim()).filter(Boolean);
    const ipv4 = addresses.filter((value) => value.includes("."));
    const others = addresses.filter((value) => !value.includes("."));
    const ordered = [...ipv4, ...others];
    const unique = [...new Set(ordered)];
    return unique.length > 0 ? unique : [normalizedHost];
  } catch {
    return [normalizedHost];
  }
};

const sendMailWithConfiguredSmtp = async ({ smtp, mailOptions }) => {
  const hostCandidates = await resolveSmtpHostCandidates(smtp.host);
  let lastError = null;

  for (const smtpHost of hostCandidates) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtp.port || 587),
        secure: smtp.secure === true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: smtp.username,
          pass: smtp.password,
        },
        tls: {
          servername: String(smtp.host || smtpHost),
        },
      });

      await withTimeout(transporter.sendMail(mailOptions), 20000, "SMTP send timed out");
      return;
    } catch (error) {
      lastError = error;
      if (!isSmtpConnectivityError(error)) throw error;
    }
  }

  throw lastError || new Error("SMTP send failed");
};

const sendMailWithSmtpFallback = async ({ smtp, mailOptions }) => {
  try {
    await sendMailWithConfiguredSmtp({ smtp, mailOptions });
    return;
  } catch (primaryError) {
    const normalizedPort = Number(smtp.port || 0);
    const using465Ssl = normalizedPort === 465 && smtp.secure === true;
    const using587StartTls = normalizedPort === 587 && smtp.secure !== true;
    const canRetry = isSmtpConnectivityError(primaryError) && (using465Ssl || using587StartTls);

    if (!canRetry) throw primaryError;

    const fallbackSmtp = using465Ssl
      ? { ...smtp, port: 587, secure: false }
      : { ...smtp, port: 465, secure: true };

    await sendMailWithConfiguredSmtp({ smtp: fallbackSmtp, mailOptions });
  }
};

const sendAutomatedMail = async ({ eventKey, toEmail, variables = {}, fallbackSubject = "Notification" }) => {
  const settings = sanitizePlatformSettings(await getPlatformSettings());
  const smtp = settings.smtp;
  
  // Decrypt password if it's encrypted
  const decryptedSmtp = {
    ...smtp,
    password: smtp.password ? decryptPassword(smtp.password) : smtp.password
  };
  
  if (!decryptedSmtp.enabled || !decryptedSmtp.host || !decryptedSmtp.username || !decryptedSmtp.password || !toEmail) {
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

  const to = String(toEmail).trim().toLowerCase();
  const adminRecipients = template.sendToAdmin === true && Array.isArray(settings.emailAutomation?.adminRecipients)
    ? settings.emailAutomation.adminRecipients
    : [];
  const bccRecipients = Array.from(new Set(adminRecipients.filter((email) => email && email !== to)));
  const subject = fillTemplate(template.subject || fallbackSubject, mergedVars);
  const text = fillTemplate(template.body || "", mergedVars);

  try {
    await sendMailWithSmtpFallback({
      smtp: decryptedSmtp,
      mailOptions: {
        from: buildEmailFromField(decryptedSmtp.fromName || platformName, decryptedSmtp.fromEmail || decryptedSmtp.username),
        to,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        replyTo: decryptedSmtp.replyTo || undefined,
        subject,
        text,
      },
    });
  } catch (error) {
    if (!isSmtpConnectivityError(error)) throw error;
    const resendRecipients = [to, ...bccRecipients];
    await Promise.all(
      resendRecipients.map((recipient) =>
        sendMailViaResend({
          toEmail: recipient,
          subject,
          text,
          html: "",
          replyTo: smtp.replyTo,
          fromName: smtp.fromName || platformName,
        }),
      ),
    );
  }

  return { sent: true };
};

const sendSmtpMail = async ({ toEmail, subject, text, html }) => {
  const settings = sanitizePlatformSettings(await getPlatformSettings());
  const smtp = settings.smtp;
  
  // Decrypt password if it's encrypted
  const decryptedSmtp = {
    ...smtp,
    password: smtp.password ? decryptPassword(smtp.password) : smtp.password
  };
  
  if (!decryptedSmtp.enabled || !decryptedSmtp.host || !decryptedSmtp.username || !decryptedSmtp.password || !toEmail) {
    return { sent: false, reason: "SMTP not configured" };
  }

  const platformName = String(settings.siteSettings?.platformName || "Ednovate");
  const to = String(toEmail).trim().toLowerCase();
  const nextSubject = String(subject || "Invoice");
  const nextText = String(text || "");
  const nextHtml = String(html || "");

  try {
    await sendMailWithSmtpFallback({
      smtp: decryptedSmtp,
      mailOptions: {
        from: buildEmailFromField(decryptedSmtp.fromName || platformName, decryptedSmtp.fromEmail || decryptedSmtp.username),
        to,
        replyTo: decryptedSmtp.replyTo || undefined,
        subject: nextSubject,
        text: nextText,
        html: nextHtml,
      },
    });
  } catch (error) {
    if (!isSmtpConnectivityError(error)) throw error;
    await sendMailViaResend({
      toEmail: to,
      subject: nextSubject,
      text: nextText,
      html: nextHtml,
      replyTo: decryptedSmtp.replyTo,
      fromName: decryptedSmtp.fromName || platformName,
    });
  }

  return { sent: true };
};

const formatMoneyInr = (value) => {
  const amount = Math.max(0, Number(value || 0));
  return `INR ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const buildInvoiceDocument = ({ orderId, studentName, studentEmail, orderDate, paymentMethod, currency, items, platformName, logoUrl }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((sum, item) => sum + Math.max(0, Number(item.baseAmount || 0)), 0);
  const taxTotal = safeItems.reduce((sum, item) => sum + Math.max(0, Number(item.taxAmount || 0)), 0);
  const total = safeItems.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const companyAddress = "4th floor, Ajanta Square Building, near Borivali court, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092";
  const invoiceNo = String(orderId || "");
  const invoiceDate = orderDate ? new Date(orderDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");
  const rowsHtml = safeItems.map((item, index) => {
    const details = [
      item.itemType ? `Type: ${item.itemType}` : "",
      item.modeLabel ? `Mode: ${item.modeLabel}` : "",
      item.bookLabel ? `Book: ${item.bookLabel}` : "",
    ].filter(Boolean).join(" | ");

    return `
      <tr>
        <td style="padding:10px;border-right:1px solid #9ca3af;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <div style="font-weight:700;">${index + 1}. ${String(item.courseTitle || "Course")}</div>
          <div style="color:#4b5563;font-size:12px;margin-top:4px;">${details || "Course purchase"}</div>
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;vertical-align:top;">${formatMoneyInr(item.amount)}</td>
      </tr>
    `;
  }).join("");

  const headerLogoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${platformName}" style="height:44px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : "";
  const companyTitle = `<div style="font-weight:800;font-size:18px;letter-spacing:.08em;color:#1f3c88;">${platformName}</div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#e5e7eb;padding:24px;color:#111827;">
      <div style="width:210mm;min-height:297mm;box-sizing:border-box;margin:0 auto;background:#ffffff;border:1px solid #9ca3af;box-shadow:0 4px 14px rgba(15,23,42,.08);padding:12mm;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
          <div>
            ${headerLogoHtml}
            ${companyTitle}
            <div style="font-size:12px;color:#4b5563;margin-top:4px;line-height:1.4;max-width:340px;">${companyAddress}</div>
          </div>
          <div style="text-align:right;min-width:250px;">
            <div style="font-size:34px;font-weight:800;color:#4f7dbd;letter-spacing:.04em;line-height:1;">TAX INVOICE</div>
            <table style="margin-top:14px;width:100%;border-collapse:collapse;font-size:12px;">
              <tr>
                <th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">INVOICE #</th>
                <th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">DATE</th>
              </tr>
              <tr>
                <td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceNo}</td>
                <td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceDate}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="margin-top:22px;display:inline-block;min-width:340px;">
          <div style="border:1px solid #9ca3af;background:#d1d5db;padding:4px 10px;font-size:12px;font-weight:700;">BILL TO</div>
          <div style="padding:8px 2px 0 2px;font-size:13px;line-height:1.45;">
            <div style="font-weight:700;">${String(studentName || "Student")}</div>
            <div>${String(studentEmail || "")}</div>
            <div style="margin-top:4px;"><strong>Payment:</strong> ${String(paymentMethod || "Online")}</div>
            <div><strong>Currency:</strong> ${String(currency || "INR")}</div>
          </div>
        </div>

        <div style="margin-top:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #9ca3af;">
            <thead>
              <tr style="background:#d1d5db;color:#111827;text-align:left;">
                <th style="padding:9px 10px;border-right:1px solid #9ca3af;">DESCRIPTION</th>
                <th style="padding:9px 10px;text-align:right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr>
                <td style="height:120px;border-right:1px solid #9ca3af;"></td>
                <td></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td style="padding:10px;border-right:1px solid #9ca3af;font-style:italic;font-size:14px;color:#1f3c88;">Thank you for your business!</td>
                <td style="padding:10px;">
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                    <span style="color:#4b5563;">Base Price</span>
                    <strong>${formatMoneyInr(subtotal)}</strong>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                    <span style="color:#4b5563;">+ GST</span>
                    <strong>${formatMoneyInr(taxTotal)}</strong>
                  </div>
                  <div style="border-top:1px solid #9ca3af;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:800;color:#111827;">Grand Total</span>
                    <span style="font-weight:800;font-size:22px;">${formatMoneyInr(total)}</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top:20px;text-align:center;font-size:12px;color:#4b5563;line-height:1.45;">
          This is a computer-generated invoice. Signature is not required.
        </div>
        <div style="margin-top:8px;text-align:right;font-size:11px;color:#94a3b8;">Generated by ${platformName}</div>
      </div>
    </div>
  `;

  const text = [
    `${platformName} Invoice`,
    `Invoice #: ${invoiceNo}`,
    `Date: ${invoiceDate}`,
    `Student: ${String(studentName || "Student")}`,
    `Email: ${String(studentEmail || "")}`,
    `Payment: ${String(paymentMethod || "Online")}`,
    `Currency: ${String(currency || "INR")}`,
    `Company Address: ${companyAddress}`,
    "",
    ...safeItems.map((item, index) => `${index + 1}. ${String(item.courseTitle || "Course")} | Amount ${formatMoneyInr(item.amount)}`),
    "",
    `Base Price: ${formatMoneyInr(subtotal)}`,
    `GST: ${formatMoneyInr(taxTotal)}`,
    `Grand Total: ${formatMoneyInr(total)}`,
    "This is a computer-generated invoice. Signature is not required.",
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
  "masters",
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
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return bcrypt.compareSync(incoming, stored);
  }
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
  if (pathName.startsWith("/api/admin/categories")) return "categories";
  if (pathName.startsWith("/api/admin/course-masters")) return "masters";
  if (pathName.startsWith("/api/admin/lead-form-settings")) return "leads";
  if (pathName.startsWith("/api/admin/leads")) return "leads";
  if (pathName.startsWith("/api/admin/marketing")) return "marketing";
  if (pathName.startsWith("/api/admin/faculty")) return "faculty";
  if (pathName.startsWith("/api/courses/")) return "courses";
  if (pathName === "/api/courses/upsert") return "courses";
  if (pathName.startsWith("/api/homepage")) return "homepage";
  if (pathName.startsWith("/api/admin/bunny")) return "settings";
  if (pathName.startsWith("/api/uploads") || pathName.startsWith("/api/bunny")) return "course-content";
  if (pathName.startsWith("/api/admin/activity-logs")) return "logs";
  if (pathName.startsWith("/api/admin/subadmins") || pathName.startsWith("/api/admin/audit-logs")) return "subadmins";
  return "dashboard";
};

const sanitizeAuditBody = (body) => {
  if (!body || typeof body !== "object") return {};
  const clone = { ...body };
  ["password", "password_hash", "apiKey", "bunnyStreamApiKey", "merchantKey", "merchantSalt", "workingKey", "easebuzzKey", "easebuzzSalt"].forEach((key) => {
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

// Define sanitization schema for admin login
const adminLoginSchema = {
  body: {
    email: schemas.email,
    password: schemas.password,
    forceLogin: { type: 'boolean' },
  },
};

// Apply rate limiting to admin endpoints, but skip auth/session routes to avoid false lockouts.
app.use("/api/admin", (request, response, next) => {
  const path = String(request.path || "").toLowerCase();
  if (path === "/login" || path === "/session-status") {
    next();
    return;
  }
  adminRateLimiter(request, response, next);
});
app.use("/api/admin/login", loginRateLimiter);

app.post("/api/admin/login", sanitizeRequest(adminLoginSchema), async (request, response) => {
  try {
    const { email, password, forceLogin = false } = request.body;
    
    if (!email || !password) {
      response.status(400).json({ message: "email and password are required" });
      return;
    }
    
    const hostHeader = String(request.headers.host || "").toLowerCase();
    const isLocalDevRequest = process.env.NODE_ENV !== "production"
      && (hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1"));

    const result = await pool.query("SELECT * FROM admin_accounts WHERE LOWER(email) = $1", [email]);
    let account = result.rows[0];

    if (!account && isLocalDevRequest && email === "admin@ednovate.com") {
      const fallbackResult = await pool.query("SELECT * FROM admin_accounts WHERE id = 'super-admin' LIMIT 1");
      account = fallbackResult.rows[0];
    }

    if (!account) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (account.is_active === false) {
      response.status(403).json({ message: "Account is disabled" });
      return;
    }

    const incomingHash = hashPassword(password);
    let isPasswordValid = verifyPassword(password, account.password_hash);

    // Localhost-only recovery path: allow default super-admin password and resync hash.
    if (!isPasswordValid && isLocalDevRequest && account.id === "super-admin" && password === "admin123") {
      isPasswordValid = true;
      await pool.query(
        "UPDATE admin_accounts SET password_hash = $2, updated_at = NOW() WHERE id = $1",
        [account.id, incomingHash],
      );
      account = {
        ...account,
        password_hash: incomingHash,
      };
    }

    if (!isPasswordValid) {
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
      response.json({
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

// Define sanitization schema for subadmin creation
const subadminCreateSchema = {
  body: {
    name: schemas.name,
    email: schemas.email,
    password: schemas.password,
    role: { type: 'string', options: { maxLength: 50 } },
    isActive: { type: 'boolean' },
    permissions: { type: 'object' }, // Will be normalized separately
  },
};

app.post("/api/admin/subadmins", requireAdminPermission("subadmins", "create"), sanitizeRequest(subadminCreateSchema), async (request, response) => {
  try {
    const { name, email, password, role = "sub_admin", isActive = true, permissions = {} } = request.body;

    if (!name || !email || !password) {
      response.status(400).json({ message: "name, email and password are required" });
      return;
    }
    
    const normalizedPermissions = normalizePermissions(permissions);

    const id = `subadmin-${Date.now()}`;
    const passwordHash = hashPassword(password);
    const createdBy = request.adminSession?.admin?.email || "system";

    await pool.query(
      `
      INSERT INTO admin_accounts
      (id, name, email, password_hash, role, is_active, permissions, created_by, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,NOW())
      `,
      [id, name, email, passwordHash, role, isActive, JSON.stringify(normalizedPermissions), createdBy],
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
    const mobileRaw = String(request.body?.mobile || "").trim();
    const mobile = mobileRaw.replace(/\D/g, "").slice(-10);
    const password = String(request.body?.password || "").trim();
    const city = String(request.body?.city || "").trim();
    const state = String(request.body?.state || "").trim();
    const country = String(request.body?.country || "").trim();
    const pin = String(request.body?.pin || "").trim();
    const address = String(request.body?.address || "").trim();
    const educationLevel = String(request.body?.level || "").trim();

    if (!name || !email || !mobile || !password) {
      response.status(400).json({ message: "name, email, mobile and password are required" });
      return;
    }

    if (!/^\d{10}$/.test(mobile)) {
      response.status(400).json({ message: "Please enter a valid 10-digit mobile number" });
      return;
    }

    const existingResult = await pool.query(
      "SELECT id FROM students WHERE LOWER(email) = $1 OR mobile = $2 LIMIT 1",
      [email, mobile],
    );
    if (existingResult.rowCount > 0) {
      response.status(409).json({ message: "Account already exists. Please login." });
      return;
    }

    const passwordHash = hashPassword(password);

    await pool.query(
      `
      INSERT INTO students
      (id, name, email, mobile, city, state, country, pin, address, status, education_level, password, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active',$10,$11,NOW())
      `,
      [
        Number(mobile),
        name,
        email,
        mobile,
        city || null,
        state || null,
        country || null,
        pin || null,
        address || null,
        educationLevel || null,
        passwordHash,
      ],
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
      response.json({
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

app.post("/api/auth/student/otp/send", async (request, response) => {
  try {
    const mobile = normalizeMobile10(request.body?.mobile || request.body?.mobileNo || "");
    const purpose = String(request.body?.purpose || "auth").trim().toLowerCase();
    const normalizedPurpose = ["login", "signup", "reset", "auth"].includes(purpose) ? purpose : "auth";
    if (!/^\d{10}$/.test(mobile)) {
      response.status(400).json({ message: "Please enter a valid 10-digit mobile number" });
      return;
    }

    if (normalizedPurpose === "login" || normalizedPurpose === "reset") {
      const studentCheck = await pool.query(
        `
        SELECT id
        FROM students
        WHERE regexp_replace(COALESCE(mobile, ''), '\\D', '', 'g') = $1
        LIMIT 1
        `,
        [mobile],
      );
      if (studentCheck.rowCount === 0) {
        response.status(404).json({ message: "Student not exist" });
        return;
      }
    }

    const config = await getOtpConfig();
    const isTestNumber = ["9876543210", "9988776655", "0123456789"].includes(mobile);
    const otp = isTestNumber ? "123456" : String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = hashPassword(otp);
    const expiresAt = new Date(Date.now() + Number(config.otpTtlSeconds || 300) * 1000);

    let smsResult = { sent: true, reason: "" };
    if (!isTestNumber) {
      smsResult = await sendTimesMobileOtp({ mobile, otp, config });
      if (!smsResult.sent) {
        response.status(400).json({ message: smsResult.reason || "Failed to send OTP" });
        return;
      }
    }

    await pool.query(
      `
      DELETE FROM student_otp_codes
      WHERE mobile = $1
        AND purpose = $2
        AND consumed_at IS NULL
      `,
      [mobile, normalizedPurpose],
    );

    await pool.query(
      `
      INSERT INTO student_otp_codes (mobile, purpose, otp_hash, expires_at)
      VALUES ($1,$2,$3,$4)
      `,
      [mobile, normalizedPurpose, otpHash, expiresAt.toISOString()],
    );

    const provider = smsResult.raw && typeof smsResult.raw === "object" ? smsResult.raw : null;
    const txn = provider?.transactionId ? ` Ref: ${provider.transactionId}` : "";
    response.json({
      ok: true,
      message: `OTP sent successfully.${txn}`,
      providerState: provider?.state || null,
      providerTransactionId: provider?.transactionId || null,
      providerDescription: provider?.description || null,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to send OTP" });
  }
});

app.post("/api/auth/student/otp/verify", async (request, response) => {
  try {
    const mobile = normalizeMobile10(request.body?.mobile || request.body?.mobileNo || "");
    const otp = String(request.body?.otp || "").trim();
    const login = request.body?.login === true;
    const purposeInput = String(request.body?.purpose || (login ? "login" : "signup")).trim().toLowerCase();
    const purpose = ["login", "signup", "auth"].includes(purposeInput) ? purposeInput : (login ? "login" : "signup");

    if (!/^\d{10}$/.test(mobile)) {
      response.status(400).json({ message: "Invalid mobile number." });
      return;
    }
    if (!/^\d{4,8}$/.test(otp)) {
      response.status(400).json({ message: "Invalid OTP." });
      return;
    }

    const isTestNumber = ["9876543210", "9988776655", "0123456789"].includes(mobile);
    if (isTestNumber && otp === "123456") {
      // Direct bypass for test numbers
    } else {
      const otpResult = await pool.query(
        `
        SELECT id, otp_hash, expires_at
        FROM student_otp_codes
        WHERE mobile = $1
          AND purpose = ANY($2::text[])
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [mobile, [purpose, "auth"]],
      );

      const otpRow = otpResult.rows[0];
      if (!otpRow) {
        response.status(400).json({ message: "OTP not found. Please resend OTP." });
        return;
      }

      if (new Date(otpRow.expires_at).getTime() < Date.now()) {
        response.status(400).json({ message: "OTP expired. Please resend OTP." });
        return;
      }

      if (String(otpRow.otp_hash || "") !== hashPassword(otp)) {
        response.status(400).json({ message: "Invalid OTP." });
        return;
      }

      await pool.query("UPDATE student_otp_codes SET consumed_at = NOW() WHERE id = $1", [otpRow.id]);
    }

    if (!login) {
      response.json({ ok: true, message: "OTP verified successfully." });
      return;
    }

    const studentResult = await pool.query(
      "SELECT * FROM students WHERE mobile = $1 LIMIT 1",
      [mobile],
    );
    const student = studentResult.rows[0];
    if (!student) {
      response.status(404).json({ message: "Account not found for this mobile number." });
      return;
    }
    if (student.status === "Inactive") {
      response.status(403).json({ message: "Student account is inactive" });
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
      "INSERT INTO student_login_logs (student_id, ip_address, user_agent, source) VALUES ($1,$2,$3,$4)",
      [student.id, ipAddress, userAgent, "student_otp_login"],
    );

    response.json({
      ok: true,
      message: "OTP verified successfully.",
      token,
      user: mapStudentSelf(student),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to verify OTP" });
  }
});

app.post("/api/auth/student/reset-password-mobile", async (request, response) => {
  try {
    const mobile = normalizeMobile10(request.body?.mobile || request.body?.mobileNo || "");
    const otp = String(request.body?.otp || "").trim();
    const password = String(request.body?.password || "").trim();

    if (!/^\d{10}$/.test(mobile)) {
      response.status(400).json({ message: "Invalid mobile number." });
      return;
    }
    if (!/^\d{4,8}$/.test(otp)) {
      response.status(400).json({ message: "Valid OTP is required." });
      return;
    }
    if (password.length < 6) {
      response.status(400).json({ message: "Password must be at least 6 characters." });
      return;
    }

    const otpResult = await pool.query(
      `
      SELECT id, otp_hash, expires_at
      FROM student_otp_codes
      WHERE mobile = $1
        AND purpose = ANY($2::text[])
        AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [mobile, ["reset", "auth"]],
    );

    const otpRow = otpResult.rows[0];
    if (!otpRow) {
      response.status(400).json({ message: "OTP not found. Please resend OTP." });
      return;
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      response.status(400).json({ message: "OTP expired. Please resend OTP." });
      return;
    }

    if (String(otpRow.otp_hash || "") !== hashPassword(otp)) {
      response.status(400).json({ message: "Invalid OTP." });
      return;
    }

    const existing = await pool.query("SELECT id, email, name FROM students WHERE mobile = $1 LIMIT 1", [mobile]);
    const student = existing.rows[0];
    if (!student) {
      response.status(404).json({ message: "Account not found for this mobile number." });
      return;
    }

    await pool.query("UPDATE student_otp_codes SET consumed_at = NOW() WHERE id = $1", [otpRow.id]);
    await pool.query("UPDATE students SET password = $2, updated_at = NOW() WHERE id = $1", [student.id, hashPassword(password)]);
    await pool.query(
      `
      UPDATE auth_sessions
      SET is_active = FALSE,
          revoked_reason = 'password_reset',
          revoked_at = NOW()
      WHERE student_id = $1 AND is_active = TRUE
      `,
      [student.id],
    );

    void sendAutomatedMail({
      eventKey: "password_reset",
      toEmail: student.email,
      variables: {
        studentName: student.name || "Student",
        changedAt: new Date().toLocaleString("en-IN"),
      },
      fallbackSubject: "Password changed",
    }).catch(() => {});

    response.json({ ok: true, message: "Password reset successful. Please login with your new password." });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to reset password" });
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

app.post("/api/admin/logout", async (request, response) => {
  try {
    const token = extractAdminToken(request);
    if (!token) {
      response.status(401).json({ message: "Missing admin token" });
      return;
    }

    const result = await pool.query(
      `
      UPDATE admin_sessions
      SET is_active = FALSE,
          revoked_reason = 'manual_logout',
          revoked_at = NOW()
      WHERE token = $1 AND is_active = TRUE
      RETURNING admin_id
      `,
      [token],
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Admin session not found" });
      return;
    }

    response.json({ ok: true, message: "Logged out successfully" });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to logout admin" });
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

app.post("/api/auth/student/logout", async (request, response) => {
  try {
    const token = extractAdminToken(request);
    if (!token) {
      response.status(401).json({ message: "Missing student token" });
      return;
    }

    const result = await pool.query(
      `
      UPDATE auth_sessions
      SET is_active = FALSE,
          revoked_reason = 'manual_logout',
          revoked_at = NOW()
      WHERE token = $1 AND is_active = TRUE
      RETURNING student_id
      `,
      [token],
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Student session not found" });
      return;
    }

    response.json({ ok: true, message: "Logged out successfully" });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to logout student" });
  }
});

app.get("/api/auth/student/profile", requireStudentSession, async (request, response) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  const student = await withOrderLocationFallback(request.studentSession.student);
  response.json({ user: student });
});

app.put("/api/auth/student/profile", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const mobile = String(request.body?.mobile || "").trim();
    const address = String(request.body?.address || "").trim();
    const city = String(request.body?.city || "").trim();
    const country = String(request.body?.country || "").trim();
    const state = String(request.body?.state || "").trim();
    const pin = String(request.body?.pin || "").trim();

    await pool.query(
      `
      UPDATE students
      SET name = COALESCE(NULLIF($2, ''), name),
          email = COALESCE(NULLIF($3, ''), email),
          mobile = COALESCE(NULLIF($4, ''), mobile),
          address = COALESCE(NULLIF($5, ''), address),
          city = COALESCE(NULLIF($6, ''), city),
          country = COALESCE(NULLIF($7, ''), country),
          state = COALESCE(NULLIF($8, ''), state),
          pin = COALESCE(NULLIF($9, ''), pin),
          updated_at = NOW()
      WHERE id = $1
      `,
        [studentId, name, email, mobile, address, city, country, state, pin],
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
    await pool.query(
      `
      UPDATE auth_sessions
      SET is_active = FALSE,
          revoked_reason = 'password_changed',
          revoked_at = NOW()
      WHERE student_id = $1 AND token <> $2 AND is_active = TRUE
      `,
      [studentId, request.studentSession.token],
    );

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
    const subtotal = Math.max(0, Number(request.body?.subtotal || 0));
    const couponDiscount = Math.max(0, Number(request.body?.couponDiscount || 0));
    const taxAmount = Math.max(0, Number(request.body?.taxAmount || 0));
    const requestedTotal = Math.max(0, Number(request.body?.total || 0));
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
      const explicitExpiresAtRaw = String(rawItem?.expiresAt || "").trim();
      const explicitExpiresAtMs = explicitExpiresAtRaw ? new Date(explicitExpiresAtRaw).getTime() : Number.NaN;
      const explicitExpiresAt = Number.isFinite(explicitExpiresAtMs)
        ? new Date(explicitExpiresAtMs).toISOString()
        : "";
      const explicitUnlimited = typeof rawItem?.isUnlimitedViews === "boolean" ? rawItem.isUnlimitedViews : null;
      const totalViewsRaw = Number(rawItem?.totalViews || 2);
      const viewBudgetMultiplier = Number.isFinite(totalViewsRaw) && totalViewsRaw > 0
        ? Number(totalViewsRaw.toFixed(2))
        : 2;
      // DB columns are INTEGER; keep them whole numbers while preserving fractional budget in watch seconds.
      const totalViews = Math.max(1, Math.ceil(viewBudgetMultiplier));
      const usedViews = Math.max(0, Math.min(totalViews, Math.floor(Number(rawItem?.usedViews || 0))));
      const isEnabled = rawItem?.isEnabled !== false;
      const baseAmount = Math.max(0, Number(rawItem?.baseAmount ?? rawItem?.amount ?? 0));
      const taxAmount = Math.max(0, Number(rawItem?.taxAmount || 0));
      const amount = Math.max(0, Number(rawItem?.amount ?? (baseAmount + taxAmount)));
      const modeLabel = String(rawItem?.modeLabel || "").trim();
      const bookLabel = String(rawItem?.bookLabel || "").trim();
      const itemType = String(rawItem?.itemType || "course").trim().toLowerCase() || "course";
      const isTestSeries = ["test_series", "test-series", "testpaper"].includes(itemType);
      const isEbook = rawItem?.isEbook === true
        || /e\s*-?book/i.test(modeLabel)
        || /e\s*-?book/i.test(bookLabel)
        || itemType === "ebook";
      const grantAccess = !isTestSeries && rawItem?.grantAccess !== false;
      const createOrderLine = rawItem?.createOrderLine !== false;

      if (!courseId) continue;

      let isUnlimitedViews = explicitUnlimited === true;
      if (!isTestSeries && explicitUnlimited === null) {
        const courseResult = await pool.query("SELECT payload FROM courses WHERE id = $1 LIMIT 1", [courseId]);
        const payload = courseResult.rows[0]?.payload;
        if (payload && typeof payload === "object" && payload.unlimitedViewsEnabled === true) {
          isUnlimitedViews = true;
        }
      }

      const title = courseTitle || courseId;
      purchasedTitles.push(title);
      purchaseAmountTotal += amount;

      if (isTestSeries && rawItem?.grantAccess !== false) {
        await pool.query(
          `
          INSERT INTO student_test_access
          (student_id, paper_id, order_id, purchased_at, expires_at, is_enabled, updated_at)
          VALUES ($1,$2,$3,$4,$5,TRUE,NOW())
          ON CONFLICT (student_id, paper_id)
          DO UPDATE SET
            order_id = COALESCE(EXCLUDED.order_id, student_test_access.order_id),
            purchased_at = LEAST(student_test_access.purchased_at, EXCLUDED.purchased_at),
            expires_at = CASE
              WHEN student_test_access.expires_at IS NULL THEN EXCLUDED.expires_at
              WHEN EXCLUDED.expires_at IS NULL THEN student_test_access.expires_at
              ELSE GREATEST(student_test_access.expires_at, EXCLUDED.expires_at)
            END,
            is_enabled = TRUE,
            updated_at = NOW()
          `,
          [
            studentId,
            courseId,
            orderId || null,
            purchaseDate,
            explicitExpiresAt || null,
          ],
        );
      }

      if (grantAccess) {
        const expiresAt = explicitExpiresAt || new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        const computedDurationDays = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        const courseDurationSeconds = await getCourseDurationSeconds(pool, courseId);
        const allowedWatchSeconds = isUnlimitedViews
          ? 0
          : Math.max(0, Math.floor(Math.max(0, courseDurationSeconds) * viewBudgetMultiplier));
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
            computedDurationDays,
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
          (order_id, student_id, customer_name, customer_email, customer_phone, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_pincode, course_id, course_title, parent_package_id, parent_package_title, package_course_ids, order_date, payment_method, amount, currency, status, item_type, mode_label, book_label, is_ebook, dispatch_status, dispatch_note, base_amount, tax_amount, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,'INR','completed',$20,$21,$22,$23,$24,$25,$26,$27,NOW())
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
            base_amount = EXCLUDED.base_amount,
            tax_amount = EXCLUDED.tax_amount,
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
            baseAmount,
            taxAmount,
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

    const computedPaidTotal = Math.max(0, subtotal - couponDiscount + taxAmount);
    const effectivePaidTotal = requestedTotal > 0 ? requestedTotal : (computedPaidTotal > 0 ? computedPaidTotal : purchaseAmountTotal);

    void sendAutomatedMail({
      eventKey: "user_purchase",
      toEmail: request.studentSession?.student?.email || customerEmail,
      variables: {
        studentName: request.studentSession?.student?.name || customerName || "Student",
        orderId,
        itemsSummary: purchasedTitles.join(", "),
        amount: effectivePaidTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        couponDiscount: couponDiscount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalPaid: effectivePaidTotal.toFixed(2),
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
    const filterParams = [...params];

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
      JOIN students s ON s.id = a.student_id
      ${whereClause}
      `,
      filterParams,
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
        s.mobile AS student_mobile,
        a.purchase_date AS access_purchase_date,
        a.expires_at AS access_expires_at,
        a.total_views AS access_total_views,
        a.used_views AS access_used_views,
        a.is_enabled AS access_is_enabled
      FROM student_orders o
      JOIN students s ON s.id = o.student_id
      LEFT JOIN student_course_access a
        ON a.student_id = o.student_id
       AND a.course_id = o.course_id
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
        s.mobile AS student_mobile,
        a.purchase_date AS access_purchase_date,
        a.expires_at AS access_expires_at,
        a.total_views AS access_total_views,
        a.used_views AS access_used_views,
        a.is_enabled AS access_is_enabled
      FROM student_orders o
      JOIN students s ON s.id = o.student_id
      LEFT JOIN student_course_access a
        ON a.student_id = o.student_id
       AND a.course_id = o.course_id
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
      items: allLinesResult.rows.map((row) => {
        const amount = Math.max(0, Number(row.amount || 0));
        const taxAmount = Math.max(0, Number(row.tax_amount || 0));
        const baseAmountRaw = Math.max(0, Number(row.base_amount || 0));
        const baseAmount = (baseAmountRaw > 0 || taxAmount > 0)
          ? baseAmountRaw
          : Math.max(0, amount - taxAmount);

        return {
          courseTitle: String(row.course_title || "Course"),
          itemType: String(row.item_type || "course"),
          modeLabel: String(row.mode_label || ""),
          bookLabel: String(row.book_label || ""),
          baseAmount,
          taxAmount,
          amount,
        };
      }),
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
    const rawPassword = String(body.password || "student123");
    const storedPassword = hashPassword(rawPassword);
    const insertResult = await pool.query(
      `
      INSERT INTO students
      (name, email, mobile, city, state, country, status, courses_enrolled, courses_completed, bio, education_level, password, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
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
      RETURNING id
      `,
      [
        String(body.name || "Student"),
        String(body.email || ""),
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
    const newId = insertResult.rows[0].id;
    const result = await pool.query("SELECT * FROM students WHERE id = $1", [newId]);
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
    await pool.query("DELETE FROM students WHERE id = ANY($1::bigint[])", [ids]);
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
      [studentId, token],
    );
    await pool.query(
      "INSERT INTO auth_sessions (token, student_id, role, expires_at, is_active, login_ip, login_user_agent) VALUES ($1,$2,'student',$3,TRUE,$4,$5)",
      [token, studentId, new Date(Date.now() + 1000 * 60 * 60 * 24), ipAddress, userAgent],
    );

    await pool.query(
      "INSERT INTO student_login_logs (student_id, ip_address, user_agent, source) VALUES ($1,$2,$3,$4)",
      [studentId, ipAddress, userAgent, "admin_quick_login"],
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
    const [studentResult, courseAccessResult, testAccessResult, loginResult, videoResult, notificationResult] = await Promise.all([
      pool.query("SELECT * FROM students WHERE id = $1", [studentId]),
      pool.query(
        `SELECT ca.*
         FROM student_course_access ca
         WHERE ca.student_id = $1
           AND NOT EXISTS (
             SELECT 1
             FROM student_orders o
             WHERE o.student_id = ca.student_id
               AND o.course_id = ca.course_id
               AND LOWER(COALESCE(o.item_type, '')) IN ('test_series', 'test-series', 'testpaper')
           )
         ORDER BY ca.updated_at DESC`,
        [studentId],
      ),
      pool.query(
        `WITH combined AS (
           SELECT
             a.id,
             a.student_id,
             a.paper_id::text AS paper_id,
             a.order_id,
             a.purchased_at,
             a.expires_at,
             COALESCE((
               SELECT COUNT(*)::int
               FROM student_test_attempts sta
               WHERE sta.student_id = a.student_id AND sta.paper_id = a.paper_id
             ), a.attempts_used, 0) AS attempts_used,
             a.is_enabled,
             a.created_at,
             a.updated_at,
             p.paper_code,
             p.title,
             p.description,
             p.total_time,
             p.question_time_limit_seconds,
             p.thumbnail_url,
             p.price,
             p.attempts_allowed,
             p.is_visible,
             0 AS source_rank
           FROM student_test_access a
           LEFT JOIN crackit_papers p ON p.id = a.paper_id
           WHERE a.student_id = $1
           UNION ALL
           SELECT
             NULL::bigint AS id,
             o.student_id,
             o.course_id AS paper_id,
             o.order_id,
             COALESCE(o.order_date, o.created_at) AS purchased_at,
             NULL::timestamptz AS expires_at,
             COALESCE((
               SELECT COUNT(*)::int
               FROM student_test_attempts sta
               WHERE sta.student_id = o.student_id AND sta.paper_id::text = o.course_id
             ), 0) AS attempts_used,
             TRUE AS is_enabled,
             o.created_at,
             o.updated_at,
             p.paper_code,
             COALESCE(p.title, o.course_title) AS title,
             p.description,
             p.total_time,
             p.question_time_limit_seconds,
             p.thumbnail_url,
             p.price,
             p.attempts_allowed,
             p.is_visible,
             1 AS source_rank
           FROM student_orders o
           LEFT JOIN crackit_papers p ON p.id::text = o.course_id
           WHERE o.student_id = $1
             AND LOWER(COALESCE(o.item_type, '')) IN ('test_series', 'test-series', 'testpaper')
             AND LOWER(COALESCE(o.status, 'completed')) = 'completed'
         )
         SELECT DISTINCT ON (paper_id) *
         FROM combined
         ORDER BY paper_id, source_rank, updated_at DESC NULLS LAST`,
        [studentId],
      ),
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
      testSeriesAccess: testAccessResult.rows.map(mapStudentTestSeriesAccess),
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
      const removeCourseResult = await pool.query(
        "SELECT course_title FROM student_course_access WHERE student_id = $1 AND course_id = $2",
        [studentId, courseId],
      );
      const removeCourseTitle = removeCourseResult.rows[0]?.course_title || courseId;
      let removeStudentName = "";
      let removeStudentEmail = "";
      try {
        const sr = await pool.query("SELECT name, email FROM students WHERE id = $1", [studentId]);
        removeStudentName = sr.rows[0]?.name || "";
        removeStudentEmail = sr.rows[0]?.email || "";
      } catch { /* ignore */ }
      await pool.query(
        "DELETE FROM student_course_access WHERE student_id = $1 AND course_id = $2",
        [studentId, courseId],
      );
      writeAdminAuditLog({
        adminId: request.adminSession?.admin?.id,
        adminEmail: request.adminSession?.admin?.email,
        action: "course_remove",
        moduleKey: "users",
        targetType: "student",
        targetId: String(studentId),
        ipAddress: getIpAddress(request),
        userAgent: String(request.headers["user-agent"] || ""),
        details: { courseId, courseTitle: removeCourseTitle, studentName: removeStudentName, studentEmail: removeStudentEmail },
      }).catch(() => {});
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
      Math.ceil(
        Number(
          request.body?.totalViews ?? existingRow?.total_views ?? 1,
        ),
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
        Math.floor(Number(request.body?.usedViews ?? existingRow?.used_views ?? 0)),
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

    let assignStudentName = "";
    let assignStudentEmail = "";
    try {
      const sr = await pool.query("SELECT name, email FROM students WHERE id = $1", [studentId]);
      assignStudentName = sr.rows[0]?.name || "";
      assignStudentEmail = sr.rows[0]?.email || "";
    } catch { /* ignore */ }
    writeAdminAuditLog({
      adminId: request.adminSession?.admin?.id,
      adminEmail: request.adminSession?.admin?.email,
      action: existingRow ? "course_update" : "course_assign",
      moduleKey: "users",
      targetType: "student",
      targetId: String(studentId),
      ipAddress: getIpAddress(request),
      userAgent: String(request.headers["user-agent"] || ""),
      details: { courseId, courseTitle, notes: notes || null, studentName: assignStudentName, studentEmail: assignStudentEmail },
    }).catch(() => {});
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
    const extraViews = Math.floor(Number(request.body?.extraViews || 0));
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
      ? Math.max(1, Math.ceil(Number(request.body?.totalViews ?? row.total_views ?? 1)))
      : Math.max(1, Number(row.total_views ?? 1));
    const nextIsUnlimitedViews =
      typeof request.body?.isUnlimitedViews === "boolean"
        ? request.body.isUnlimitedViews
        : row.is_unlimited_views === true;
    const nextUsedViews = hasUsedViews
      ? Math.max(0, Math.min(nextTotalViews, Math.floor(Number(request.body?.usedViews ?? row.used_views ?? 0))))
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
    const supportedChannels = new Set(["in_app", "email"]);

    if (!message) {
      response.status(400).json({ message: "message is required" });
      return;
    }
    if (!supportedChannels.has(channel)) {
      response.status(400).json({ message: `${channel} messaging is not configured for this admin action` });
      return;
    }

    await pool.query(
      "INSERT INTO student_notifications (student_id, channel, subject, message, status, sent_by) VALUES ($1,$2,$3,$4,'queued',$5)",
      [studentId, channel, subject || null, message, sentBy],
    );

    if (channel === "email") {
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
    }

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

app.get("/api/categories", async (_request, response) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, slug, color, is_visible, parent_id, sort_order, created_at, updated_at
      FROM course_categories
      ORDER BY sort_order ASC, name ASC
      `,
    );
    response.json({ items: result.rows.map(mapCourseCategoryRow) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load categories" });
  }
});

app.get("/api/admin/categories", requireAdminPermission("categories", "read"), async (_request, response) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, slug, color, is_visible, parent_id, sort_order, created_at, updated_at
      FROM course_categories
      ORDER BY sort_order ASC, name ASC
      `,
    );
    response.json({ items: result.rows.map(mapCourseCategoryRow) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load categories" });
  }
});

app.post("/api/admin/categories/upsert", requireAdminPermission("categories", "edit"), async (request, response) => {
  try {
    const payload = normalizeCategoryPayload(request.body?.category || {});
    if (!payload.id || !payload.name) {
      response.status(400).json({ message: "Category id and name are required" });
      return;
    }

    if (payload.parentId && payload.parentId === payload.id) {
      response.status(400).json({ message: "Category cannot be parent of itself" });
      return;
    }

    if (payload.parentId) {
      const parentResult = await pool.query("SELECT id FROM course_categories WHERE id = $1", [payload.parentId]);
      if (parentResult.rowCount === 0) {
        response.status(400).json({ message: "Parent category not found" });
        return;
      }
    }

    const result = await pool.query(
      `
      INSERT INTO course_categories
      (id, name, slug, color, is_visible, parent_id, sort_order, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        color = EXCLUDED.color,
        is_visible = EXCLUDED.is_visible,
        parent_id = EXCLUDED.parent_id,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      RETURNING id, name, slug, color, is_visible, parent_id, sort_order, created_at, updated_at
      `,
      [
        payload.id,
        payload.name,
        payload.slug || payload.id,
        payload.color,
        payload.isVisible,
        payload.parentId,
        payload.sortOrder,
      ],
    );

    response.json({ ok: true, item: mapCourseCategoryRow(result.rows[0]) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save category" });
  }
});

app.post("/api/admin/categories/:id/toggle", requireAdminPermission("categories", "edit"), async (request, response) => {
  try {
    const id = String(request.params.id || "").trim();
    if (!id) {
      response.status(400).json({ message: "Category id is required" });
      return;
    }

    const hasExplicitValue = typeof request.body?.isVisible === "boolean";
    const result = await pool.query(
      `
      UPDATE course_categories
      SET is_visible = COALESCE($2::boolean, NOT is_visible),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, slug, color, is_visible, parent_id, sort_order, created_at, updated_at
      `,
      [id, hasExplicitValue ? request.body.isVisible : null],
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Category not found" });
      return;
    }

    response.json({ ok: true, item: mapCourseCategoryRow(result.rows[0]) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to toggle category" });
  }
});

app.delete("/api/admin/categories/:id", requireAdminPermission("categories", "delete"), async (request, response) => {
  const client = await pool.connect();
  try {
    const id = String(request.params.id || "").trim();
    if (!id) {
      response.status(400).json({ message: "Category id is required" });
      return;
    }

    await client.query("BEGIN");
    await client.query("UPDATE course_categories SET parent_id = NULL, updated_at = NOW() WHERE parent_id = $1", [id]);
    const result = await client.query("DELETE FROM course_categories WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Category not found" });
      return;
    }

    await client.query("COMMIT");
    response.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete category" });
  } finally {
    client.release();
  }
});

app.get("/api/course-masters", async (_request, response) => {
  try {
    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const mastersRaw = settings.siteSettings?.courseMasters && typeof settings.siteSettings.courseMasters === "object"
      ? settings.siteSettings.courseMasters
      : {};

    const viewModes = normalizeCourseMasterViewModes(mastersRaw.viewModes || []);
    const validityOptions = normalizeCourseMasterValidityOptions(mastersRaw.validityOptions || []);
    const attemptOptions = normalizeCourseMasterAttemptOptions(mastersRaw.attemptOptions || []);
    const deliveryModes = normalizeCourseMasterDeliveryModes(mastersRaw.deliveryModes || []);
    const languages = normalizeCourseMasterLanguages(mastersRaw.languages || []);
    const subjects = normalizeCourseMasterSubjects(mastersRaw.subjects || []);
    const pricingCombinations = normalizeCourseMasterPricingCombinations(mastersRaw.pricingCombinations || []);

    response.json({ viewModes, validityOptions, attemptOptions, deliveryModes, languages, subjects, pricingCombinations });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load course masters" });
  }
});

app.get("/api/admin/course-masters", requireAdminPermission("masters", "read"), async (_request, response) => {
  try {
    const [categoriesResult, settingsRaw] = await Promise.all([
      pool.query(
        `
        SELECT id, name, slug, color, is_visible, parent_id, sort_order, created_at, updated_at
        FROM course_categories
        ORDER BY sort_order ASC, name ASC
        `,
      ),
      getPlatformSettings(),
    ]);

    const settings = sanitizePlatformSettings(settingsRaw);
    const mastersRaw = settings.siteSettings?.courseMasters && typeof settings.siteSettings.courseMasters === "object"
      ? settings.siteSettings.courseMasters
      : {};

    const viewModes = normalizeCourseMasterViewModes(mastersRaw.viewModes || []);
    const validityOptions = normalizeCourseMasterValidityOptions(mastersRaw.validityOptions || []);
    const attemptOptions = normalizeCourseMasterAttemptOptions(mastersRaw.attemptOptions || []);
    const deliveryModes = normalizeCourseMasterDeliveryModes(mastersRaw.deliveryModes || []);
    const languages = normalizeCourseMasterLanguages(mastersRaw.languages || []);
    const categories = categoriesResult.rows.map(mapCourseCategoryRow);
    const categoryIds = new Set(categories.map((item) => item.id));
    const levelIds = new Set(categories.filter((item) => item.parentId).map((item) => item.id));
    const subjects = normalizeCourseMasterSubjects(mastersRaw.subjects || []).map((item) => ({
      ...item,
      courseIds: item.courseIds.filter((id) => categoryIds.has(id)),
      levelIds: item.levelIds.filter((id) => levelIds.has(id)),
    }));
    const viewModeIds = new Set(viewModes.map((item) => item.id));
    const validityIds = new Set(validityOptions.map((item) => item.id));
    const attemptIds = new Set(attemptOptions.map((item) => item.id));
    const deliveryModeIds = new Set(deliveryModes.map((item) => item.id));
    const languageIds = new Set(languages.map((item) => item.id));
    const pricingCombinations = normalizeCourseMasterPricingCombinations(mastersRaw.pricingCombinations || [])
      .filter((item) => (!item.viewModeId || viewModeIds.has(item.viewModeId))
        && (!item.validityOptionId || validityIds.has(item.validityOptionId))
        && (!item.attemptOptionId || attemptIds.has(item.attemptOptionId))
        && (!item.deliveryModeId || deliveryModeIds.has(item.deliveryModeId))
        && (!item.languageId || languageIds.has(item.languageId)));

    response.json({
      categories,
      viewModes,
      validityOptions,
      attemptOptions,
      deliveryModes,
      languages,
      subjects,
      pricingCombinations,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load course masters" });
  }
});

app.put("/api/admin/course-masters", requireAdminPermission("masters", "edit"), async (request, response) => {
  try {
    const existing = sanitizePlatformSettings(await getPlatformSettings());
    const incoming = request.body?.masters && typeof request.body.masters === "object" ? request.body.masters : {};

    const viewModes = normalizeCourseMasterViewModes(incoming.viewModes || []);
    const validityOptions = normalizeCourseMasterValidityOptions(incoming.validityOptions || []);
    const attemptOptions = normalizeCourseMasterAttemptOptions(incoming.attemptOptions || []);
    const deliveryModes = normalizeCourseMasterDeliveryModes(incoming.deliveryModes || []);
    const languages = normalizeCourseMasterLanguages(incoming.languages || []);
    const categoriesResult = await pool.query(
      `
      SELECT id, parent_id
      FROM course_categories
      `,
    );
    const categoryRows = categoriesResult.rows || [];
    const categoryIds = new Set(categoryRows.map((item) => String(item.id || "")).filter(Boolean));
    const levelIds = new Set(
      categoryRows
        .filter((item) => item.parent_id)
        .map((item) => String(item.id || "").trim())
        .filter(Boolean),
    );
    const subjects = normalizeCourseMasterSubjects(incoming.subjects || []).map((item) => ({
      ...item,
      courseIds: item.courseIds.filter((id) => categoryIds.has(id)),
      levelIds: item.levelIds.filter((id) => levelIds.has(id)),
    }));
    const viewModeIds = new Set(viewModes.map((item) => item.id));
    const validityIds = new Set(validityOptions.map((item) => item.id));
    const attemptIds = new Set(attemptOptions.map((item) => item.id));
    const deliveryModeIds = new Set(deliveryModes.map((item) => item.id));
    const languageIds = new Set(languages.map((item) => item.id));
    const pricingCombinations = normalizeCourseMasterPricingCombinations(incoming.pricingCombinations || [])
      .filter((item) => (!item.viewModeId || viewModeIds.has(item.viewModeId))
        && (!item.validityOptionId || validityIds.has(item.validityOptionId))
        && (!item.attemptOptionId || attemptIds.has(item.attemptOptionId))
        && (!item.deliveryModeId || deliveryModeIds.has(item.deliveryModeId))
        && (!item.languageId || languageIds.has(item.languageId)));

    const nextData = sanitizePlatformSettings({
      ...existing,
      siteSettings: {
        ...(existing.siteSettings || {}),
        courseMasters: {
          viewModes,
          validityOptions,
          attemptOptions,
          deliveryModes,
          languages,
          subjects,
          pricingCombinations,
        },
      },
    });

    await setPlatformSettings(nextData);
    response.json({ ok: true, masters: { viewModes, validityOptions, attemptOptions, deliveryModes, languages, subjects, pricingCombinations } });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save course masters" });
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

    const facultyIds = Array.from(new Set(normalizeStringList(course?.facultyIds)));
    if (facultyIds.length > 0) {
      const facultyResult = await pool.query(
        "SELECT id::text AS id FROM faculty_profiles WHERE id::text = ANY($1::text[])",
        [facultyIds],
      );
      const validFacultyIds = new Set(facultyResult.rows.map((row) => String(row.id || "").trim()).filter(Boolean));
      const invalidFacultyIds = facultyIds.filter((id) => !validFacultyIds.has(id));
      if (invalidFacultyIds.length > 0) {
        response.status(400).json({ message: `Invalid facultyIds: ${invalidFacultyIds.join(", ")}` });
        return;
      }
    }

    const nextCourse = {
      ...course,
      facultyIds,
      revenueShareEnabled: course?.revenueShareEnabled === true,
    };

    await pool.query(
      `
      INSERT INTO courses (id, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [String(course.id), JSON.stringify(nextCourse)],
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

// --- Crack It (Test Series) Module ---

app.get("/api/admin/crackit/questions", requireAdminPermission("crackit", "read"), async (request, response) => {
  try {
    const { courseId, levelId, subjectId, chapterId, type, difficulty } = request.query;
    let query = "SELECT * FROM crackit_questions WHERE 1=1";
    const params = [];

    if (courseId) {
      params.push(courseId);
      query += ` AND course_id = $${params.length}`;
    }
    if (levelId) {
      params.push(levelId);
      query += ` AND level_id = $${params.length}`;
    }
    if (subjectId) {
      params.push(subjectId);
      query += ` AND subject_id = $${params.length}`;
    }
    if (chapterId) {
      params.push(chapterId);
      query += ` AND chapter_id = $${params.length}`;
    }
    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    if (difficulty) {
      params.push(difficulty);
      query += ` AND difficulty = $${params.length}`;
    }

    query += " ORDER BY created_at DESC";
    const result = await pool.query(query, params);
    response.json({ items: result.rows });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch questions" });
  }
});

app.delete("/api/admin/crackit/questions", requireAdminPermission("crackit", "edit"), async (request, response) => {
  try {
    const ids = Array.isArray(request.body?.ids)
      ? request.body.ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      response.status(400).json({ message: "Question ids are required" });
      return;
    }
    if (uniqueIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      response.status(400).json({ message: "Question ids must be valid UUIDs" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM crackit_paper_questions WHERE question_id = ANY($1::uuid[])", [uniqueIds]);
      const deleted = await client.query("DELETE FROM crackit_questions WHERE id = ANY($1::uuid[]) RETURNING id", [uniqueIds]);
      await client.query("COMMIT");
      response.json({ ok: true, deleted: deleted.rowCount });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete questions" });
  }
});

app.delete("/api/admin/crackit/questions/:id", requireAdminPermission("crackit", "edit"), async (request, response) => {
  try {
    const questionId = String(request.params.id || "").trim();
    if (!questionId) {
      response.status(400).json({ message: "Question id is required" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM crackit_paper_questions WHERE question_id = $1", [questionId]);
      const deleted = await client.query("DELETE FROM crackit_questions WHERE id = $1 RETURNING id", [questionId]);
      if (deleted.rowCount === 0) {
        await client.query("ROLLBACK");
        response.status(404).json({ message: "Question not found" });
        return;
      }
      await client.query("COMMIT");
      response.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete question" });
  }
});

app.post("/api/admin/crackit/questions", requireAdminPermission("crackit", "edit"), async (request, response) => {
  try {
    const { id, course_id, level_id, subject_id, chapter_id, sub_chapter_id, type, difficulty, question_text, options, correct_answer, explanation, metadata } = request.body;
    
    // Ensure JSON fields are objects or valid JSON strings
    const finalOptions = Array.isArray(options) ? JSON.stringify(options) : (options || "[]");
    const finalCorrect = typeof correct_answer === 'object' ? JSON.stringify(correct_answer) : (correct_answer || "{}");
    const finalMeta = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || "{}");

    if (id && id.length > 5) { // Simple check for a real ID
      // Update
      await pool.query(
        `UPDATE crackit_questions SET 
          course_id = $1, level_id = $2, subject_id = $3, chapter_id = $4, sub_chapter_id = $5,
          type = $6, difficulty = $7, question_text = $8, options = $9::jsonb, 
          correct_answer = $10::jsonb, explanation = $11, metadata = $12::jsonb, updated_at = NOW()
        WHERE id = $13`,
        [course_id || null, level_id || null, subject_id || null, chapter_id || null, sub_chapter_id || null, 
         type, difficulty, question_text, finalOptions, finalCorrect, explanation || null, finalMeta, id]
      );
    } else {
      // Insert
      await pool.query(
        `INSERT INTO crackit_questions 
          (course_id, level_id, subject_id, chapter_id, sub_chapter_id, type, difficulty, question_text, options, correct_answer, explanation, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12::jsonb)`,
        [course_id || null, level_id || null, subject_id || null, chapter_id || null, sub_chapter_id || null, 
         type, difficulty, question_text, finalOptions, finalCorrect, explanation || null, finalMeta]
      );
    }
    response.json({ ok: true });
  } catch (error) {
    console.error("CRACKIT QUESTION SAVE ERROR:", error);
    response.status(500).json({ 
      message: error instanceof Error ? error.message : "Failed to save question",
      detail: (error && typeof error === 'object' && 'detail' in error) ? error.detail : undefined
    });
  }
});

const getCrackItExtractionPrompt = () => `
  Extract multiple-choice and other educational questions from the provided content and return them as a valid JSON array.
  Return JSON only. No markdown and no explanation outside the JSON.
  Preserve mathematical formulas, equations, symbols, roots, fractions, exponents, subscripts, matrices, limits, integrals, summations and inequalities accurately.
  Convert formulas to LaTeX-style inline notation when needed, for example \\(x^2 + y^2\\), \\frac{a}{b}, \\sqrt{x}, x_1, \\sum_{i=1}^{n}.
  Wrap every mathematical expression in inline LaTeX delimiters \\(...\\), or display delimiters \\[...\\] for large matrices/cases/multi-line equations.
  For advanced formulas use valid KaTeX-compatible LaTeX: \\begin{matrix}, \\begin{pmatrix}, \\begin{cases}, \\lim_{x\\to0}, \\int_a^b, \\sum_{i=1}^n, \\vec{x}, \\bar{x}, \\hat{x}.
  Because the output must be JSON, every LaTeX backslash must be escaped as double backslash, for example "\\\\frac{a}{b}" and "\\\\sqrt{x}".
  Do not simplify, solve, rewrite, or change formula meaning. Keep the same variables, signs, units, and option order from the source.
  If the source contains Hindi/English mixed text, keep the original language and only normalize formulas.
  If a formula is visually unclear, preserve the readable parts and mark only the unclear fragment as "[unclear]" inside the same field.
  Each object in the array MUST follow this structure:
  {
    "question_text": "The full text of the question",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": { "value": "Option A" },
    "difficulty": "medium",
    "explanation": "Why this is correct"
  }
  Allowed type values: mcq, msq, tf, short, match, fill.
  Use null for options when options are not applicable.
  Use easy, medium, or hard for difficulty.
`;

const normalizeGeminiModelName = (value) => {
  const model = String(value || "").trim();
  if (!model) return "gemini-1.5-flash";
  if (model.startsWith("models/")) return model.replace(/^models\//, "");
  if (model.startsWith("gemini-")) return model;
  if (/^\d/.test(model) || model.startsWith("flash") || model.startsWith("pro")) {
    return `gemini-${model}`;
  }
  return model;
};

const getImageCapableAiModel = (provider, model) => {
  const selected = String(model || "").trim();
  const lower = selected.toLowerCase();
  if (provider === "gemini") {
    return normalizeGeminiModelName(selected || "gemini-1.5-flash");
  }
  if (provider === "grok") {
    if (lower.includes("vision")) return selected;
    return "grok-2-vision-latest";
  }
  if (provider === "openrouter") {
    if (
      lower.includes("vision") ||
      lower.includes("gpt-4o") ||
      lower.includes("gemini") ||
      lower.includes("claude-3") ||
      lower.includes("qwen-vl") ||
      lower.includes("llava")
    ) {
      return selected;
    }
    return "google/gemini-2.0-flash-001";
  }
  return selected;
};

const getConfiguredAiExtraction = async (overrides = {}) => {
  const settings = sanitizePlatformSettings(await getPlatformSettings());
  const savedAi = settings.aiExtraction && typeof settings.aiExtraction === "object" ? settings.aiExtraction : {};
  const incomingAi = overrides && typeof overrides === "object" ? sanitizePlatformSettings({ aiExtraction: overrides }).aiExtraction : {};
  const ai = { ...savedAi, ...incomingAi };
  ["geminiApiKey", "grokApiKey", "openRouterApiKey"].forEach((key) => {
    if (!incomingAi?.[key] || incomingAi[key] === "••••••" || incomingAi[key] === "******") {
      ai[key] = savedAi[key] || "";
    }
  });
  const provider = ["gemini", "grok", "openrouter"].includes(String(ai.provider || "").toLowerCase())
    ? String(ai.provider || "").toLowerCase()
    : "gemini";
  const apiKeys = {
    gemini: decryptPassword(String(ai.geminiApiKey || "").trim()) || process.env.GEMINI_API_KEY || "",
    grok: decryptPassword(String(ai.grokApiKey || "").trim()) || process.env.GROK_API_KEY || process.env.XAI_API_KEY || "",
    openrouter: decryptPassword(String(ai.openRouterApiKey || "").trim()) || process.env.OPENROUTER_API_KEY || "",
  };
  const models = {
    gemini: normalizeGeminiModelName(ai.geminiModel || process.env.GEMINI_MODEL || "gemini-1.5-flash"),
    grok: String(ai.grokModel || process.env.GROK_MODEL || "grok-2-vision-latest").trim() || "grok-2-vision-latest",
    openrouter: String(ai.openRouterModel || process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001").trim() || "google/gemini-2.0-flash-001",
  };

  return {
    provider,
    apiKey: String(apiKeys[provider] || "").trim(),
    model: models[provider],
  };
};

const getOpenAiCompatibleContent = (prompt, file) => {
  if (!file) return prompt;
  const mimeType = String(file.mimetype || "").toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error("Selected AI provider/model supports image upload only here. For PDF extraction, use Gemini or upload a text-based PDF.");
  }

  return [
    { type: "text", text: `${prompt}\n\nRead the uploaded image carefully and extract all visible questions.` },
    {
      type: "image_url",
      image_url: {
        url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      },
    },
  ];
};

const callOpenAiCompatibleAi = async ({ apiKey, model, endpoint, prompt, file, providerName }) => {
  const aiResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || "http://localhost:8081",
      "X-Title": "Ednovate CrackIt",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: getOpenAiCompatibleContent(prompt, file),
        },
      ],
    }),
  });

  const payload = await aiResponse.json().catch(() => ({}));
  if (!aiResponse.ok) {
    const message = payload?.error?.message || payload?.message || `${providerName} request failed`;
    if (/support image|image input|no endpoint/i.test(message)) {
      throw new Error(`${providerName} selected model does not support image upload. Use a vision model such as Gemini Flash, GPT-4o, Claude 3, Qwen-VL, or Grok Vision.`);
    }
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || "").join("\n");
  }

  return String(content || "");
};

const extractQuestionsWithConfiguredAi = async ({ prompt, file, aiExtraction }) => {
  const config = await getConfiguredAiExtraction(aiExtraction);
  if (!config.apiKey) {
    throw new Error(`${config.provider} API key is not configured in Admin Settings`);
  }
  const modelName = file ? getImageCapableAiModel(config.provider, config.model) : config.model;

  if (config.provider === "gemini") {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = file
      ? await model.generateContent([
          `${prompt}\n\nRead the uploaded document carefully and extract all visible questions.`,
          {
            inlineData: {
              data: file.buffer.toString("base64"),
              mimeType: file.mimetype,
            },
          },
        ])
      : await model.generateContent(prompt);
    return result.response.text();
  }

  if (config.provider === "grok") {
    return callOpenAiCompatibleAi({
      apiKey: config.apiKey,
      model: modelName,
      endpoint: "https://api.x.ai/v1/chat/completions",
      prompt,
      file,
      providerName: "Grok",
    });
  }

  return callOpenAiCompatibleAi({
    apiKey: config.apiKey,
    model: modelName,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    prompt,
    file,
    providerName: "OpenRouter",
  });
};

const extractPdfText = async (buffer) => {
  if (typeof pdfParse === "function") {
    const result = await pdfParse(buffer);
    return String(result?.text || "");
  }

  if (pdfParse && typeof pdfParse.PDFParse === "function") {
    const parser = new pdfParse.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return String(result?.text || "");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  throw new Error("Unsupported pdf-parse export shape");
};

const normalizeExtractedQuestionText = (value) => (
  typeof value === "string"
    ? value
        .replace(/\s+\n/g, "\n")
        .replace(/\n\s+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim()
    : value
);

const normalizeExtractedQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];
  return questions.map((item) => {
    const question = item && typeof item === "object" ? item : {};
    return {
      ...question,
      question_text: normalizeExtractedQuestionText(question.question_text),
      options: Array.isArray(question.options)
        ? question.options.map((option) => normalizeExtractedQuestionText(option))
        : question.options,
      correct_answer: question.correct_answer && typeof question.correct_answer === "object"
        ? {
            ...question.correct_answer,
            value: normalizeExtractedQuestionText(question.correct_answer.value),
          }
        : question.correct_answer,
      explanation: normalizeExtractedQuestionText(question.explanation),
    };
  });
};

const parseAiQuestionJson = (rawJson) => {
  try {
    return JSON.parse(rawJson);
  } catch (firstError) {
    const repaired = String(rawJson || "").replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    try {
      return JSON.parse(repaired);
    } catch {
      throw firstError;
    }
  }
};

app.post("/api/admin/ai-extraction/test", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const aiExtraction = request.body?.aiExtraction && typeof request.body.aiExtraction === "object"
      ? request.body.aiExtraction
      : {};
    const config = await getConfiguredAiExtraction(aiExtraction);
    if (!config.apiKey) {
      response.status(400).json({ ok: false, message: `${config.provider} API key is missing` });
      return;
    }

    const text = await extractQuestionsWithConfiguredAi({
      aiExtraction,
      file: null,
      prompt: 'Reply with exactly this JSON: [{"question_text":"Connection test","type":"short","options":null,"correct_answer":{"value":"ok"},"difficulty":"easy","explanation":"ok"}]',
    });

    response.json({
      ok: true,
      provider: config.provider,
      model: config.model,
      message: text ? "AI connection is working" : "AI connection responded without text",
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "AI connection test failed",
    });
  }
});

app.post("/api/admin/crackit/extract-questions", requireAdminPermission("crackit", "edit"), upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ message: "No PDF or image file uploaded" });
      return;
    }

    let aiExtraction = {};
    if (request.body?.aiExtraction) {
      try {
        const parsed = typeof request.body.aiExtraction === "string"
          ? JSON.parse(request.body.aiExtraction)
          : request.body.aiExtraction;
        aiExtraction = parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        aiExtraction = {};
      }
    }

    const extractionPrompt = getCrackItExtractionPrompt();
    const mimeType = String(request.file.mimetype || "").toLowerCase();
    let resultText;

    if (mimeType.startsWith("image/")) {
      resultText = await extractQuestionsWithConfiguredAi({ prompt: extractionPrompt, file: request.file, aiExtraction });
    } else {
      let text = "";
      try {
        text = await extractPdfText(request.file.buffer);
      } catch (pdfError) {
        console.warn("[CRACKIT_PDF_TEXT_ERROR]", pdfError);
      }

      if (!text || text.trim().length < 10) {
        const config = await getConfiguredAiExtraction(aiExtraction);
        if (config.provider !== "gemini") {
          response.status(400).json({
            message: "Could not extract readable text from this PDF. For scanned/image PDFs, select Gemini in Admin Settings or upload the page as an image.",
          });
          return;
        }

        resultText = await extractQuestionsWithConfiguredAi({
          prompt: extractionPrompt,
          file: {
            ...request.file,
            mimetype: mimeType || "application/pdf",
          },
          aiExtraction,
        });
      } else {
        resultText = await extractQuestionsWithConfiguredAi({
          aiExtraction,
          file: null,
          prompt: `
          ${extractionPrompt}
          
          Text:
          ${text.slice(0, 30000)}
        `,
        });
      }
    }
    
    // Clean JSON from markdown code blocks if present
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      response.status(500).json({ message: "AI failed to generate a valid JSON list of questions" });
      return;
    }

    const questions = normalizeExtractedQuestions(parseAiQuestionJson(jsonMatch[0]));
    response.json({ items: questions });
  } catch (error) {
    console.error("[CRACKIT_AI_ERROR]", error);
    response.status(500).json({ message: error instanceof Error ? error.message : "AI extraction failed" });
  }
});

app.get("/api/test-papers", async (request, response) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        COALESCE(
          array_agg(pq.question_id::text ORDER BY pq.sort_order)
            FILTER (WHERE pq.question_id IS NOT NULL),
          ARRAY[]::text[]
        ) AS question_ids
      FROM crackit_papers p
      LEFT JOIN crackit_paper_questions pq ON pq.paper_id = p.id
      WHERE p.is_visible IS NOT FALSE
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    response.json({ items: result.rows });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch test papers" });
  }
});

const studentHasTestPaperAccess = async (studentId, paperId) => {
  const result = await pool.query(
    `
    SELECT
      EXISTS (
        SELECT 1
        FROM student_test_access a
        WHERE a.student_id = $1
          AND a.paper_id::text = $2
      ) AS direct_exists,
      EXISTS (
        SELECT 1
        FROM student_test_access a
        WHERE a.student_id = $1
          AND a.paper_id::text = $2
          AND a.is_enabled IS NOT FALSE
          AND (a.expires_at IS NULL OR a.expires_at > NOW())
      ) AS direct_allowed,
      EXISTS (
        SELECT 1
        FROM student_orders o
        WHERE o.student_id = $1
          AND o.course_id = $2
          AND LOWER(COALESCE(o.item_type, '')) IN ('test_series', 'test-series', 'testpaper')
          AND LOWER(COALESCE(o.status, 'completed')) = 'completed'
      ) AS order_allowed
    `,
    [studentId, paperId],
  );
  const row = result.rows[0] || {};
  return row.direct_exists ? row.direct_allowed === true : row.order_allowed === true;
};

const getStudentTestAttemptLimit = async (studentId, paperId) => {
  const result = await pool.query(
    `
    SELECT
      COALESCE(p.attempts_allowed, 1)::int AS attempts_allowed,
      COUNT(a.id)::int AS attempts_used
    FROM crackit_papers p
    LEFT JOIN student_test_attempts a ON a.paper_id = p.id AND a.student_id = $1
    WHERE p.id::text = $2
    GROUP BY p.id, p.attempts_allowed
    `,
    [studentId, paperId],
  );
  const row = result.rows[0] || {};
  return {
    attemptsAllowed: Math.max(1, Number(row.attempts_allowed || 1)),
    attemptsUsed: Math.max(0, Number(row.attempts_used || 0)),
  };
};

app.get("/api/test-papers/:id/questions", requireStudentSession, async (request, response) => {
  try {
    const paperId = String(request.params.id || "").trim();
    const studentId = request.studentSession.studentId;
    const hasAccess = await studentHasTestPaperAccess(studentId, paperId);
    if (!hasAccess) {
      response.status(403).json({ message: "Purchase required to attempt this test paper" });
      return;
    }
    const attemptLimit = await getStudentTestAttemptLimit(studentId, paperId);
    if (attemptLimit.attemptsUsed >= attemptLimit.attemptsAllowed) {
      response.status(403).json({
        message: "Attempt limit reached for this test paper",
        code: "ATTEMPT_LIMIT_REACHED",
        attemptsAllowed: attemptLimit.attemptsAllowed,
        attemptsUsed: attemptLimit.attemptsUsed,
      });
      return;
    }
    const result = await pool.query(`
      SELECT q.id, q.type, q.difficulty, q.question_text, q.options, q.correct_answer, q.explanation, q.metadata
      FROM crackit_paper_questions pq
      JOIN crackit_questions q ON q.id = pq.question_id
      JOIN crackit_papers p ON p.id = pq.paper_id
      WHERE pq.paper_id::text = $1 AND p.is_visible IS NOT FALSE
      ORDER BY pq.sort_order ASC, q.created_at ASC
    `, [paperId]);
    response.json({ items: result.rows });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch test paper questions" });
  }
});

app.get("/api/auth/student/test-attempts", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const result = await pool.query(
      `
      SELECT *
      FROM student_test_attempts
      WHERE student_id = $1
      ORDER BY submitted_at DESC
      LIMIT 100
      `,
      [studentId],
    );
    response.json({
      items: result.rows.map((row) => ({
        id: row.id,
        paperId: String(row.paper_id || ""),
        paperTitle: row.paper_title,
        submittedAt: row.submitted_at,
        totalQuestions: Number(row.total_questions || 0),
        attempted: Number(row.attempted || 0),
        correct: Number(row.correct || 0),
        wrong: Number(row.wrong || 0),
        scorePercent: Number(row.score_percent || 0),
        timeTakenSeconds: Number(row.time_taken_seconds || 0),
        questions: Array.isArray(row.report?.questions) ? row.report.questions : [],
      })),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch test attempts" });
  }
});

app.post("/api/auth/student/test-attempts", requireStudentSession, async (request, response) => {
  try {
    const studentId = request.studentSession.studentId;
    const report = request.body?.report && typeof request.body.report === "object" ? request.body.report : request.body;
    const paperId = String(report?.paperId || "").trim();
    if (!paperId) {
      response.status(400).json({ message: "paperId is required" });
      return;
    }
    const hasAccess = await studentHasTestPaperAccess(studentId, paperId);
    if (!hasAccess) {
      response.status(403).json({ message: "Purchase required to submit this test attempt" });
      return;
    }
    const attemptId = String(report?.id || `attempt-${Date.now()}`).trim();
    const existingAttemptResult = await pool.query(
      "SELECT id FROM student_test_attempts WHERE id = $1 AND student_id = $2 LIMIT 1",
      [attemptId, studentId],
    );
    const attemptLimit = await getStudentTestAttemptLimit(studentId, paperId);
    if (existingAttemptResult.rowCount === 0 && attemptLimit.attemptsUsed >= attemptLimit.attemptsAllowed) {
      response.status(403).json({
        message: "Attempt limit reached for this test paper",
        code: "ATTEMPT_LIMIT_REACHED",
        attemptsAllowed: attemptLimit.attemptsAllowed,
        attemptsUsed: attemptLimit.attemptsUsed,
      });
      return;
    }

    const submittedAt = report?.submittedAt ? new Date(report.submittedAt) : new Date();
    await pool.query(
      `
      INSERT INTO student_test_attempts
      (id, student_id, paper_id, paper_title, submitted_at, total_questions, attempted, correct, wrong, score_percent, time_taken_seconds, report)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        paper_title = EXCLUDED.paper_title,
        submitted_at = EXCLUDED.submitted_at,
        total_questions = EXCLUDED.total_questions,
        attempted = EXCLUDED.attempted,
        correct = EXCLUDED.correct,
        wrong = EXCLUDED.wrong,
        score_percent = EXCLUDED.score_percent,
        time_taken_seconds = EXCLUDED.time_taken_seconds,
        report = EXCLUDED.report
      `,
      [
        attemptId,
        studentId,
        paperId,
        String(report?.paperTitle || "Test Paper"),
        submittedAt,
        Math.max(0, Number(report?.totalQuestions || 0)),
        Math.max(0, Number(report?.attempted || 0)),
        Math.max(0, Number(report?.correct || 0)),
        Math.max(0, Number(report?.wrong || 0)),
        Math.max(0, Number(report?.scorePercent || 0)),
        Math.max(0, Number(report?.timeTakenSeconds || 0)),
        JSON.stringify({
          ...report,
          id: attemptId,
          paperId,
          questions: Array.isArray(report?.questions) ? report.questions : [],
        }),
      ],
    );
    await pool.query(
      `
      UPDATE student_test_access
      SET attempts_used = (
            SELECT COUNT(*)::int
            FROM student_test_attempts sta
            WHERE sta.student_id = $1
              AND sta.paper_id::text = $2
          ),
          updated_at = NOW()
      WHERE student_id = $1
        AND paper_id::text = $2
      `,
      [studentId, paperId],
    );
    response.json({ ok: true, id: attemptId });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save test attempt" });
  }
});

app.get("/api/admin/crackit/papers", requireAdminPermission("crackit", "read"), async (request, response) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        COALESCE(
          array_agg(pq.question_id::text ORDER BY pq.sort_order)
            FILTER (WHERE pq.question_id IS NOT NULL),
          ARRAY[]::text[]
        ) AS question_ids
      FROM crackit_papers p
      LEFT JOIN crackit_paper_questions pq ON pq.paper_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    response.json({ items: result.rows });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch papers" });
  }
});

app.post("/api/admin/crackit/papers", requireAdminPermission("crackit", "edit"), async (request, response) => {
  try {
    const { id, paper_code, title, nature, category, remark_teacher, remark_students, description, total_time, question_time_limit_seconds, course_id, level_id, subject_id, chapter_id, sub_chapter_id, passing_percent, attempts_allowed, thumbnail_url, price, original_price, is_visible, question_ids } = request.body;
    const safeQuestionTimeLimitSeconds = Math.max(0, Math.floor(Number(question_time_limit_seconds || 0)));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      let paperId = id;
      if (id) {
        // Update
        await client.query(
          `UPDATE crackit_papers SET 
            paper_code = $1, title = $2, nature = $3, category = $4, remark_teacher = $5,
            remark_students = $6, description = $7, total_time = $8, course_id = $9,
            level_id = $10, subject_id = $11, chapter_id = $12, sub_chapter_id = $13,
            passing_percent = $14, attempts_allowed = $15, thumbnail_url = $16, price = $17, original_price = $18,
            is_visible = $19, question_time_limit_seconds = $20, updated_at = NOW()
          WHERE id = $21`,
          [paper_code, title, nature, category, remark_teacher, remark_students, description, total_time, course_id, level_id, subject_id, chapter_id, sub_chapter_id, passing_percent, attempts_allowed, thumbnail_url || null, price, original_price, is_visible, safeQuestionTimeLimitSeconds, id]
        );
      } else {
        // Insert
        const insertRes = await client.query(
          `INSERT INTO crackit_papers 
            (paper_code, title, nature, category, remark_teacher, remark_students, description, total_time, course_id, level_id, subject_id, chapter_id, sub_chapter_id, passing_percent, attempts_allowed, thumbnail_url, price, original_price, is_visible, question_time_limit_seconds)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING id`,
          [paper_code, title, nature, category, remark_teacher, remark_students, description, total_time, course_id, level_id, subject_id, chapter_id, sub_chapter_id, passing_percent, attempts_allowed, thumbnail_url || null, price, original_price, is_visible, safeQuestionTimeLimitSeconds]
        );
        paperId = insertRes.rows[0].id;
      }

      // Sync questions
      if (Array.isArray(question_ids)) {
        await client.query("DELETE FROM crackit_paper_questions WHERE paper_id = $1", [paperId]);
        for (let i = 0; i < question_ids.length; i++) {
          await client.query(
            "INSERT INTO crackit_paper_questions (paper_id, question_id, sort_order) VALUES ($1, $2, $3)",
            [paperId, question_ids[i], i]
          );
        }
      }

      await client.query("COMMIT");
      response.json({ ok: true, id: paperId });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save paper" });
  }
});

app.delete("/api/admin/crackit/papers/:id", requireAdminPermission("crackit", "edit"), async (request, response) => {
  const paperId = String(request.params.id || "").trim();
  if (!paperId) {
    response.status(400).json({ message: "Paper id is required" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM student_test_access WHERE paper_id = $1", [paperId]);
    await client.query("DELETE FROM crackit_paper_questions WHERE paper_id = $1", [paperId]);
    const deleted = await client.query("DELETE FROM crackit_papers WHERE id = $1 RETURNING id", [paperId]);
    if (deleted.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Test paper not found" });
      return;
    }
    await client.query("COMMIT");
    response.json({ ok: true, id: paperId });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete paper" });
  } finally {
    client.release();
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

const buildRevenueShareCourseSet = async (dbClient, courseIds) => {
  const uniqueCourseIds = Array.from(new Set((Array.isArray(courseIds) ? courseIds : []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (uniqueCourseIds.length === 0) return new Set();
  const result = await dbClient.query(
    "SELECT id FROM courses WHERE id = ANY($1::text[]) AND COALESCE((payload->>'revenueShareEnabled')::boolean, FALSE) = TRUE",
    [uniqueCourseIds],
  );
  return new Set(result.rows.map((row) => String(row.id || "").trim()).filter(Boolean));
};

const mapFacultyProfile = (row, courseLookup = {}, options = {}) => {
  const includePrivate = options.includePrivate === true;
  const courseIds = normalizeStringList(row.course_ids);
  const item = {
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
    revenueSharePercent: Number(row.revenue_share_percent || 0),
    isLoginEnabled: row.is_login_enabled === true,
  };

  if (includePrivate) {
    item.email = String(row.email || "");
  }

  return item;
};

const parseDateParam = (value) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeLessonInstructorShares = (lesson) => {
  const source = Array.isArray(lesson?.instructorShares)
    ? lesson.instructorShares
    : Array.isArray(lesson?.instructors)
      ? lesson.instructors
      : [];

  const cleaned = source
    .map((row) => ({
      facultyId: String(row?.facultyId || row?.id || "").trim(),
      sharePercent: Number(row?.sharePercent || row?.percentage || 0),
    }))
    .filter((row) => row.facultyId && Number.isFinite(row.sharePercent) && row.sharePercent > 0);

  const total = cleaned.reduce((sum, row) => sum + row.sharePercent, 0);
  if (total <= 0) return [];

  return cleaned.map((row) => ({
    facultyId: row.facultyId,
    sharePercent: row.sharePercent / total,
  }));
};

const buildCourseInstructorStatsMap = async (dbClient, courseIds) => {
  const uniqueCourseIds = Array.from(new Set((Array.isArray(courseIds) ? courseIds : []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (uniqueCourseIds.length === 0) return new Map();

  const result = await dbClient.query(
    "SELECT course_id, chapters FROM course_curricula WHERE course_id = ANY($1::text[])",
    [uniqueCourseIds],
  );

  const stats = new Map();
  uniqueCourseIds.forEach((courseId) => {
    stats.set(courseId, {
      totalSeconds: 0,
      instructorSeconds: {},
    });
  });

  result.rows.forEach((row) => {
    const courseId = String(row.course_id || "").trim();
    if (!courseId) return;
    const chapters = Array.isArray(row.chapters) ? row.chapters : [];
    const entry = stats.get(courseId) || { totalSeconds: 0, instructorSeconds: {} };

    chapters.forEach((chapter) => {
      const lessons = Array.isArray(chapter?.lessons) ? chapter.lessons : [];
      lessons.forEach((lesson) => {
        const seconds = parseDurationToSeconds(lesson?.durationSeconds ?? lesson?.duration);
        if (seconds <= 0) return;

        entry.totalSeconds += seconds;
        const shares = normalizeLessonInstructorShares(lesson);
        shares.forEach((shareRow) => {
          const current = Number(entry.instructorSeconds[shareRow.facultyId] || 0);
          entry.instructorSeconds[shareRow.facultyId] = current + (seconds * shareRow.sharePercent);
        });
      });
    });

    stats.set(courseId, entry);
  });

  return stats;
};

const parseOrderPackageCourseIds = (row) => {
  if (Array.isArray(row?.package_course_ids)) {
    return row.package_course_ids.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [];
};

const buildFacultySalesEntries = ({
  orderRows,
  facultyId,
  facultyCourseSet,
  courseStatsMap,
  revenueSharePercent,
}) => {
  const entries = [];
  const percent = Math.max(0, Math.min(100, Number(revenueSharePercent || 0)));

  orderRows.forEach((row) => {
    const directCourseId = String(row.course_id || "").trim();
    const packageCourseIds = parseOrderPackageCourseIds(row).filter((courseId) => facultyCourseSet.has(courseId));
    const targetCourseIds = [];

    if (directCourseId && facultyCourseSet.has(directCourseId)) targetCourseIds.push(directCourseId);
    packageCourseIds.forEach((courseId) => {
      if (!targetCourseIds.includes(courseId)) targetCourseIds.push(courseId);
    });

    if (targetCourseIds.length === 0) return;

    const weightedCourses = targetCourseIds.map((courseId) => {
      const stats = courseStatsMap.get(courseId) || { totalSeconds: 0, instructorSeconds: {} };
      const weight = Number(stats.totalSeconds || 0) > 0 ? Number(stats.totalSeconds) : 1;
      return { courseId, stats, weight };
    });

    const totalWeight = weightedCourses.reduce((sum, item) => sum + item.weight, 0) || weightedCourses.length;
    const orderAmount = Math.max(0, Number(row.amount || 0));

    weightedCourses.forEach(({ courseId, stats, weight }) => {
      const allocatedAmount = orderAmount * (weight / totalWeight);
      const facultySeconds = Number(stats.instructorSeconds?.[facultyId] || 0);
      const hasInstructorMapping = Object.keys(stats.instructorSeconds || {}).length > 0;
      const ratio = hasInstructorMapping
        ? (stats.totalSeconds > 0 ? (facultySeconds / stats.totalSeconds) : 0)
        : 1;

      const facultyShareAmount = allocatedAmount * (percent / 100) * ratio;
      if (!Number.isFinite(facultyShareAmount) || facultyShareAmount <= 0) return;

      entries.push({
        orderDbId: Number(row.id),
        orderId: String(row.order_id || ""),
        studentId: String(row.student_id || ""),
        studentName: String(row.customer_name || ""),
        studentEmail: String(row.customer_email || ""),
        courseId,
        courseTitle: courseId === directCourseId
          ? String(row.course_title || "")
          : String(row.course_title || courseId || ""),
        orderDate: row.order_date,
        grossAllocatedAmount: Number(allocatedAmount.toFixed(2)),
        currency: String(row.currency || "INR"),
        facultyShareAmount: Number(facultyShareAmount.toFixed(2)),
      });
    });
  });

  return entries;
};

const fetchEligibleFacultyOrders = async ({ courseIds, fromDate, toDate }) => {
  return pool.query(
    `
    SELECT id,
           order_id,
           student_id,
           customer_name,
           customer_email,
           course_id,
           course_title,
           package_course_ids,
           order_date,
           amount,
           currency,
           dispatch_status,
           status
    FROM student_orders
    WHERE (
      course_id = ANY($1::text[])
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(package_course_ids, '[]'::jsonb)) pkg(course_id)
        WHERE pkg.course_id = ANY($1::text[])
      )
    )
      AND COALESCE(dispatch_status, '') <> 'refunded'
      AND (COALESCE(dispatch_status, '') = 'delivered' OR COALESCE(status, '') = 'completed')
      AND ($2::date IS NULL OR order_date >= $2::date)
      AND ($3::date IS NULL OR order_date <= $3::date)
    ORDER BY order_date DESC, id DESC
    `,
    [courseIds, fromDate, toDate],
  );
};

const loadFacultySession = async (token) => {
  if (!token) return null;
  const sessionResult = await pool.query(
    `
    SELECT s.token,
           s.faculty_id,
           s.expires_at,
          s.is_active AS session_is_active,
           s.revoked_reason,
           s.revoked_at,
           s.replaced_by_token,
           s.login_ip,
           r.login_ip AS replaced_login_ip,
           r.created_at AS replaced_login_at,
          f.is_active AS faculty_is_active,
           f.*
    FROM faculty_sessions s
    JOIN faculty_profiles f ON f.id = s.faculty_id
    LEFT JOIN faculty_sessions r ON r.token = s.replaced_by_token
    WHERE s.token = $1
    `,
    [token],
  );

  return sessionResult.rows[0] || null;
};

const requireFacultySession = async (request, response, next) => {
  try {
    const token = extractAdminToken(request);
    if (!token) {
      response.status(401).json({ message: "Faculty authorization required" });
      return;
    }

    const row = await loadFacultySession(token);
    if (!row) {
      response.status(401).json({ message: "Invalid faculty session" });
      return;
    }

    if (row.session_is_active === false) {
      const message = row.revoked_reason === "logged_in_elsewhere"
        ? buildForcedLogoutMessage(row.replaced_login_ip || row.login_ip, row.replaced_login_at || row.revoked_at)
        : "Faculty session is no longer active";
      response.status(401).json({ message, reason: row.revoked_reason || "session_revoked", forcedLogout: true });
      return;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await pool.query(
        `
        UPDATE faculty_sessions
        SET is_active = FALSE,
            revoked_reason = 'session_expired',
            revoked_at = NOW()
        WHERE token = $1
        `,
        [token],
      );
      response.status(401).json({ message: "Faculty session expired" });
      return;
    }

    if (row.faculty_is_active === false) {
      response.status(403).json({ message: "Faculty account is disabled" });
      return;
    }

    const courseLookup = await buildCourseLookup();
    request.facultySession = {
      token,
      facultyId: String(row.id),
      faculty: mapFacultyProfile(row, courseLookup, { includePrivate: true }),
    };

    next();
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Faculty auth failed" });
  }
};

app.post("/api/faculty/login", async (request, response) => {
  try {
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const forceLogin = request.body?.forceLogin === true;

    if (!email || !password) {
      response.status(400).json({ message: "Email and password are required" });
      return;
    }

    const facultyResult = await pool.query(
      "SELECT * FROM faculty_profiles WHERE LOWER(email) = $1 LIMIT 1",
      [email],
    );
    const faculty = facultyResult.rows[0];

    if (!faculty) {
      response.status(401).json({ message: "Invalid credentials" });
      return;
    }

    if (faculty.is_active === false || faculty.is_login_enabled !== true) {
      response.status(403).json({ message: "Faculty login is disabled" });
      return;
    }

    if (!verifyPassword(password, faculty.password_hash)) {
      response.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const activeSessionResult = await pool.query(
      `
      SELECT token, login_ip, created_at
      FROM faculty_sessions
      WHERE faculty_id = $1
        AND is_active = TRUE
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [faculty.id],
    );

    const activeSession = activeSessionResult.rows[0] || null;
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

    if (activeSession) {
      await pool.query(
        `
        UPDATE faculty_sessions
        SET is_active = FALSE,
            revoked_reason = 'logged_in_elsewhere',
            revoked_at = NOW(),
            replaced_by_token = $2
        WHERE token = $1
        `,
        [activeSession.token, token],
      );
    }

    await pool.query(
      `
      INSERT INTO faculty_sessions
      (token, faculty_id, expires_at, is_active, login_ip, login_user_agent)
      VALUES ($1, $2, NOW() + INTERVAL '24 hours', TRUE, $3, $4)
      `,
      [token, faculty.id, ipAddress || null, userAgent || null],
    );

    const courseLookup = await buildCourseLookup();
    response.json({
      token,
      user: mapFacultyProfile(faculty, courseLookup, { includePrivate: true }),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Faculty login failed" });
  }
});

app.post("/api/faculty/logout", requireFacultySession, async (request, response) => {
  try {
    await pool.query(
      `
      UPDATE faculty_sessions
      SET is_active = FALSE,
          revoked_reason = 'manual_logout',
          revoked_at = NOW()
      WHERE token = $1
      `,
      [request.facultySession.token],
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to logout faculty" });
  }
});

app.get("/api/faculty/session-status", requireFacultySession, async (request, response) => {
  response.json({
    ok: true,
    user: request.facultySession.faculty,
  });
});

app.get("/api/faculty/dashboard/monthly", requireFacultySession, async (request, response) => {
  try {
    const faculty = request.facultySession.faculty;
    const courseIds = Array.isArray(faculty.courseIds) ? faculty.courseIds : [];
    if (courseIds.length === 0) {
      response.json({ items: [] });
      return;
    }

    const facultyId = String(faculty.id || "").trim();
    const fromDate = parseDateParam(request.query?.from);
    const toDate = parseDateParam(request.query?.to);
    const facultyCourseSet = await buildRevenueShareCourseSet(pool, courseIds);
    if (facultyCourseSet.size === 0) {
      response.json({ items: [] });
      return;
    }
    const [ordersResult, courseStatsMap] = await Promise.all([
      fetchEligibleFacultyOrders({ courseIds: Array.from(facultyCourseSet), fromDate, toDate }),
      buildCourseInstructorStatsMap(pool, Array.from(facultyCourseSet)),
    ]);

    const entries = buildFacultySalesEntries({
      orderRows: Array.isArray(ordersResult.rows) ? ordersResult.rows : [],
      facultyId,
      facultyCourseSet,
      courseStatsMap,
      revenueSharePercent: Number(faculty.revenueSharePercent || 0),
    });

    const bucket = new Map();
    entries.forEach((entry) => {
      const month = entry.orderDate ? `${String(entry.orderDate).slice(0, 7)}-01` : "unknown";
      const existing = bucket.get(month) || {
        month,
        sales_count: 0,
        students_set: new Set(),
        gross_amount: 0,
        faculty_share: 0,
      };
      existing.sales_count += 1;
      if (entry.studentId) existing.students_set.add(entry.studentId);
      existing.gross_amount += Number(entry.grossAllocatedAmount || 0);
      existing.faculty_share += Number(entry.facultyShareAmount || 0);
      bucket.set(month, existing);
    });

    const items = Array.from(bucket.values())
      .map((row) => ({
        month: row.month,
        sales_count: row.sales_count,
        students_count: row.students_set.size,
        gross_amount: Number(row.gross_amount.toFixed(2)),
        faculty_share: Number(row.faculty_share.toFixed(2)),
      }))
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));

    response.json({ items });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load monthly summary" });
  }
});

app.get("/api/faculty/dashboard/courses", requireFacultySession, async (request, response) => {
  try {
    const faculty = request.facultySession.faculty;
    const courseIds = Array.isArray(faculty.courseIds) ? faculty.courseIds : [];
    if (courseIds.length === 0) {
      response.json({ items: [] });
      return;
    }

    const facultyId = String(faculty.id || "").trim();
    const fromDate = parseDateParam(request.query?.from);
    const toDate = parseDateParam(request.query?.to);
    const facultyCourseSet = await buildRevenueShareCourseSet(pool, courseIds);
    if (facultyCourseSet.size === 0) {
      response.json({ items: [] });
      return;
    }
    const [ordersResult, courseStatsMap] = await Promise.all([
      fetchEligibleFacultyOrders({ courseIds: Array.from(facultyCourseSet), fromDate, toDate }),
      buildCourseInstructorStatsMap(pool, Array.from(facultyCourseSet)),
    ]);

    const entries = buildFacultySalesEntries({
      orderRows: Array.isArray(ordersResult.rows) ? ordersResult.rows : [],
      facultyId,
      facultyCourseSet,
      courseStatsMap,
      revenueSharePercent: Number(faculty.revenueSharePercent || 0),
    });

    const bucket = new Map();
    entries.forEach((entry) => {
      const key = entry.courseId || "unknown";
      const existing = bucket.get(key) || {
        course_id: entry.courseId,
        course_title: entry.courseTitle || entry.courseId,
        sales_count: 0,
        gross_amount: 0,
        faculty_share: 0,
      };
      existing.sales_count += 1;
      existing.gross_amount += Number(entry.grossAllocatedAmount || 0);
      existing.faculty_share += Number(entry.facultyShareAmount || 0);
      bucket.set(key, existing);
    });

    const items = Array.from(bucket.values())
      .map((row) => ({
        ...row,
        gross_amount: Number(row.gross_amount.toFixed(2)),
        faculty_share: Number(row.faculty_share.toFixed(2)),
      }))
      .sort((a, b) => (b.gross_amount - a.gross_amount) || String(a.course_title || "").localeCompare(String(b.course_title || "")));

    response.json({ items });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load course summary" });
  }
});

app.get("/api/faculty/dashboard/sales", requireFacultySession, async (request, response) => {
  try {
    const faculty = request.facultySession.faculty;
    const courseIds = Array.isArray(faculty.courseIds) ? faculty.courseIds : [];
    if (courseIds.length === 0) {
      response.json({ items: [], total: 0, page: 1, limit: 25 });
      return;
    }

    const facultyId = String(faculty.id || "").trim();
    const fromDate = parseDateParam(request.query?.from);
    const toDate = parseDateParam(request.query?.to);
    const search = String(request.query?.search || "").trim().toLowerCase();
    const page = Math.max(1, toSafeInt(request.query?.page, 1, { min: 1, max: 50000 }));
    const limit = Math.max(1, Math.min(200, toSafeInt(request.query?.limit, 25, { min: 1, max: 200 })));
    const offset = (page - 1) * limit;
    const facultyCourseSet = await buildRevenueShareCourseSet(pool, courseIds);
    if (facultyCourseSet.size === 0) {
      response.json({ items: [], total: 0, page, limit });
      return;
    }
    const [ordersResult, courseStatsMap] = await Promise.all([
      fetchEligibleFacultyOrders({ courseIds: Array.from(facultyCourseSet), fromDate, toDate }),
      buildCourseInstructorStatsMap(pool, Array.from(facultyCourseSet)),
    ]);

    const entries = buildFacultySalesEntries({
      orderRows: Array.isArray(ordersResult.rows) ? ordersResult.rows : [],
      facultyId,
      facultyCourseSet,
      courseStatsMap,
      revenueSharePercent: Number(faculty.revenueSharePercent || 0),
    });

    const filtered = search
      ? entries.filter((row) => {
        const hay = [
          String(row.orderId || ""),
          String(row.studentName || ""),
          String(row.studentEmail || ""),
          String(row.courseTitle || ""),
          String(row.courseId || ""),
        ].join(" ").toLowerCase();
        return hay.includes(search);
      })
      : entries;

    const paginated = filtered.slice(offset, offset + limit);

    response.json({
      items: paginated.map((row) => ({
        id: row.orderDbId,
        orderId: row.orderId,
        studentId: row.studentId,
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        courseId: row.courseId,
        courseTitle: row.courseTitle,
        orderDate: row.orderDate,
        amount: row.grossAllocatedAmount,
        currency: row.currency,
        facultyShareAmount: row.facultyShareAmount,
      })),
      total: filtered.length,
      page,
      limit,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load sales list" });
  }
});

app.get("/api/faculty/dashboard/payouts", requireFacultySession, async (request, response) => {
  try {
    const faculty = request.facultySession.faculty;
    const facultyId = String(faculty.id || "").trim();
    const courseIds = Array.isArray(faculty.courseIds) ? faculty.courseIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
    if (courseIds.length === 0) {
      response.json({ pendingAmount: 0, paidAmount: 0, currency: "INR", payouts: [] });
      return;
    }

    const facultyCourseSet = await buildRevenueShareCourseSet(pool, courseIds);
    if (facultyCourseSet.size === 0) {
      response.json({ pendingAmount: 0, paidAmount: 0, currency: "INR", payouts: [] });
      return;
    }
    const [ordersResult, courseStatsMap, paidResult, payoutsResult] = await Promise.all([
      fetchEligibleFacultyOrders({ courseIds: Array.from(facultyCourseSet), fromDate: null, toDate: null }),
      buildCourseInstructorStatsMap(pool, Array.from(facultyCourseSet)),
      pool.query("SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS paid_amount FROM faculty_payouts WHERE faculty_id = $1", [facultyId]),
      pool.query("SELECT id, amount, currency, status, reference_id, payout_date, note, created_at FROM faculty_payouts WHERE faculty_id = $1 ORDER BY payout_date DESC, id DESC LIMIT 100", [facultyId]),
    ]);

    const entries = buildFacultySalesEntries({
      orderRows: Array.isArray(ordersResult.rows) ? ordersResult.rows : [],
      facultyId,
      facultyCourseSet,
      courseStatsMap,
      revenueSharePercent: Number(faculty.revenueSharePercent || 0),
    });

    const totalEarned = entries.reduce((sum, row) => sum + Number(row.facultyShareAmount || 0), 0);
    const paidAmount = Number(paidResult.rows[0]?.paid_amount || 0);
    const pendingAmount = Math.max(0, Number((totalEarned - paidAmount).toFixed(2)));

    response.json({
      pendingAmount,
      paidAmount: Number(paidAmount.toFixed(2)),
      currency: "INR",
      payouts: payoutsResult.rows || [],
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load payout status" });
  }
});

app.get("/api/admin/faculty", requireAdminPermission("faculty", "read"), async (_request, response) => {
  try {
    const [facultyResult, courseLookup] = await Promise.all([
      pool.query("SELECT * FROM faculty_profiles ORDER BY sort_order ASC, created_at DESC"),
      buildCourseLookup(),
    ]);

    response.json({
      items: facultyResult.rows.map((row) => mapFacultyProfile(row, courseLookup, { includePrivate: true })),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load faculty" });
  }
});

app.post("/api/admin/faculty", requireAdminPermission("faculty", "create"), async (request, response) => {
  try {
    const name = String(request.body?.name || "").trim();
    const emailInput = String(request.body?.email || "").trim().toLowerCase();
    const photoUrl = String(request.body?.photoUrl || "").trim();
    const about = String(request.body?.about || "").trim();
    const rawPassword = String(request.body?.password || "");
    const revenueSharePercent = Math.max(0, Math.min(100, Number(request.body?.revenueSharePercent || 0)));
    const isLoginEnabled = request.body?.isLoginEnabled === true;
    const courseIds = normalizeStringList(request.body?.courseIds);
    const isActive = request.body?.isActive !== false;
    const sortOrder = toSafeInt(request.body?.sortOrder, 0);

    if (!name) {
      response.status(400).json({ message: "Faculty name is required" });
      return;
    }

    if (emailInput) {
      const emailExists = await pool.query(
        "SELECT id FROM faculty_profiles WHERE LOWER(email) = $1 LIMIT 1",
        [emailInput],
      );
      if (emailExists.rows[0]) {
        response.status(409).json({ message: "Faculty email already exists" });
        return;
      }
    }

    if (isLoginEnabled && !emailInput) {
      response.status(400).json({ message: "Email is required when login is enabled" });
      return;
    }

    if (rawPassword && rawPassword.length < 6) {
      response.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const id = String(request.body?.id || `faculty-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const passwordHash = rawPassword ? hashPassword(rawPassword) : null;

    await pool.query(
      `
      INSERT INTO faculty_profiles
      (id, name, email, password_hash, photo_url, about, course_ids, is_active, sort_order, revenue_share_percent, is_login_enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, NOW())
      `,
      [
        id,
        name,
        emailInput || null,
        passwordHash,
        photoUrl || null,
        about || null,
        JSON.stringify(courseIds),
        isActive,
        sortOrder,
        revenueSharePercent,
        isLoginEnabled,
      ],
    );

    const [itemResult, courseLookup] = await Promise.all([
      pool.query("SELECT * FROM faculty_profiles WHERE id = $1", [id]),
      buildCourseLookup(),
    ]);

    response.status(201).json({ item: mapFacultyProfile(itemResult.rows[0], courseLookup, { includePrivate: true }) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to create faculty" });
  }
});

app.put("/api/admin/faculty/:id", requireAdminPermission("faculty", "edit"), async (request, response) => {
  try {
    const id = String(request.params.id);
    const name = String(request.body?.name || "").trim();
    const emailInput = String(request.body?.email || "").trim().toLowerCase();
    const photoUrl = String(request.body?.photoUrl || "").trim();
    const about = String(request.body?.about || "").trim();
    const rawPassword = String(request.body?.password || "");
    const revenueSharePercent = Math.max(0, Math.min(100, Number(request.body?.revenueSharePercent || 0)));
    const isLoginEnabled = request.body?.isLoginEnabled === true;
    const courseIds = normalizeStringList(request.body?.courseIds);
    const isActive = request.body?.isActive !== false;
    const sortOrder = toSafeInt(request.body?.sortOrder, 0);

    if (!name) {
      response.status(400).json({ message: "Faculty name is required" });
      return;
    }

    const existing = await pool.query("SELECT id, password_hash FROM faculty_profiles WHERE id = $1", [id]);
    if (!existing.rows[0]) {
      response.status(404).json({ message: "Faculty not found" });
      return;
    }

    if (emailInput) {
      const emailExists = await pool.query(
        "SELECT id FROM faculty_profiles WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1",
        [emailInput, id],
      );
      if (emailExists.rows[0]) {
        response.status(409).json({ message: "Faculty email already exists" });
        return;
      }
    }

    if (isLoginEnabled && !emailInput) {
      response.status(400).json({ message: "Email is required when login is enabled" });
      return;
    }

    if (rawPassword && rawPassword.length < 6) {
      response.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const passwordHash = rawPassword ? hashPassword(rawPassword) : existing.rows[0].password_hash || null;

    await pool.query(
      `
      UPDATE faculty_profiles
      SET name = $2,
          email = $3,
          password_hash = $4,
          photo_url = $5,
          about = $6,
          course_ids = $7::jsonb,
          is_active = $8,
          sort_order = $9,
          revenue_share_percent = $10,
          is_login_enabled = $11,
          updated_at = NOW()
      WHERE id = $1
      `,
      [
        id,
        name,
        emailInput || null,
        passwordHash,
        photoUrl || null,
        about || null,
        JSON.stringify(courseIds),
        isActive,
        sortOrder,
        revenueSharePercent,
        isLoginEnabled,
      ],
    );

    const [itemResult, courseLookup] = await Promise.all([
      pool.query("SELECT * FROM faculty_profiles WHERE id = $1", [id]),
      buildCourseLookup(),
    ]);

    response.json({ item: mapFacultyProfile(itemResult.rows[0], courseLookup, { includePrivate: true }) });
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

app.get("/api/coupons", async (_request, response) => {
  try {
    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const siteSettings = settings.siteSettings && typeof settings.siteSettings === "object"
      ? settings.siteSettings
      : {};
    const coupons = Array.isArray(siteSettings.coupons) ? siteSettings.coupons : [];
    response.json({ items: coupons });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load coupons" });
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

app.delete("/api/admin/leads/:id", requireAdminPermission("leads", "delete"), async (request, response) => {
  const client = await pool.connect();
  try {
    const leadId = Number(request.params.id || 0);
    if (!leadId || Number.isNaN(leadId)) {
      response.status(400).json({ message: "Valid lead id is required" });
      return;
    }

    await client.query("BEGIN");
    const leadResult = await client.query("SELECT id FROM enquiry_leads WHERE id = $1 FOR UPDATE", [leadId]);
    if (leadResult.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Lead not found" });
      return;
    }

    await client.query("DELETE FROM lead_follow_ups WHERE lead_id = $1", [leadId]);
    await client.query("DELETE FROM enquiry_leads WHERE id = $1", [leadId]);
    await client.query("COMMIT");

    response.json({ ok: true, id: leadId });
  } catch (error) {
    await client.query("ROLLBACK");
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete lead" });
  } finally {
    client.release();
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

app.post("/api/uploads/image", upload.single("file"), requireAdminPermission("course-content", "create"), async (request, response) => {
  try {
    // Debug log
    console.log("/api/uploads/image fields:", request.body);
    console.log("/api/uploads/image file:", request.file);

    // Multer parses file and fields
    const file = request.file;
    const folder = sanitizeFileName(request.body?.folder || "images");
    if (!file) {
      response.status(400).json({ message: "No file uploaded" });
      return;
    }
    const fileName = sanitizeFileName(file.originalname || `image-${Date.now()}.png`);
    const mimeType = file.mimetype || "application/octet-stream";
    const binary = file.buffer;

    const imageUploadBackend = String(process.env.IMAGE_UPLOAD_BACKEND || "database").trim().toLowerCase();

    if (imageUploadBackend === "database") {
      const assetId = randomUUID();
      await pool.query(
        `
        INSERT INTO uploaded_assets (id, folder, file_name, mime_type, binary_data, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [assetId, folder, fileName, mimeType, binary, binary.length],
      );

      response.json({
        url: `/api/uploads/storage/${assetId}/${encodeURIComponent(fileName)}`,
        assetId,
        source: "database-storage",
      });
      return;
    }

    // ...existing code for Bunny Storage (if used)...

    if (imageUploadBackend === "bunny" && zone && accessKey) {
      const remotePath = `images/${folder}/${Date.now()}-${fileName}`;
      const host = region ? `${region}.storage.bunnycdn.com` : "storage.bunnycdn.com";
      const uploadUrl = `https://${host}/${zone}/${remotePath}`;

      const bunnyRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          AccessKey: accessKey,
          "Content-Type": mimeType,
        },
        body: binary,
      });

      if (!bunnyRes.ok) {
        const raw = await bunnyRes.text();
        response.status(502).json({ message: "Bunny image upload failed", details: raw.slice(0, 500) });
        return;
      }

      const publicBase = publicBaseEnv
        ? publicBaseEnv.replace(/\/$/, "")
        : (pullZoneHost ? `https://${pullZoneHost}` : "");

      const url = publicBase
        ? `${publicBase}/${remotePath}`
        : uploadUrl;

      response.json({
        url,
        remotePath,
        source: "bunny-storage",
        via: publicBase ? "public-base" : "storage-url",
      });
      return;
    }

    const targetDir = path.join(uploadsDir, folder);
    await mkdir(targetDir, { recursive: true });
    const finalName = `${Date.now()}-${fileName}`;
    const finalPath = path.join(targetDir, finalName);
    await writeFile(finalPath, binary);
    response.json({
      url: `/api/uploads/${folder}/${finalName}`,
      legacyUrl: `/uploads/${folder}/${finalName}`,
      source: "local-disk",
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Image upload failed" });
  }
});

app.get("/api/uploads/storage/:assetId/:fileName", uploadsCors, async (request, response) => {
  try {
    const assetId = String(request.params?.assetId || "").trim();
    if (!assetId) {
      response.status(400).json({ message: "assetId is required" });
      return;
    }

    const result = await pool.query(
      `
      SELECT file_name, mime_type, binary_data, size_bytes
      FROM uploaded_assets
      WHERE id = $1
      LIMIT 1
      `,
      [assetId],
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Asset not found" });
      return;
    }

    const row = result.rows[0];
    const fileName = String(row.file_name || "file");
    const mimeType = String(row.mime_type || "application/octet-stream");
    const binaryData = row.binary_data;
    const sizeBytes = Number(row.size_bytes || 0);

    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `inline; filename=\"${fileName.replace(/\"/g, "")}\"`);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (sizeBytes > 0) response.setHeader("Content-Length", String(sizeBytes));
    response.send(binaryData);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to read asset" });
  }
});

app.get("/api/uploads/storage/:assetId", uploadsCors, async (request, response) => {
  try {
    const assetId = String(request.params?.assetId || "").trim();
    if (!assetId) {
      response.status(400).json({ message: "assetId is required" });
      return;
    }

    const result = await pool.query(
      `
      SELECT file_name, mime_type, binary_data, size_bytes
      FROM uploaded_assets
      WHERE id = $1
      LIMIT 1
      `,
      [assetId],
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Asset not found" });
      return;
    }

    const row = result.rows[0];
    const fileName = String(row.file_name || "file");
    const mimeType = String(row.mime_type || "application/octet-stream");
    const binaryData = row.binary_data;
    const sizeBytes = Number(row.size_bytes || 0);

    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `inline; filename=\"${fileName.replace(/\"/g, "")}\"`);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (sizeBytes > 0) response.setHeader("Content-Length", String(sizeBytes));
    response.send(binaryData);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to read asset" });
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
    const headerCollectionId = String(request.headers["x-collection-id"] || "").trim();
    const fileName = sanitizeFileName(decodedFileName || request.body?.fileName || `video-${Date.now()}.mp4`);
    const collectionId = sanitizeFileName(headerCollectionId || request.body?.collectionId || "");
    const isRawUpload = !request.body?.base64Data && Number(request.headers["content-length"] || 0) > 0;
    const binary = isRawUpload ? null : decodeBase64File(request.body?.base64Data);
    if (!isRawUpload && !binary) {
      response.status(400).json({ message: "base64Data is required" });
      return;
    }

    // Prefer Bunny Stream upload using admin-configured Library ID + API Key.
    if (!forceStorageUpload && bunnySettings.enabled && bunnySettings.libraryId && bunnySettings.apiKey) {
      const title = fileName.replace(/\.[a-z0-9]+$/i, "") || `video-${Date.now()}`;

      const createPayload = {
        title,
        ...(collectionId ? { collectionId } : {}),
      };

      const createRes = await fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(bunnySettings.libraryId)}/videos`,
        {
          method: "POST",
          headers: {
            AccessKey: bunnySettings.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createPayload),
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

      response.json({ url: videoGuid, remotePath: videoGuid, source: "bunny-stream", collectionId: collectionId || null });
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

app.get("/api/admin/bunny/library", requireAdminPermission("settings", "read"), async (request, response) => {
  try {
    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const bunny = settings.bunnyStreamApi || {};

    if (!bunny.enabled || !bunny.libraryId || !bunny.apiKey) {
      response.status(400).json({ message: "Bunny Stream is not configured in admin settings" });
      return;
    }

    const limit = Math.max(1, Math.min(250, Number(request.query?.limit || 100)));
    const startOffset = Math.max(0, Number(request.query?.offset || 0));
    const searchText = String(request.query?.search || "").trim().toLowerCase();
    const filterCollectionId = String(request.query?.collectionId || "").trim();

    const headers = {
      AccessKey: bunny.apiKey,
      Accept: "application/json",
    };

    const [collectionsRes, firstVideosRes] = await Promise.all([
      fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/collections`,
        { method: "GET", headers },
      ),
      fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/videos?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(startOffset))}`,
        { method: "GET", headers },
      ),
    ]);

    if (!collectionsRes.ok) {
      const raw = await collectionsRes.text();
      response.status(502).json({ message: "Bunny Stream collections fetch failed", details: raw.slice(0, 500) });
      return;
    }

    if (!firstVideosRes.ok) {
      const raw = await firstVideosRes.text();
      response.status(502).json({ message: "Bunny Stream videos fetch failed", details: raw.slice(0, 500) });
      return;
    }

    const collectionsRaw = await collectionsRes.json().catch(() => ({}));
    const firstVideosRaw = await firstVideosRes.json().catch(() => ({}));

    const normalizeArray = (payload) => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.Items)) return payload.Items;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    const collections = normalizeArray(collectionsRaw)
      .map((item, index) => {
        const id = String(item?.guid || item?.id || item?.collectionId || `collection-${index + 1}`).trim();
        return {
          id,
          name: String(item?.name || item?.title || item?.collectionName || id).trim() || id,
          videoCount: Math.max(0, Number(item?.videoCount || item?.videosCount || item?.totalVideos || 0)),
          previewVideoIds: Array.isArray(item?.previewVideoIds)
            ? item.previewVideoIds.map((entry) => String(entry || "").trim()).filter(Boolean)
            : [],
        };
      })
      .filter((item) => Boolean(item.id));

    const collectionLookup = Object.fromEntries(collections.map((item) => [item.id, item.name]));

    const pagedVideos = [...normalizeArray(firstVideosRaw)];
    let runningOffset = startOffset + limit;
    const maxPages = 40;
    let pagesFetched = 1;
    while (pagesFetched < maxPages) {
      const lastBatchSize = normalizeArray({ items: pagedVideos.slice(-limit) }).length;
      if (lastBatchSize < limit) break;

      const nextRes = await fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/videos?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(runningOffset))}`,
        { method: "GET", headers },
      );

      if (!nextRes.ok) break;

      const nextRaw = await nextRes.json().catch(() => ({}));
      const nextBatch = normalizeArray(nextRaw);
      if (nextBatch.length === 0) break;

      pagedVideos.push(...nextBatch);
      if (nextBatch.length < limit) break;

      runningOffset += limit;
      pagesFetched += 1;
    }

    const videos = pagedVideos
      .map((item, index) => {
        const id = String(item?.guid || item?.id || item?.videoId || `video-${index + 1}`).trim();
        const collectionId = String(item?.collectionId || item?.videoLibraryCollectionId || "").trim();
        const title = String(item?.title || item?.name || item?.videoTitle || id).trim() || id;
        const lengthSeconds = Math.max(0, Number(item?.length || item?.duration || item?.videoLength || 0));
        const status = String(item?.status || item?.encodeProgress || item?.state || "unknown").trim();
        const dateCreated = String(item?.dateCreated || item?.createdAt || item?.created || "").trim();
        return {
          id,
          title,
          collectionId: collectionId || null,
          collectionName: collectionId ? String(collectionLookup[collectionId] || "") : "",
          lengthSeconds,
          status,
          dateCreated,
        };
      })
      .filter((item) => Boolean(item.id));

    const collectionVideoCountMap = videos.reduce((acc, item) => {
      const key = String(item.collectionId || "").trim();
      if (!key) return acc;
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {});

    const collectionsWithCounts = collections.map((item) => ({
      ...item,
      videoCount: Math.max(item.videoCount, Number(collectionVideoCountMap[item.id] || 0)),
    }));

    const filteredVideos = searchText
      ? videos.filter((item) => {
          const haystack = `${item.title} ${item.collectionName} ${item.status}`.toLowerCase();
          return haystack.includes(searchText);
        })
      : videos;

    const byCollectionVideos = filterCollectionId
      ? filteredVideos.filter((item) => String(item.collectionId || "") === filterCollectionId)
      : filteredVideos;

    response.json({
      libraryId: String(bunny.libraryId || ""),
      collections: collectionsWithCounts,
      videos: byCollectionVideos,
      stats: {
        collectionCount: collectionsWithCounts.length,
        videoCount: byCollectionVideos.length,
        totalVideoCount: videos.length,
      },
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load Bunny Stream library" });
  }
});

app.post("/api/admin/bunny/collections", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const name = String(request.body?.name || "").trim();
    if (!name) {
      response.status(400).json({ message: "Collection name is required" });
      return;
    }

    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const bunny = settings.bunnyStreamApi || {};
    if (!bunny.enabled || !bunny.libraryId || !bunny.apiKey) {
      response.status(400).json({ message: "Bunny Stream is not configured in admin settings" });
      return;
    }

    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/collections`,
      {
        method: "POST",
        headers: {
          AccessKey: bunny.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ name }),
      },
    );

    if (!createRes.ok) {
      const raw = await createRes.text();
      response.status(502).json({ message: "Bunny collection create failed", details: raw.slice(0, 500) });
      return;
    }

    const created = await createRes.json().catch(() => ({}));
    response.json({
      ok: true,
      collection: {
        id: String(created?.guid || created?.id || created?.collectionId || "").trim(),
        name: String(created?.name || name).trim(),
      },
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to create Bunny collection" });
  }
});

app.patch("/api/admin/bunny/collections/:collectionId", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const collectionId = sanitizeFileName(String(request.params?.collectionId || "").trim());
    const name = String(request.body?.name || "").trim();
    if (!collectionId) {
      response.status(400).json({ message: "collectionId is required" });
      return;
    }
    if (!name) {
      response.status(400).json({ message: "Collection name is required" });
      return;
    }

    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const bunny = settings.bunnyStreamApi || {};
    if (!bunny.enabled || !bunny.libraryId || !bunny.apiKey) {
      response.status(400).json({ message: "Bunny Stream is not configured in admin settings" });
      return;
    }

    const updateRes = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/collections/${encodeURIComponent(collectionId)}`,
      {
        method: "POST",
        headers: {
          AccessKey: bunny.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ name }),
      },
    );

    if (!updateRes.ok) {
      const raw = await updateRes.text();
      response.status(502).json({ message: "Bunny collection update failed", details: raw.slice(0, 500) });
      return;
    }

    response.json({ ok: true, collectionId, name });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update Bunny collection" });
  }
});

app.delete("/api/admin/bunny/videos/:videoId", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const videoId = sanitizeFileName(String(request.params?.videoId || "").trim());
    if (!videoId) {
      response.status(400).json({ message: "videoId is required" });
      return;
    }

    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const bunny = settings.bunnyStreamApi || {};
    if (!bunny.enabled || !bunny.libraryId || !bunny.apiKey) {
      response.status(400).json({ message: "Bunny Stream is not configured in admin settings" });
      return;
    }

    const deleteRes = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/videos/${encodeURIComponent(videoId)}`,
      {
        method: "DELETE",
        headers: {
          AccessKey: bunny.apiKey,
          Accept: "application/json",
        },
      },
    );

    if (!deleteRes.ok) {
      const raw = await deleteRes.text();
      response.status(502).json({ message: "Bunny video delete failed", details: raw.slice(0, 500) });
      return;
    }

    response.json({ ok: true, videoId });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete Bunny video" });
  }
});

app.patch("/api/admin/bunny/videos/:videoId", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const videoId = sanitizeFileName(String(request.params?.videoId || "").trim());
    if (!videoId) {
      response.status(400).json({ message: "videoId is required" });
      return;
    }

    const hasCollectionId = Object.prototype.hasOwnProperty.call(request.body || {}, "collectionId");
    const collectionId = String(request.body?.collectionId || "").trim();
    const title = String(request.body?.title || "").trim();
    if (!hasCollectionId && !title) {
      response.status(400).json({ message: "collectionId or title is required" });
      return;
    }

    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const bunny = settings.bunnyStreamApi || {};
    if (!bunny.enabled || !bunny.libraryId || !bunny.apiKey) {
      response.status(400).json({ message: "Bunny Stream is not configured in admin settings" });
      return;
    }

    const updateRes = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(bunny.libraryId)}/videos/${encodeURIComponent(videoId)}`,
      {
        method: "POST",
        headers: {
          AccessKey: bunny.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...(hasCollectionId ? { collectionId: collectionId || "" } : {}),
          ...(title ? { title } : {}),
        }),
      },
    );

    if (!updateRes.ok) {
      const raw = await updateRes.text();
      response.status(502).json({ message: "Bunny video update failed", details: raw.slice(0, 500) });
      return;
    }

    response.json({ ok: true, videoId, collectionId: hasCollectionId ? (collectionId || null) : null, title: title || null });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to update Bunny video" });
  }
});

app.get("/api/platform-settings", async (_request, response) => {
  try {
    const data = sanitizePlatformSettings(await getPlatformSettings());
    response.json({ settings: maskSensitiveSettings(data) });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load settings" });
  }
});

app.get("/api/admin/platform-settings", requireAdminPermission("settings", "read"), async (_request, response) => {
  try {
    const data = sanitizePlatformSettings(await getPlatformSettings());
    // Mask sensitive fields before sending to frontend
    const maskedData = maskSensitiveSettings(data);
    response.json({ settings: maskedData });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load settings" });
  }
});

app.put("/api/admin/platform-settings", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const existingRaw = sanitizePlatformSettings(await getPlatformSettings());
    const incomingRaw = request.body?.settings && typeof request.body.settings === "object" ? request.body.settings : {};
    const incomingHasAiExtraction = incomingRaw.aiExtraction && typeof incomingRaw.aiExtraction === "object";
    const incomingHasCourseMasters = incomingRaw.siteSettings?.courseMasters && typeof incomingRaw.siteSettings.courseMasters === "object";
    
    // Process incoming settings to handle password updates properly
    const processedIncoming = processIncomingSettings(incomingRaw, existingRaw);
    const incoming = sanitizePlatformSettings(processedIncoming);
    
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
      aiExtraction: {
        ...(existingRaw.aiExtraction || {}),
        ...(incomingHasAiExtraction ? (incoming.aiExtraction || {}) : {}),
      },
      siteSettings: {
        ...(existingRaw.siteSettings || {}),
        ...(incoming.siteSettings || {}),
        courseMasters: incomingHasCourseMasters
          ? incoming.siteSettings?.courseMasters
          : existingRaw.siteSettings?.courseMasters,
      },
      homepage: {
        ...(existingRaw.homepage || {}),
        ...(incoming.homepage || {}),
      },
    });
    
    await setPlatformSettings(nextData);
    syncSmsEnvFromSettings(nextData);
    
    // Return masked settings to frontend
    const maskedData = maskSensitiveSettings(nextData);
    response.json({ ok: true, settings: maskedData });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save settings" });
  }
});

app.get("/api/admin/sms-env-preview", requireAdminPermission("settings", "read"), async (_request, response) => {
  try {
    const settings = sanitizePlatformSettings(await getPlatformSettings());
    syncSmsEnvFromSettings(settings);
    response.json({ ok: true, env: getSmsEnvPreview() });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load SMS env preview" });
  }
});

app.post("/api/admin/smtp/test", requireAdminPermission("settings", "edit"), async (request, response) => {
  try {
    const toEmail = String(request.body?.toEmail || request.adminSession?.admin?.email || "").trim().toLowerCase();
    if (!toEmail) {
      response.status(400).json({ message: "toEmail is required" });
      return;
    }

    const result = await sendSmtpMail({
      toEmail,
      subject: "SMTP test - Ednovate",
      text: "SMTP test successful. Your Ednovate mail setup is working.",
      html: "<p>SMTP test successful. Your Ednovate mail setup is working.</p>",
    });

    if (!result.sent) {
      response.status(400).json({ ok: false, message: result.reason || "SMTP test failed" });
      return;
    }

    response.json({ ok: true, message: `Test mail sent to ${toEmail}` });
  } catch (error) {
    const mapped = mapSmtpError(error);
    response.status(mapped.status).json({ message: mapped.message });
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

app.get("/api/admin/coupons", requireAdminPermission("coupons", "read"), async (_request, response) => {
  try {
    const settings = sanitizePlatformSettings(await getPlatformSettings());
    const siteSettings = settings.siteSettings && typeof settings.siteSettings === "object"
      ? settings.siteSettings
      : {};
    const coupons = Array.isArray(siteSettings.coupons) ? siteSettings.coupons : [];
    response.json({ items: coupons });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to load coupons" });
  }
});

app.put("/api/admin/coupons", requireAdminPermission("coupons", "edit"), async (request, response) => {
  try {
    const existing = sanitizePlatformSettings(await getPlatformSettings());
    const incomingItems = Array.isArray(request.body?.items) ? request.body.items : [];
    const nextData = sanitizePlatformSettings({
      ...existing,
      siteSettings: {
        ...(existing.siteSettings || {}),
        coupons: incomingItems,
      },
    });

    await setPlatformSettings(nextData);
    const nextSiteSettings = nextData.siteSettings && typeof nextData.siteSettings === "object"
      ? nextData.siteSettings
      : {};
    response.json({ ok: true, items: Array.isArray(nextSiteSettings.coupons) ? nextSiteSettings.coupons : [] });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : "Failed to save coupons" });
  }
});

app.put("/api/admin/homepage/platform-settings", requireAdminPermission("homepage", "edit"), async (request, response) => {
  try {
    const existingRaw = sanitizePlatformSettings(await getPlatformSettings());
    const incomingRaw = request.body?.settings && typeof request.body.settings === "object" ? request.body.settings : {};
    const incomingHasCourseMasters = incomingRaw.siteSettings?.courseMasters && typeof incomingRaw.siteSettings.courseMasters === "object";
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
        courseMasters: incomingHasCourseMasters
          ? incoming.siteSettings?.courseMasters
          : existingRaw.siteSettings?.courseMasters,
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
  syncSmsEnvFromSettings(await getPlatformSettings());

  // Static routes must come AFTER all API routes to avoid intercepting POST /api/uploads/image
  // Uploads are public assets (thumbnails, images) — allow any origin so Flutter app + browsers can load them.

  // Image proxy – fetches external images (e.g. from letsednovate.com) and serves with CORS headers.
  app.get("/api/image-proxy", uploadsCors, async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      return res.status(400).json({ error: "Missing or invalid ?url= parameter" });
    }
    try {
      const upstream = await fetch(imageUrl, { redirect: "follow" });
      if (!upstream.ok) return res.status(upstream.status).send("Upstream error");
      const contentType = upstream.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      console.error("[image-proxy] Failed:", imageUrl, err.message);
      res.status(502).json({ error: "Failed to fetch image" });
    }
  });

  app.use("/uploads", uploadsCors, express.static(uploadsDir));
  app.use("/api/uploads", uploadsCors, express.static(uploadsDir));

  app.listen(port, () => {
    console.log(`Node API running on http://localhost:${port}`);
    console.log("Try /api/health and /api/db-check");
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
