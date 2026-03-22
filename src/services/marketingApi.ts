import { SESSION_TOKEN_KEY } from "@/services/authApi";

export type MarketingContentType = "text" | "banner" | "video" | "pdf" | "alert";

export interface ActiveMarketingCampaign {
  id: number;
  campaignKey: string;
  title: string;
  message: string;
  contentType: MarketingContentType;
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

const MARKETING_LOCAL_CACHE_KEY = "ednovate_marketing_campaigns_cache";
const MARKETING_EVENT_CACHE_KEY = "ednovate_marketing_event_cache";

const getStudentToken = () => localStorage.getItem(SESSION_TOKEN_KEY) || "";

const withStudentHeaders = (headers: Record<string, string> = {}) => {
  const token = getStudentToken();
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};

const parseResponse = async <T,>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const is404Error = (error: unknown) =>
  error instanceof Error && /404/.test(error.message);

const getStudentId = () => {
  try {
    const raw = localStorage.getItem("ednovate_auth_user");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { studentId?: string };
    return String(parsed?.studentId || "");
  } catch {
    return "";
  }
};

const readLocalCampaigns = (): ActiveMarketingCampaign[] => {
  try {
    const raw = localStorage.getItem(MARKETING_LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? (parsed as ActiveMarketingCampaign[]) : [];
  } catch {
    return [];
  }
};

type MarketingLocalEvent = {
  campaignId: number;
  eventType: "shown" | "dismissed" | "clicked";
  sessionId: string;
  pathName: string;
  studentId: string;
  at: string;
};

const readLocalEvents = (): MarketingLocalEvent[] => {
  try {
    const raw = localStorage.getItem(MARKETING_EVENT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? (parsed as MarketingLocalEvent[]) : [];
  } catch {
    return [];
  }
};

const writeLocalEvents = (items: MarketingLocalEvent[]) => {
  try {
    localStorage.setItem(MARKETING_EVENT_CACHE_KEY, JSON.stringify(items.slice(-1000)));
  } catch {
    // ignore local cache write errors
  }
};

const pathMatches = (pathName: string, rule: string) => {
  const normalizedPath = String(pathName || "").trim();
  const normalizedRule = String(rule || "").trim();
  if (!normalizedPath || !normalizedRule) return false;
  if (normalizedRule.endsWith("*")) return normalizedPath.startsWith(normalizedRule.slice(0, -1));
  return normalizedPath === normalizedRule;
};

const resolveActiveCampaignsFromLocal = (options: {
  path: string;
  sessionId: string;
  pageSeconds: number;
  courseId?: string;
  subject?: string;
  language?: string;
}) => {
  const now = new Date();
  const studentId = getStudentId();
  const campaigns = readLocalCampaigns();
  const events = readLocalEvents();

  const filtered = campaigns.filter((campaign) => {
    if (campaign.isEnabled === false) return false;

    if (campaign.startsAt && new Date(campaign.startsAt) > now) return false;
    if (campaign.endsAt && new Date(campaign.endsAt) < now) return false;

    if (campaign.pageScope === "specific") {
      if (!(campaign.pagePaths || []).some((rule) => pathMatches(options.path, rule))) return false;
    }

    if ((campaign.targetStudentIds || []).length > 0 && !(campaign.targetStudentIds || []).includes(studentId)) return false;
    if ((campaign.targetCourseIds || []).length > 0 && !(campaign.targetCourseIds || []).includes(String(options.courseId || ""))) return false;

    const subject = String(options.subject || "").trim().toLowerCase();
    const language = String(options.language || "").trim().toLowerCase();
    const targetSubjects = (campaign.targetSubjects || []).map((item) => String(item || "").toLowerCase());
    const targetLanguages = (campaign.targetLanguages || []).map((item) => String(item || "").toLowerCase());

    if (targetSubjects.length > 0 && !targetSubjects.includes(subject)) return false;
    if (targetLanguages.length > 0 && !targetLanguages.includes(language)) return false;
    if (campaign.showDelaySeconds > 0 && options.pageSeconds < campaign.showDelaySeconds) return false;

    const ownEvents = events.filter((event) =>
      event.campaignId === campaign.id && (
        (studentId && event.studentId === studentId) ||
        (!studentId && event.sessionId === options.sessionId)
      ),
    );

    const shownCount = ownEvents.filter((event) => event.eventType === "shown").length;
    if (campaign.maxImpressionsPerUser > 0 && shownCount >= campaign.maxImpressionsPerUser) return false;

    if (campaign.repeatAfterCloseMinutes > 0) {
      const lastDismissed = ownEvents
        .filter((event) => event.eventType === "dismissed")
        .map((event) => new Date(event.at).getTime())
        .sort((a, b) => b - a)[0];
      if (lastDismissed) {
        const nextAllowed = lastDismissed + campaign.repeatAfterCloseMinutes * 60 * 1000;
        if (nextAllowed > now.getTime()) return false;
      }
    }

    return true;
  });

  return { items: filtered.slice(0, 5) };
};

export const marketingApi = {
  async getActiveCampaigns(options: {
    path: string;
    sessionId: string;
    pageSeconds: number;
    courseId?: string;
    subject?: string;
    language?: string;
  }) {
    const query = new URLSearchParams();
    query.set("path", options.path);
    query.set("sessionId", options.sessionId);
    query.set("pageSeconds", String(Math.max(0, Math.floor(options.pageSeconds || 0))));
    if (options.courseId) query.set("courseId", options.courseId);
    if (options.subject) query.set("subject", options.subject);
    if (options.language) query.set("language", options.language);

    try {
      return await parseResponse<{ items: ActiveMarketingCampaign[] }>(
        await fetch(`/api/marketing/active?${query.toString()}`, {
          headers: withStudentHeaders({}),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;
      return resolveActiveCampaignsFromLocal(options);
    }
  },

  async trackEvent(payload: {
    campaignId: number;
    eventType: "shown" | "dismissed" | "clicked";
    sessionId: string;
    pathName: string;
  }) {
    try {
      return await parseResponse<{ ok: boolean }>(
        await fetch("/api/marketing/events", {
          method: "POST",
          headers: withStudentHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        }),
      );
    } catch (error) {
      if (!is404Error(error)) throw error;

      const studentId = getStudentId();
      const events = readLocalEvents();
      events.push({
        ...payload,
        studentId,
        at: new Date().toISOString(),
      });
      writeLocalEvents(events);
      return { ok: true };
    }
  },
};
