import { resolveApiUrl } from "@/lib/runtimeUrls";

export interface StudentRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  city: string;
  state: string;
  country: string;
  status: "Active" | "Inactive";
  joinDate: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  bio?: string;
  educationLevel?: string;
}

export interface StudentCourseAccess {
  id: number;
  studentId: string;
  courseId: string;
  courseTitle: string;
  purchaseDate?: string;
  durationDays: number;
  expiresAt?: string;
  totalViews: number;
  usedViews: number;
  remainingViews: number;
  courseDurationSeconds?: number;
  allowedWatchSeconds?: number;
  usedWatchSeconds?: number;
  remainingWatchSeconds?: number;
  isUnlimitedViews?: boolean;
  isEnabled: boolean;
  preferredVideoQuality?: "auto" | "high" | "medium" | "low";
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentLoginLog {
  id: number;
  studentId: string;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
  createdAt: string;
}

export interface StudentVideoActivity {
  id: number;
  studentId: string;
  courseId?: string;
  chapterTitle?: string;
  lessonTitle?: string;
  progressPercent: number;
  viewedSeconds: number;
  lastViewedAt: string;
}

export interface StudentNotification {
  id: number;
  studentId: string;
  channel: string;
  subject?: string;
  message: string;
  status: string;
  sentBy?: string;
  createdAt: string;
}

export interface StudentAccessSummaryItem {
  id: number;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentMobile?: string;
  courseId: string;
  courseTitle: string;
  purchaseDate?: string;
  durationDays: number;
  expiresAt?: string;
  totalViews: number;
  usedViews: number;
  remainingViews: number;
  courseDurationSeconds?: number;
  allowedWatchSeconds?: number;
  usedWatchSeconds?: number;
  remainingWatchSeconds?: number;
  isUnlimitedViews?: boolean;
  isEnabled: boolean;
  status: "active" | "expired" | "disabled" | "out_of_views";
  lastViewedAt?: string;
  updatedAt?: string;
}

export interface PlatformSettingsPayload {
  bunnyStreamApi: {
    enabled: boolean;
    libraryId: string;
    apiKey: string;
    cdnHostname: string;
    pullZone: string;
  };
  smtp?: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromName: string;
    fromEmail: string;
    replyTo: string;
  };
  emailAutomation?: {
    enabled: boolean;
    adminRecipients?: string[];
    templates: Record<string, { enabled: boolean; subject: string; body: string; sendToAdmin?: boolean }>;
  };
  siteSettings?: Record<string, unknown>;
  homepage?: {
    exploreCategoryIds?: string[];
  };
}

