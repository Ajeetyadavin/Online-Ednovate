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
  isUnlimitedViews?: boolean;
  isEnabled: boolean;
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
  contentType: "text" | "banner" | "video" | "pdf" | "alert";
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
  contentType: "text" | "banner" | "video" | "pdf" | "alert";
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
  async listStudents(search = "") {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
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

  async saveCurriculum(courseId: string, chapters: unknown[]) {
    return parseResponse<{ ok: boolean }>(
      await fetch(`/api/courses/${encodeURIComponent(courseId)}/curriculum`, {
        method: "POST",
        headers: withAuthHeaders(),
        body: JSON.stringify({ chapters }),
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

  async getHomepagePlatformSettings() {
    return parseResponse<{ settings: PlatformSettingsPayload }>(
      await fetch("/api/admin/homepage/platform-settings", {
        headers: withAuthHeaders({}),
      }),
    );
  },

  async saveHomepagePlatformSettings(settings: PlatformSettingsPayload) {
    return parseResponse<{ ok: boolean; settings: PlatformSettingsPayload }>(
      await fetch("/api/admin/homepage/platform-settings", {
        method: "PUT",
        headers: withAuthHeaders(),
        body: JSON.stringify({ settings }),
      }),
    );
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
};

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
