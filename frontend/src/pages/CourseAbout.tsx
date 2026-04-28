import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  IndianRupee,
  Layers,
  Lock,
  Package,
  PlayCircle,
  RefreshCw,
  Shield,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LoginModal from "@/components/LoginModal";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import {
  getStudentCourseAccessApi,
  getStudentOrdersApi,
  type StudentCourseAccessSelf,
  type StudentOrderLine,
} from "@/services/authApi";
import { getCourseAccessIssueLabel, getCourseAccessIssueMessage, isCourseAccessActive } from "@/lib/studentAccess";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";

const fmt = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtFull = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/* ── Circular SVG progress ── */
function CircularProgress({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={88} height={88} viewBox="0 0 88 88" className="-rotate-90">
        <circle cx={44} cy={44} r={r} stroke="#e2e8f0" strokeWidth={8} fill="none" />
        <circle
          cx={44} cy={44} r={r}
          stroke="url(#pg)" strokeWidth={8} fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <defs>
          <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-sm font-extrabold text-slate-800">{pct}%</span>
    </div>
  );
}

/* ── dispatch status badge ── */
const dispatchColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  shipped: "bg-blue-100 text-blue-700 border-blue-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};
function DispatchBadge({ status }: { status: string }) {
  const cls = dispatchColors[status.toLowerCase()] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${cls}`}>
      <Truck className="h-3 w-3" />
      {status || "—"}
    </span>
  );
}

export default function CourseAbout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, logout } = useAuth();
  const { courses, getCurriculumForCourse } = usePlatformData();
  const { purchasedCourses } = useCart();

  const [accessItem, setAccessItem] = useState<StudentCourseAccessSelf | null>(null);
  const [orderLines, setOrderLines] = useState<StudentOrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const hasStudentSessionFailure = (message: string) => /session|token|authoriz|logged out|expired/i.test(message);

  const PLAY_STORE_URL = "https://play.google.com/store";
  const APP_STORE_URL = "https://www.apple.com/app-store/";
  const [openChapterIds, setOpenChapterIds] = useState<Set<string>>(new Set());

  const course = useMemo(() =>
    purchasedCourses.find((c) => c.id === id) || courses.find((c) => c.id === id),
    [courses, id, purchasedCourses]
  );

  const curriculum = useMemo(() =>
    course ? getCurriculumForCourse(course.id, course.title) : [],
    [course, getCurriculumForCourse]
  );

  const lessonCount = useMemo(() => curriculum.reduce((s, ch) => s + ch.lessons.length, 0), [curriculum]);
  const completedCount = useMemo(() => curriculum.reduce((s, ch) => s + ch.lessons.filter((l) => l.completed).length, 0), [curriculum]);

  useEffect(() => {
    if (!isLoggedIn || !id) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const [a, o] = await Promise.all([getStudentCourseAccessApi(), getStudentOrdersApi(id)]);
      if ((!a.ok && hasStudentSessionFailure(a.message || "")) || (!o.ok && hasStudentSessionFailure(o.message || ""))) {
        void logout();
        setLoading(false);
        return;
      }
      if (a.ok && a.data) setAccessItem(a.data.find((x) => x.courseId === id) || null);
      if (o.ok && o.data) setOrderLines(Array.isArray(o.data.lines) ? o.data.lines : []);
      setLoading(false);
    };
    void load();
  }, [id, isLoggedIn, logout]);

  /* ── open first chapter by default ── */
  useEffect(() => {
    if (curriculum.length > 0) setOpenChapterIds(new Set([curriculum[0].id]));
  }, [curriculum]);

  /* ── not logged in ── */
  if (!isLoggedIn) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Login Required</h2>
        <p className="mt-2 mb-6 text-sm text-slate-500">Please login or sign up to view your course details.</p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { setSignupMode(false); setLoginOpen(true); }}>Login</Button>
          <Button className="flex-1" onClick={() => { setSignupMode(true); setLoginOpen(true); }}>Sign Up</Button>
        </div>
        <Button variant="ghost" className="mt-3 text-sm text-slate-500" onClick={() => navigate("/dashboard")}>← Back to Dashboard</Button>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} isSignup={signupMode} onToggleMode={() => setSignupMode((p) => !p)} />
      </div>
    </div>
  );

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <h2 className="text-xl font-bold text-slate-900">Course Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">This course isn't in your dashboard yet.</p>
        <Button className="mt-5" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    </div>
  );

  const totalViews = Math.max(0, Number(accessItem?.totalViews || 0));
  const usedViews = Math.max(0, Number(accessItem?.usedViews || 0));
  const remainingViews = Math.max(0, Number(accessItem?.remainingViews ?? (totalViews - usedViews)));
  const isUnlimitedViews = accessItem?.isUnlimitedViews === true;
  const watchRemainingSeconds = Math.max(0,
    Number(accessItem?.remainingWatchSeconds ?? ((accessItem?.allowedWatchSeconds || 0) - (accessItem?.usedWatchSeconds || 0)))
  );
  const watchRemainingHours = (watchRemainingSeconds / 3600).toFixed(1);
  const lessonProgressPct = lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0;
  const allowedWatchSeconds = Math.max(0, Number(accessItem?.allowedWatchSeconds || 0));
  const usedWatchSeconds = Math.max(0, Number(accessItem?.usedWatchSeconds || 0));
  const watchProgressPct = allowedWatchSeconds > 0
    ? Math.max(0, Math.min(100, Math.round((usedWatchSeconds / allowedWatchSeconds) * 100)))
    : 0;
  const progressPct = Math.max(lessonProgressPct, watchProgressPct);
  const purchaseStamp = accessItem?.createdAt || accessItem?.purchaseDate || ("purchasedOn" in course ? course.purchasedOn : undefined);
  const latestOrder = orderLines[0] || null;
  const isActive = isCourseAccessActive(accessItem);
  const accessIssueLabel = getCourseAccessIssueLabel(accessItem);
  const accessIssueMessage = getCourseAccessIssueMessage(accessItem);
  const thumbnail = resolveUploadAssetUrl(course.thumbnail || course.image || "", "/placeholder.svg");
  const expiresAt = accessItem?.expiresAt;
  const isWebPlayBlocked = course.webPlayEnabled !== true;

  const handleContinueLearning = () => {
    if (isWebPlayBlocked) {
      setInstallPromptOpen(true);
      return;
    }
    navigate(`/learn/${course.id}`);
  };

  const downloadCourseInvoice = () => {
    if (!latestOrder) return;
    const taxableAmount = Math.max(0, Number(latestOrder.amount || 0));
    const taxAmount = 0;
    const totalAmount = taxableAmount + taxAmount;
    const invoiceDate = latestOrder.orderDate ? new Date(latestOrder.orderDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");
    const invoiceNo = String(latestOrder.orderId || `INV-${latestOrder.id}`);
    const billingAddress = [
      latestOrder.shippingAddressLine1,
      latestOrder.shippingAddressLine2,
      latestOrder.shippingCity,
      latestOrder.shippingState,
      latestOrder.shippingCountry,
      latestOrder.shippingPincode,
    ].map((item) => String(item || "").trim()).filter(Boolean).join(", ") || "Address unavailable";
    const details = [
      latestOrder.itemType ? `Type: ${latestOrder.itemType}` : "",
      latestOrder.modeLabel ? `Mode: ${latestOrder.modeLabel}` : "",
      latestOrder.bookLabel ? `Book: ${latestOrder.bookLabel}` : "",
    ].filter(Boolean).join(" | ");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice-${invoiceNo}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { margin: 0; padding: 0; }
  </style>
</head>
<body style="font-family:Arial,sans-serif;background:#e5e7eb;padding:24px;color:#111827;">
  <div style="width:210mm;min-height:297mm;box-sizing:border-box;margin:0 auto;background:#ffffff;border:1px solid #9ca3af;box-shadow:0 4px 14px rgba(15,23,42,.08);padding:12mm;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div>
        <img src="${window.location.origin}/ednovate-logo.png" alt="Ednovate" style="height:46px;object-fit:contain;display:block;margin-bottom:8px;" />
        <div style="font-size:18px;font-weight:800;color:#1f3c88;letter-spacing:.06em;">Ednovate</div>
        <div style="font-size:12px;color:#4b5563;margin-top:4px;max-width:340px;line-height:1.4;">4th floor, Ajanta Square Building, near Borivali court, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092</div>
      </div>
      <div style="text-align:right;min-width:250px;">
        <div style="font-size:34px;font-weight:800;color:#4f7dbd;letter-spacing:.04em;line-height:1;">TAX INVOICE</div>
        <table style="margin-top:14px;width:100%;border-collapse:collapse;font-size:12px;">
          <tr><th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">INVOICE #</th><th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">DATE</th></tr>
          <tr><td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceNo}</td><td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceDate}</td></tr>
        </table>
      </div>
    </div>
    <div style="margin-top:22px;display:inline-block;min-width:340px;">
      <div style="border:1px solid #9ca3af;background:#d1d5db;padding:4px 10px;font-size:12px;font-weight:700;">BILL TO</div>
      <div style="padding:8px 2px 0 2px;font-size:13px;line-height:1.45;">
        <div style="font-weight:700;">${latestOrder.customerName || "Student"}</div>
        <div>${latestOrder.customerEmail || "-"}</div>
        <div>${latestOrder.customerPhone || "-"}</div>
        <div>${billingAddress}</div>
        <div style="margin-top:4px;"><strong>Payment:</strong> ${latestOrder.paymentMethod || "Online"}</div>
      </div>
    </div>
    <div style="margin-top:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #9ca3af;">
        <thead><tr style="background:#d1d5db;text-align:left;"><th style="padding:9px 10px;border-right:1px solid #9ca3af;">DESCRIPTION</th><th style="padding:9px 10px;text-align:right;">AMOUNT</th></tr></thead>
        <tbody>
          <tr>
            <td style="padding:10px;border-right:1px solid #9ca3af;border-bottom:1px solid #e5e7eb;vertical-align:top;"><div style="font-weight:700;">${latestOrder.courseTitle || course.title}</div><div style="color:#4b5563;font-size:12px;margin-top:4px;">${details || "Course purchase"}</div></td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;vertical-align:top;">₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          <tr><td style="height:140px;border-right:1px solid #9ca3af;"></td><td></td></tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:10px;border-right:1px solid #9ca3af;font-style:italic;font-size:14px;color:#1f3c88;">Thank you for your business!</td>
            <td style="padding:10px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="color:#4b5563;">Base Price</span><strong>₹${taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="color:#4b5563;">+ GST</span><strong>₹${taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div style="border-top:1px solid #9ca3af;padding-top:8px;display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:800;color:#111827;">Grand Total</span><span style="font-weight:800;font-size:22px;">₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:12px;color:#4b5563;line-height:1.45;">This is a computer-generated invoice. Signature is not required.</div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoiceNo}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const toggleChapter = (id: string) =>
    setOpenChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-24 font-['Inter'] md:pb-12">
      {/* ── sticky top bar ── */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </button>
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`} />
            <p className="truncate text-sm font-semibold text-slate-800">{course.title}</p>
          </div>
          <Button size="sm" className="h-8 shrink-0 gap-1.5 rounded-xl bg-[#E74623] px-4 text-xs font-semibold text-white hover:bg-[#d13a1a]" onClick={handleContinueLearning}>
            <PlayCircle className="h-3.5 w-3.5" /> Continue
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-3 py-4 space-y-4 sm:px-4 sm:py-6 sm:space-y-5">

        {/* ── Hero card ── */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
          {/* gradient strip */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#264897] via-[#E74623] to-[#f59e0b]" />
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-6 sm:p-5">
            {/* Thumbnail */}
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-36 sm:w-56">
              <img src={thumbnail} alt={course.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              {course.isCombo && (
                <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Layers className="h-3 w-3" /> COMBO
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary uppercase tracking-wide">
                  {course.category}
                </span>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : accessIssueLabel === "Disabled" ? "bg-slate-100 text-slate-700 border-slate-200" : accessIssueLabel === "Watchtime Over" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                  <Shield className="h-3 w-3" />
                  {accessIssueLabel}
                </span>
              </div>
              <h1 className="text-lg font-black leading-snug text-slate-900 sm:text-xl">{course.title}</h1>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>by <span className="font-semibold text-slate-700">{course.professor}</span></span>
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-xs text-slate-500">
                {course.language && <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{course.language}</span>}
                {course.hours > 0 && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{course.hours}h content</span>}
                {course.lectures > 0 && <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{course.lectures} lectures</span>}
              </div>
            </div>

            {/* Circular progress */}
            <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
              <CircularProgress pct={progressPct} />
              <p className="text-[11px] font-semibold text-slate-500">Progress</p>
              <p className="text-[10px] text-slate-400">{completedCount}/{lessonCount} lessons</p>
            </div>
          </div>
        </div>

        {/* ── Stat cards row ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Bought on */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
              <Calendar className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Purchased</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{fmt(purchaseStamp)}</p>
          </div>
          {/* Expires */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50">
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expires</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{isUnlimitedViews ? "Unlimited" : (expiresAt ? fmt(expiresAt) : "No expiry")}</p>
          </div>
          {/* Views */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
              <Eye className="h-4 w-4 text-sky-500" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Views</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {isUnlimitedViews ? "Unlimited" : `${remainingViews} / ${totalViews}`}
            </p>
          </div>
          {/* Watch time */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
              <RefreshCw className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Watch Left</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {isUnlimitedViews ? "Unlimited" : `${watchRemainingHours}h`}
            </p>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">Course Progress</p>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{progressPct}%</span>
          </div>
          {!isActive ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{accessIssueMessage}</p>
          ) : null}
          <Progress value={progressPct} className="h-2.5 rounded-full bg-slate-100" />
          <p className="mt-2 text-xs text-slate-400">{completedCount} of {lessonCount} lessons completed</p>
        </div>

        {/* ── Curriculum ── */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <BookOpen className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-slate-800">Course Content</p>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{curriculum.length} chapters</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
            </div>
          ) : curriculum.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No lessons added yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {curriculum.map((ch, ci) => {
                const isOpen = openChapterIds.has(ch.id);
                const chCompleted = ch.lessons.filter((l) => l.completed).length;
                return (
                  <div key={ch.id}>
                    <button
                      type="button"
                      onClick={() => toggleChapter(ch.id)}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {ci + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 line-clamp-1">{ch.title}</p>
                        <p className="text-[11px] text-slate-400">{chCompleted}/{ch.lessons.length} completed</p>
                      </div>
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="bg-slate-50/60 border-t border-slate-100 px-5 py-2 space-y-1.5">
                        {ch.lessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                            {lesson.completed
                              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                            }
                            <p className={`flex-1 min-w-0 text-xs truncate ${lesson.completed ? "text-slate-500 line-through" : "text-slate-700"}`}>
                              {lesson.title}
                            </p>
                            <span className="shrink-0 text-[11px] font-medium text-slate-400">{lesson.duration || "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Order & dispatch ── */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Package className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-slate-800">Order & Dispatch Info</p>
          </div>
          <div className="px-5 py-4">
            {latestOrder ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order ID</p>
                  <p className="text-sm font-semibold text-slate-700">{latestOrder.orderId}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order Date</p>
                  <p className="text-sm font-semibold text-slate-700">{fmtFull(latestOrder.orderDate || latestOrder.createdAt)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</p>
                  <p className="inline-flex items-center text-sm font-bold text-slate-800"><IndianRupee className="h-3.5 w-3.5 text-[#E74623]" />{Number(latestOrder.amount || 0).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dispatch Status</p>
                  <DispatchBadge status={latestOrder.dispatchStatus || "pending"} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracking ID</p>
                  <p className="text-sm font-semibold text-slate-700">{latestOrder.trackingId || "Not assigned yet"}</p>
                </div>
                {latestOrder.dispatchNote && (
                  <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Note</p>
                    <p className="mt-1 text-xs text-amber-800">{latestOrder.dispatchNote}</p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Button variant="outline" className="h-10 rounded-xl border-slate-200 text-xs font-bold" onClick={downloadCourseInvoice}>
                    <Download className="mr-2 h-4 w-4" /> Download Invoice
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Truck className="mb-2 h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">Order details will appear here after purchase sync.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <Button className="gap-2 rounded-xl bg-[#E74623] px-6 font-semibold text-white hover:bg-[#d13a1a]" onClick={handleContinueLearning}>
            <PlayCircle className="h-4 w-4" /> Continue Learning
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl px-5 font-semibold border-slate-200" onClick={() => navigate(`/course/${course.id}`)}>
            View Course Page
          </Button>
        </div>
      </div>

      <Dialog open={installPromptOpen} onOpenChange={setInstallPromptOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Install App To Continue</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">WebPlay is OFF for this course. Video will not play on website. Install the app to continue.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" className="rounded-xl" onClick={() => window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer")}>
              Play Store
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => window.open(APP_STORE_URL, "_blank", "noopener,noreferrer")}>
              App Store
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