export interface TechnicalSupportTicket {
  id: number;
  ticketCode: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  subject: string;
  issueCategory: string;
  priority: "low" | "medium" | "high";
  lessonTitle?: string;
  issueDetails: string;
  screenshotUrl?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  messageCount?: number;
  latestMessageAt?: string;
  lastReplyAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalSupportMessage {
  id: number;
  ticketId: number;
  senderRole: "student" | "admin";
  senderId?: string;
  senderName?: string;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface TechnicalSupportListResponse {
  items: TechnicalSupportTicket[];
  summary: {
    total: number;
    open_count: number;
    in_progress_count: number;
    resolved_count: number;
    closed_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
  };
  categories: Array<{ issueCategory: string; total: number }>;
  courses: Array<{ courseId: string; courseTitle: string; total: number }>;
}

export interface MarketingCampaign {
  id: number;
  campaignKey: string;
  title: string;
  message: string;
  contentType: "text" | "banner" | "video" | "pdf" | "alert" | "enquiry_form";
  mediaUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  pageScope: "global" | "specific";
  pagePaths: string[];
  targetStudentIds: string[];
  targetCourseIds: string[];
  targetSubjects: string[];
  targetLanguages: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  showDelaySeconds: number;
  repeatAfterCloseMinutes: number;
  maxImpressionsPerUser: number;
  isDismissible: boolean;
  isEnabled: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingCampaignPayload {
  title: string;
  message: string;
  contentType: "text" | "banner" | "video" | "pdf" | "alert" | "enquiry_form";
  mediaUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  pageScope: "global" | "specific";
  pagePaths: string[];
  targetStudentIds: string[];
  targetCourseIds: string[];
  targetSubjects: string[];
  targetLanguages: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  showDelaySeconds: number;
  repeatAfterCloseMinutes: number;
  maxImpressionsPerUser: number;
  isDismissible: boolean;
  isEnabled: boolean;
}

export interface AdminCategoryItem {
  id: string;
  name: string;
  slug: string;
  color: string;
  isVisible: boolean;
  parentId: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseMasterViewMode {
  id: string;
  name: string;
  maxViews: number | null;
  isLifetime: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CourseMasterValidityOption {
  id: string;
  label: string;
  days: number | null;
  isLifetime: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CourseMasterDeliveryMode {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CourseMasterLanguage {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CourseMasterAttemptOption {
  id: string;
  label: string;
  endDate: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CourseMasterSubject {
  id: string;
  name: string;
  courseIds: string[];
  levelIds: string[];
  isActive: boolean;
  sortOrder: number;
  chapters?: CourseMasterSubjectChapter[];
}

export interface CourseMasterSubjectChapter {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CourseMasterPricingCombination {
  id: string;
  label: string;
  viewModeId?: string | null;
  validityOptionId?: string | null;
  attemptOptionId?: string | null;
  deliveryModeId?: string | null;
  languageId?: string | null;
  price: number;
  originalPrice: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface FacultyCourseRef {
  id: string;
  title: string;
  thumbnail?: string;
}

export interface BunnyLibraryCollection {
  id: string;
  name: string;
  videoCount: number;
  previewVideoIds: string[];
}

export interface BunnyLibraryVideo {
  id: string;
  title: string;
  collectionId: string | null;
  collectionName: string;
  lengthSeconds: number;
  status: string;
  dateCreated: string;
}

export interface FacultyProfile {
  id: string;
  name: string;
  photoUrl?: string;
  about?: string;
  courseIds: string[];
  courses: FacultyCourseRef[];
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminOrderLine {
  id: number;
  orderId: string;
  studentId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  shippingPincode?: string;
  studentName: string;
  studentEmail: string;
  studentMobile?: string;
  courseId: string;
  courseTitle: string;
  parentPackageId?: string;
  parentPackageTitle?: string;
  packageCourseIds?: string[];
  orderDate?: string;
  purchaseDate?: string;
  expiresAt?: string;
  totalViews?: number;
  usedViews?: number;
  remainingViews?: number;
  accessStatus?: "active" | "expired" | "disabled" | "out_of_views" | string;
  paymentMethod?: string;
  baseAmount?: number;
  taxAmount?: number;
  amount: number;
  currency: string;
  status: string;
  itemType: string;
  modeLabel?: string;
  bookLabel?: string;
  isEbook: boolean;
  dispatchStatus: "pending" | "processing" | "dispatched" | "delivered" | "cancelled" | "refunded" | string;
  trackingId?: string;
  dispatchNote?: string;
  dispatchedAt?: string;
  refundNote?: string;
  refundedAt?: string;
  refundedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminOrderGroup {
  id: string;
  date: string;
  status: string;
  dispatchStatus?: string;
  trackingId?: string;
  dispatchNote?: string;
  paymentMethod?: string;
  total: number;
  items: Array<{
    id?: number;
    courseId?: string;
    title: string;
    price: number;
    itemType?: string;
    modeLabel?: string;
    bookLabel?: string;
    isEbook?: boolean;
    dispatchStatus?: string;
    trackingId?: string;
  }>;
}

export type LeadBaseFieldKey = "name" | "address" | "mobile" | "email" | "message";

export interface LeadFormFieldSetting {
  key: LeadBaseFieldKey;
  label: string;
  type: "text" | "phone" | "email" | "textarea";
  enabled: boolean;
  mandatory: boolean;
}

export interface LeadCustomFieldSetting {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  enabled: boolean;
  mandatory: boolean;
  options?: string[];
  placeholder?: string;
}

export interface LeadFormSettings {
  fields: LeadFormFieldSetting[];
  customFields?: LeadCustomFieldSetting[];
  stream: {
    enabled: boolean;
    label: string;
    mandatory: boolean;
    allowMultiple: boolean;
    options: string[];
  };
}

export interface LeadRecord {
  id: number;
  source: string;
  name: string;
  address: string;
  mobile: string;
  email?: string;
  streams: string[];
  status: "fresh" | "contacted" | "follow_up" | "qualified" | "won" | "lost" | string;
  enquiryMessage?: string;
  extraData?: Record<string, unknown>;
  lastFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
  followUpCount?: number;
  latestFollowUpAt?: string;
}

export interface LeadFollowUp {
  id: number;
  leadId: number;
  commentText: string;
  nextFollowUpAt?: string;
  status: string;
  createdBy?: string;
  createdAt: string;
}

export interface ActivityLogItem {
  actor_type: "admin" | "student";
  actor_id: string;
  actor_name: string;
  actor_email?: string;
  actor_role: "super_admin" | "sub_admin" | "student" | string;
  action: string;
  module_key: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
  created_at: string;
  course_id?: string;
  course_title?: string;
  amount?: number;
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

const MARKETING_LOCAL_CACHE_KEY = "ednovate_marketing_campaigns_cache";

const getAdminToken = () => {
  try {
    const stored = localStorage.getItem("admin_session_v2");
    if (!stored) return "";
    const parsed = JSON.parse(stored);
    return String(parsed?.token || "");
  } catch {
    return "";
  }
};

const withAuthHeaders = (headers: Record<string, string> = jsonHeaders) => {
  const token = getAdminToken();
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};

type BunnyVideoUploadOptions = {
  onProgress?: (percent: number, loaded: number, total: number) => void;
  signal?: AbortSignal;
  forceStorage?: boolean;
  collectionId?: string;
};

const uploadVideoViaXhr = (
  url: string,
  file: File,
  headers: Record<string, string>,
  options?: BunnyVideoUploadOptions,
) => new Promise<{ url: string; remotePath: string }>((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);

  Object.entries(headers).forEach(([key, value]) => {
    xhr.setRequestHeader(key, value);
  });

  const onAbort = () => {
    xhr.abort();
    reject(new Error("Upload cancelled"));
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      onAbort();
      return;
    }
    options.signal.addEventListener("abort", onAbort, { once: true });
  }

  xhr.upload.onprogress = (event) => {
    if (!options?.onProgress) return;
    const total = Number(event.total || 0);
    const loaded = Number(event.loaded || 0);
    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
    options.onProgress(percent, loaded, total);
  };

  xhr.onerror = () => {
    reject(new Error("Network error while uploading video"));
  };

  xhr.onabort = () => {
    reject(new Error("Upload cancelled"));
  };

  xhr.onload = () => {
    const raw = String(xhr.responseText || "");
    const parsed = (() => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();

    if (xhr.status >= 200 && xhr.status < 300) {
      resolve(parsed as { url: string; remotePath: string });
      return;
    }

    reject(new Error(parsed?.message || raw || `Request failed with ${xhr.status}`));
  };

  xhr.send(file);
});

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const maybeJson = await response.json().catch(() => null);
    throw new Error(maybeJson?.message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const is404Error = (error: unknown) =>
  error instanceof Error && /404/.test(error.message);

const toMarketingCampaignList = (settings: PlatformSettingsPayload): MarketingCampaign[] => {
  const rawItems = (settings?.siteSettings as { marketingCampaigns?: unknown[] } | undefined)?.marketingCampaigns;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      const row = (item || {}) as Partial<MarketingCampaign>;
      if (!row.id || !row.campaignKey || !row.title) return null;
      return {
        id: Number(row.id),
        campaignKey: String(row.campaignKey),
        title: String(row.title || ""),
        message: String(row.message || ""),
        contentType: (row.contentType || "text") as MarketingCampaign["contentType"],
        mediaUrl: String(row.mediaUrl || ""),
        ctaText: String(row.ctaText || ""),
        ctaUrl: String(row.ctaUrl || ""),
        pageScope: (row.pageScope || "global") as MarketingCampaign["pageScope"],
        pagePaths: Array.isArray(row.pagePaths) ? row.pagePaths.map(String) : [],
        targetStudentIds: Array.isArray(row.targetStudentIds) ? row.targetStudentIds.map(String) : [],
        targetCourseIds: Array.isArray(row.targetCourseIds) ? row.targetCourseIds.map(String) : [],
        targetSubjects: Array.isArray(row.targetSubjects) ? row.targetSubjects.map(String) : [],
        targetLanguages: Array.isArray(row.targetLanguages) ? row.targetLanguages.map(String) : [],
        startsAt: row.startsAt || null,
        endsAt: row.endsAt || null,
        showDelaySeconds: Number(row.showDelaySeconds || 0),
        repeatAfterCloseMinutes: Number(row.repeatAfterCloseMinutes || 0),
        maxImpressionsPerUser: Number(row.maxImpressionsPerUser || 0),
        isDismissible: row.isDismissible !== false,
        isEnabled: row.isEnabled !== false,
        createdBy: String(row.createdBy || ""),
        updatedBy: String(row.updatedBy || ""),
        createdAt: row.createdAt || "",
        updatedAt: row.updatedAt || "",
      };
    })
    .filter(Boolean) as MarketingCampaign[];
};

const readMarketingLocalCache = (): MarketingCampaign[] => {
  try {
    const raw = localStorage.getItem(MARKETING_LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed as MarketingCampaign[];
  } catch {
    return [];
  }
};

const writeMarketingLocalCache = (items: MarketingCampaign[]) => {
  try {
    localStorage.setItem(MARKETING_LOCAL_CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore cache write failures
  }
};

const readMarketingCampaignsFromSettings = async () => {
  try {
    const result = await parseResponse<{ settings: PlatformSettingsPayload }>(
      await fetch("/api/admin/platform-settings", {
        headers: withAuthHeaders({}),
      }),
    );
    const items = toMarketingCampaignList(result.settings);
    writeMarketingLocalCache(items);
    return {
      settings: result.settings,
      items,
    };
  } catch (error) {
    if (!is404Error(error)) throw error;
    return {
      settings: {} as PlatformSettingsPayload,
      items: readMarketingLocalCache(),
    };
  }
};

const writeMarketingCampaignsToSettings = async (
  settings: PlatformSettingsPayload,
  items: MarketingCampaign[],
) => {
  const nextSettings: PlatformSettingsPayload = {
    ...settings,
    siteSettings: {
      ...(settings.siteSettings || {}),
      marketingCampaigns: items,
    },
  };

  try {
    await parseResponse<{ ok: boolean; settings: PlatformSettingsPayload }>(
      await fetch("/api/admin/platform-settings", {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify({ settings: nextSettings }),
      }),
    );
  } catch (error) {
    if (!is404Error(error)) throw error;
  }

  writeMarketingLocalCache(items);
};

export const adminApi = {
  async getPublicLeadFormSettings() {
    return parseResponse<{ settings: LeadFormSettings }>(
      await fetch("/api/lead-form-settings", {
        headers: {},
      }),
    );
  },

  async submitPublicEnquiryLead(payload: {
    source?: string;
    name: string;
    address: string;
    mobile: string;
    email?: string;
    message?: string;
    streams?: string[];
    customFieldValues?: Record<string, unknown>;
    extraData?: Record<string, unknown>;
  }) {
    return parseResponse<{ ok: boolean; item: LeadRecord }>(
      await fetch("/api/leads/enquiry", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      }),
    );
  },

  async listStudents(search = "", from?: string, to?: string) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString() ? `?${params.toString()}` : "";
    return parseResponse<{ students: StudentRecord[] }>(await fetch(`/api/students${query}`, {
      headers: withAuthHeaders({}),
    }));
  },

  async saveStudent(student: Partial<StudentRecord> & { id?: string; password?: string }) {
    return parseResponse<{ student: StudentRecord }>(
      await fetch("/api/students", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(student),
      }),
    );
  },

  async updateStudent(id: string, student: Partial<StudentRecord>) {
    return parseResponse<{ student: StudentRecord }>(
      await fetch(`/api/students/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify(student),
      }),
    );
  },

  async deleteStudent(id: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async bulkDeleteStudents(ids: string[]) {
    return parseResponse<{ ok: boolean; deletedCount: number }>(
      await fetch("/api/students/bulk-delete", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ ids }),
      }),
    );
  },

  async bulkUpdateStudents(ids: string[], updates: Record<string, unknown>) {
    return parseResponse<{ ok: boolean; updatedCount: number }>(
      await fetch("/api/students/bulk-update", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ ids, updates }),
      }),
    );
  },

  async getStudentDetails(studentId: string) {
    return parseResponse<{
      student: StudentRecord;
      courseAccess: StudentCourseAccess[];
      loginLogs: StudentLoginLog[];
      videoActivity: StudentVideoActivity[];
      notifications: StudentNotification[];
    }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/details`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async getStudentAccessSummary(options?: { search?: string; status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (options?.search) query.set("search", options.search);
    if (options?.status) query.set("status", options.status);
    if (options?.limit) query.set("limit", String(options.limit));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return parseResponse<{
      summary: { total: number; active: number; disabled: number; expired: number; outOfViews: number };
      items: StudentAccessSummaryItem[];
    }>(
      await fetch(`/api/admin/student-access-summary${suffix}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async listOrders(options?: {
    search?: string;
    dispatchStatus?: string;
    itemType?: "all" | "ebook" | "course" | "package";
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (options?.search) query.set("search", options.search);
    if (options?.dispatchStatus) query.set("dispatchStatus", options.dispatchStatus);
    if (options?.itemType) query.set("itemType", options.itemType);
    if (options?.from) query.set("from", options.from);
    if (options?.to) query.set("to", options.to);
    if (options?.limit) query.set("limit", String(options.limit));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return parseResponse<{ items: AdminOrderLine[] }>(
      await fetch(`/api/admin/orders${suffix}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async getStudentOrderHistory(studentId: string) {
    return parseResponse<{ lines: AdminOrderLine[]; grouped: AdminOrderGroup[] }>(
      await fetch(`/api/admin/orders/student/${encodeURIComponent(studentId)}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async updateOrderDispatch(
    id: number,
    payload: {
      dispatchStatus: "pending" | "processing" | "dispatched" | "delivered" | "cancelled" | string;
      trackingId?: string;
      dispatchNote?: string;
      status?: string;
    },
  ) {
    return parseResponse<{ item: AdminOrderLine }>(
      await fetch(`/api/admin/orders/${encodeURIComponent(String(id))}/dispatch`, {
        method: "PATCH",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async deleteOrder(id: number) {
    return parseResponse<{ ok: boolean; item: AdminOrderLine }>(
      await fetch(`/api/admin/orders/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async sendOrderInvoice(id: number) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/admin/orders/${encodeURIComponent(String(id))}/send-invoice`, {
        method: "POST",
        headers: withAuthHeaders(),
      }),
    );
  },

  async refundOrder(id: number, refundNote?: string) {
    return parseResponse<{ ok: boolean; item: AdminOrderLine }>(
      await fetch(`/api/admin/orders/${encodeURIComponent(String(id))}/refund`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ refundNote: String(refundNote || "").trim() }),
      }),
    );
  },

  async getLeadFormSettings() {
    return parseResponse<{ settings: LeadFormSettings }>(
      await fetch("/api/admin/lead-form-settings", {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async saveLeadFormSettings(settings: LeadFormSettings) {
    return parseResponse<{ ok: boolean; settings: LeadFormSettings }>(
      await fetch("/api/admin/lead-form-settings", {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify({ settings }),
      }),
    );
  },

  async listLeads(options?: {
    search?: string;
    status?: string;
    source?: string;
    stream?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (options?.search) query.set("search", options.search);
    if (options?.status) query.set("status", options.status);
    if (options?.source) query.set("source", options.source);
    if (options?.stream) query.set("stream", options.stream);
    if (options?.from) query.set("from", options.from);
    if (options?.to) query.set("to", options.to);
    if (options?.limit) query.set("limit", String(options.limit));
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return parseResponse<{
      items: LeadRecord[];
      summary: {
        total: number;
        freshCount: number;
        followUpCount: number;
        qualifiedCount: number;
        wonCount: number;
        lostCount: number;
      };
    }>(
      await fetch(`/api/admin/leads${suffix}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async getLeadDetails(id: number) {
    return parseResponse<{ lead: LeadRecord; followUps: LeadFollowUp[] }>(
      await fetch(`/api/admin/leads/${encodeURIComponent(String(id))}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async updateLeadStatus(id: number, status: LeadRecord["status"]) {
    return parseResponse<{ item: LeadRecord }>(
      await fetch(`/api/admin/leads/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        headers: withAuthHeaders(),
        body: JSON.stringify({ status }),
      }),
    );
  },

  async addLeadFollowUp(
    id: number,
    payload: { commentText: string; status?: LeadRecord["status"]; nextFollowUpAt?: string },
  ) {
    return parseResponse<{ ok: boolean; followUp: LeadFollowUp; lead: LeadRecord }>(
      await fetch(`/api/admin/leads/${encodeURIComponent(String(id))}/follow-ups`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async saveStudentCourseAccess(studentId: string, payload: Record<string, unknown>) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/course-access`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async extendStudentCourseAccess(
    studentId: string,
    courseId: string,
    extraDays: number,
    extraViews: number,
    extraWatchHours = 0,
  ) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/course-access/${encodeURIComponent(courseId)}/extend`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ extraDays, extraViews, extraWatchHours }),
      }),
    );
  },

  async adjustStudentCourseWatchTime(studentId: string, courseId: string, deltaHours: number) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/course-access/${encodeURIComponent(courseId)}/adjust-watch-time`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ deltaHours }),
      }),
    );
  },

  async updateStudentCourseAccess(
    studentId: string,
    courseId: string,
    payload: {
      courseTitle?: string;
      expiresAt?: string | null;
      durationDays?: number;
      totalViews?: number;
      usedViews?: number;
      isEnabled?: boolean;
      isUnlimitedViews?: boolean;
    },
  ) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/course-access/${encodeURIComponent(courseId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async removeStudentCourseAccess(studentId: string, courseId: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/course-access/${encodeURIComponent(courseId)}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async toggleStudentCourse(studentId: string, courseId: string, isEnabled: boolean) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/course-access/${encodeURIComponent(courseId)}/toggle`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ isEnabled }),
      }),
    );
  },

  async resetStudentCourseViews(studentId: string, courseId: string, resetTo = 0) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/course-access/${encodeURIComponent(courseId)}/reset-views`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ resetTo }),
      }),
    );
  },

  async changeStudentPassword(studentId: string, password: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/password`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ password }),
      }),
    );
  },

  async sendStudentMessage(studentId: string, payload: { channel: string; subject?: string; message: string }) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/message`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async deleteStudentNotification(studentId: string, notificationId: number) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/students/${encodeURIComponent(studentId)}/notifications/${encodeURIComponent(String(notificationId))}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async quickLogin(studentId: string) {
    return parseResponse<{
      token: string;
      redirectPath: string;
      student: {
        studentId: string;
        name: string;
        email: string;
        mobile: string;
        country?: string;
        state?: string;
        city?: string;
        course?: string;
        level?: string;
        attemptYear?: string;
      };
    }>(
      await fetch("/api/admin/quick-login", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ studentId }),
      }),
    );
  },

  async getHomepage() {
    return parseResponse<{
      banners: unknown[];
      testimonials: unknown[];
      announcements: unknown[];
    }>(await fetch("/api/homepage"));
  },

  async updateHomepage(payload: { banners: unknown[]; testimonials: unknown[]; announcements: unknown[] }) {
    return parseResponse<{ ok: boolean }>(
      await fetch("/api/homepage", {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async upsertCourse(course: unknown) {
    return parseResponse<{ ok: boolean }>(
      await fetch("/api/courses/upsert", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ course }),
      }),
    );
  },

  async deleteCourse(courseId: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async duplicateCourse(sourceCourseId: string, duplicateCourse: { id: string; title: string }) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/courses/${encodeURIComponent(sourceCourseId)}/duplicate`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(duplicateCourse),
      }),
    );
  },

  async getCourses() {
    return parseResponse<{ courses: unknown[]; curricula: Record<string, unknown[]> }>(await fetch("/api/courses"));
  },

  async getCategories() {
    return parseResponse<{ items: AdminCategoryItem[] }>(await fetch("/api/categories"));
  },

  async getAdminCategories() {
    return parseResponse<{ items: AdminCategoryItem[] }>(
      await fetch("/api/admin/categories", {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async upsertCategory(category: AdminCategoryItem) {
    return parseResponse<{ ok: boolean; item: AdminCategoryItem }>(
      await fetch("/api/admin/categories/upsert", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ category }),
      }),
    );
  },

  async toggleCategory(categoryId: string, isVisible?: boolean) {
    return parseResponse<{ ok: boolean; item: AdminCategoryItem }>(
      await fetch(`/api/admin/categories/${encodeURIComponent(categoryId)}/toggle`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(typeof isVisible === "boolean" ? { isVisible } : {}),
      }),
    );
  },

  async deleteCategory(categoryId: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async getCourseMasters() {
    try {
      return await parseResponse<{
        categories: AdminCategoryItem[];
        viewModes: CourseMasterViewMode[];
        validityOptions: CourseMasterValidityOption[];
        attemptOptions: CourseMasterAttemptOption[];
        deliveryModes: CourseMasterDeliveryMode[];
        languages: CourseMasterLanguage[];
        subjects: CourseMasterSubject[];
        pricingCombinations: CourseMasterPricingCombination[];
      }>(
        await fetch("/api/admin/course-masters", {
          headers: withAuthHeaders({}),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;

      const [categoryResult, settingsResult] = await Promise.all([
        this.getAdminCategories(),
        this.getPlatformSettings(),
      ]);

      const courseMasters = (settingsResult.settings?.siteSettings as { courseMasters?: unknown } | undefined)?.courseMasters;
      const masters = courseMasters && typeof courseMasters === "object"
        ? (courseMasters as {
            viewModes?: CourseMasterViewMode[];
            validityOptions?: CourseMasterValidityOption[];
            attemptOptions?: CourseMasterAttemptOption[];
            deliveryModes?: CourseMasterDeliveryMode[];
            languages?: CourseMasterLanguage[];
            subjects?: CourseMasterSubject[];
            pricingCombinations?: CourseMasterPricingCombination[];
          })
        : {};

      return {
        categories: Array.isArray(categoryResult.items) ? categoryResult.items : [],
        viewModes: Array.isArray(masters.viewModes) ? masters.viewModes : [],
        validityOptions: Array.isArray(masters.validityOptions) ? masters.validityOptions : [],
        attemptOptions: Array.isArray(masters.attemptOptions) ? masters.attemptOptions : [],
        deliveryModes: Array.isArray(masters.deliveryModes) ? masters.deliveryModes : [],
        languages: Array.isArray(masters.languages) ? masters.languages : [],
        subjects: Array.isArray(masters.subjects) ? masters.subjects : [],
        pricingCombinations: Array.isArray(masters.pricingCombinations) ? masters.pricingCombinations : [],
      };
    }
  },

  async saveCourseMasters(payload: {
    viewModes: CourseMasterViewMode[];
    validityOptions: CourseMasterValidityOption[];
    attemptOptions: CourseMasterAttemptOption[];
    deliveryModes: CourseMasterDeliveryMode[];
    languages: CourseMasterLanguage[];
    subjects: CourseMasterSubject[];
    pricingCombinations: CourseMasterPricingCombination[];
  }) {
    try {
      return await parseResponse<{
        ok: boolean;
        masters: {
          viewModes: CourseMasterViewMode[];
          validityOptions: CourseMasterValidityOption[];
          attemptOptions: CourseMasterAttemptOption[];
          deliveryModes: CourseMasterDeliveryMode[];
          languages: CourseMasterLanguage[];
          subjects: CourseMasterSubject[];
          pricingCombinations: CourseMasterPricingCombination[];
        };
      }>(
        await fetch("/api/admin/course-masters", {
          method: "PUT",
          headers: withAuthHeaders(),
          body: JSON.stringify({ masters: payload }),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;

      const current = await this.getPlatformSettings();
      const existingSiteSettings =
        current.settings?.siteSettings && typeof current.settings.siteSettings === "object"
          ? current.settings.siteSettings
          : {};

      const nextSettings: PlatformSettingsPayload = {
        ...current.settings,
        siteSettings: {
          ...existingSiteSettings,
          courseMasters: {
            viewModes: payload.viewModes,
            validityOptions: payload.validityOptions,
            attemptOptions: payload.attemptOptions,
            deliveryModes: payload.deliveryModes,
            languages: payload.languages,
            subjects: payload.subjects,
            pricingCombinations: payload.pricingCombinations,
          },
        },
      };

      await this.savePlatformSettings(nextSettings);
      return {
        ok: true,
        masters: {
          viewModes: payload.viewModes,
          validityOptions: payload.validityOptions,
          attemptOptions: payload.attemptOptions,
          deliveryModes: payload.deliveryModes,
          languages: payload.languages,
          subjects: payload.subjects,
          pricingCombinations: payload.pricingCombinations,
        },
      };
    }
  },

  async listFaculty() {
    return parseResponse<{ items: FacultyProfile[] }>(
      await fetch("/api/admin/faculty", {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async createFaculty(payload: {
    name: string;
    photoUrl?: string;
    about?: string;
    courseIds: string[];
    isActive?: boolean;
    sortOrder?: number;
  }) {
    return parseResponse<{ item: FacultyProfile }>(
      await fetch("/api/admin/faculty", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async updateFaculty(
    id: string,
    payload: {
      name: string;
      photoUrl?: string;
      about?: string;
      courseIds: string[];
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return parseResponse<{ item: FacultyProfile }>(
      await fetch(`/api/admin/faculty/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async deleteFaculty(id: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/admin/faculty/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async saveCurriculum(courseId: string, chapters: unknown[]) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/courses/${encodeURIComponent(courseId)}/curriculum`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ chapters }),
      }),
    );
  },

  async getBunnyVideoDuration(videoId: string) {
    return parseResponse<{ videoId: string; durationSeconds: number; ready: boolean; status?: string }>(
      await fetch(`/api/admin/bunny/video-duration/${encodeURIComponent(videoId)}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async getBunnyLibrary(options?: { limit?: number; offset?: number; search?: string; collectionId?: string }) {
    const query = new URLSearchParams();
    if (options?.limit && options.limit > 0) query.set("limit", String(options.limit));
    if (options?.offset && options.offset >= 0) query.set("offset", String(options.offset));
    if (options?.search) query.set("search", options.search);
    if (options?.collectionId) query.set("collectionId", options.collectionId);
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return parseResponse<{
      libraryId: string;
      collections: BunnyLibraryCollection[];
      videos: BunnyLibraryVideo[];
      stats: {
        collectionCount: number;
        videoCount: number;
        totalVideoCount: number;
      };
    }>(
      await fetch(`/api/admin/bunny/library${suffix}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async uploadImage(fileName: string, mimeType: string, base64Data: string, folder = "images") {
    return parseResponse<{ url: string }>(
      await fetch("/api/uploads/image", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ fileName, mimeType, base64Data, folder }),
      }),
    );
  },

  async uploadVideoToBunny(fileName: string, mimeType: string, base64Data: string, folder = "videos") {
    return parseResponse<{ url: string; remotePath: string }>(
      await fetch("/api/uploads/bunny-video", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ fileName, mimeType, base64Data, folder }),
      }),
    );
  },

  async createBunnyCollection(name: string) {
    return parseResponse<{ ok: boolean; collection: { id: string; name: string } }>(
      await fetch("/api/admin/bunny/collections", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ name }),
      }),
    );
  },

  async renameBunnyCollection(collectionId: string, name: string) {
    return parseResponse<{ ok: boolean; collectionId: string; name: string }>(
      await fetch(`/api/admin/bunny/collections/${encodeURIComponent(collectionId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(),
        body: JSON.stringify({ name }),
      }),
    );
  },

  async deleteBunnyVideo(videoId: string) {
    return parseResponse<{ ok: boolean; videoId: string }>(
      await fetch(`/api/admin/bunny/videos/${encodeURIComponent(videoId)}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async updateBunnyVideo(videoId: string, updates: { collectionId?: string; title?: string }) {
    return parseResponse<{ ok: boolean; videoId: string; collectionId: string | null; title: string | null }>(
      await fetch(`/api/admin/bunny/videos/${encodeURIComponent(videoId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(),
        body: JSON.stringify(updates),
      }),
    );
  },

  async moveBunnyVideoToCollection(videoId: string, collectionId: string) {
    return this.updateBunnyVideo(videoId, { collectionId });
  },

  async renameBunnyVideo(videoId: string, title: string) {
    return this.updateBunnyVideo(videoId, { title });
  },

  async uploadVideoFileToBunny(file: File, folder = "videos") {
    return this.uploadVideoFileToBunnyWithProgress(file, folder);
  },

  async uploadVideoFileToBunnyWithProgress(file: File, folder = "videos", options?: BunnyVideoUploadOptions) {
    const headers = withAuthHeaders({
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || `video-${Date.now()}.mp4`),
      "X-Upload-Folder": folder,
      ...(options?.collectionId ? { "X-Collection-Id": options.collectionId } : {}),
      ...(options?.forceStorage ? { "X-Force-Storage": "1" } : {}),
    });

    const directUrl = resolveApiUrl("/api/uploads/bunny-video");
    const proxyUrl = "/api/uploads/bunny-video";

    try {
      return await uploadVideoViaXhr(directUrl, file, headers, options);
    } catch (error) {
      if (directUrl !== proxyUrl) {
        return uploadVideoViaXhr(proxyUrl, file, headers, options);
      }
      throw error;
    }
  },

  async trackEvent(eventType: string, courseId?: string, userId?: string, metadata: Record<string, unknown> = {}) {
    return parseResponse<{ ok: boolean }>(
      await fetch("/api/analytics/events", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ eventType, courseId, userId, metadata }),
      }),
    );
  },

  async topContent(limit = 10) {
    return parseResponse<{ items: Array<{ course_id: string; views: number }> }>(
      await fetch(`/api/analytics/top-content?limit=${encodeURIComponent(String(limit))}`),
    );
  },

  async analyticsSummary() {
    return parseResponse<{ totalEvents: number; totalStudents: number }>(await fetch("/api/analytics/summary"));
  },

  async listSubAdmins() {
    return parseResponse<{ items: unknown[] }>(
      await fetch("/api/admin/subadmins", {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async createSubAdmin(payload: Record<string, unknown>) {
    return parseResponse<{ item: unknown }>(
      await fetch("/api/admin/subadmins", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async updateSubAdmin(id: string, payload: Record<string, unknown>) {
    return parseResponse<{ item: unknown }>(
      await fetch(`/api/admin/subadmins/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify(payload),
      }),
    );
  },

  async deleteSubAdmin(id: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/admin/subadmins/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },

  async listAdminAuditLogs(limit = 100) {
    return parseResponse<{ items: unknown[] }>(
      await fetch(`/api/admin/audit-logs?limit=${encodeURIComponent(String(limit))}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async listActivityLogs(filters?: {
    limit?: number;
    actorType?: "all" | "admin" | "subadmin" | "student";
    actionType?: "all" | "login" | "create" | "edit" | "delete" | "purchase" | "video_watch";
    actorId?: string;
    actorName?: string;
    actorEmail?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const query = new URLSearchParams();
    if (filters?.limit) query.set("limit", String(filters.limit));
    if (filters?.actorType && filters.actorType !== "all") query.set("actorType", filters.actorType);
    if (filters?.actionType && filters.actionType !== "all") query.set("actionType", filters.actionType);
    if (filters?.actorId) query.set("actorId", filters.actorId);
    if (filters?.actorName) query.set("actorName", filters.actorName);
    if (filters?.actorEmail) query.set("actorEmail", filters.actorEmail);
    if (filters?.search) query.set("search", filters.search);
    if (filters?.from) query.set("from", filters.from);
    if (filters?.to) query.set("to", filters.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return parseResponse<{ items: ActivityLogItem[] }>(
      await fetch(`/api/admin/activity-logs${suffix}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async getPlatformSettings() {
    return parseResponse<{ settings: PlatformSettingsPayload }>(
      await fetch("/api/admin/platform-settings", {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async savePlatformSettings(settings: PlatformSettingsPayload) {
    return parseResponse<{ ok: boolean; settings: PlatformSettingsPayload }>(
      await fetch("/api/admin/platform-settings", {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify({ settings }),
      }),
    );
  },

  async sendSmtpTestMail(toEmail: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch("/api/admin/smtp/test", {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ toEmail }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("SMTP test timed out after 30 seconds. Please verify host/port/firewall and try again.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

    return parseResponse<{ ok: boolean; message: string }>(
      response,
    );
  },

  async listCoupons() {
    return parseResponse<{ items: unknown[] }>(
      await fetch("/api/admin/coupons", {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async saveCoupons(items: unknown[]) {
    return parseResponse<{ ok: boolean; items: unknown[] }>(
      await fetch("/api/admin/coupons", {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify({ items }),
      }),
    );
  },

  async getHomepagePlatformSettings() {
    try {
      return await parseResponse<{ settings: PlatformSettingsPayload }>(
        await fetch("/api/admin/homepage/platform-settings", {
          headers: withAuthHeaders({}),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) {
        throw error;
      }
      // Fallback for servers that only expose the generic platform settings endpoint.
      return parseResponse<{ settings: PlatformSettingsPayload }>(
        await fetch("/api/admin/platform-settings", {
          headers: withAuthHeaders({}),
        }),
      );
    }
  },

  async saveHomepagePlatformSettings(settings: PlatformSettingsPayload) {
    try {
      return await parseResponse<{ ok: boolean; settings: PlatformSettingsPayload }>(
        await fetch("/api/admin/homepage/platform-settings", {
          method: "PUT",
          headers: withAuthHeaders(),
          body: JSON.stringify({ settings }),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) {
        throw error;
      }
      // Fallback for servers that only expose the generic platform settings endpoint.
      return parseResponse<{ ok: boolean; settings: PlatformSettingsPayload }>(
        await fetch("/api/admin/platform-settings", {
          method: "PUT",
          headers: withAuthHeaders(),
          body: JSON.stringify({ settings }),
        }),
      );
    }
  },

  async listMarketingCampaigns(filters?: { search?: string; status?: "all" | "enabled" | "disabled" }) {
    const query = new URLSearchParams();
    if (filters?.search) query.set("search", filters.search);
    if (filters?.status && filters.status !== "all") query.set("status", filters.status);
    const suffix = query.toString() ? `?${query.toString()}` : "";

    try {
      const result = await parseResponse<{ items: MarketingCampaign[] }>(
        await fetch(`/api/admin/marketing/campaigns${suffix}`, {
          headers: withAuthHeaders({}),
        }),
      );
      writeMarketingLocalCache(result.items || []);
      return result;
    } catch (error) {
      if (!is404Error(error)) throw error;

      const { items } = await readMarketingCampaignsFromSettings();
      const search = String(filters?.search || "").trim().toLowerCase();
      const status = filters?.status || "all";
      const filtered = items.filter((item) => {
        if (search && !(`${item.title} ${item.message}`.toLowerCase().includes(search))) return false;
        if (status === "enabled" && !item.isEnabled) return false;
        if (status === "disabled" && item.isEnabled) return false;
        return true;
      });
      return { items: filtered };
    }
  },

  async createMarketingCampaign(payload: MarketingCampaignPayload) {
    try {
      return await parseResponse<{ ok: boolean; item: MarketingCampaign }>(
        await fetch("/api/admin/marketing/campaigns", {
          method: "POST",
          headers: withAuthHeaders(),
          body: JSON.stringify(payload),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;

      const { settings, items } = await readMarketingCampaignsFromSettings();
      const now = new Date().toISOString();
      const item: MarketingCampaign = {
        id: Date.now(),
        campaignKey: `mkt-local-${Date.now()}`,
        ...payload,
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt || null,
        mediaUrl: payload.mediaUrl || "",
        ctaText: payload.ctaText || "",
        ctaUrl: payload.ctaUrl || "",
        createdAt: now,
        updatedAt: now,
      };
      const nextItems = [item, ...items];
      await writeMarketingCampaignsToSettings(settings, nextItems);
      return { ok: true, item };
    }
  },

  async updateMarketingCampaign(id: number, payload: MarketingCampaignPayload) {
    try {
      return await parseResponse<{ ok: boolean; item: MarketingCampaign }>(
        await fetch(`/api/admin/marketing/campaigns/${encodeURIComponent(String(id))}`, {
          method: "PUT",
          headers: withAuthHeaders(),
          body: JSON.stringify(payload),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;

      const { settings, items } = await readMarketingCampaignsFromSettings();
      const existing = items.find((item) => item.id === id);
      if (!existing) throw new Error("Campaign not found");
      const updated: MarketingCampaign = {
        ...existing,
        ...payload,
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt || null,
        mediaUrl: payload.mediaUrl || "",
        ctaText: payload.ctaText || "",
        ctaUrl: payload.ctaUrl || "",
        updatedAt: new Date().toISOString(),
      };
      const nextItems = items.map((item) => (item.id === id ? updated : item));
      await writeMarketingCampaignsToSettings(settings, nextItems);
      return { ok: true, item: updated };
    }
  },

  async toggleMarketingCampaign(id: number, isEnabled: boolean) {
    try {
      return await parseResponse<{ ok: boolean; item: MarketingCampaign }>(
        await fetch(`/api/admin/marketing/campaigns/${encodeURIComponent(String(id))}/toggle`, {
          method: "POST",
          headers: withAuthHeaders(),
          body: JSON.stringify({ isEnabled }),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;

      const { settings, items } = await readMarketingCampaignsFromSettings();
      const existing = items.find((item) => item.id === id);
      if (!existing) throw new Error("Campaign not found");
      const updated: MarketingCampaign = {
        ...existing,
        isEnabled,
        updatedAt: new Date().toISOString(),
      };
      const nextItems = items.map((item) => (item.id === id ? updated : item));
      await writeMarketingCampaignsToSettings(settings, nextItems);
      return { ok: true, item: updated };
    }
  },

  async deleteMarketingCampaign(id: number) {
    try {
      return await parseResponse<{ ok: boolean }>(
        await fetch(`/api/admin/marketing/campaigns/${encodeURIComponent(String(id))}`, {
          method: "DELETE",
          headers: withAuthHeaders({}),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;

      const { settings, items } = await readMarketingCampaignsFromSettings();
      const nextItems = items.filter((item) => item.id !== id);
      await writeMarketingCampaignsToSettings(settings, nextItems);
      return { ok: true };
    }
  },

  async listTechnicalSupportTickets(filters?: {
    search?: string;
    status?: string;
    priority?: string;
    issueCategory?: string;
    courseId?: string;
    subject?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (filters?.search) query.set("search", filters.search);
    if (filters?.status) query.set("status", filters.status);
    if (filters?.priority) query.set("priority", filters.priority);
    if (filters?.issueCategory) query.set("issueCategory", filters.issueCategory);
    if (filters?.courseId) query.set("courseId", filters.courseId);
    if (filters?.subject) query.set("subject", filters.subject);
    if (filters?.limit) query.set("limit", String(filters.limit));
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return parseResponse<TechnicalSupportListResponse>(
      await fetch(`/api/admin/technical-support/tickets${suffix}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async getTechnicalSupportTicket(ticketId: number) {
    return parseResponse<{ ticket: TechnicalSupportTicket; messages: TechnicalSupportMessage[] }>(
      await fetch(`/api/admin/technical-support/tickets/${encodeURIComponent(String(ticketId))}`, {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async replyTechnicalSupportTicket(ticketId: number, message: string, status = "in_progress") {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/admin/technical-support/tickets/${encodeURIComponent(String(ticketId))}/reply`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ message, status }),
      }),
    );
  },

  async updateTechnicalSupportTicketStatus(ticketId: number, status: "open" | "in_progress" | "resolved" | "closed") {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/admin/technical-support/tickets/${encodeURIComponent(String(ticketId))}/status`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ status }),
      }),
    );
  },

  async deleteTechnicalSupportTicket(ticketId: number) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/admin/technical-support/tickets/${encodeURIComponent(String(ticketId))}`, {
        method: "DELETE",
        headers: withAuthHeaders({}),
      }),
    );
  },
};

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
