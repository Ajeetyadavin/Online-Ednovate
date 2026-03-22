import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { adminApi, type MarketingCampaign, type MarketingCampaignPayload } from "@/services/adminApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Megaphone, Plus, RefreshCw, Trash2, Edit2, XCircle, Search, Globe,
  Clock, Users, BookOpen, CheckCircle2, AlertCircle, Loader2, X, Calendar,
  BarChart3, Zap,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────────── */
const emptyForm: MarketingCampaignPayload = {
  title: "", message: "", contentType: "banner", mediaUrl: "", ctaText: "", ctaUrl: "",
  pageScope: "global", pagePaths: [], targetStudentIds: [], targetCourseIds: [],
  targetSubjects: [], targetLanguages: [], startsAt: "", endsAt: "",
  showDelaySeconds: 0, repeatAfterCloseMinutes: 0, maxImpressionsPerUser: 0,
  isDismissible: true, isEnabled: true,
};

const toCsv = (list: string[]) => list.join(", ");
const fromCsv = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);
const toDatetimeLocal = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
};

const PAGE_SUGGESTIONS = ["/", "/packages", "/dashboard", "/contact-us", "/learn/*", "/course/*", "/collections/*"];

type TargetLookup = { students: Array<{ id: string; name: string }>; courses: Array<{ id: string; title: string; subject: string }>; subjects: string[] };
type FormTab = "content" | "targeting" | "schedule";

const TYPE_STYLE: Record<string, { cls: string; label: string }> = {
  banner: { cls: "bg-blue-100 text-blue-700 border-blue-200",   label: "Banner" },
  text:   { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Text" },
  alert:  { cls: "bg-amber-100 text-amber-700 border-amber-200", label: "Alert" },
  video:  { cls: "bg-purple-100 text-purple-700 border-purple-200", label: "Video" },
  pdf:    { cls: "bg-rose-100 text-rose-700 border-rose-200",   label: "PDF" },
};

/* ─── Tag chip ───────────────────────────────────────────────── */
const TagChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
    {label}
    <button type="button" onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
  </span>
);

/* ─── Field label ─────────────────────────────────────────────── */
const FL = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
);

const fieldCls = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";
const selectCls = "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40";

