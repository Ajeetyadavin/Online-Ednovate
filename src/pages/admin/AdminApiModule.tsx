import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Search } from "lucide-react";

type EndpointDoc = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: "Public" | "Student Token" | "Admin Token";
  module: string;
  description: string;
};

const API_ENDPOINTS: EndpointDoc[] = [
  { method: "POST", path: "/api/auth/student/signup", auth: "Public", module: "Auth", description: "Student signup" },
  { method: "POST", path: "/api/auth/student/login", auth: "Public", module: "Auth", description: "Student login" },
  { method: "GET", path: "/api/auth/student/session-status", auth: "Public", module: "Auth", description: "Check student session" },
  { method: "GET", path: "/api/auth/student/profile", auth: "Student Token", module: "Auth", description: "Get student profile" },
  { method: "PUT", path: "/api/auth/student/profile", auth: "Student Token", module: "Auth", description: "Update student profile" },
  { method: "POST", path: "/api/auth/student/change-password", auth: "Student Token", module: "Auth", description: "Change student password" },

  { method: "GET", path: "/api/auth/student/dashboard", auth: "Student Token", module: "Student Dashboard", description: "Student dashboard data" },
  { method: "GET", path: "/api/auth/student/orders", auth: "Student Token", module: "Student Dashboard", description: "Student order list" },
  { method: "GET", path: "/api/auth/student/course-access", auth: "Student Token", module: "Student Dashboard", description: "Purchased course access list" },
  { method: "PATCH", path: "/api/auth/student/course-access/:courseId/video-quality", auth: "Student Token", module: "Student Dashboard", description: "Set preferred video quality" },
  { method: "POST", path: "/api/auth/student/purchase", auth: "Student Token", module: "Student Dashboard", description: "Create purchase + grant access" },

  { method: "POST", path: "/api/auth/student/video-activity", auth: "Student Token", module: "Lecture", description: "Track lesson view activity" },
  { method: "GET", path: "/api/auth/student/lesson-note", auth: "Student Token", module: "Lecture", description: "Get lesson note" },
  { method: "POST", path: "/api/auth/student/lesson-note", auth: "Student Token", module: "Lecture", description: "Save lesson note" },
  { method: "POST", path: "/api/auth/student/watch-progress", auth: "Student Token", module: "Lecture", description: "Sync watch-time progress" },
  { method: "POST", path: "/api/auth/student/lesson-complete", auth: "Student Token", module: "Lecture", description: "Mark lesson complete" },

  { method: "GET", path: "/api/auth/student/support/courses", auth: "Student Token", module: "Support", description: "List support-enabled courses" },
  { method: "GET", path: "/api/auth/student/support/tickets", auth: "Student Token", module: "Support", description: "List support tickets" },
  { method: "GET", path: "/api/auth/student/support/tickets/:id", auth: "Student Token", module: "Support", description: "Get support ticket detail" },
  { method: "POST", path: "/api/auth/student/support/screenshot", auth: "Student Token", module: "Support", description: "Upload support screenshot" },
  { method: "POST", path: "/api/auth/student/support/tickets", auth: "Student Token", module: "Support", description: "Create support ticket" },
  { method: "POST", path: "/api/auth/student/support/tickets/:id/reply", auth: "Student Token", module: "Support", description: "Reply to support ticket" },

  { method: "GET", path: "/api/categories", auth: "Public", module: "Catalog", description: "Public category list" },
  { method: "GET", path: "/api/course-masters", auth: "Public", module: "Catalog", description: "Public course masters" },
  { method: "GET", path: "/api/courses", auth: "Public", module: "Catalog", description: "Public courses list" },
  { method: "GET", path: "/api/courses/:id/curriculum", auth: "Public", module: "Catalog", description: "Get course curriculum" },
  { method: "GET", path: "/api/faculty", auth: "Public", module: "Catalog", description: "Public faculty list" },
  { method: "GET", path: "/api/homepage", auth: "Public", module: "Catalog", description: "Homepage content" },
  { method: "GET", path: "/api/coupons", auth: "Public", module: "Catalog", description: "Public coupon validation data" },
  { method: "GET", path: "/api/lead-form-settings", auth: "Public", module: "Catalog", description: "Public lead form config" },
  { method: "POST", path: "/api/leads/enquiry", auth: "Public", module: "Catalog", description: "Submit enquiry lead" },

  { method: "GET", path: "/api/marketing/active", auth: "Public", module: "Marketing", description: "Active marketing campaigns" },
  { method: "POST", path: "/api/marketing/events", auth: "Public", module: "Marketing", description: "Track campaign events" },

  { method: "POST", path: "/api/uploads/image", auth: "Admin Token", module: "Uploads", description: "Upload image" },
  { method: "POST", path: "/api/uploads/bunny-video", auth: "Admin Token", module: "Uploads", description: "Upload Bunny video" },
  { method: "POST", path: "/api/bunny/signed-playback", auth: "Public", module: "Bunny", description: "Create signed playback URL" },

  { method: "POST", path: "/api/admin/login", auth: "Public", module: "Admin Auth", description: "Admin login" },
  { method: "GET", path: "/api/admin/session-status", auth: "Public", module: "Admin Auth", description: "Check admin session" },

  { method: "GET", path: "/api/admin/subadmins", auth: "Admin Token", module: "Admin Subadmins", description: "List sub admins" },
  { method: "POST", path: "/api/admin/subadmins", auth: "Admin Token", module: "Admin Subadmins", description: "Create sub admin" },
  { method: "PUT", path: "/api/admin/subadmins/:id", auth: "Admin Token", module: "Admin Subadmins", description: "Update sub admin" },
  { method: "DELETE", path: "/api/admin/subadmins/:id", auth: "Admin Token", module: "Admin Subadmins", description: "Delete sub admin" },
  { method: "GET", path: "/api/admin/audit-logs", auth: "Admin Token", module: "Admin Subadmins", description: "Audit logs" },
  { method: "GET", path: "/api/admin/activity-logs", auth: "Admin Token", module: "Admin Logs", description: "Activity logs" },

  { method: "GET", path: "/api/students", auth: "Admin Token", module: "Admin Students", description: "List students" },
  { method: "POST", path: "/api/students", auth: "Admin Token", module: "Admin Students", description: "Create student" },
  { method: "PUT", path: "/api/students/:id", auth: "Admin Token", module: "Admin Students", description: "Update student" },
  { method: "DELETE", path: "/api/students/:id", auth: "Admin Token", module: "Admin Students", description: "Delete student" },
  { method: "POST", path: "/api/students/bulk-delete", auth: "Admin Token", module: "Admin Students", description: "Bulk delete students" },
  { method: "POST", path: "/api/students/bulk-update", auth: "Admin Token", module: "Admin Students", description: "Bulk update students" },
  { method: "POST", path: "/api/admin/quick-login", auth: "Admin Token", module: "Admin Students", description: "Quick login as student" },
  { method: "GET", path: "/api/students/:id/details", auth: "Admin Token", module: "Admin Students", description: "Student detailed profile" },
  { method: "POST", path: "/api/students/:id/password", auth: "Admin Token", module: "Admin Students", description: "Reset student password" },

  { method: "POST", path: "/api/students/:id/course-access", auth: "Admin Token", module: "Admin Access", description: "Grant course access" },
  { method: "POST", path: "/api/students/:id/course-access/:courseId/extend", auth: "Admin Token", module: "Admin Access", description: "Extend course access" },
  { method: "POST", path: "/api/students/:id/course-access/:courseId/adjust-watch-time", auth: "Admin Token", module: "Admin Access", description: "Adjust watch-time" },
  { method: "PATCH", path: "/api/students/:id/course-access/:courseId", auth: "Admin Token", module: "Admin Access", description: "Update access fields" },
  { method: "DELETE", path: "/api/students/:id/course-access/:courseId", auth: "Admin Token", module: "Admin Access", description: "Remove access" },
  { method: "POST", path: "/api/students/:id/course-access/:courseId/toggle", auth: "Admin Token", module: "Admin Access", description: "Enable or disable access" },
  { method: "POST", path: "/api/students/:id/course-access/:courseId/reset-views", auth: "Admin Token", module: "Admin Access", description: "Reset view counters" },
  { method: "GET", path: "/api/admin/student-access-summary", auth: "Admin Token", module: "Admin Access", description: "Student access summary" },

  { method: "GET", path: "/api/admin/orders", auth: "Admin Token", module: "Admin Orders", description: "List orders" },
  { method: "GET", path: "/api/admin/orders/student/:studentId", auth: "Admin Token", module: "Admin Orders", description: "Orders by student" },
  { method: "PATCH", path: "/api/admin/orders/:id/dispatch", auth: "Admin Token", module: "Admin Orders", description: "Update dispatch status" },
  { method: "DELETE", path: "/api/admin/orders/:id", auth: "Admin Token", module: "Admin Orders", description: "Delete order" },
  { method: "POST", path: "/api/admin/orders/:id/send-invoice", auth: "Admin Token", module: "Admin Orders", description: "Send invoice" },
  { method: "POST", path: "/api/admin/orders/:id/refund", auth: "Admin Token", module: "Admin Orders", description: "Refund order" },

  { method: "GET", path: "/api/admin/technical-support/tickets", auth: "Admin Token", module: "Admin Support", description: "List technical support tickets" },
  { method: "GET", path: "/api/admin/technical-support/tickets/:id", auth: "Admin Token", module: "Admin Support", description: "Ticket detail" },
  { method: "POST", path: "/api/admin/technical-support/tickets/:id/reply", auth: "Admin Token", module: "Admin Support", description: "Reply to ticket" },
  { method: "POST", path: "/api/admin/technical-support/tickets/:id/status", auth: "Admin Token", module: "Admin Support", description: "Update ticket status" },
  { method: "DELETE", path: "/api/admin/technical-support/tickets/:id", auth: "Admin Token", module: "Admin Support", description: "Delete ticket" },

  { method: "GET", path: "/api/admin/marketing/campaigns", auth: "Admin Token", module: "Admin Marketing", description: "List campaigns" },
  { method: "POST", path: "/api/admin/marketing/campaigns", auth: "Admin Token", module: "Admin Marketing", description: "Create campaign" },
  { method: "PUT", path: "/api/admin/marketing/campaigns/:id", auth: "Admin Token", module: "Admin Marketing", description: "Update campaign" },
  { method: "POST", path: "/api/admin/marketing/campaigns/:id/toggle", auth: "Admin Token", module: "Admin Marketing", description: "Toggle campaign active" },
  { method: "DELETE", path: "/api/admin/marketing/campaigns/:id", auth: "Admin Token", module: "Admin Marketing", description: "Delete campaign" },

  { method: "GET", path: "/api/admin/categories", auth: "Admin Token", module: "Admin Masters", description: "List categories" },
  { method: "POST", path: "/api/admin/categories/upsert", auth: "Admin Token", module: "Admin Masters", description: "Create or update category" },
  { method: "POST", path: "/api/admin/categories/:id/toggle", auth: "Admin Token", module: "Admin Masters", description: "Toggle category visibility" },
  { method: "DELETE", path: "/api/admin/categories/:id", auth: "Admin Token", module: "Admin Masters", description: "Delete category" },
  { method: "GET", path: "/api/admin/course-masters", auth: "Admin Token", module: "Admin Masters", description: "Get course masters" },
  { method: "PUT", path: "/api/admin/course-masters", auth: "Admin Token", module: "Admin Masters", description: "Save course masters" },

  { method: "POST", path: "/api/courses/upsert", auth: "Admin Token", module: "Admin Courses", description: "Create or update course" },
  { method: "POST", path: "/api/courses/:id/duplicate", auth: "Admin Token", module: "Admin Courses", description: "Duplicate course" },
  { method: "DELETE", path: "/api/courses/:id", auth: "Admin Token", module: "Admin Courses", description: "Delete course" },
  { method: "POST", path: "/api/courses/:id/curriculum", auth: "Admin Token", module: "Admin Courses", description: "Save course curriculum" },

  { method: "GET", path: "/api/admin/faculty", auth: "Admin Token", module: "Admin Faculty", description: "List faculty" },
  { method: "POST", path: "/api/admin/faculty", auth: "Admin Token", module: "Admin Faculty", description: "Create faculty" },
  { method: "PUT", path: "/api/admin/faculty/:id", auth: "Admin Token", module: "Admin Faculty", description: "Update faculty" },
  { method: "DELETE", path: "/api/admin/faculty/:id", auth: "Admin Token", module: "Admin Faculty", description: "Delete faculty" },

  { method: "PUT", path: "/api/homepage", auth: "Admin Token", module: "Admin Homepage", description: "Save homepage content" },
  { method: "GET", path: "/api/admin/homepage/platform-settings", auth: "Admin Token", module: "Admin Homepage", description: "Homepage platform settings" },
  { method: "PUT", path: "/api/admin/homepage/platform-settings", auth: "Admin Token", module: "Admin Homepage", description: "Save homepage platform settings" },

  { method: "GET", path: "/api/admin/lead-form-settings", auth: "Admin Token", module: "Admin Leads", description: "Lead form settings" },
  { method: "PUT", path: "/api/admin/lead-form-settings", auth: "Admin Token", module: "Admin Leads", description: "Save lead form settings" },
  { method: "GET", path: "/api/admin/leads", auth: "Admin Token", module: "Admin Leads", description: "List leads" },
  { method: "GET", path: "/api/admin/leads/:id", auth: "Admin Token", module: "Admin Leads", description: "Lead detail" },
  { method: "PATCH", path: "/api/admin/leads/:id", auth: "Admin Token", module: "Admin Leads", description: "Update lead" },
  { method: "POST", path: "/api/admin/leads/:id/follow-ups", auth: "Admin Token", module: "Admin Leads", description: "Add follow-up" },

  { method: "GET", path: "/api/admin/bunny/video-duration/:videoId", auth: "Admin Token", module: "Admin Bunny", description: "Get bunny video duration" },
  { method: "GET", path: "/api/admin/bunny/library", auth: "Admin Token", module: "Admin Bunny", description: "List bunny videos and collections" },
  { method: "POST", path: "/api/admin/bunny/collections", auth: "Admin Token", module: "Admin Bunny", description: "Create bunny collection" },
  { method: "PATCH", path: "/api/admin/bunny/collections/:collectionId", auth: "Admin Token", module: "Admin Bunny", description: "Rename bunny collection" },
  { method: "DELETE", path: "/api/admin/bunny/videos/:videoId", auth: "Admin Token", module: "Admin Bunny", description: "Delete bunny video" },
  { method: "PATCH", path: "/api/admin/bunny/videos/:videoId", auth: "Admin Token", module: "Admin Bunny", description: "Update bunny video meta" },

  { method: "GET", path: "/api/platform-settings", auth: "Public", module: "Settings", description: "Public platform settings" },
  { method: "GET", path: "/api/admin/platform-settings", auth: "Admin Token", module: "Settings", description: "Admin platform settings" },
  { method: "PUT", path: "/api/admin/platform-settings", auth: "Admin Token", module: "Settings", description: "Save admin platform settings" },
  { method: "POST", path: "/api/admin/smtp/test", auth: "Admin Token", module: "Settings", description: "Send SMTP test email" },
  { method: "GET", path: "/api/admin/coupons", auth: "Admin Token", module: "Coupons", description: "List coupons" },
  { method: "PUT", path: "/api/admin/coupons", auth: "Admin Token", module: "Coupons", description: "Save coupons" },

  { method: "POST", path: "/api/students/:id/message", auth: "Admin Token", module: "Notifications", description: "Send notification to student" },
  { method: "DELETE", path: "/api/students/:id/notifications/:notificationId", auth: "Admin Token", module: "Notifications", description: "Delete student notification" },
  { method: "POST", path: "/api/students/:id/video-activity", auth: "Admin Token", module: "Notifications", description: "Admin log video activity" },

  { method: "POST", path: "/api/analytics/events", auth: "Public", module: "Analytics", description: "Track analytics event" },
  { method: "GET", path: "/api/analytics/top-content", auth: "Public", module: "Analytics", description: "Top content analytics" },
  { method: "GET", path: "/api/analytics/summary", auth: "Public", module: "Analytics", description: "Analytics summary" },
  { method: "GET", path: "/api/health", auth: "Public", module: "System", description: "Health check" },
  { method: "GET", path: "/api/db-check", auth: "Public", module: "System", description: "Database connectivity check" },
];

