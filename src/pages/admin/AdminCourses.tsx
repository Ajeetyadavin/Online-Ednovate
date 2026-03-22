import { useCallback, useEffect, useMemo, useState } from "react";
import { type ManagedCourse, usePlatformData } from "@/context/PlatformDataContext";
import { adminApi } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, ArrowUpDown, Copy, BookOpen, Clock, DollarSign, Tag, Video, Package, FileText, Star, Settings, Loader2, LayoutGrid, List } from "lucide-react";

/* ─── helpers (unchanged) ─────────────────────────────────────── */
const parseLessonDurationToSeconds = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return 0;
  if (raw.includes(":")) {
    const parts = raw.split(":").map(Number);
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.floor(Number(raw) * 60);
  const h = Number((raw.match(/(\d+(?:\.\d+)?)\s*h/) || [])[1] || 0);
  const m = Number((raw.match(/(\d+(?:\.\d+)?)\s*m/) || [])[1] || 0);
  const s = Number((raw.match(/(\d+(?:\.\d+)?)\s*s/) || [])[1] || 0);
  return Math.max(0, Math.floor(h * 3600 + m * 60 + s));
};

const computeCurriculumMeta = (chapters: any[]) => {
  const lessons = Array.isArray(chapters) ? chapters.flatMap((ch) => Array.isArray(ch?.lessons) ? ch.lessons : []) : [];
  const videoLessons = lessons.filter((l) => l?.type === "video");
  const totalSeconds = videoLessons.reduce((sum, l) => sum + parseLessonDurationToSeconds(l?.duration), 0);
  return { lectures: videoLessons.length, totalSeconds, hours: Number((totalSeconds / 3600).toFixed(1)) };
};

const formatSecondsToClock = (s: number) => {
  const t = Math.max(0, Math.floor(Number(s) || 0));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
};

const parsePositiveNumberList = (value: string, fallback: number[]): number[] => {
  const parsed = value.split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x >= 1);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback;
};

