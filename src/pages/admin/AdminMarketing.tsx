import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { adminApi, type MarketingCampaign, type MarketingCampaignPayload } from "@/services/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Megaphone, Plus, RefreshCw, Trash2, Edit2, XCircle, Search, Globe,
  Clock, Users, BookOpen, CheckCircle2, AlertCircle, Loader2, X, Calendar,
  Zap, Download, ChevronDown, ChevronUp, LayoutGrid, List, Eye, EyeOff
} from "lucide-react";

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
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
};

const PAGE_SUGGESTIONS = ["/", "/packages", "/dashboard", "/contact-us", "/learn/*", "/course/*", "/collections/*"];

type TargetLookup = { students: Array<{ id: string; name: string }>; courses: Array<{ id: string; title: string }>; subjects: string[] };

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  banner: { bg: "bg-blue-100", text: "text-blue-700", label: "Banner" },
  text:   { bg: "bg-gray-100", text: "text-gray-700", label: "Text" },
  alert:  { bg: "bg-amber-100", text: "text-amber-700", label: "Alert" },
  video:  { bg: "bg-purple-100", text: "text-purple-700", label: "Video" },
  pdf:    { bg: "bg-rose-100", text: "text-rose-700", label: "PDF" },
};

const TagChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
    {label}
    <button type="button" onClick={onRemove} className="ml-0.5 hover:text-indigo-900"><X className="h-3 w-3" /></button>
  </span>
);