/* ─── Main ─────────────────────────────────────────────────────── */
export default function AdminMarketing() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("marketing", "create");
  const canEdit   = hasPermission("marketing", "edit");
  const canDelete = hasPermission("marketing", "delete");

  const [items, setItems]         = useState<MarketingCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState<"all" | "enabled" | "disabled">("all");
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [formTab, setFormTab]             = useState<FormTab>("content");

  const [form, setForm] = useState(emptyForm);
  const sf = (u: Partial<MarketingCampaignPayload>) => setForm((p) => ({ ...p, ...u }));

  const [csvFields, setCsvFields] = useState({ pagePaths: "", targetStudentIds: "", targetCourseIds: "", targetSubjects: "", targetLanguages: "" });
  const [targetInput, setTargetInput] = useState({ pagePath: "", student: "", course: "" });
  const [targetLookup, setTargetLookup] = useState<TargetLookup>({ students: [], courses: [], subjects: [] });

  const readCsv = (k: keyof typeof csvFields) => fromCsv(csvFields[k]);
  const writeCsv = (k: keyof typeof csvFields, vals: string[]) =>
    setCsvFields((p) => ({ ...p, [k]: toCsv(Array.from(new Set(vals.map((x) => x.trim()).filter(Boolean)))) }));
  const addCsv = (k: keyof typeof csvFields, v: string) => { if (v.trim()) writeCsv(k, [...readCsv(k), v.trim()]); };
  const removeCsv = (k: keyof typeof csvFields, v: string) => writeCsv(k, readCsv(k).filter((x) => x !== v));

  const openCreate = () => {
    setEditingId(null); setForm(emptyForm);
    setCsvFields({ pagePaths: "", targetStudentIds: "", targetCourseIds: "", targetSubjects: "", targetLanguages: "" });
    setTargetInput({ pagePath: "", student: "", course: "" });
    setFormTab("content"); setError(""); setSuccess(""); setDialogOpen(true);
  };

  const startEdit = (item: MarketingCampaign) => {
    setEditingId(item.id);
    setForm({ title: item.title, message: item.message || "", contentType: item.contentType,
      mediaUrl: item.mediaUrl || "", ctaText: item.ctaText || "", ctaUrl: item.ctaUrl || "",
      pageScope: item.pageScope, pagePaths: item.pagePaths || [], targetStudentIds: item.targetStudentIds || [],
      targetCourseIds: item.targetCourseIds || [], targetSubjects: item.targetSubjects || [],
      targetLanguages: item.targetLanguages || [], startsAt: toDatetimeLocal(item.startsAt),
      endsAt: toDatetimeLocal(item.endsAt), showDelaySeconds: item.showDelaySeconds || 0,
      repeatAfterCloseMinutes: item.repeatAfterCloseMinutes || 0, maxImpressionsPerUser: item.maxImpressionsPerUser || 0,
      isDismissible: item.isDismissible !== false, isEnabled: item.isEnabled !== false,
    });
    setCsvFields({ pagePaths: toCsv(item.pagePaths || []), targetStudentIds: toCsv(item.targetStudentIds || []),
      targetCourseIds: toCsv(item.targetCourseIds || []), targetSubjects: toCsv(item.targetSubjects || []),
      targetLanguages: toCsv(item.targetLanguages || []),
    });
    setTargetInput({ pagePath: "", student: "", course: "" });
    setFormTab("content"); setError(""); setSuccess(""); setDialogOpen(true);
  };

  const loadTargetLookup = async () => {
    try {
      const [cr, sr] = await Promise.all([adminApi.getCourses(), adminApi.listStudents()]);
      const courses = (cr.courses || []).map((r: Record<string, unknown>) => ({
        id: String(r.id || ""), title: String(r.title || ""), subject: String(r.subcategory || r.category || "").trim()
      })).filter((c) => c.id && c.title);
      const students = (sr.students || []).map((s: Record<string, unknown>) => ({ id: String(s.id || ""), name: String(s.name || "") })).filter((s) => s.id);
      const subjects = Array.from(new Set(courses.map((c) => c.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      setTargetLookup({ students, courses, subjects });
    } catch { /* optional */ }
  };

  const loadCampaigns = async () => {
    try {
      setIsLoading(true);
      const r = await adminApi.listMarketingCampaigns({ search, status: statusFilter });
      setItems(r.items || []); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load campaigns"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void loadCampaigns(); void loadTargetLookup(); }, []);

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Campaign title is required"); return; }
    const payload: MarketingCampaignPayload = {
      ...form, title: form.title.trim(), message: form.message.trim(),
      mediaUrl: (form.mediaUrl || "").trim(), ctaText: (form.ctaText || "").trim(), ctaUrl: (form.ctaUrl || "").trim(),
      pagePaths: fromCsv(csvFields.pagePaths), targetStudentIds: fromCsv(csvFields.targetStudentIds),
      targetCourseIds: fromCsv(csvFields.targetCourseIds),
      targetSubjects: fromCsv(csvFields.targetSubjects).map((x) => x.toLowerCase()),
      targetLanguages: fromCsv(csvFields.targetLanguages).map((x) => x.toLowerCase()),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    try {
      setIsSaving(true);
      if (editingId) { await adminApi.updateMarketingCampaign(editingId, payload); setSuccess("Campaign updated successfully."); }
      else { await adminApi.createMarketingCampaign(payload); setSuccess("Campaign created successfully."); }
      setError(""); setDialogOpen(false); await loadCampaigns();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save campaign"); }
    finally { setIsSaving(false); }
  };

  const toggleCampaign = async (item: MarketingCampaign) => {
    if (!canEdit) return;
    try { await adminApi.toggleMarketingCampaign(item.id, !item.isEnabled); await loadCampaigns(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to toggle campaign"); }
  };

  const removeCampaign = async (item: MarketingCampaign) => {
    if (!canDelete || !window.confirm(`Delete campaign "${item.title}"?`)) return;
    try { await adminApi.deleteMarketingCampaign(item.id); setSuccess("Campaign deleted."); await loadCampaigns(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to delete campaign"); }
  };

  const activeCount = useMemo(() => items.filter((x) => x.isEnabled).length, [items]);

  const formTabs: { key: FormTab; label: string }[] = [
    { key: "content",   label: "Content & Type" },
    { key: "targeting", label: "Audience" },
    { key: "schedule",  label: "Schedule" },
  ];

  return (
    <div className="space-y-5 font-['Inter']">

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Marketing Campaigns</h1>
            <p className="text-xs text-slate-400">Manage in-app banners, alerts, and announcements</p>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex gap-2 ml-2">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <BarChart3 className="h-3.5 w-3.5" /> Total: {items.length}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Zap className="h-3.5 w-3.5" /> Active: {activeCount}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            <XCircle className="h-3.5 w-3.5" /> Paused: {Math.max(0, items.length - activeCount)}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input className="h-9 w-52 rounded-xl border-slate-200 pl-9 text-xs" placeholder="Search campaigns..." value={search}
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadCampaigns(); }} />
          </div>
          <select className={selectCls + " w-36"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "enabled" | "disabled")}>
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-slate-200 text-xs" onClick={() => void loadCampaigns()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </Button>
          {(canCreate || canEdit) && (
            <Button size="sm" className="h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> New Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button type="button" className="ml-auto opacity-60 hover:opacity-100" onClick={() => setError("")}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
          <button type="button" className="ml-auto opacity-60 hover:opacity-100" onClick={() => setSuccess("")}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ─── Campaign List ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* List header row */}
        <div className="grid grid-cols-[2fr_auto_auto_auto_auto] items-center gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Campaign</span>
          <span>Type</span>
          <span>Audience</span>
          <span>Schedule</span>
          <span>Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary/30" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Megaphone className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No campaigns found</p>
            <p className="mt-1 text-xs text-slate-400">Click "New Campaign" to create your first one</p>
            {(canCreate || canEdit) && (
              <Button size="sm" className="mt-4 gap-1.5 rounded-xl text-xs" onClick={openCreate}><Plus className="h-3.5 w-3.5" />Create Campaign</Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const typeInfo = TYPE_STYLE[item.contentType] || TYPE_STYLE.text;
              return (
                <div key={item.id} className="grid grid-cols-[2fr_auto_auto_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/70">
                  {/* Campaign name + status */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.isEnabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {item.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Globe className="h-3 w-3" />{item.pageScope === "global" ? "All pages" : "Specific pages"}
                      </span>
                    </div>
                    <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                    {item.message && <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{item.message}</p>}
                    {/* Sub-meta */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.showDelaySeconds > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          <Clock className="h-2.5 w-2.5" />Delay {item.showDelaySeconds}s
                        </span>
                      )}
                      {item.repeatAfterCloseMinutes > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          <RefreshCw className="h-2.5 w-2.5" />Repeat {item.repeatAfterCloseMinutes}m
                        </span>
                      )}
                      {item.maxImpressionsPerUser > 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          Max {item.maxImpressionsPerUser}×/user
                        </span>
                      )}
                      {item.isDismissible && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500">Dismissible</span>
                      )}
                    </div>
                  </div>

                  {/* Type badge */}
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${typeInfo.cls}`}>{typeInfo.label}</span>

                  {/* Audience */}
                  <div className="flex flex-col gap-1 text-[11px] text-slate-500 min-w-[80px]">
                    {item.targetStudentIds.length > 0
                      ? <span className="flex items-center gap-1 text-blue-600 font-semibold"><Users className="h-3 w-3" />{item.targetStudentIds.length} students</span>
                      : <span className="flex items-center gap-1"><Users className="h-3 w-3" />All students</span>}
                    {item.targetCourseIds.length > 0
                      ? <span className="flex items-center gap-1 text-purple-600 font-semibold"><BookOpen className="h-3 w-3" />{item.targetCourseIds.length} courses</span>
                      : <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />All courses</span>}
                  </div>

                  {/* Schedule */}
                  <div className="flex flex-col gap-1 text-[11px] text-slate-500 min-w-[100px]">
                    {item.startsAt ? (
                      <>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(item.startsAt)}</span>
                        <span className="text-slate-400">→ {fmtDate(item.endsAt) || "No end"}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">No schedule</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => void toggleCampaign(item)} disabled={!canEdit} title={item.isEnabled ? "Disable" : "Enable"}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${item.isEnabled ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
                      {item.isEnabled ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => startEdit(item)} disabled={!canEdit} title="Edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => void removeCampaign(item)} disabled={!canDelete} title="Delete"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create / Edit Dialog ──────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingId ? "Edit Campaign" : "Create New Campaign"}
            </DialogTitle>
          </DialogHeader>

          {/* Error inside dialog */}
          {error && (
            <div className="shrink-0 flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-6 py-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
            </div>
          )}

          {/* Tab bar */}
          <div className="shrink-0 flex border-b border-slate-100">
            {formTabs.map((tab, i) => (
              <button key={tab.key} type="button" onClick={() => setFormTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-[11px] font-semibold transition-colors ${formTab === tab.key ? "border-b-2 border-primary text-primary" : "text-slate-400 hover:text-slate-700"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${formTab === tab.key ? "bg-primary text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── CONTENT TAB ── */}
            {formTab === "content" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <FL>Campaign Title *</FL>
                  <Input className={fieldCls} placeholder="e.g., Summer Sale — 40% Off All Courses" value={form.title} onChange={(e) => sf({ title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <FL>Message (optional)</FL>
                  <textarea className="h-20 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Short message visible to students..." rows={3} value={form.message} onChange={(e) => sf({ message: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FL>Content Type</FL>
                    <select className={selectCls} value={form.contentType} onChange={(e) => sf({ contentType: e.target.value as MarketingCampaignPayload["contentType"] })}>
                      {Object.entries(TYPE_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <FL>Page Scope</FL>
                    <select className={selectCls} value={form.pageScope} onChange={(e) => sf({ pageScope: e.target.value as MarketingCampaignPayload["pageScope"] })}>
                      <option value="global">Global — all pages</option>
                      <option value="specific">Specific pages only</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <FL>Media URL (image / video / pdf link)</FL>
                  <Input className={fieldCls} placeholder="https://cdn.example.com/banner.jpg" value={form.mediaUrl || ""} onChange={(e) => sf({ mediaUrl: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FL>CTA Button Text</FL>
                    <Input className={fieldCls} placeholder="Enroll Now" value={form.ctaText || ""} onChange={(e) => sf({ ctaText: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <FL>CTA Link URL</FL>
                    <Input className={fieldCls} placeholder="/packages" value={form.ctaUrl || ""} onChange={(e) => sf({ ctaUrl: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Dismissible</p>
                      <p className="text-[10px] text-slate-400">Student can close it</p>
                    </div>
                    <Switch checked={form.isDismissible} onCheckedChange={(v) => sf({ isDismissible: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Enabled</p>
                      <p className="text-[10px] text-slate-400">Show to students</p>
                    </div>
                    <Switch checked={form.isEnabled} onCheckedChange={(v) => sf({ isEnabled: v })} />
                  </div>
                </div>
              </div>
            )}

            {/* ── AUDIENCE TAB ── */}
            {formTab === "targeting" && (
              <div className="space-y-5">
                {/* Page Paths */}
                <div className="space-y-2">
                  <FL>Page Paths (supports * wildcard)</FL>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input list="mkt-pages" className={fieldCls} placeholder="e.g., /packages" value={targetInput.pagePath}
                        onChange={(e) => setTargetInput((p) => ({ ...p, pagePath: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCsv("pagePaths", targetInput.pagePath); setTargetInput((p) => ({ ...p, pagePath: "" })); } }} />
                      <datalist id="mkt-pages">{PAGE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl border-slate-200 px-3 text-xs"
                      onClick={() => { addCsv("pagePaths", targetInput.pagePath); setTargetInput((p) => ({ ...p, pagePath: "" })); }}>Add</Button>
                  </div>
                  {readCsv("pagePaths").length > 0 && <div className="flex flex-wrap gap-1.5">{readCsv("pagePaths").map((v) => <TagChip key={v} label={v} onRemove={() => removeCsv("pagePaths", v)} />)}</div>}
                </div>

                {/* Students */}
                <div className="space-y-2">
                  <FL>Target Students <span className="normal-case font-normal text-slate-400">(leave empty = all students)</span></FL>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input list="mkt-students" className={fieldCls} placeholder="Search student ID or name" value={targetInput.student}
                        onChange={(e) => setTargetInput((p) => ({ ...p, student: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCsv("targetStudentIds", targetInput.student.split(" - ")[0] || targetInput.student); setTargetInput((p) => ({ ...p, student: "" })); } }} />
                      <datalist id="mkt-students">{targetLookup.students.map((s) => <option key={s.id} value={`${s.id} - ${s.name}`} />)}</datalist>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl border-slate-200 px-3 text-xs"
                      onClick={() => { addCsv("targetStudentIds", targetInput.student.split(" - ")[0] || targetInput.student); setTargetInput((p) => ({ ...p, student: "" })); }}>Add</Button>
                  </div>
                  {readCsv("targetStudentIds").length > 0 && <div className="flex flex-wrap gap-1.5">{readCsv("targetStudentIds").map((v) => <TagChip key={v} label={v} onRemove={() => removeCsv("targetStudentIds", v)} />)}</div>}
                </div>

                {/* Courses */}
                <div className="space-y-2">
                  <FL>Target Courses <span className="normal-case font-normal text-slate-400">(leave empty = all courses)</span></FL>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input list="mkt-courses" className={fieldCls} placeholder="Search course title" value={targetInput.course}
                        onChange={(e) => setTargetInput((p) => ({ ...p, course: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCsv("targetCourseIds", targetInput.course.split(" - ")[0] || targetInput.course); setTargetInput((p) => ({ ...p, course: "" })); } }} />
                      <datalist id="mkt-courses">{targetLookup.courses.map((c) => <option key={c.id} value={`${c.id} - ${c.title}`} />)}</datalist>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl border-slate-200 px-3 text-xs"
                      onClick={() => { addCsv("targetCourseIds", targetInput.course.split(" - ")[0] || targetInput.course); setTargetInput((p) => ({ ...p, course: "" })); }}>Add</Button>
                  </div>
                  {readCsv("targetCourseIds").length > 0 && <div className="flex flex-wrap gap-1.5">{readCsv("targetCourseIds").map((v) => <TagChip key={v} label={v} onRemove={() => removeCsv("targetCourseIds", v)} />)}</div>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FL>Subjects (comma-separated)</FL>
                    <Input list="mkt-subjects" className={fieldCls} placeholder="e.g., ca, tax" value={csvFields.targetSubjects}
                      onChange={(e) => setCsvFields((p) => ({ ...p, targetSubjects: e.target.value }))} />
                    <datalist id="mkt-subjects">{targetLookup.subjects.map((s) => <option key={s} value={s} />)}</datalist>
                  </div>
                  <div className="space-y-1.5">
                    <FL>Languages (comma-separated)</FL>
                    <Input className={fieldCls} placeholder="e.g., hindi, english" value={csvFields.targetLanguages}
                      onChange={(e) => setCsvFields((p) => ({ ...p, targetLanguages: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {/* ── SCHEDULE TAB ── */}
            {formTab === "schedule" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FL>Start Date & Time</FL>
                    <Input type="datetime-local" className={fieldCls} value={String(form.startsAt || "")} onChange={(e) => sf({ startsAt: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <FL>End Date & Time</FL>
                    <Input type="datetime-local" className={fieldCls} value={String(form.endsAt || "")} onChange={(e) => sf({ endsAt: e.target.value })} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" />Display Behavior</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <FL>Show After (sec)</FL>
                      <Input type="number" min={0} className={fieldCls} value={form.showDelaySeconds}
                        onChange={(e) => sf({ showDelaySeconds: Number(e.target.value || 0) })} />
                      <p className="text-[10px] text-slate-400">Seconds after page load</p>
                    </div>
                    <div className="space-y-1.5">
                      <FL>Repeat After Close (min)</FL>
                      <Input type="number" min={0} className={fieldCls} value={form.repeatAfterCloseMinutes}
                        onChange={(e) => sf({ repeatAfterCloseMinutes: Number(e.target.value || 0) })} />
                      <p className="text-[10px] text-slate-400">0 = only once per session</p>
                    </div>
                    <div className="space-y-1.5">
                      <FL>Max Shown / User</FL>
                      <Input type="number" min={0} className={fieldCls} value={form.maxImpressionsPerUser}
                        onChange={(e) => sf({ maxImpressionsPerUser: Number(e.target.value || 0) })} />
                      <p className="text-[10px] text-slate-400">0 = unlimited</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-primary/5 p-4 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-primary">Summary</p>
                  <p>This campaign will show <strong>{form.isEnabled ? "immediately when saved" : "after manually enabling"}</strong>. {form.showDelaySeconds > 0 && `It will appear ${form.showDelaySeconds}s after page load.`} {form.repeatAfterCloseMinutes > 0 ? `It will reappear every ${form.repeatAfterCloseMinutes} minutes after being closed.` : "It will not repeat after being closed."}</p>
                </div>
              </div>
            )}
          </div>

          {/* Dialog footer */}
          <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <div className="flex gap-1">
              {formTabs.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setFormTab(tab.key)}
                  className={`h-1.5 w-8 rounded-full transition-all ${formTab === tab.key ? "bg-primary" : "bg-slate-200"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {formTab !== "schedule" && (
                <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs" onClick={() => {
                  const idx = formTabs.findIndex((t) => t.key === formTab);
                  if (idx < formTabs.length - 1) setFormTab(formTabs[idx + 1].key);
                }}>Next →</Button>
              )}
              <Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={handleSubmit} disabled={isSaving || !(canCreate || canEdit)}>
                {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</> : editingId ? "Update Campaign" : "Create Campaign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