const parseCustomModes = (value: string) =>
  value.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => {
    const [lp, pp] = line.split(":");
    const label = String(lp || "").trim();
    const price = Number(String(pp || "").trim());
    if (!label || !Number.isFinite(price) || price <= 0) return null;
    return { id: `custom-${i + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label, price };
  }).filter((x): x is { id: string; label: string; price: number } => Boolean(x));

const parseReviewsText = (value: string) =>
  value.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [np, rp, cp, dp] = line.split("|");
    const name = String(np || "").trim();
    const rating = Math.max(1, Math.min(5, Number(String(rp || "").trim() || 5)));
    const comment = String(cp || "").trim();
    const date = String(dp || "").trim();
    if (!name || !comment) return null;
    return { name, rating, comment, date };
  }).filter((x): x is { name: string; rating: number; comment: string; date: string } => Boolean(x));

type CourseForm = {
  id: string; title: string; category: string; subcategory: string; price: number; originalPrice: number; taxPercentage: number;
  language: string; professor: string; lectures: number; hours: number; thumbnail?: string;
  demoVideoTitle?: string; demoVideoDescription?: string; demoVideoSource?: "youtube" | "direct" | "upload";
  demoVideoUrl?: string; demoVideoThumbnailUrl?: string; demoVideoVisible?: boolean;
  isSubcategoryCustom?: boolean; viewPricingEnabled?: boolean; unlimitedViewsEnabled?: boolean;
  validityPricingEnabled?: boolean; viewOptionsText?: string; validityOptionsDaysText?: string;
  deliveryModePricingEnabled?: boolean; enableOnlineMode?: boolean; enableGoogleDriveMode?: boolean;
  enablePenDriveMode?: boolean; enableCustomMode?: boolean; onlineModePrice?: number;
  googleDriveModePrice?: number; penDriveModePrice?: number; customModeName?: string;
  customModePrice?: number; customModesText?: string; bookAddonEnabled?: boolean;
  enableEnotesAddon?: boolean; enotesAddonPrice?: number; enablePhysicalBookAddon?: boolean;
  physicalBookAddonPrice?: number; aboutCourseEnabled?: boolean; aboutCourseText?: string;
  ratingsEnabled?: boolean; reviewsEnabled?: boolean; ratingValue?: number; ratingCount?: number;
  reviewsText?: string; enrollmentCount?: number; showEnrollmentCount?: boolean;
  showMetaLectures?: boolean; showMetaHours?: boolean; showMetaValidity?: boolean;
  showMetaResources?: boolean; showMetaViews?: boolean; showMetaPerHour?: boolean; showMetaLanguage?: boolean;
};

const toCourseForm = (c: ManagedCourse): CourseForm => ({
  id: c.id, title: c.title, category: c.category, subcategory: c.subcategory || "general",
  price: c.price, originalPrice: c.originalPrice, taxPercentage: Math.max(0, Number(c.taxPercentage || 0)), language: c.language, professor: c.professor,
  lectures: c.lectures, hours: c.hours, thumbnail: c.thumbnail,
  demoVideoTitle: c.demoVideoTitle, demoVideoDescription: c.demoVideoDescription,
  demoVideoSource: c.demoVideoSource, demoVideoUrl: c.demoVideoUrl,
  demoVideoThumbnailUrl: c.demoVideoThumbnailUrl, demoVideoVisible: c.demoVideoVisible,
  isSubcategoryCustom: !c.subcategory?.startsWith("subcat-"),
  viewPricingEnabled: Boolean(c.viewPricingEnabled), unlimitedViewsEnabled: Boolean(c.unlimitedViewsEnabled),
  validityPricingEnabled: Boolean(c.validityPricingEnabled),
  viewOptionsText: (c.viewOptions?.length ? c.viewOptions : [1, 2]).join(","),
  validityOptionsDaysText: (c.validityOptionsDays?.length ? c.validityOptionsDays : [30, 90, 180]).join(","),
  deliveryModePricingEnabled: Boolean(c.deliveryModePricingEnabled),
  enableOnlineMode: Boolean(c.deliveryModes?.some((m) => m.id === "online")),
  enableGoogleDriveMode: Boolean(c.deliveryModes?.some((m) => m.id === "google-drive")),
  enablePenDriveMode: Boolean(c.deliveryModes?.some((m) => m.id === "pen-drive")),
  enableCustomMode: Boolean(c.deliveryModes?.some((m) => m.id === "custom")),
  onlineModePrice: c.deliveryModes?.find((m) => m.id === "online")?.price ?? c.price,
  googleDriveModePrice: c.deliveryModes?.find((m) => m.id === "google-drive")?.price ?? c.price,
  penDriveModePrice: c.deliveryModes?.find((m) => m.id === "pen-drive")?.price ?? c.price,
  customModeName: c.deliveryModes?.find((m) => m.id === "custom")?.label ?? "",
  customModePrice: c.deliveryModes?.find((m) => m.id === "custom")?.price ?? c.price,
  customModesText: (c.deliveryModes || []).filter((m) => !["online","google-drive","pen-drive"].includes(m.id)).map((m) => `${m.label}: ${m.price}`).join("\n"),
  bookAddonEnabled: Boolean(c.bookAddonEnabled),
  enableEnotesAddon: Boolean(c.bookAddons?.find((a) => a.id === "enotes")?.enabled),
  enotesAddonPrice: Number(c.bookAddons?.find((a) => a.id === "enotes")?.price || 0),
  enablePhysicalBookAddon: Boolean(c.bookAddons?.find((a) => a.id === "physical-book")?.enabled),
  physicalBookAddonPrice: Number(c.bookAddons?.find((a) => a.id === "physical-book")?.price || 0),
  aboutCourseEnabled: Boolean(c.aboutCourseEnabled), aboutCourseText: c.aboutCourseText || "",
  ratingsEnabled: c.ratingsEnabled !== false, reviewsEnabled: c.reviewsEnabled !== false,
  ratingValue: Number(c.ratingValue || 4.8), ratingCount: Number(c.ratingCount || 0),
  reviewsText: (c.reviews || []).map((r) => `${r.name} | ${r.rating} | ${r.comment} | ${r.date || ""}`).join("\n"),
  enrollmentCount: Number(c.enrollmentCount || 0), showEnrollmentCount: c.showEnrollmentCount !== false,
  showMetaLectures: c.showMetaLectures !== false, showMetaHours: c.showMetaHours !== false,
  showMetaValidity: c.showMetaValidity !== false, showMetaResources: c.showMetaResources !== false,
  showMetaViews: c.showMetaViews !== false, showMetaPerHour: c.showMetaPerHour !== false,
  showMetaLanguage: c.showMetaLanguage !== false,
});

const BLANK_FORM: CourseForm = {
  id: "", title: "", category: "", subcategory: "general", price: 0, originalPrice: 0, taxPercentage: 0,
  language: "English", professor: "Ednovate Faculty", lectures: 0, hours: 0, thumbnail: "",
  demoVideoTitle: "", demoVideoDescription: "", demoVideoSource: "youtube", demoVideoUrl: "",
  demoVideoThumbnailUrl: "", demoVideoVisible: false, isSubcategoryCustom: false,
  viewPricingEnabled: false, unlimitedViewsEnabled: false, validityPricingEnabled: false,
  viewOptionsText: "1,2", validityOptionsDaysText: "30,90,180", deliveryModePricingEnabled: false,
  enableOnlineMode: true, enableGoogleDriveMode: false, enablePenDriveMode: false, enableCustomMode: false,
  onlineModePrice: 0, googleDriveModePrice: 0, penDriveModePrice: 0, customModeName: "", customModePrice: 0,
  customModesText: "", bookAddonEnabled: false, enableEnotesAddon: false, enotesAddonPrice: 0,
  enablePhysicalBookAddon: false, physicalBookAddonPrice: 0, aboutCourseEnabled: false, aboutCourseText: "",
  ratingsEnabled: true, reviewsEnabled: true, ratingValue: 4.8, ratingCount: 0, reviewsText: "",
  enrollmentCount: 0, showEnrollmentCount: true, showMetaLectures: true, showMetaHours: true,
  showMetaValidity: true, showMetaResources: true, showMetaViews: true, showMetaPerHour: true, showMetaLanguage: true,
};

type DialogTab = "basic" | "demo" | "pricing" | "delivery" | "content";

/* ─── small reusable bits ─────────────────────────────────────── */
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</label>
);
const fieldCls = "h-9 rounded-xl border-slate-200 bg-white text-sm focus-visible:ring-primary/40";
const checkboxRow = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
  <label className="flex cursor-pointer items-center gap-2.5">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-primary" />
    <span className="text-xs font-medium text-slate-700">{label}</span>
  </label>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function AdminCourses() {
  const { courses, categories, toggleCourseVisibility, upsertCourse, deleteCourse } = usePlatformData();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm>(BLANK_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<DialogTab>("basic");
  const [isSaving, setIsSaving] = useState(false);
  const [curriculumMetaByCourse, setCurriculumMetaByCourse] = useState<Record<string, { lectures: number; totalSeconds: number; hours: number }>>({});

  const sf = (updates: Partial<CourseForm>) => setForm((p) => ({ ...p, ...updates }));

  const loadCurriculumMeta = useCallback(async () => {
    try {
      const response = await adminApi.getCourses();
      const rawCurricula = response.curricula && typeof response.curricula === "object" ? response.curricula : {};
      setCurriculumMetaByCourse(Object.fromEntries(
        Object.entries(rawCurricula).map(([id, chapters]) => [id, computeCurriculumMeta(Array.isArray(chapters) ? chapters : [])]),
      ));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadCurriculumMeta(); }, [courses.length, loadCurriculumMeta]);
  useEffect(() => {
    const handler = () => void loadCurriculumMeta();
    window.addEventListener("curriculum-updated", handler as EventListener);
    return () => window.removeEventListener("curriculum-updated", handler as EventListener);
  }, [loadCurriculumMeta]);

  const autoMeta = useMemo(() => {
    const meta = curriculumMetaByCourse[form.id] || { lectures: 0, totalSeconds: 0, hours: 0 };
    return { ...meta, formattedDuration: formatSecondsToClock(meta.totalSeconds) };
  }, [curriculumMetaByCourse, form.id]);

  useEffect(() => {
    if (!dialogOpen || !form.id) return;
    const m = curriculumMetaByCourse[form.id];
    if (!m) { if (form.lectures === 0 && form.hours === 0) return; sf({ lectures: 0, hours: 0 }); return; }
    if (form.lectures !== m.lectures || form.hours !== m.hours) sf({ lectures: m.lectures, hours: m.hours });
  }, [dialogOpen, form.id, form.lectures, form.hours, curriculumMetaByCourse]);

  const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const parentCategories = useMemo(() => categories.filter((c) => c.parentId === null), [categories]);
  const subcategoryOptions = useMemo(() => categories.filter((c) => c.parentId === form.category), [categories, form.category]);

  useEffect(() => {
    if (!form.category && parentCategories.length > 0) { sf({ category: parentCategories[0].id }); return; }
    if (!form.category) return;
    if (!subcategoryOptions.some((s) => s.id === form.subcategory) && subcategoryOptions.length > 0) sf({ subcategory: subcategoryOptions[0].id });
  }, [form.category, form.subcategory, parentCategories, subcategoryOptions]);

  const filteredCourses = useMemo(() =>
    courses.filter((c) =>
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (categoriesById[c.category]?.name || c.category).toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => sortOrder === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)),
  [courses, categoriesById, searchTerm, sortOrder]);

  const handleToggleVisibility = (courseId: string) => {
    toggleCourseVisibility(courseId);
    const next = courses.find((c) => c.id === courseId);
    if (next) adminApi.upsertCourse({ ...next, isVisible: !next.isVisible }).catch(() => {});
  };

  const openCreateDialog = () => {
    const firstCat = parentCategories[0]?.id || "general";
    setEditingId(null);
    setForm({ ...BLANK_FORM, id: `course-${Date.now()}`, category: firstCat, subcategory: categories.find((c) => c.parentId === firstCat)?.id || "general" });
    setDialogTab("basic");
    setDialogOpen(true);
  };

  const openEditDialog = (course: ManagedCourse) => {
    setEditingId(course.id);
    setForm(toCourseForm(course));
    setDialogTab("basic");
    setDialogOpen(true);
  };

  const handleSaveCourse = async () => {
    if (!form.title.trim()) { alert("Please add a valid course title"); return; }
    const deliveryModes: Array<{ id: string; label: string; price: number; originalPrice?: number }> = [];
    if (form.deliveryModePricingEnabled) {
      if (form.enableOnlineMode && Number(form.onlineModePrice || 0) > 0) deliveryModes.push({ id: "online", label: "Online", price: Number(form.onlineModePrice), originalPrice: Number(form.originalPrice || form.onlineModePrice) });
      if (form.enableGoogleDriveMode && Number(form.googleDriveModePrice || 0) > 0) deliveryModes.push({ id: "google-drive", label: "Google Drive", price: Number(form.googleDriveModePrice), originalPrice: Number(form.originalPrice || form.googleDriveModePrice) });
      if (form.enablePenDriveMode && Number(form.penDriveModePrice || 0) > 0) deliveryModes.push({ id: "pen-drive", label: "Pen Drive", price: Number(form.penDriveModePrice), originalPrice: Number(form.originalPrice || form.penDriveModePrice) });
      if (form.enableCustomMode && String(form.customModeName || "").trim() && Number(form.customModePrice || 0) > 0) deliveryModes.push({ id: "custom", label: String(form.customModeName).trim(), price: Number(form.customModePrice), originalPrice: Number(form.originalPrice || form.customModePrice) });
      parseCustomModes(form.customModesText || "").forEach((m) => deliveryModes.push({ id: m.id, label: m.label, price: m.price, originalPrice: Number(form.originalPrice || m.price) }));
    }
    if (!form.deliveryModePricingEnabled && Number(form.price || 0) <= 0) { alert("Please add a valid base price"); return; }
    if (form.deliveryModePricingEnabled && deliveryModes.length === 0) { alert("Please enable at least one delivery mode with a valid price"); return; }
    const bookAddons: Array<{ id: string; label: string; price: number; enabled?: boolean }> = [];
    if (form.bookAddonEnabled) {
      if (form.enableEnotesAddon) bookAddons.push({ id: "enotes", label: "eNotes", price: Math.max(0, Number(form.enotesAddonPrice || 0)), enabled: true });
      if (form.enablePhysicalBookAddon) bookAddons.push({ id: "physical-book", label: "Physical Book", price: Math.max(0, Number(form.physicalBookAddonPrice || 0)), enabled: true });
    }
    const derivedBasePrice = form.deliveryModePricingEnabled ? Number(deliveryModes[0]?.price || 0) : Number(form.price || 0);
    const derivedBaseOriginalPrice = form.deliveryModePricingEnabled ? Number(deliveryModes[0]?.originalPrice || derivedBasePrice) : Number(form.originalPrice || form.price || 0);
    const nextCourse: ManagedCourse = {
      id: form.id, title: form.title.trim(), category: form.category || "general",
      subcategory: form.subcategory || "general", language: form.language || "English",
      lectures: Number(autoMeta.lectures || 0), hours: Number(autoMeta.hours || 0),
      price: derivedBasePrice, originalPrice: derivedBaseOriginalPrice,
      taxPercentage: Math.max(0, Number(form.taxPercentage || 0)),
      discount: derivedBaseOriginalPrice > 0 ? Math.max(0, Math.min(95, Math.round(((derivedBaseOriginalPrice - derivedBasePrice) / derivedBaseOriginalPrice) * 100))) : 0,
      image: "/placeholder.svg", thumbnail: form.thumbnail || "",
      professor: form.professor.trim() || "Ednovate Faculty",
      isCombo: false, isMaterial: false, isVisible: true,
      demoVideoTitle: form.demoVideoTitle?.trim() || "", demoVideoDescription: form.demoVideoDescription?.trim() || "",
      demoVideoSource: form.demoVideoSource || "youtube", demoVideoUrl: form.demoVideoUrl?.trim() || "",
      demoVideoThumbnailUrl: form.demoVideoThumbnailUrl?.trim() || "", demoVideoVisible: form.demoVideoVisible || false,
      viewPricingEnabled: Boolean(form.viewPricingEnabled), unlimitedViewsEnabled: Boolean(form.unlimitedViewsEnabled),
      validityPricingEnabled: Boolean(form.validityPricingEnabled),
      viewOptions: parsePositiveNumberList(form.viewOptionsText || "", [1, 2]),
      validityOptionsDays: parsePositiveNumberList(form.validityOptionsDaysText || "", [30, 90, 180]),
      selectedViews: 1, selectedValidityDays: 30,
      deliveryModePricingEnabled: Boolean(form.deliveryModePricingEnabled), deliveryModes,
      selectedDeliveryModeId: deliveryModes[0]?.id || "online",
      selectedDeliveryModeIds: deliveryModes.length > 0 ? [deliveryModes[0].id] : [],
      bookAddonEnabled: Boolean(form.bookAddonEnabled), bookAddons, selectedBookAddonIds: [],
      aboutCourseEnabled: Boolean(form.aboutCourseEnabled), aboutCourseText: String(form.aboutCourseText || "").trim(),
      ratingsEnabled: form.ratingsEnabled !== false, reviewsEnabled: form.reviewsEnabled !== false,
      ratingValue: Math.max(0, Math.min(5, Number(form.ratingValue || 4.8))),
      ratingCount: Math.max(0, Number(form.ratingCount || 0)),
      reviews: parseReviewsText(form.reviewsText || ""),
      enrollmentCount: Math.max(0, Number(form.enrollmentCount || 0)),
      showEnrollmentCount: form.showEnrollmentCount !== false, showMetaLectures: form.showMetaLectures !== false,
      showMetaHours: form.showMetaHours !== false, showMetaValidity: form.showMetaValidity !== false,
      showMetaResources: form.showMetaResources !== false, showMetaViews: form.showMetaViews !== false,
      showMetaPerHour: form.showMetaPerHour !== false, showMetaLanguage: form.showMetaLanguage !== false,
    };
    setIsSaving(true);
    try {
      upsertCourse(nextCourse);
      await adminApi.upsertCourse(nextCourse);
      setDialogOpen(false);
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Delete this course?")) return;
    deleteCourse(courseId);
    await adminApi.deleteCourse(courseId);
  };

  const handleDuplicateCourse = async (course: ManagedCourse) => {
    const nextTitle = prompt("Duplicate course title", `${course.title} (Copy)`);
    if (!nextTitle?.trim()) return;
    const duplicateId = `course-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    try {
      try {
        await adminApi.duplicateCourse(course.id, { id: duplicateId, title: nextTitle.trim() });
      } catch (error) {
        if (!(error instanceof Error && error.message.includes("404"))) throw error;
        const fallback: ManagedCourse = { ...JSON.parse(JSON.stringify(course)), id: duplicateId, title: nextTitle.trim(), isVisible: false, enrollmentCount: 0 };
        await adminApi.upsertCourse(fallback);
        const response = await adminApi.getCourses();
        const src = response.curricula?.[course.id];
        if (Array.isArray(src)) await adminApi.saveCurriculum(duplicateId, JSON.parse(JSON.stringify(src)));
      }
      upsertCourse({ ...JSON.parse(JSON.stringify(course)), id: duplicateId, title: nextTitle.trim(), isVisible: false, enrollmentCount: 0 });
      await loadCurriculumMeta();
      alert("Course duplicated successfully");
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to duplicate course"); }
  };

  /* ─── Dialog Tabs ────────────────────────────────────────────── */
  const dialogTabs: { key: DialogTab; label: string; icon: React.ElementType }[] = [
    { key: "basic",    label: "Basic",    icon: BookOpen },
    { key: "demo",     label: "Demo",     icon: Video },
    { key: "pricing",  label: "Pricing",  icon: DollarSign },
    { key: "delivery", label: "Delivery", icon: Package },
    { key: "content",  label: "Content",  icon: FileText },
  ];

  const selectCls = "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-5 font-['Inter']">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
          <p className="mt-0.5 text-xs text-slate-500">{filteredCourses.length} courses total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-slate-200 text-xs" onClick={() => setSortOrder((p) => p === "asc" ? "desc" : "asc")}>
            <ArrowUpDown className="h-3.5 w-3.5" />{sortOrder === "asc" ? "A→Z" : "Z→A"}
          </Button>
          {/* Grid / List toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
            <button type="button" onClick={() => setViewMode("grid")}
              className={`flex h-7 w-8 items-center justify-center rounded-lg transition-all ${viewMode === "grid" ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setViewMode("list")}
              className={`flex h-7 w-8 items-center justify-center rounded-lg transition-all ${viewMode === "list" ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input className="h-9 w-52 rounded-xl border-slate-200 pl-9 text-xs" placeholder="Search courses…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5" /> Add Course
              </Button>
            </DialogTrigger>

            {/* ─── Course Dialog ─────────────────────────────────── */}
            <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-100 p-0 shadow-2xl">
              <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
                <DialogTitle className="text-base font-bold text-slate-900">{editingId ? "Edit Course" : "Add New Course"}</DialogTitle>
              </DialogHeader>

              {/* Tabs row */}
              <div className="shrink-0 flex border-b border-slate-100 px-6">
                {dialogTabs.map((tab) => (
                  <button key={tab.key} type="button" onClick={() => setDialogTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${dialogTab === tab.key ? "border-b-2 border-primary text-primary" : "text-slate-500 hover:text-slate-700"}`}>
                    <tab.icon className="h-3.5 w-3.5" />{tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5">

                {/* ── BASIC TAB ── */}
                {dialogTab === "basic" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Course Title *</Label>
                      <Input className={fieldCls} placeholder="e.g., CA Final Advanced Accounting" value={form.title} onChange={(e) => sf({ title: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Thumbnail URL</Label>
                      <Input className={fieldCls} placeholder="https://…" value={form.thumbnail || ""} onChange={(e) => sf({ thumbnail: e.target.value })} />
                      {form.thumbnail && <img src={form.thumbnail} alt="thumb" className="mt-2 h-20 rounded-xl object-cover" />}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Category</Label>
                        <select className={selectCls} value={form.category} onChange={(e) => sf({ category: e.target.value })}>
                          {parentCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Subcategory / Level</Label>
                        <select className={selectCls} value={form.subcategory} onChange={(e) => sf({ subcategory: e.target.value })}>
                          {subcategoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Price (₹)</Label>
                        <Input className={fieldCls} type="number" placeholder="999" value={form.price} disabled={Boolean(form.deliveryModePricingEnabled)} onChange={(e) => sf({ price: Number(e.target.value) || 0 })} />
                        {form.deliveryModePricingEnabled && <p className="text-[10px] text-slate-400">Controlled by delivery mode pricing</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Original Price (₹)</Label>
                        <Input className={fieldCls} type="number" placeholder="1299" value={form.originalPrice} disabled={Boolean(form.deliveryModePricingEnabled)} onChange={(e) => sf({ originalPrice: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tax (%)</Label>
                        <Input className={fieldCls} type="number" min={0} step={0.01} placeholder="18" value={form.taxPercentage} onChange={(e) => sf({ taxPercentage: Math.max(0, Number(e.target.value) || 0) })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Professor</Label>
                        <Input className={fieldCls} placeholder="Faculty Name" value={form.professor} onChange={(e) => sf({ professor: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Language</Label>
                        <Input className={fieldCls} placeholder="English" value={form.language} onChange={(e) => sf({ language: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Lectures (Auto)</Label>
                        <Input className={`${fieldCls} bg-slate-50`} type="number" value={autoMeta.lectures} disabled />
                        <p className="text-[10px] text-slate-400">Auto-counted from Course Content</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Total Duration (Auto)</Label>
                        <Input className={`${fieldCls} bg-slate-50`} value={autoMeta.formattedDuration} disabled />
                        <p className="text-[10px] text-slate-400">Auto-calculated HH:MM:SS</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DEMO TAB ── */}
                {dialogTab === "demo" && (
                  <div className="space-y-4">
                    {checkboxRow("Show Demo Lecture on Course Page", form.demoVideoVisible || false, (v) => sf({ demoVideoVisible: v }))}
                    {form.demoVideoVisible && (
                      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="space-y-1.5">
                          <Label>Demo Lecture Title</Label>
                          <Input className={fieldCls} placeholder="Introduction Lecture" value={form.demoVideoTitle || ""} onChange={(e) => sf({ demoVideoTitle: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Description</Label>
                          <textarea className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" value={form.demoVideoDescription || ""} onChange={(e) => sf({ demoVideoDescription: e.target.value })} placeholder="Brief description…" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Video Source</Label>
                          <div className="flex gap-3">
                            {(["youtube", "upload", "direct"] as const).map((src) => (
                              <label key={src} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
                                <input type="radio" name="videoSource" value={src} checked={form.demoVideoSource === src} onChange={() => sf({ demoVideoSource: src })} className="accent-primary" />
                                {src === "youtube" ? "YouTube" : src === "upload" ? "CDN Upload" : "Direct URL"}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>{form.demoVideoSource === "youtube" ? "YouTube Video ID" : "Video URL"}</Label>
                          <Input className={fieldCls} placeholder={form.demoVideoSource === "youtube" ? "e.g., dQw4w9WgXcQ" : "https://…"} value={form.demoVideoUrl || ""} onChange={(e) => sf({ demoVideoUrl: e.target.value })} />
                          {form.demoVideoSource === "youtube" && form.demoVideoUrl && <p className="text-[10px] text-slate-400">Preview: youtube.com/embed/{form.demoVideoUrl}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Video Thumbnail URL (Optional)</Label>
                          <Input className={fieldCls} placeholder="https://…" value={form.demoVideoThumbnailUrl || ""} onChange={(e) => sf({ demoVideoThumbnailUrl: e.target.value })} />
                          {form.demoVideoThumbnailUrl && <img src={form.demoVideoThumbnailUrl} alt="thumb" className="mt-1 h-16 rounded-xl object-cover" />}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── PRICING TAB ── */}
                {dialogTab === "pricing" && (
                  <div className="space-y-4">
                    {/* View pricing */}
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800">View-based Pricing</p>
                      {checkboxRow("Sell by number of views", form.viewPricingEnabled || false, (v) => sf({ viewPricingEnabled: v, unlimitedViewsEnabled: v ? false : form.unlimitedViewsEnabled }))}
                      {form.viewPricingEnabled && (
                        <div className="pl-5 space-y-1.5">
                          <Label>View options (comma-separated)</Label>
                          <Input className={fieldCls} placeholder="1,2,3" value={form.viewOptionsText || ""} onChange={(e) => sf({ viewOptionsText: e.target.value })} />
                        </div>
                      )}
                      {checkboxRow("Grant unlimited views to buyers", form.unlimitedViewsEnabled || false, (v) => sf({ unlimitedViewsEnabled: v, viewPricingEnabled: v ? false : form.viewPricingEnabled }))}
                    </div>
                    {/* Validity pricing */}
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800">Validity-based Pricing</p>
                      {checkboxRow("Sell by validity period", form.validityPricingEnabled || false, (v) => sf({ validityPricingEnabled: v }))}
                      {form.validityPricingEnabled && (
                        <div className="pl-5 space-y-1.5">
                          <Label>Validity options in days (comma-separated)</Label>
                          <Input className={fieldCls} placeholder="30,90,180" value={form.validityOptionsDaysText || ""} onChange={(e) => sf({ validityOptionsDaysText: e.target.value })} />
                        </div>
                      )}
                    </div>
                    {/* Sidebar meta */}
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800">Sidebar Display Controls</p>
                      <div className="space-y-1.5">
                        <Label>Enrollment Count</Label>
                        <Input className={fieldCls} type="number" min={0} value={form.enrollmentCount || 0} onChange={(e) => sf({ enrollmentCount: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {[
                          ["showEnrollmentCount", "Show enrolled count"], ["showMetaLectures", "Show lectures"],
                          ["showMetaHours", "Show hours"], ["showMetaValidity", "Show validity"],
                          ["showMetaResources", "Show resources"], ["showMetaViews", "Show views"],
                          ["showMetaPerHour", "Show ₹/hr"], ["showMetaLanguage", "Show language"],
                        ].map(([key, label]) => checkboxRow(label, Boolean(form[key as keyof CourseForm]), (v) => sf({ [key]: v })))}
                      </div>
                    </div>
                    {/* Ratings */}
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500" /> Ratings & Reviews</p>
                      <div className="grid grid-cols-2 gap-3">
                        {checkboxRow("Show Ratings tab", form.ratingsEnabled !== false, (v) => sf({ ratingsEnabled: v }))}
                        {checkboxRow("Show Reviews tab", form.reviewsEnabled !== false, (v) => sf({ reviewsEnabled: v }))}
                      </div>
                      {form.ratingsEnabled && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label>Rating Value (0-5)</Label><Input className={fieldCls} type="number" step={0.1} min={0} max={5} value={form.ratingValue || 0} onChange={(e) => sf({ ratingValue: Number(e.target.value) || 0 })} /></div>
                          <div className="space-y-1.5"><Label>Rating Count</Label><Input className={fieldCls} type="number" min={0} value={form.ratingCount || 0} onChange={(e) => sf({ ratingCount: Number(e.target.value) || 0 })} /></div>
                        </div>
                      )}
                      {form.reviewsEnabled && (
                        <div className="space-y-1.5">
                          <Label>Reviews (one per line)</Label>
                          <textarea className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Name | 5 | Great course | 2 weeks ago" value={form.reviewsText || ""} onChange={(e) => sf({ reviewsText: e.target.value })} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── DELIVERY TAB ── */}
                {dialogTab === "delivery" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800">Lecture Mode Pricing</p>
                      {checkboxRow("Enable delivery mode-wise pricing", form.deliveryModePricingEnabled || false, (v) => sf({ deliveryModePricingEnabled: v }))}
                      {form.deliveryModePricingEnabled && (
                        <div className="space-y-3 pl-4">
                          {[
                            { key: "enableOnlineMode", label: "Online", priceKey: "onlineModePrice" },
                            { key: "enableGoogleDriveMode", label: "Google Drive", priceKey: "googleDriveModePrice" },
                            { key: "enablePenDriveMode", label: "Pen Drive", priceKey: "penDriveModePrice" },
                          ].map(({ key, label, priceKey }) => (
                            <div key={key} className="grid grid-cols-[auto_1fr] items-center gap-3">
                              {checkboxRow(label, Boolean(form[key as keyof CourseForm]), (v) => sf({ [key]: v }))}
                              <Input className={fieldCls} type="number" placeholder={`${label} price`} value={(form[priceKey as keyof CourseForm] as number) || 0} onChange={(e) => sf({ [priceKey]: Number(e.target.value) || 0 })} />
                            </div>
                          ))}
                          {/* Custom mode */}
                          <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-3">
                            {checkboxRow("Custom", form.enableCustomMode || false, (v) => sf({ enableCustomMode: v }))}
                            <Input className={fieldCls} placeholder="Mode name" value={form.customModeName || ""} onChange={(e) => sf({ customModeName: e.target.value })} />
                            <Input className={fieldCls} type="number" placeholder="Price" value={form.customModePrice || 0} onChange={(e) => sf({ customModePrice: Number(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Additional custom modes (one per line: Name: Price)</Label>
                            <textarea className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder={"Android App: 1499\nPrinted Book + Online: 2499"} value={form.customModesText || ""} onChange={(e) => sf({ customModesText: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Book Addons */}
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800">Book Add-ons</p>
                      {checkboxRow("Enable book selection add-ons", form.bookAddonEnabled || false, (v) => sf({ bookAddonEnabled: v }))}
                      {form.bookAddonEnabled && (
                        <div className="space-y-3 pl-4">
                          {[
                            { key: "enableEnotesAddon", label: "eNotes", priceKey: "enotesAddonPrice" },
                            { key: "enablePhysicalBookAddon", label: "Physical Book", priceKey: "physicalBookAddonPrice" },
                          ].map(({ key, label, priceKey }) => (
                            <div key={key} className="grid grid-cols-[auto_1fr] items-center gap-3">
                              {checkboxRow(label, Boolean(form[key as keyof CourseForm]), (v) => sf({ [key]: v }))}
                              <Input className={fieldCls} type="number" placeholder={`${label} add-on price`} value={(form[priceKey as keyof CourseForm] as number) || 0} onChange={(e) => sf({ [priceKey]: Number(e.target.value) || 0 })} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── CONTENT TAB ── */}
                {dialogTab === "content" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800">About Course Section</p>
                      {checkboxRow("Show About Course section on course page", form.aboutCourseEnabled || false, (v) => sf({ aboutCourseEnabled: v }))}
                      {form.aboutCourseEnabled && (
                        <div className="space-y-1.5">
                          <Label>About Course Text</Label>
                          <textarea className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Dear Students, this course covers…" value={form.aboutCourseText || ""} onChange={(e) => sf({ aboutCourseText: e.target.value })} />
                          <p className="text-[10px] text-slate-400">Supports multi-line content and bullet points.</p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">💡 To manage curriculum chapters and lessons, go to <strong>Course Content</strong> from the course row actions.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dialog footer */}
              <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                <div className="flex gap-1">
                  {dialogTabs.map((tab, i) => (
                    <button key={tab.key} type="button" onClick={() => setDialogTab(tab.key)}
                      className={`h-1.5 w-6 rounded-full transition-all ${dialogTab === tab.key ? "bg-primary" : "bg-slate-200"}`} />
                  ))}
                </div>
                <div className="flex gap-2">
                  {dialogTab !== "content" && (
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs" onClick={() => {
                      const idx = dialogTabs.findIndex((t) => t.key === dialogTab);
                      if (idx < dialogTabs.length - 1) setDialogTab(dialogTabs[idx + 1].key);
                    }}>Next →</Button>
                  )}
                  <Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={handleSaveCourse} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : editingId ? "Update Course" : "Create Course"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Course List ──────────────────────────────────────── */}
      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No courses found</p>
          <p className="mt-1 text-xs text-slate-400">Add a course or adjust your search</p>
        </div>
      ) : viewMode === "grid" ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCourses.map((course) => {
            const meta = curriculumMetaByCourse[course.id];
            const catName = categoriesById[course.category]?.name || course.category;
            const subName = categoriesById[course.subcategory]?.name || "";
            return (
              <div key={course.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                {/* Thumbnail */}
                <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-10 w-10 text-slate-300" />
                    </div>
                  )}
                  <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${course.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${course.isVisible ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {course.isVisible ? "Published" : "Draft"}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{catName}</span>
                    {subName && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{subName}</span>}
                  </div>
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">{course.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{course.professor}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{meta ? formatSecondsToClock(meta.totalSeconds) : `${course.hours}h`}</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{meta?.lectures ?? course.lectures} lectures</span>
                    <span className="ml-auto text-sm font-bold text-slate-900">₹{course.price.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
                  <button type="button" onClick={() => handleToggleVisibility(course.id)} title={course.isVisible ? "Hide" : "Publish"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800">
                    {course.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => openEditDialog(course)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-primary/10 hover:text-primary">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDuplicateCourse(course)} title="Duplicate" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDeleteCourse(course.id)} title="Delete" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* List header */}
          <div className="grid grid-cols-[2fr_1fr_auto_auto_auto] items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Course</span>
            <span>Category</span>
            <span className="text-right">Price</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredCourses.map((course) => {
              const meta = curriculumMetaByCourse[course.id];
              const catName = categoriesById[course.category]?.name || course.category;
              const subName = categoriesById[course.subcategory]?.name || "";
              return (
                <div key={course.id} className="grid grid-cols-[2fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50">
                  {/* Course info */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-slate-200">
                      {course.thumbnail
                        ? <img src={course.thumbnail} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full items-center justify-center"><BookOpen className="h-4 w-4 text-slate-300" /></div>}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{course.title}</p>
                      <p className="truncate text-xs text-slate-400">{course.professor} · {meta?.lectures ?? course.lectures} lectures · {meta ? formatSecondsToClock(meta.totalSeconds) : `${course.hours}h`}</p>
                    </div>
                  </div>
                  {/* Category */}
                  <div className="flex min-w-0 flex-wrap gap-1">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{catName}</span>
                    {subName && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{subName}</span>}
                  </div>
                  {/* Price */}
                  <span className="text-sm font-bold text-slate-900 text-right">₹{course.price.toLocaleString()}</span>
                  {/* Status badge */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${course.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${course.isVisible ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {course.isVisible ? "Published" : "Draft"}
                  </span>
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleToggleVisibility(course.id)} title={course.isVisible ? "Hide" : "Publish"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                      {course.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => openEditDialog(course)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDuplicateCourse(course)} title="Duplicate" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDeleteCourse(course.id)} title="Delete" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