const methodClass: Record<EndpointDoc["method"], string> = {
  GET: "bg-blue-100 text-blue-700 border-blue-200",
  POST: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PUT: "bg-amber-100 text-amber-700 border-amber-200",
  PATCH: "bg-purple-100 text-purple-700 border-purple-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
};

const authClass: Record<EndpointDoc["auth"], string> = {
  Public: "bg-slate-100 text-slate-700 border-slate-200",
  "Student Token": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Admin Token": "bg-orange-100 text-orange-700 border-orange-200",
};

const normalizeBase = (value: string) => String(value || "").trim().replace(/\/+$/, "");

const getEnvApiBaseUrl = () => normalizeBase(String(import.meta.env.VITE_API_BASE_URL || ""));

const getDefaultApiBaseUrl = () => {
  const envBaseUrl = getEnvApiBaseUrl();
  if (envBaseUrl) return envBaseUrl;

  if (typeof window === "undefined") return "";
  const { protocol, hostname, host, port } = window.location;

  // In local Vite dev, backend runs on 4000.
  if (port === "8080") return `${protocol}//${hostname}:4000`;
  return `${protocol}//${host}`;
};

const getApiBaseCandidates = () => {
  if (typeof window === "undefined") return [];

  const envBaseUrl = getEnvApiBaseUrl();
  if (envBaseUrl) return [envBaseUrl];

  const { protocol, hostname, host, port } = window.location;
  const candidates = new Set<string>();

  if (port === "8080") {
    candidates.add(`${protocol}//${hostname}:4000`);
  }

  const hostParts = hostname.split(".").filter(Boolean);
  const looksLikeDomain = hostParts.length >= 2 && !/^localhost$/i.test(hostname) && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  if (looksLikeDomain) {
    const parentDomain = hostParts.length > 2 ? hostParts.slice(1).join(".") : hostname;
    candidates.add(`${protocol}//api.${parentDomain}`);
    candidates.add(`${protocol}//backend.${parentDomain}`);

    if (hostParts[0].toLowerCase() === "www") {
      const root = hostParts.slice(1).join(".");
      candidates.add(`${protocol}//api.${root}`);
      candidates.add(`${protocol}//backend.${root}`);
    }
  }

  candidates.add(`${protocol}//${host}`);
  return Array.from(candidates).map(normalizeBase).filter(Boolean);
};