export default function AdminMarketing() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("marketing", "create");
  const canEdit = hasPermission("marketing", "edit");
  const canDelete = hasPermission("marketing", "delete");

  const [items, setItems] = useState<MarketingCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [formTab, setFormTab] = useState<"content" | "targeting" | "schedule">("content");

  const [form, setForm] = useState(emptyForm);
  const [csvFields, setCsvFields] = useState({ pagePaths: "", targetStudentIds: "", targetCourseIds: "", targetSubjects: "", targetLanguages: "" });
  const [targetInput, setTargetInput] = useState({ pagePath: "", student: "", course: "" });
  const [targetLookup, setTargetLookup] = useState<TargetLookup>({ students: [], courses: [], subjects: [] });

  const loadTargetLookup = async () => {
    try {
      const [cr, sr] = await Promise.all([adminApi.getCourses(), adminApi.listStudents()]);
      const courses = (cr.courses || []).map((r: any) => ({ id: String(r.id || ""), title: String(r.title || "") })).filter((c: any) => c.id && c.title);
      const students = (sr.students || []).map((s: any) => ({ id: String(s.id || ""), name: String(s.name || "") })).filter((s: any) => s.id);
      const subjects = Array.from(new Set(courses.map((c: any) => c.subject).filter(Boolean))).sort();
      setTargetLookup({ students, courses, subjects });
    } catch { }
  };

  const loadCampaigns = async () => {
    try {
      setIsLoading(true);
      const r = await adminApi.listMarketingCampaigns({ search, status: statusFilter as any });
      setItems(r.items || []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadCampaigns(); loadTargetLookup(); }, []);

  const sf = (u: Partial<MarketingCampaignPayload>) => setForm((p) => ({ ...p, ...u }));
  const readCsv = (k: keyof typeof csvFields) => fromCsv(csvFields[k]);
  const writeCsv = (k: keyof typeof csvFields, vals: string[]) => setCsvFields((p) => ({ ...p, [k]: toCsv(Array.from(new Set(vals.map((x) => x.trim()).filter(Boolean)))) }));
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
    setForm({
      title: item.title, message: item.message || "", contentType: item.contentType,
      mediaUrl: item.mediaUrl || "", ctaText: item.ctaText || "", ctaUrl: item.ctaUrl || "",
      pageScope: item.pageScope, pagePaths: item.pagePaths || [], targetStudentIds: item.targetStudentIds || [],
      targetCourseIds: item.targetCourseIds || [], targetSubjects: item.targetSubjects || [],
      targetLanguages: item.targetLanguages || [], startsAt: toDatetimeLocal(item.startsAt),
      endsAt: toDatetimeLocal(item.endsAt), showDelaySeconds: item.showDelaySeconds || 0,
      repeatAfterCloseMinutes: item.repeatAfterCloseMinutes || 0, maxImpressionsPerUser: item.maxImpressionsPerUser || 0,
      isDismissible: item.isDismissible !== false, isEnabled: item.isEnabled !== false,
    });
    setCsvFields({
      pagePaths: toCsv(item.pagePaths || []), targetStudentIds: toCsv(item.targetStudentIds || []),
      targetCourseIds: toCsv(item.targetCourseIds || []), targetSubjects: toCsv(item.targetSubjects || []),
      targetLanguages: toCsv(item.targetLanguages || []),
    });
    setTargetInput({ pagePath: "", student: "", course: "" });
    setFormTab("content"); setError(""); setSuccess(""); setDialogOpen(true);
  };

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
      if (editingId) { await adminApi.updateMarketingCampaign(editingId, payload); setSuccess("Updated successfully!"); }
      else { await adminApi.createMarketingCampaign(payload); setSuccess("Created successfully!"); }
      setError(""); setDialogOpen(false); await loadCampaigns();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setIsSaving(false); }
  };

  const toggleCampaign = async (item: MarketingCampaign) => {
    if (!canEdit) return;
    try { await adminApi.toggleMarketingCampaign(item.id, !item.isEnabled); await loadCampaigns(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to toggle"); }
  };

  const removeCampaign = async (item: MarketingCampaign) => {
    if (!canDelete || !window.confirm(`Delete "${item.title}"?`)) return;
    try { await adminApi.deleteMarketingCampaign(item.id); setSuccess("Deleted!"); await loadCampaigns(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to delete"); }
  };

  const exportCampaigns = async () => {
    setIsExporting(true);
    try {
      const r = await adminApi.listMarketingCampaigns({ search, status: statusFilter as any });
      const rows = (r.items || []).map((c) => ({
        "Title": c.title, "Type": c.contentType, "Status": c.isEnabled ? "Active" : "Disabled",
        "Scope": c.pageScope === "global" ? "All Pages" : "Specific",
        "Start": fmtDate(c.startsAt), "End": fmtDate(c.endsAt),
        "Students": c.targetStudentIds?.length || 0, "Courses": c.targetCourseIds?.length || 0,
      }));
      const { utils, writeFile } = await import("xlsx");
      writeFile(utils.json_to_sheet(rows), "campaigns.xlsx");
    } catch { alert("Export failed"); }
    finally { setIsExporting(false); }
  };

  const activeCount = useMemo(() => items.filter((x) => x.isEnabled).length, [items]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketing Campaigns</h1>
            <p className="text-sm text-gray-500">Manage banners, alerts & announcements</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Total Campaigns</p>
            <p className="text-2xl font-bold">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Paused</p>
            <p className="text-2xl font-bold text-amber-600">{items.length - activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Targeted</p>
            <p className="text-2xl font-bold text-purple-600">{items.filter(i => i.targetStudentIds?.length || i.targetCourseIds?.length).length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="enabled">Active</SelectItem>
                <SelectItem value="disabled">Paused</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => setShowDateFilter(!showDateFilter)} className={showDateFilter ? "bg-gray-100" : ""}>
              <Calendar className="w-4 h-4 mr-1" /> Date {showDateFilter ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="h-8 px-3">
                <List className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="h-8 px-3">
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={() => loadCampaigns()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            <Button variant="outline" size="sm" onClick={exportCampaigns} disabled={isExporting}>
              <Download className={`w-4 h-4 mr-1 ${isExporting ? "animate-pulse" : ""}`} /> Export
            </Button>

            {canCreate && (
              <Button size="sm" onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-1" /> New
              </Button>
            )}
          </div>

          {showDateFilter && (
            <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="text-xs">From:</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[140px] h-8" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">To:</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[140px] h-8" />
              </div>
              <Button size="sm" onClick={() => loadCampaigns()}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</Button>
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {success && <p className="text-green-600 text-sm mt-2">{success}</p>}
        </CardHeader>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p>No campaigns found</p>
              {canCreate && <Button size="sm" className="mt-3" onClick={openCreate}>Create Campaign</Button>}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {items.map((item) => {
                const type = TYPE_STYLE[item.contentType] || TYPE_STYLE.text;
                return (
                  <div key={item.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.bg} ${type.text}`}>{type.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${item.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {item.isEnabled ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleCampaign(item)}>
                          {item.isEnabled ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        </Button>
                        {canEdit && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(item)}><Edit2 className="w-4 h-4" /></Button>}
                        {canDelete && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeCampaign(item)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                    {item.message && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.message}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{item.pageScope === "global" ? "All pages" : "Specific"}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.targetStudentIds?.length || 0}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(item.startsAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Campaign</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Audience</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Schedule</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const type = TYPE_STYLE[item.contentType] || TYPE_STYLE.text;
                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{item.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.bg} ${type.text}`}>{type.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.targetStudentIds?.length || "All"}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.startsAt ? <><span>{fmtDate(item.startsAt)}</span><span className="mx-1">→</span><span>{fmtDate(item.endsAt)}</span></> : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {item.isEnabled ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleCampaign(item)}>
                            {item.isEnabled ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          </Button>
                          {canEdit && <Button variant="ghost" size="sm" onClick={() => startEdit(item)}><Edit2 className="w-4 h-4" /></Button>}
                          {canDelete && <Button variant="ghost" size="sm" onClick={() => removeCampaign(item)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
          </DialogHeader>

          <div className="flex border-b mb-4">
            {["content", "targeting", "schedule"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFormTab(tab as any)}
                className={`flex-1 py-2 text-sm font-medium capitalize ${formTab === tab ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-400"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {formTab === "content" && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Campaign Title *</Label>
                <Input value={form.title} onChange={(e) => sf({ title: e.target.value })} placeholder="Enter title" />
              </div>
              <div className="grid gap-2">
                <Label>Message</Label>
                <textarea className="h-20 w-full border rounded-lg px-3 py-2 text-sm" value={form.message} onChange={(e) => sf({ message: e.target.value })} placeholder="Short message..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Content Type</Label>
                  <Select value={form.contentType} onValueChange={(v) => sf({ contentType: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="banner">Banner</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Page Scope</Label>
                  <Select value={form.pageScope} onValueChange={(v) => sf({ pageScope: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (All Pages)</SelectItem>
                      <SelectItem value="specific">Specific Pages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Media URL</Label>
                <Input value={form.mediaUrl || ""} onChange={(e) => sf({ mediaUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>CTA Text</Label>
                  <Input value={form.ctaText || ""} onChange={(e) => sf({ ctaText: e.target.value })} placeholder="Enroll Now" />
                </div>
                <div className="grid gap-2">
                  <Label>CTA URL</Label>
                  <Input value={form.ctaUrl || ""} onChange={(e) => sf({ ctaUrl: e.target.value })} placeholder="/packages" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Enabled</Label>
                  <p className="text-xs text-gray-500">Show to students</p>
                </div>
                <Switch checked={form.isEnabled} onCheckedChange={(v) => sf({ isEnabled: v })} />
              </div>
            </div>
          )}

          {formTab === "targeting" && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Page Paths</Label>
                <Input list="page-path-suggestions" placeholder="e.g., /packages" value={targetInput.pagePath} onChange={(e) => setTargetInput(p => ({ ...p, pagePath: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { addCsv("pagePaths", targetInput.pagePath); setTargetInput(p => ({ ...p, pagePath: "" })); }}} />
                <datalist id="page-path-suggestions">
                  {PAGE_SUGGESTIONS.map(p => <option key={p} value={p} />)}
                </datalist>
                {readCsv("pagePaths").length > 0 && <div className="flex flex-wrap gap-2 mt-2">{readCsv("pagePaths").map(v => <TagChip key={v} label={v} onRemove={() => removeCsv("pagePaths", v)} />)}</div>}
              </div>
              <div className="grid gap-2">
                <Label>Target Students</Label>
                <Input list="student-suggestions" placeholder="Search student name or ID" value={targetInput.student} onChange={(e) => setTargetInput(p => ({ ...p, student: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { addCsv("targetStudentIds", targetInput.student.split(" - ")[0] || targetInput.student); setTargetInput(p => ({ ...p, student: "" })); }}} />
                <datalist id="student-suggestions">
                  {targetLookup.students.slice(0, 20).map(s => <option key={s.id} value={`${s.id} - ${s.name}`} />)}
                </datalist>
                {readCsv("targetStudentIds").length > 0 && <div className="flex flex-wrap gap-2 mt-2">{readCsv("targetStudentIds").map(v => <TagChip key={v} label={v} onRemove={() => removeCsv("targetStudentIds", v)} />)}</div>}
              </div>
              <div className="grid gap-2">
                <Label>Target Courses</Label>
                <Input list="course-suggestions" placeholder="Search course name or ID" value={targetInput.course} onChange={(e) => setTargetInput(p => ({ ...p, course: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { addCsv("targetCourseIds", targetInput.course.split(" - ")[0] || targetInput.course); setTargetInput(p => ({ ...p, course: "" })); }}} />
                <datalist id="course-suggestions">
                  {targetLookup.courses.slice(0, 20).map(c => <option key={c.id} value={`${c.id} - ${c.title}`} />)}
                </datalist>
                {readCsv("targetCourseIds").length > 0 && <div className="flex flex-wrap gap-2 mt-2">{readCsv("targetCourseIds").map(v => <TagChip key={v} label={v} onRemove={() => removeCsv("targetCourseIds", v)} />)}</div>}
              </div>
            </div>
          )}

          {formTab === "schedule" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date & Time</Label>
                  <Input type="datetime-local" value={form.startsAt || ""} onChange={(e) => sf({ startsAt: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>End Date & Time</Label>
                  <Input type="datetime-local" value={form.endsAt || ""} onChange={(e) => sf({ endsAt: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Show After (sec)</Label>
                  <Input type="number" min={0} value={form.showDelaySeconds} onChange={(e) => sf({ showDelaySeconds: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Repeat After (min)</Label>
                  <Input type="number" min={0} value={form.repeatAfterCloseMinutes} onChange={(e) => sf({ repeatAfterCloseMinutes: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Max Impressions</Label>
                  <Input type="number" min={0} value={form.maxImpressionsPerUser} onChange={(e) => sf({ maxImpressionsPerUser: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="bg-indigo-600">
              {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}