const detectApiBaseUrl = async () => {
  const candidates = getApiBaseCandidates();
  for (const base of candidates) {
    try {
      const response = await fetch(`${base}/api/health`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) return base;
    } catch {
      // ignore probe failures and continue trying next candidate
    }
  }
  return "";
};

const buildFullUrl = (baseUrl: string, path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedBase = normalizeBase(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
};

export default function AdminApiModule() {
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<"ALL" | EndpointDoc["method"]>("ALL");
  const [apiBaseUrl, setApiBaseUrl] = useState(getDefaultApiBaseUrl);
  const [detectingBaseUrl, setDetectingBaseUrl] = useState(false);

  useEffect(() => {
    // Explicit env config should always win over probing.
    if (getEnvApiBaseUrl()) return;

    let cancelled = false;
    const run = async () => {
      setDetectingBaseUrl(true);
      const detected = await detectApiBaseUrl();
      if (!cancelled && detected) setApiBaseUrl(detected);
      if (!cancelled) setDetectingBaseUrl(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return API_ENDPOINTS.filter((item) => {
      const methodOk = methodFilter === "ALL" || item.method === methodFilter;
      if (!methodOk) return false;
      if (!q) return true;
      return (
        item.path.toLowerCase().includes(q)
        || item.module.toLowerCase().includes(q)
        || item.description.toLowerCase().includes(q)
        || item.auth.toLowerCase().includes(q)
      );
    });
  }, [query, methodFilter]);

  const modulesCount = useMemo(() => new Set(API_ENDPOINTS.map((item) => item.module)).size, []);

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(buildFullUrl(apiBaseUrl, path));
    } catch {
      // ignore clipboard errors on unsupported browsers
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-white">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-900">API Module For Flutter</CardTitle>
          <CardDescription>
            Key endpoints from login to lecture tracking are listed in one place. Map these paths with your base URL in the Flutter network layer.
          </CardDescription>
          <p className="text-xs text-slate-500">
            Copy uses base URL: <span className="font-mono">{apiBaseUrl || "(not detected)"}</span>
            {detectingBaseUrl ? " (detecting...)" : ""}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Total Endpoints</p>
              <p className="text-xl font-bold text-slate-900">{API_ENDPOINTS.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Modules Covered</p>
              <p className="text-xl font-bold text-slate-900">{modulesCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Visible Rows</p>
              <p className="text-xl font-bold text-slate-900">{filtered.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by path, module, auth, or description"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              {(["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((method) => (
                <Button
                  key={method}
                  type="button"
                  variant={methodFilter === method ? "default" : "outline"}
                  className="h-9 px-3 text-xs"
                  onClick={() => setMethodFilter(method)}
                >
                  {method}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endpoint Catalog</CardTitle>
          <CardDescription>Tip: Verify the full flow from app open to login, dashboard, purchase, lecture, and watch progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.map((item) => (
            <div key={`${item.method}-${item.path}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={methodClass[item.method]}>{item.method}</Badge>
                <code className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.path}</code>
                <Badge variant="outline" className={authClass[item.auth]}>{item.auth}</Badge>
                <Badge variant="outline">{item.module}</Badge>
                <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => void copyPath(item.path)}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy URL
                </Button>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No endpoint found for current filter/search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
