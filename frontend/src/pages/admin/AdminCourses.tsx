import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Chapter, type ManagedCourse, usePlatformData } from "@/context/PlatformDataContext";
import {
  adminApi,
  type CourseMasterDeliveryMode,
  type CourseMasterLanguage,
  type CourseMasterAttemptOption,
  type CourseMasterPricingCombination,
  type CourseMasterSubject,
  type CourseMasterValidityOption,
  type CourseMasterViewMode,
} from "@/services/adminApi";
import { decodeVideoUrl } from "@/lib/video-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, ArrowUpDown, Copy, BookOpen, Clock, DollarSign, Tag, Video, Package, FileText, Star, Settings, Loader2, LayoutGrid, List, Layers, CheckCircle2, X, ChevronDown, ChevronUp } from "lucide-react";

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

const parseFirstPositiveInt = (value: unknown): number => {
  const text = String(value || "");
  const match = text.match(/(\d+)/);
  if (!match) return 0;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) && numeric >= 1 ? numeric : 0;
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

const decodeDemoVideoValue = (value: unknown) => decodeVideoUrl(String(value || "")).trim();

type CourseForm = {
  id: string; title: string; category: string; subcategory: string; price: number; originalPrice: number; taxPercentage: number;
  subject: string; chapter: string; selectedChapters: string[];
  language: string; professor: string; lectures: number; hours: number; thumbnail?: string;
  demoVideoTitle?: string; demoVideoDescription?: string; demoVideoSource?: "youtube" | "direct" | "upload";
  demoVideoUrl?: string; demoVideoThumbnailUrl?: string; demoVideoVisible?: boolean;
  webPlayEnabled?: boolean;
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
  masterCombinationsEnabled?: boolean;
  masterCombinationRows?: CourseMasterPricingCombination[];
  combinationUseView?: boolean;
  combinationUseValidity?: boolean;
  combinationUseAttempt?: boolean;
  combinationUseMode?: boolean;
};

const toCourseForm = (c: ManagedCourse): CourseForm => ({
  id: c.id, title: c.title, category: c.category, subcategory: c.subcategory || "general",
  subject: String(c.subject || ""),
  chapter: String(c.chapter || ""),
  selectedChapters: Array.isArray(c.selectedChapters)
    ? c.selectedChapters.map((item) => String(item || "").trim()).filter(Boolean)
    : (c.chapter ? [String(c.chapter)] : []),
  price: c.price, originalPrice: c.originalPrice, taxPercentage: Math.max(0, Number(c.taxPercentage || 0)), language: c.language, professor: c.professor,
  lectures: c.lectures, hours: c.hours, thumbnail: c.thumbnail,
  demoVideoTitle: c.demoVideoTitle, demoVideoDescription: c.demoVideoDescription,
  demoVideoSource: c.demoVideoSource, demoVideoUrl: decodeDemoVideoValue(c.demoVideoUrl),
  demoVideoThumbnailUrl: c.demoVideoThumbnailUrl, demoVideoVisible: c.demoVideoVisible,
  webPlayEnabled: c.webPlayEnabled === true,
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
  masterCombinationsEnabled: Array.isArray(c.masterConfig?.combinations) && c.masterConfig.combinations.length > 0,
  masterCombinationRows: Array.isArray(c.masterConfig?.combinations)
    ? c.masterConfig.combinations
        .map((item, index) => ({
          id: String(item.id || `combo-${index + 1}`),
          label: String(item.label || ""),
          viewModeId: item.viewModeId ? String(item.viewModeId) : null,
          validityOptionId: item.validityOptionId ? String(item.validityOptionId) : null,
          attemptOptionId: item.attemptOptionId ? String(item.attemptOptionId) : null,
          deliveryModeId: item.deliveryModeId ? String(item.deliveryModeId) : null,
          languageId: item.languageId ? String(item.languageId) : null,
          price: Number(item.price || 0),
          originalPrice: item.originalPrice === null || item.originalPrice === undefined ? null : Number(item.originalPrice || 0),
          isActive: true,
          sortOrder: Number(index + 1),
        }))
    : [],
  combinationUseView: c.masterConfig?.combinationBasis?.useView
    ?? Boolean(c.masterConfig?.combinations?.some((item) => item.viewModeId)),
  combinationUseValidity: c.masterConfig?.combinationBasis?.useValidity
    ?? Boolean(c.masterConfig?.combinations?.some((item) => item.validityOptionId)),
  combinationUseAttempt: c.masterConfig?.combinationBasis?.useAttempt
    ?? Boolean(c.masterConfig?.combinations?.some((item) => item.attemptOptionId)),
  combinationUseMode: c.masterConfig?.combinationBasis?.useMode
    ?? Boolean(c.masterConfig?.combinations?.some((item) => item.deliveryModeId)),
});

const BLANK_FORM: CourseForm = {
  id: "", title: "", category: "", subcategory: "general", price: 0, originalPrice: 0, taxPercentage: 0,
  subject: "", chapter: "", selectedChapters: [],
  language: "English", professor: "Ednovate Faculty", lectures: 0, hours: 0, thumbnail: "",
  demoVideoTitle: "", demoVideoDescription: "", demoVideoSource: "youtube", demoVideoUrl: "",
  demoVideoThumbnailUrl: "", demoVideoVisible: false, webPlayEnabled: false, isSubcategoryCustom: false,
  viewPricingEnabled: false, unlimitedViewsEnabled: false, validityPricingEnabled: false,
  viewOptionsText: "1,2", validityOptionsDaysText: "30,90,180", deliveryModePricingEnabled: false,
  enableOnlineMode: true, enableGoogleDriveMode: false, enablePenDriveMode: false, enableCustomMode: false,
  onlineModePrice: 0, googleDriveModePrice: 0, penDriveModePrice: 0, customModeName: "", customModePrice: 0,
  customModesText: "", bookAddonEnabled: false, enableEnotesAddon: false, enotesAddonPrice: 0,
  enablePhysicalBookAddon: false, physicalBookAddonPrice: 0, aboutCourseEnabled: false, aboutCourseText: "",
  ratingsEnabled: true, reviewsEnabled: true, ratingValue: 4.8, ratingCount: 0, reviewsText: "",
  enrollmentCount: 0, showEnrollmentCount: true, showMetaLectures: true, showMetaHours: true,
  showMetaValidity: true, showMetaResources: true, showMetaViews: true, showMetaPerHour: true, showMetaLanguage: true,
  masterCombinationsEnabled: false,
  masterCombinationRows: [],
  combinationUseView: true,
  combinationUseValidity: true,
  combinationUseAttempt: false,
  combinationUseMode: false,
};

type DialogTab = "basic" | "pricing" | "content";
type VideoUploadState = {
  scope: "course" | "package";
  fileName: string;
  progress: number;
  status: "uploading" | "success" | "error" | "cancelled";
  message?: string;
};

/* ─── small reusable bits ─────────────────────────────────────── */
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{children}</label>
);
const fieldCls = "h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 shadow-sm hover:border-slate-300";
const checkboxRow = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
  <label className="flex cursor-pointer items-center gap-2.5">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-primary" />
    <span className="text-xs font-medium text-slate-700">{label}</span>
  </label>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function AdminCourses() {
  const { courses, categories, setCurriculumForCourse, toggleCourseVisibility, upsertCourse, deleteCourse } = usePlatformData();
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [showHeaderFilters, setShowHeaderFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [facultyOptions, setFacultyOptions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm>(BLANK_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<DialogTab>("basic");
  const [isSaving, setIsSaving] = useState(false);
  const [courseThumbnailUploading, setCourseThumbnailUploading] = useState(false);
  const [courseDemoVideoUploading, setCourseDemoVideoUploading] = useState(false);
  const [courseDemoThumbUploading, setCourseDemoThumbUploading] = useState(false);
  const [videoUploadState, setVideoUploadState] = useState<VideoUploadState | null>(null);
  const [uploadPanelMinimized, setUploadPanelMinimized] = useState(false);
  const courseUploadAbortRef = useRef<AbortController | null>(null);
  const pkgUploadAbortRef = useRef<AbortController | null>(null);
  const [courseCurricula, setCourseCurricula] = useState<Record<string, Chapter[]>>({});
  const [curriculumMetaByCourse, setCurriculumMetaByCourse] = useState<Record<string, { lectures: number; totalSeconds: number; hours: number }>>({});
  const [masterViewModes, setMasterViewModes] = useState<CourseMasterViewMode[]>([]);
  const [masterValidityOptions, setMasterValidityOptions] = useState<CourseMasterValidityOption[]>([]);
  const [masterDeliveryModes, setMasterDeliveryModes] = useState<CourseMasterDeliveryMode[]>([]);
  const [masterLanguages, setMasterLanguages] = useState<CourseMasterLanguage[]>([]);
  const [masterAttemptOptions, setMasterAttemptOptions] = useState<CourseMasterAttemptOption[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<CourseMasterSubject[]>([]);
  const [courseComboSelectorOpen, setCourseComboSelectorOpen] = useState(false);
  const [courseSelectedViewModeIds, setCourseSelectedViewModeIds] = useState<string[]>([]);
  const [courseSelectedValidityIds, setCourseSelectedValidityIds] = useState<string[]>([]);
  const [courseSelectedAttemptIds, setCourseSelectedAttemptIds] = useState<string[]>([]);
  const [courseSelectedDeliveryModeIds, setCourseSelectedDeliveryModeIds] = useState<string[]>([]);

  // ── Package Builder state ──────────────────────────────────
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgTab, setPkgTab] = useState<"courses"|"details"|"pricing"|"content">("courses");
  const [pkgEditingId, setPkgEditingId] = useState<string | null>(null);
  const [pkgTitle, setPkgTitle] = useState("");
  const [pkgThumbnail, setPkgThumbnail] = useState("");
  const [pkgThumbnailUploading, setPkgThumbnailUploading] = useState(false);
  const [pkgCategory, setPkgCategory] = useState("");
  const [pkgSubcategory, setPkgSubcategory] = useState("");
  const [pkgPrice, setPkgPrice] = useState(0);
  const [pkgOriginalPrice, setPkgOriginalPrice] = useState(0);
  const [pkgTaxPct, setPkgTaxPct] = useState(0);
  const [pkgMasterCombinationRows, setPkgMasterCombinationRows] = useState<CourseMasterPricingCombination[]>([]);
  const [pkgCombinationUseView, setPkgCombinationUseView] = useState(true);
  const [pkgCombinationUseValidity, setPkgCombinationUseValidity] = useState(true);
  const [pkgCombinationUseMode, setPkgCombinationUseMode] = useState(false);
  const [pkgCombinationUseAttempt, setPkgCombinationUseAttempt] = useState(false);
  const [pkgComboSelectorOpen, setPkgComboSelectorOpen] = useState(false);
  const [pkgSelectedViewModeIds, setPkgSelectedViewModeIds] = useState<string[]>([]);
  const [pkgSelectedValidityIds, setPkgSelectedValidityIds] = useState<string[]>([]);
  const [pkgSelectedAttemptIds, setPkgSelectedAttemptIds] = useState<string[]>([]);
  const [pkgSelectedDeliveryModeIds, setPkgSelectedDeliveryModeIds] = useState<string[]>([]);
  const [pkgLanguage, setPkgLanguage] = useState("Hindi + English");
  const [pkgProfessor, setPkgProfessor] = useState("Multiple Faculty");
  const [pkgCourseIds, setPkgCourseIds] = useState<string[]>([]);
  const [pkgSearch, setPkgSearch] = useState("");
  const [pkgSaving, setPkgSaving] = useState(false);
  // Pricing options
  const [pkgViewPricingEnabled, setPkgViewPricingEnabled] = useState(false);
  const [pkgUnlimitedViews, setPkgUnlimitedViews] = useState(false);
  const [pkgViewOptionsText, setPkgViewOptionsText] = useState("1,2");
  const [pkgValidityEnabled, setPkgValidityEnabled] = useState(false);
  const [pkgValidityDaysText, setPkgValidityDaysText] = useState("30,90,180");
  // Delivery modes
  const [pkgDeliveryEnabled, setPkgDeliveryEnabled] = useState(false);
  const [pkgOnlineMode, setPkgOnlineMode] = useState(true);
  const [pkgOnlinePrice, setPkgOnlinePrice] = useState(0);
  const [pkgDriveMode, setPkgDriveMode] = useState(false);
  const [pkgDrivePrice, setPkgDrivePrice] = useState(0);
  const [pkgPenMode, setPkgPenMode] = useState(false);
  const [pkgPenPrice, setPkgPenPrice] = useState(0);
  // Book addons
  const [pkgBookAddon, setPkgBookAddon] = useState(false);
  const [pkgEnotesEnabled, setPkgEnotesEnabled] = useState(false);
  const [pkgEnotesPrice, setPkgEnotesPrice] = useState(0);
  const [pkgPhysBookEnabled, setPkgPhysBookEnabled] = useState(false);
  const [pkgPhysBookPrice, setPkgPhysBookPrice] = useState(0);
  // Demo video
  const [pkgDemoVideoVisible, setPkgDemoVideoVisible] = useState(false);
  const [pkgWebPlayEnabled, setPkgWebPlayEnabled] = useState(false);
  const [pkgDemoVideoTitle, setPkgDemoVideoTitle] = useState("");
  const [pkgDemoVideoDescription, setPkgDemoVideoDescription] = useState("");
  const [pkgDemoVideoSource, setPkgDemoVideoSource] = useState<"youtube" | "direct" | "upload">("youtube");
  const [pkgDemoVideoUrl, setPkgDemoVideoUrl] = useState("");
  const [pkgDemoVideoThumbnailUrl, setPkgDemoVideoThumbnailUrl] = useState("");
  const [pkgDemoVideoUploading, setPkgDemoVideoUploading] = useState(false);
  const [pkgDemoThumbUploading, setPkgDemoThumbUploading] = useState(false);
  // About + ratings/reviews + sidebar display controls
  const [pkgAboutCourseEnabled, setPkgAboutCourseEnabled] = useState(false);
  const [pkgAboutCourseText, setPkgAboutCourseText] = useState("");
  const [pkgRatingsEnabled, setPkgRatingsEnabled] = useState(true);
  const [pkgReviewsEnabled, setPkgReviewsEnabled] = useState(true);
  const [pkgRatingValue, setPkgRatingValue] = useState(4.8);
  const [pkgRatingCount, setPkgRatingCount] = useState(0);
  const [pkgReviewsText, setPkgReviewsText] = useState("");
  const [pkgEnrollmentCount, setPkgEnrollmentCount] = useState(0);
  const [pkgShowEnrollmentCount, setPkgShowEnrollmentCount] = useState(true);
  const [pkgShowMetaLectures, setPkgShowMetaLectures] = useState(true);
  const [pkgShowMetaHours, setPkgShowMetaHours] = useState(true);
  const [pkgShowMetaValidity, setPkgShowMetaValidity] = useState(true);
  const [pkgShowMetaResources, setPkgShowMetaResources] = useState(true);
  const [pkgShowMetaViews, setPkgShowMetaViews] = useState(true);
  const [pkgShowMetaPerHour, setPkgShowMetaPerHour] = useState(true);
  const [pkgShowMetaLanguage, setPkgShowMetaLanguage] = useState(true);

  const courseUploadPercent = videoUploadState?.scope === "course" ? videoUploadState.progress : 0;
  const pkgUploadPercent = videoUploadState?.scope === "package" ? videoUploadState.progress : 0;


  const sf = (updates: Partial<CourseForm>) => setForm((p) => ({ ...p, ...updates }));

  const masterViewModeMap = useMemo(
    () => Object.fromEntries(masterViewModes.map((item) => [item.id, item])),
    [masterViewModes],
  );
  const masterValidityMap = useMemo(
    () => Object.fromEntries(masterValidityOptions.map((item) => [item.id, item])),
    [masterValidityOptions],
  );
  const masterDeliveryModeMap = useMemo(
    () => Object.fromEntries(masterDeliveryModes.map((item) => [item.id, item])),
    [masterDeliveryModes],
  );
  const masterLanguageMap = useMemo(
    () => Object.fromEntries(masterLanguages.map((item) => [item.id, item])),
    [masterLanguages],
  );
  const masterAttemptMap = useMemo(
    () => Object.fromEntries(masterAttemptOptions.map((item) => [item.id, item])),
    [masterAttemptOptions],
  );

  const activeMasterViewModes = useMemo(
    () => masterViewModes.filter((item) => item.isActive),
    [masterViewModes],
  );
  const activeMasterValidityOptions = useMemo(
    () => masterValidityOptions.filter((item) => item.isActive),
    [masterValidityOptions],
  );
  const activeMasterDeliveryModes = useMemo(
    () => masterDeliveryModes.filter((item) => item.isActive),
    [masterDeliveryModes],
  );
  const activeMasterLanguages = useMemo(
    () => masterLanguages.filter((item) => item.isActive),
    [masterLanguages],
  );
  const activeMasterAttemptOptions = useMemo(
    () => masterAttemptOptions.filter((item) => item.isActive),
    [masterAttemptOptions],
  );

  const buildCombinationRows = useCallback((
    options: {
      useView: boolean;
      useValidity: boolean;
      useAttempt: boolean;
      useMode: boolean;
      selectedViewModeIds?: string[];
      selectedValidityOptionIds?: string[];
      selectedAttemptOptionIds?: string[];
      selectedDeliveryModeIds?: string[];
    },
    existingRows: CourseMasterPricingCombination[],
    idPrefix: "course" | "pkg",
    basePrice?: number,
    baseOriginalPrice?: number,
  ): CourseMasterPricingCombination[] => {
    const sourceViews = options.useView
      ? activeMasterViewModes.filter((item) => {
        if (!Array.isArray(options.selectedViewModeIds) || options.selectedViewModeIds.length === 0) return true;
        return options.selectedViewModeIds.includes(item.id);
      })
      : [];
    const sourceValidity = options.useValidity
      ? activeMasterValidityOptions.filter((item) => {
        if (!Array.isArray(options.selectedValidityOptionIds) || options.selectedValidityOptionIds.length === 0) return true;
        return options.selectedValidityOptionIds.includes(item.id);
      })
      : [];
    const sourceModes = options.useMode
      ? activeMasterDeliveryModes.filter((item) => {
        if (!Array.isArray(options.selectedDeliveryModeIds) || options.selectedDeliveryModeIds.length === 0) return true;
        return options.selectedDeliveryModeIds.includes(item.id);
      })
      : [];
    const sourceAttempts = options.useAttempt
      ? activeMasterAttemptOptions.filter((item) => {
        if (!Array.isArray(options.selectedAttemptOptionIds) || options.selectedAttemptOptionIds.length === 0) return true;
        return options.selectedAttemptOptionIds.includes(item.id);
      })
      : [];

    if ((options.useView && sourceViews.length === 0)
      || (options.useValidity && sourceValidity.length === 0)
      || (options.useAttempt && sourceAttempts.length === 0)
      || (options.useMode && sourceModes.length === 0)
       ) {
      return existingRows;
    }

    const views = options.useView ? sourceViews.map((item) => item.id) : [null];
    const validities = options.useValidity ? sourceValidity.map((item) => item.id) : [null];
    const attempts = options.useAttempt ? sourceAttempts.map((item) => item.id) : [null];
    const modes = options.useMode ? sourceModes.map((item) => item.id) : [null];

    const existingMap = new Map(
      existingRows.map((item) => [
        `${item.viewModeId || "any"}|${item.validityOptionId || "any"}|${item.deliveryModeId || "any"}|${item.languageId || "any"}`,
        item,
      ]),
    );

    const rows: CourseMasterPricingCombination[] = [];
    let sortOrder = 1;

    for (const viewModeId of views) {
      for (const validityOptionId of validities) {
        for (const attemptOptionId of attempts) {
        for (const deliveryModeId of modes) {
          const key = `${viewModeId || "any"}|${validityOptionId || "any"}|${attemptOptionId || "any"}|${deliveryModeId || "any"}|any`;
            const previous = existingMap.get(key);
          
            // Calculate price multipliers based on selected view/validity
            const viewMode = viewModeId ? masterViewModeMap[viewModeId] : null;
            const validityOption = validityOptionId ? masterValidityMap[validityOptionId] : null;
            const viewMultiplier = viewMode ? Math.max(1, Number(viewMode.maxViews || 1)) : 1;
            const validityMultiplier = validityOption ? Math.max(1, (Number(validityOption.days || 30) / 30)) : 1;
          
            // Auto-calculate price if base price provided and no previous price exists
            let autoPrice = 0;
            if (basePrice && basePrice > 0 && (!previous || (previous && Number(previous.price || 0) === 0))) {
              autoPrice = Math.round(basePrice * viewMultiplier * validityMultiplier);
            }
          
            let autoOriginalPrice: number | null = null;
            if (baseOriginalPrice && baseOriginalPrice > 0 && (!previous || (previous && previous.originalPrice === null))) {
              autoOriginalPrice = Math.round(baseOriginalPrice * viewMultiplier * validityMultiplier);
            }
          
            rows.push({
              id: previous?.id || `${idPrefix}-combo-${Date.now()}-${sortOrder}`,
              label: previous?.label || "",
              viewModeId,
              validityOptionId,
              attemptOptionId,
              deliveryModeId,
              price: previous?.price !== undefined && previous.price > 0 ? Number(previous.price) : autoPrice,
              originalPrice: previous?.originalPrice !== undefined && previous.originalPrice !== null
                ? Number(previous.originalPrice)
                : autoOriginalPrice,
              isActive: previous?.isActive !== false,
              sortOrder,
            });
            sortOrder += 1;
          }
        }
      }
    }

    return rows;
  }, [
    activeMasterDeliveryModes,
    activeMasterAttemptOptions,
    activeMasterValidityOptions,
    activeMasterViewModes,
    masterDeliveryModeMap,
    masterValidityMap,
    masterViewModeMap,
  ]);

  const fileToBase64 = useCallback((file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  }), []);

  const loadCurriculumMeta = useCallback(async () => {
    try {
      const response = await adminApi.getCourses();
      const rawCurricula = response.curricula && typeof response.curricula === "object" ? response.curricula : {};
      const nextCurricula = Object.fromEntries(
        Object.entries(rawCurricula).map(([id, chapters]) => [id, Array.isArray(chapters) ? chapters as Chapter[] : []]),
      );
      setCourseCurricula(nextCurricula);
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

  useEffect(() => {
    const loadFacultyOptions = async () => {
      try {
        const response = await fetch("/api/faculty");
        if (!response.ok) throw new Error("Failed to load faculty");
        const data = await response.json();
        const names = Array.isArray(data?.items)
          ? data.items
              .map((item: { name?: string }) => String(item?.name || "").trim())
              .filter(Boolean)
          : [];
        setFacultyOptions(Array.from(new Set(names)));
      } catch {
        setFacultyOptions([]);
      }
    };

    void loadFacultyOptions();
  }, []);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const result = await adminApi.getCourseMasters();
        setMasterViewModes(Array.isArray(result.viewModes) ? result.viewModes : []);
        setMasterValidityOptions(Array.isArray(result.validityOptions) ? result.validityOptions : []);
        setMasterAttemptOptions(Array.isArray(result.attemptOptions) ? result.attemptOptions : []);
        setMasterDeliveryModes(Array.isArray(result.deliveryModes) ? result.deliveryModes : []);
        setMasterLanguages(Array.isArray(result.languages) ? result.languages : []);
        setMasterSubjects(Array.isArray(result.subjects) ? result.subjects : []);
      } catch {
        setMasterViewModes([]);
        setMasterValidityOptions([]);
        setMasterAttemptOptions([]);
        setMasterDeliveryModes([]);
        setMasterLanguages([]);
        setMasterSubjects([]);
      }
    };

    void loadMasters();
  }, []);

  const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const parentCategories = useMemo(() => categories.filter((c) => c.parentId === null), [categories]);
  const getCategoryCodePrefix = useCallback((categoryId: string) => {
    const category = categoriesById[categoryId];
    const raw = String(category?.name || category?.slug || categoryId || "general");
    const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return compact || "GEN";
  }, [categoriesById]);

  const getNextCategoryCourseCode = useCallback((categoryId: string, existingId?: string) => {
    const prefix = getCategoryCodePrefix(categoryId);
    const serialWidth = Math.max(3, 6 - prefix.length);
    const matcher = new RegExp(`^${prefix}(\\d+)$`, "i");
    const usedSerials = courses
      .map((course) => {
        if (existingId && course.id === existingId) return null;
        const match = String(course.id || "").match(matcher);
        if (!match) return null;
        const numeric = Number(match[1]);
        return Number.isFinite(numeric) ? numeric : null;
      })
      .filter((value): value is number => value !== null);
    const nextSerial = (usedSerials.length > 0 ? Math.max(...usedSerials) : 0) + 1;
    return `${prefix}${String(nextSerial).padStart(serialWidth, "0")}`;
  }, [courses, getCategoryCodePrefix]);

  const subcategoryOptions = useMemo(() => categories.filter((c) => c.parentId === form.category), [categories, form.category]);
  const subjectOptions = useMemo(
    () => masterSubjects
      .filter((item) => item.isActive !== false)
      .filter((item) => {
        const courseMatch = (item.courseIds || []).includes(form.category);
        const levelMatch = (item.levelIds || []).includes(form.subcategory);
        if (form.subcategory && form.subcategory !== "general") {
          return levelMatch || courseMatch;
        }
        return courseMatch;
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [masterSubjects, form.category, form.subcategory],
  );
  const chapterOptions = useMemo(() => {
    const activeSubject = subjectOptions.find((item) => item.name === form.subject);
    if (!activeSubject || !Array.isArray(activeSubject.chapters)) return [];
    return activeSubject.chapters
      .filter((item) => item.isActive !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }, [subjectOptions, form.subject]);
  const fallbackCategoryId = parentCategories[0]?.id || "general";
  const fallbackSubcategoryId = subcategoryOptions[0]?.id || "general";

  useEffect(() => {
    if (!form.category) return;
    const hasValidParentCategory = parentCategories.some((c) => c.id === form.category);
    if (!hasValidParentCategory) {
      sf({ category: fallbackCategoryId, subcategory: categories.find((c) => c.parentId === fallbackCategoryId)?.id || "general" });
      return;
    }

    if (!form.subcategory) return;
    const hasValidSubcategory = subcategoryOptions.some((s) => s.id === form.subcategory);
    if (!hasValidSubcategory) {
      sf({ subcategory: fallbackSubcategoryId });
    }
  }, [form.category, form.subcategory, parentCategories, subcategoryOptions, fallbackCategoryId, fallbackSubcategoryId, categories]);

  useEffect(() => {
    if (!form.subject) return;
    const hasValidSubject = subjectOptions.some((item) => item.name === form.subject);
    if (!hasValidSubject) {
      sf({
        subject: "",
        chapter: "",
        selectedChapters: [],
      });
      return;
    }

    const validSelectedChapters = form.selectedChapters.filter((name) => chapterOptions.some((item) => item.name === name));
    const nextChapter = validSelectedChapters[0] || "";
    const selectedChanged = validSelectedChapters.length !== form.selectedChapters.length
      || validSelectedChapters.some((item, index) => item !== form.selectedChapters[index]);
    if (selectedChanged || form.chapter !== nextChapter) {
      sf({
        selectedChapters: validSelectedChapters,
        chapter: nextChapter,
      });
    }
  }, [form.subject, form.chapter, form.selectedChapters, subjectOptions, chapterOptions]);

  const toggleChapterSelection = (chapterName: string, checked: boolean) => {
    const nextSelected = checked
      ? Array.from(new Set([...form.selectedChapters, chapterName]))
      : form.selectedChapters.filter((item) => item !== chapterName);
    sf({
      selectedChapters: nextSelected,
      chapter: nextSelected[0] || "",
    });
  };

  const syncSelectedChaptersToCurriculum = useCallback(async (courseId: string, selectedChapterNames: string[]) => {
    const normalizedSelected = Array.from(new Set(selectedChapterNames.map((item) => String(item || "").trim()).filter(Boolean)));
    if (normalizedSelected.length === 0) return;

    const rawExisting = courseCurricula[courseId];
    const existing = Array.isArray(rawExisting) ? rawExisting : [];

    const matchedTitles = new Set<string>();
    const seeded = normalizedSelected.map((name, index) => {
      const existingChapter = existing.find((chapter) => String(chapter.title || "").trim().toLowerCase() === name.toLowerCase());
      if (existingChapter) {
        matchedTitles.add(String(existingChapter.title || "").trim().toLowerCase());
        return existingChapter;
      }

      return {
        id: `ch_${Date.now()}_${index + 1}`,
        title: name,
        description: "",
        lessons: [],
      } satisfies Chapter;
    });

    const untouched = existing.filter((chapter) => !matchedTitles.has(String(chapter.title || "").trim().toLowerCase()));
    const nextCurriculum = [...seeded, ...untouched];
    setCourseCurricula((prev) => ({ ...prev, [courseId]: nextCurriculum }));
    setCurriculumForCourse(courseId, nextCurriculum);
    await adminApi.saveCurriculum(courseId, nextCurriculum);
    window.dispatchEvent(new CustomEvent("curriculum-updated", { detail: { courseId, updatedAt: Date.now() } }));
  }, [courseCurricula, setCurriculumForCourse]);

  const courseFilterOptions = useMemo(() => {
    const used = new Set(courses.map((item) => String(item.category || "")).filter(Boolean));
    return parentCategories
      .filter((item) => used.has(item.id))
      .map((item) => ({ id: item.id, name: item.name }));
  }, [courses, parentCategories]);

  const levelFilterOptions = useMemo(() => {
    const pool = courses.filter((item) => courseFilter === "all" || item.category === courseFilter);
    const uniqueLevelIds = Array.from(new Set(pool.map((item) => String(item.subcategory || "")).filter(Boolean)));
    return uniqueLevelIds.map((id) => ({ id, name: categoriesById[id]?.name || id }));
  }, [courses, categoriesById, courseFilter]);

  const subjectFilterOptions = useMemo(() => {
    const pool = courses.filter((item) => {
      if (courseFilter !== "all" && item.category !== courseFilter) return false;
      if (levelFilter !== "all" && String(item.subcategory || "") !== levelFilter) return false;
      return true;
    });
    return Array.from(new Set(pool.map((item) => String(item.subject || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [courses, courseFilter, levelFilter]);

  const chapterFilterOptions = useMemo(() => {
    const pool = courses.filter((item) => {
      if (courseFilter !== "all" && item.category !== courseFilter) return false;
      if (levelFilter !== "all" && String(item.subcategory || "") !== levelFilter) return false;
      if (subjectFilter !== "all" && String(item.subject || "").trim() !== subjectFilter) return false;
      return true;
    });

    return Array.from(
      new Set(
        pool.flatMap((item) => {
          const selected = Array.isArray(item.selectedChapters)
            ? item.selectedChapters.map((chapter) => String(chapter || "").trim()).filter(Boolean)
            : [];
          const fallback = String(item.chapter || "").trim();
          return selected.length > 0 ? selected : (fallback ? [fallback] : []);
        }),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [courses, courseFilter, levelFilter, subjectFilter]);

  useEffect(() => {
    if (courseFilter === "all") return;
    const valid = courseFilterOptions.some((item) => item.id === courseFilter);
    if (!valid) setCourseFilter("all");
  }, [courseFilter, courseFilterOptions]);

  useEffect(() => {
    if (levelFilter === "all") return;
    const valid = levelFilterOptions.some((item) => item.id === levelFilter);
    if (!valid) setLevelFilter("all");
  }, [levelFilter, levelFilterOptions]);

  useEffect(() => {
    if (subjectFilter === "all") return;
    const valid = subjectFilterOptions.includes(subjectFilter);
    if (!valid) setSubjectFilter("all");
  }, [subjectFilter, subjectFilterOptions]);

  useEffect(() => {
    if (chapterFilter === "all") return;
    const valid = chapterFilterOptions.includes(chapterFilter);
    if (!valid) setChapterFilter("all");
  }, [chapterFilter, chapterFilterOptions]);

  const filteredCourses = useMemo(() =>
    courses
      .filter((c) => {
        const text = searchTerm.toLowerCase();
        const matchesSearch = c.title.toLowerCase().includes(text)
          || (categoriesById[c.category]?.name || c.category).toLowerCase().includes(text)
          || String(c.subject || "").toLowerCase().includes(text);
        if (!matchesSearch) return false;
        if (courseFilter !== "all" && c.category !== courseFilter) return false;
        if (levelFilter !== "all" && String(c.subcategory || "") !== levelFilter) return false;
        if (subjectFilter !== "all" && String(c.subject || "").trim() !== subjectFilter) return false;
        if (chapterFilter !== "all") {
          const selected = Array.isArray(c.selectedChapters)
            ? c.selectedChapters.map((chapter) => String(chapter || "").trim()).filter(Boolean)
            : [];
          const fallback = String(c.chapter || "").trim();
          const chapterNames = selected.length > 0 ? selected : (fallback ? [fallback] : []);
          if (!chapterNames.includes(chapterFilter)) return false;
        }
        return true;
      })
      .sort((a, b) => sortOrder === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)),
  [courses, categoriesById, searchTerm, sortOrder, courseFilter, levelFilter, subjectFilter, chapterFilter]);

  const suggestedFaculty = useMemo(() => {
    const query = form.professor.trim().toLowerCase();
    if (!query) return [];
    return facultyOptions
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [facultyOptions, form.professor]);

  const handleToggleVisibility = (courseId: string) => {
    toggleCourseVisibility(courseId);
    const next = courses.find((c) => c.id === courseId);
    if (next) adminApi.upsertCourse({ ...next, isVisible: !next.isVisible }).catch(() => {});
  };

  const openCourseCombinationSelector = () => {
    if (!form.combinationUseView && !form.combinationUseValidity && !form.combinationUseAttempt && !form.combinationUseMode) {
      alert("Select at least one basis (View, Validity, Attempt, or Mode)");
      return;
    }
    if (form.combinationUseView && activeMasterViewModes.length === 0) {
      alert("No View options found in Masters. Configure them first.");
      return;
    }
    if (form.combinationUseValidity && activeMasterValidityOptions.length === 0) {
      alert("No Validity options found in Masters. Configure them first.");
      return;
    }
    if (form.combinationUseAttempt && activeMasterAttemptOptions.length === 0) {
      alert("No Attempt options found in Masters. Configure them first.");
      return;
    }
    if (form.combinationUseMode && activeMasterDeliveryModes.length === 0) {
      alert("No Lecture Mode options found in Masters. Configure them first.");
      return;
    }

    setCourseSelectedViewModeIds(
      form.combinationUseView ? activeMasterViewModes.map((item) => item.id) : [],
    );
    setCourseSelectedValidityIds(
      form.combinationUseValidity ? activeMasterValidityOptions.map((item) => item.id) : [],
    );
    setCourseSelectedAttemptIds(
      form.combinationUseAttempt ? activeMasterAttemptOptions.map((item) => item.id) : [],
    );
    setCourseSelectedDeliveryModeIds(
      form.combinationUseMode ? activeMasterDeliveryModes.map((item) => item.id) : [],
    );
    setCourseComboSelectorOpen(true);
  };

  const generateCourseCombinationsFromSelected = () => {
    if (form.combinationUseView && courseSelectedViewModeIds.length === 0) {
      alert("Select at least one View option.");
      return;
    }
    if (form.combinationUseValidity && courseSelectedValidityIds.length === 0) {
      alert("Select at least one Validity option.");
      return;
    }
    if (form.combinationUseAttempt && courseSelectedAttemptIds.length === 0) {
      alert("Select at least one Attempt option.");
      return;
    }
    if (form.combinationUseMode && courseSelectedDeliveryModeIds.length === 0) {
      alert("Select at least one Lecture Mode option.");
      return;
    }

    sf({
      masterCombinationRows: buildCombinationRows(
        {
          useView: Boolean(form.combinationUseView),
          useValidity: Boolean(form.combinationUseValidity),
          useAttempt: Boolean(form.combinationUseAttempt),
          useMode: Boolean(form.combinationUseMode),
          selectedViewModeIds: courseSelectedViewModeIds,
          selectedValidityOptionIds: courseSelectedValidityIds,
          selectedAttemptOptionIds: courseSelectedAttemptIds,
          selectedDeliveryModeIds: courseSelectedDeliveryModeIds,
        },
        form.masterCombinationRows || [],
        "course",
        Number(form.price || 0),
        Number(form.originalPrice || form.price || 0),
      ),
    });
    setCourseComboSelectorOpen(false);
  };

  const openPackageCombinationSelector = () => {
    if (!pkgCombinationUseView && !pkgCombinationUseValidity && !pkgCombinationUseAttempt && !pkgCombinationUseMode) {
      alert("Select at least one basis (View, Validity, Attempt, or Mode)");
      return;
    }
    if (pkgCombinationUseView && activeMasterViewModes.length === 0) {
      alert("No View options found in Masters. Configure them first.");
      return;
    }
    if (pkgCombinationUseValidity && activeMasterValidityOptions.length === 0) {
      alert("No Validity options found in Masters. Configure them first.");
      return;
    }
    if (pkgCombinationUseAttempt && activeMasterAttemptOptions.length === 0) {
      alert("No Attempt options found in Masters. Configure them first.");
      return;
    }
    if (pkgCombinationUseMode && activeMasterDeliveryModes.length === 0) {
      alert("No Lecture Mode options found in Masters. Configure them first.");
      return;
    }

    setPkgSelectedViewModeIds(
      pkgCombinationUseView ? activeMasterViewModes.map((item) => item.id) : [],
    );
    setPkgSelectedValidityIds(
      pkgCombinationUseValidity ? activeMasterValidityOptions.map((item) => item.id) : [],
    );
    setPkgSelectedAttemptIds(
      pkgCombinationUseAttempt ? activeMasterAttemptOptions.map((item) => item.id) : [],
    );
    setPkgSelectedDeliveryModeIds(
      pkgCombinationUseMode ? activeMasterDeliveryModes.map((item) => item.id) : [],
    );
    setPkgComboSelectorOpen(true);
  };

  const generatePackageCombinationsFromSelected = () => {
    if (pkgCombinationUseView && pkgSelectedViewModeIds.length === 0) {
      alert("Select at least one View option.");
      return;
    }
    if (pkgCombinationUseValidity && pkgSelectedValidityIds.length === 0) {
      alert("Select at least one Validity option.");
      return;
    }
    if (pkgCombinationUseAttempt && pkgSelectedAttemptIds.length === 0) {
      alert("Select at least one Attempt option.");
      return;
    }
    if (pkgCombinationUseMode && pkgSelectedDeliveryModeIds.length === 0) {
      alert("Select at least one Lecture Mode option.");
      return;
    }

    setPkgMasterCombinationRows(
      buildCombinationRows(
        {
          useView: pkgCombinationUseView,
          useValidity: pkgCombinationUseValidity,
          useAttempt: pkgCombinationUseAttempt,
          useMode: pkgCombinationUseMode,
          selectedViewModeIds: pkgSelectedViewModeIds,
          selectedValidityOptionIds: pkgSelectedValidityIds,
          selectedAttemptOptionIds: pkgSelectedAttemptIds,
          selectedDeliveryModeIds: pkgSelectedDeliveryModeIds,
        },
        pkgMasterCombinationRows,
        "pkg",
        pkgPrice,
        pkgOriginalPrice,
      ),
    );
    setPkgComboSelectorOpen(false);
  };

  const openCreateDialog = () => {
    const initialCategory = parentCategories[0]?.id || "general";
    const initialSubcategory = categories.find((c) => c.parentId === initialCategory)?.id || "general";
    setEditingId(null);
    setForm({
      ...BLANK_FORM,
      id: getNextCategoryCourseCode(initialCategory),
      category: initialCategory,
      subcategory: initialSubcategory,
      subject: "",
      selectedChapters: [],
      chapter: "",
      language: masterLanguages[0]?.name || "",
    });
    setCourseThumbnailUploading(false);
    setCourseDemoVideoUploading(false);
    setCourseDemoThumbUploading(false);
    setDialogTab("basic");
    setDialogOpen(true);
  };

  const openEditDialog = (course: ManagedCourse) => {
    setEditingId(course.id);
    setForm(toCourseForm(course));
    setCourseThumbnailUploading(false);
    setCourseDemoVideoUploading(false);
    setCourseDemoThumbUploading(false);
    setDialogTab("basic");
    setDialogOpen(true);
  };

  const handleUploadCourseThumbnail = async (file?: File | null) => {
    if (!file) return;
    setCourseThumbnailUploading(true);
    try {
      const base64Data = await fileToBase64(file);
      const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, "courses");
      sf({ thumbnail: uploaded.url });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Thumbnail upload failed");
    } finally {
      setCourseThumbnailUploading(false);
    }
  };

  const handleUploadCourseDemoVideo = async (file?: File | null) => {
    if (!file) return;
    courseUploadAbortRef.current?.abort();
    const controller = new AbortController();
    courseUploadAbortRef.current = controller;
    setCourseDemoVideoUploading(true);
    setUploadPanelMinimized(false);
    setVideoUploadState({
      scope: "course",
      fileName: file.name,
      progress: 0,
      status: "uploading",
      message: "Uploading demo video...",
    });
    try {
      const uploaded = await adminApi.uploadVideoFileToBunnyWithProgress(file, "demo-videos", {
        signal: controller.signal,
        onProgress: (percent) => {
          setVideoUploadState((prev) => {
            if (!prev || prev.scope !== "course" || prev.status !== "uploading") return prev;
            return { ...prev, progress: percent, message: `Uploading demo video... ${percent}%` };
          });
        },
      });
      sf({ demoVideoUrl: uploaded.url });
      setVideoUploadState((prev) => (prev && prev.scope === "course"
        ? { ...prev, progress: 100, status: "success", message: "Upload complete" }
        : prev));
    } catch (e) {
      const cancelled = e instanceof Error && /cancelled/i.test(e.message);
      setVideoUploadState((prev) => (prev && prev.scope === "course"
        ? { ...prev, status: cancelled ? "cancelled" : "error", message: cancelled ? "Upload cancelled" : "Upload failed" }
        : prev));
      alert(e instanceof Error ? e.message : "Demo video upload failed");
    } finally {
      courseUploadAbortRef.current = null;
      setCourseDemoVideoUploading(false);
    }
  };

  const handleUploadCourseDemoThumbnail = async (file?: File | null) => {
    if (!file) return;
    setCourseDemoThumbUploading(true);
    try {
      const base64Data = await fileToBase64(file);
      const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, "demo-thumbnails");
      sf({ demoVideoThumbnailUrl: uploaded.url });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Demo thumbnail upload failed");
    } finally {
      setCourseDemoThumbUploading(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!form.title.trim()) { alert("Please add a valid course title"); return; }
    const UNLIMITED_VALIDITY_DAYS = 36500;
    const hasValidCourseComboPrice = form.masterCombinationsEnabled !== false && (form.masterCombinationRows || []).some(
      (row) => row.isActive !== false
        && Number(row.price || 0) > 0
        && Boolean(row.viewModeId || row.validityOptionId || row.attemptOptionId || row.deliveryModeId || row.languageId),
    );
    const deliveryModes: Array<{ id: string; label: string; price: number; originalPrice?: number }> = [];
    if (form.deliveryModePricingEnabled) {
      if (form.enableOnlineMode && Number(form.onlineModePrice || 0) > 0) deliveryModes.push({ id: "online", label: "Online", price: Number(form.onlineModePrice), originalPrice: Number(form.originalPrice || form.onlineModePrice) });
      if (form.enableGoogleDriveMode && Number(form.googleDriveModePrice || 0) > 0) deliveryModes.push({ id: "google-drive", label: "Google Drive", price: Number(form.googleDriveModePrice), originalPrice: Number(form.originalPrice || form.googleDriveModePrice) });
      if (form.enablePenDriveMode && Number(form.penDriveModePrice || 0) > 0) deliveryModes.push({ id: "pen-drive", label: "Pen Drive", price: Number(form.penDriveModePrice), originalPrice: Number(form.originalPrice || form.penDriveModePrice) });
      if (form.enableCustomMode && String(form.customModeName || "").trim() && Number(form.customModePrice || 0) > 0) deliveryModes.push({ id: "custom", label: String(form.customModeName).trim(), price: Number(form.customModePrice), originalPrice: Number(form.originalPrice || form.customModePrice) });
      parseCustomModes(form.customModesText || "").forEach((m) => deliveryModes.push({ id: m.id, label: m.label, price: m.price, originalPrice: Number(form.originalPrice || m.price) }));
    }
    if (!form.deliveryModePricingEnabled && Number(form.price || 0) <= 0 && !hasValidCourseComboPrice) {
      alert("Please add a valid base price or active combination price");
      return;
    }
    if (form.deliveryModePricingEnabled && deliveryModes.length === 0) { alert("Please enable at least one delivery mode with a valid price"); return; }
    const bookAddons: Array<{ id: string; label: string; price: number; enabled?: boolean }> = [];
    if (form.bookAddonEnabled) {
      if (form.enableEnotesAddon) bookAddons.push({ id: "enotes", label: "eNotes", price: Math.max(0, Number(form.enotesAddonPrice || 0)), enabled: true });
      if (form.enablePhysicalBookAddon) bookAddons.push({ id: "physical-book", label: "Physical Book", price: Math.max(0, Number(form.physicalBookAddonPrice || 0)), enabled: true });
    }
    const selectedMasterCombinationsWithPricing = (form.masterCombinationsEnabled === false ? [] : (form.masterCombinationRows || []))
      .map((item, index) => ({
        id: String(item.id || `combo-${index + 1}`).trim(),
        label: String(item.label || "").trim(),
        viewModeId: item.viewModeId ? String(item.viewModeId).trim() : null,
        validityOptionId: item.validityOptionId ? String(item.validityOptionId).trim() : null,
        attemptOptionId: item.attemptOptionId ? String(item.attemptOptionId).trim() : null,
        deliveryModeId: item.deliveryModeId ? String(item.deliveryModeId).trim() : null,
        languageId: item.languageId ? String(item.languageId).trim() : null,
        price: Number(item.price || 0),
        originalPrice: item.originalPrice === null || item.originalPrice === undefined
          ? null
          : Number(item.originalPrice || 0),
        isActive: item.isActive !== false,
        sortOrder: Number(item.sortOrder || index + 1),
      }))
      .filter((item) => item.isActive !== false && Boolean(item.viewModeId || item.validityOptionId || item.attemptOptionId || item.deliveryModeId || item.languageId));

    const hasMasterCombinationPricing = selectedMasterCombinationsWithPricing.length > 0;

    if (selectedMasterCombinationsWithPricing.some((item) => Number(item.price || 0) <= 0)) {
      alert("Selected master combinations must have valid price greater than 0");
      return;
    }

    const masterBasedPrice = selectedMasterCombinationsWithPricing.length > 0 ? Number(selectedMasterCombinationsWithPricing[0].price || 0) : null;
    const masterBasedOriginalPrice = selectedMasterCombinationsWithPricing.length > 0
      ? Number(selectedMasterCombinationsWithPricing[0].originalPrice || selectedMasterCombinationsWithPricing[0].price || 0)
      : null;

    const derivedBasePrice = form.deliveryModePricingEnabled
      ? Number(deliveryModes[0]?.price || 0)
      : Number(masterBasedPrice ?? Number(form.price || 0));
    const derivedBaseOriginalPrice = form.deliveryModePricingEnabled
      ? Number(deliveryModes[0]?.originalPrice || derivedBasePrice)
      : Number(masterBasedOriginalPrice ?? Number(form.originalPrice || form.price || 0));

    const selectedMasterViewModes = selectedMasterCombinationsWithPricing
      .map((combo) => (combo.viewModeId ? masterViewModeMap[combo.viewModeId] : null))
      .filter((item): item is CourseMasterViewMode => Boolean(item));
    const selectedMasterValidity = selectedMasterCombinationsWithPricing
      .map((combo) => (combo.validityOptionId ? masterValidityMap[combo.validityOptionId] : null))
      .filter((item): item is CourseMasterValidityOption => Boolean(item));

    const selectedMasterDeliveryModeIds = Array.from(new Set(
      selectedMasterCombinationsWithPricing
        .map((combo) => String(combo.deliveryModeId || "").trim())
        .filter(Boolean),
    ));
    const selectedMasterLanguageIds = Array.from(new Set(
      selectedMasterCombinationsWithPricing
        .map((combo) => String(combo.languageId || "").trim())
        .filter(Boolean),
    ));

    const selectedMasterDeliveryModes = selectedMasterDeliveryModeIds
      .map((id) => masterDeliveryModeMap[id])
      .filter((item): item is CourseMasterDeliveryMode => Boolean(item));
    const selectedMasterLanguages = selectedMasterLanguageIds
      .map((id) => masterLanguageMap[id])
      .filter((item): item is CourseMasterLanguage => Boolean(item));

    const autoDeliveryModesFromMasters = selectedMasterDeliveryModes.map((mode) => {
      const modeCombos = selectedMasterCombinationsWithPricing
        .filter((combo) => combo.deliveryModeId === mode.id)
        .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      const best = modeCombos[0];
      return {
        id: mode.id,
        label: mode.name,
        price: Number(best?.price || 0),
        originalPrice: Number(best?.originalPrice || best?.price || 0),
      };
    }).filter((item) => Number.isFinite(item.price) && item.price > 0);

    const finalDeliveryModes = form.deliveryModePricingEnabled
      ? deliveryModes
      : (autoDeliveryModesFromMasters.length > 0 ? autoDeliveryModesFromMasters : deliveryModes);

    const derivedLanguage = selectedMasterLanguages.length === 1
      ? selectedMasterLanguages[0].name
      : selectedMasterLanguages.length > 1
        ? selectedMasterLanguages.map((item) => item.name).join(" / ")
        : (form.language || "English");

    const combinedViewOptions = Array.from(new Set(
      selectedMasterViewModes
        .map((item) => Number(item.maxViews || 0))
        .filter((value) => Number.isFinite(value) && value >= 1),
    ));
    const combinedValidityOptions = Array.from(new Set(
      selectedMasterValidity
        .map((item) => Number(item.days || 0))
        .filter((value) => Number.isFinite(value) && value >= 1),
    ));

    const resolvedCourseId = editingId
      ? form.id
      : getNextCategoryCourseCode(form.category || "general", form.id);

    const nextCourse: ManagedCourse = {
      id: resolvedCourseId, title: form.title.trim(), category: form.category || "general",
      subcategory: form.subcategory || "general", language: derivedLanguage,
      subject: String(form.subject || "").trim(),
      chapter: String((form.selectedChapters[0] || form.chapter || "")).trim(),
      selectedChapters: form.selectedChapters,
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
      webPlayEnabled: form.webPlayEnabled === true,
      viewPricingEnabled: hasMasterCombinationPricing ? Boolean(form.combinationUseView) : false,
      unlimitedViewsEnabled: hasMasterCombinationPricing
        ? selectedMasterViewModes.some((item) => item.isLifetime === true)
        : true,
      validityPricingEnabled: hasMasterCombinationPricing ? Boolean(form.combinationUseValidity) : false,
      viewOptions: hasMasterCombinationPricing
        ? (combinedViewOptions.length > 0 ? combinedViewOptions : parsePositiveNumberList(form.viewOptionsText || "", [1, 2]))
        : [1],
      validityOptionsDays: hasMasterCombinationPricing
        ? (combinedValidityOptions.length > 0 ? combinedValidityOptions : parsePositiveNumberList(form.validityOptionsDaysText || "", [30, 90, 180]))
        : [UNLIMITED_VALIDITY_DAYS],
      selectedViews: 1,
      selectedValidityDays: hasMasterCombinationPricing ? 30 : UNLIMITED_VALIDITY_DAYS,
      deliveryModePricingEnabled: Boolean(form.deliveryModePricingEnabled || autoDeliveryModesFromMasters.length > 0),
      deliveryModes: finalDeliveryModes,
      selectedDeliveryModeId: finalDeliveryModes[0]?.id || "online",
      selectedDeliveryModeIds: finalDeliveryModes.length > 0 ? [finalDeliveryModes[0].id] : [],
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
      masterConfig: {
        combinationIds: selectedMasterCombinationsWithPricing.map((item) => item.id),
        combinationPrices: Object.fromEntries(
          selectedMasterCombinationsWithPricing.map((item) => [item.id, {
            price: Number(item.price || 0),
            originalPrice: Number(item.originalPrice || 0) || null,
          }]),
        ),
        combinations: selectedMasterCombinationsWithPricing.map((item) => ({
          id: item.id,
          label: item.label || [
            item.viewModeId ? masterViewModeMap[item.viewModeId]?.name : null,
            item.validityOptionId ? masterValidityMap[item.validityOptionId]?.label : null,
            item.attemptOptionId ? masterAttemptMap[item.attemptOptionId]?.label : null,
            item.deliveryModeId ? masterDeliveryModeMap[item.deliveryModeId]?.name : null,
            item.languageId ? masterLanguageMap[item.languageId]?.name : null,
          ].filter((part): part is string => Boolean(part)).join(" | "),
          viewModeId: item.viewModeId,
          viewModeName: item.viewModeId ? (masterViewModeMap[item.viewModeId]?.name || "") : "",
          viewCount: item.viewModeId
            ? (() => {
                const mode = masterViewModeMap[item.viewModeId];
                const direct = Number(mode?.maxViews || 0);
                const parsed = parseFirstPositiveInt(mode?.name) || parseFirstPositiveInt(item.label);
                const next = parsed > direct ? parsed : direct;
                return next > 0 ? next : null;
              })()
            : null,
          validityOptionId: item.validityOptionId,
          validityLabel: item.validityOptionId ? (masterValidityMap[item.validityOptionId]?.label || "") : "",
          validityDays: item.validityOptionId ? Number(masterValidityMap[item.validityOptionId]?.days || 0) : null,
          attemptOptionId: item.attemptOptionId,
          attemptLabel: item.attemptOptionId ? (masterAttemptMap[item.attemptOptionId]?.label || "") : "",
          attemptEndDate: item.attemptOptionId ? (masterAttemptMap[item.attemptOptionId]?.endDate || "") : null,
          deliveryModeId: item.deliveryModeId || null,
          deliveryModeName: item.deliveryModeId ? (masterDeliveryModeMap[item.deliveryModeId]?.name || "") : "",
          languageId: item.languageId || null,
          languageName: item.languageId ? (masterLanguageMap[item.languageId]?.name || "") : "",
          price: item.price,
          originalPrice: item.originalPrice,
        })),
        combinationBasis: {
          useView: Boolean(form.combinationUseView),
          useValidity: Boolean(form.combinationUseValidity),
          useAttempt: Boolean(form.combinationUseAttempt),
          useMode: Boolean(form.combinationUseMode),
        },
      },
    };
    setIsSaving(true);
    try {
      upsertCourse(nextCourse);
      await adminApi.upsertCourse(nextCourse);
      await syncSelectedChaptersToCurriculum(nextCourse.id, form.selectedChapters);
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

  // ── Package Builder helpers ──────────────────────────────────
  const openCreatePackage = () => {
    const firstCat = parentCategories[0]?.id || "general";
    const firstSub = categories.find((c) => c.parentId === firstCat)?.id || "general";
    setPkgEditingId(null); setPkgTab("courses");
    setPkgTitle(""); setPkgThumbnail(""); setPkgCategory(firstCat); setPkgSubcategory(firstSub);
    setPkgPrice(0); setPkgOriginalPrice(0); setPkgTaxPct(0);
    setPkgMasterCombinationRows([]);
      setPkgCombinationUseView(true); setPkgCombinationUseValidity(true); setPkgCombinationUseMode(false); setPkgCombinationUseAttempt(false);
    setPkgSelectedViewModeIds([]); setPkgSelectedValidityIds([]); setPkgSelectedAttemptIds([]); setPkgSelectedDeliveryModeIds([]);
    setPkgLanguage("Hindi + English"); setPkgProfessor("Multiple Faculty");
    setPkgCourseIds([]); setPkgSearch("");
    setPkgViewPricingEnabled(false); setPkgUnlimitedViews(false); setPkgViewOptionsText("1,2");
    setPkgValidityEnabled(false); setPkgValidityDaysText("30,90,180");
    setPkgDeliveryEnabled(false); setPkgOnlineMode(true); setPkgOnlinePrice(0);
    setPkgDriveMode(false); setPkgDrivePrice(0); setPkgPenMode(false); setPkgPenPrice(0);
    setPkgBookAddon(false); setPkgEnotesEnabled(false); setPkgEnotesPrice(0);
    setPkgPhysBookEnabled(false); setPkgPhysBookPrice(0);
    setPkgDemoVideoVisible(false); setPkgWebPlayEnabled(false); setPkgDemoVideoTitle(""); setPkgDemoVideoDescription("");
    setPkgDemoVideoSource("youtube"); setPkgDemoVideoUrl(""); setPkgDemoVideoThumbnailUrl("");
    setPkgAboutCourseEnabled(false); setPkgAboutCourseText("");
    setPkgRatingsEnabled(true); setPkgReviewsEnabled(true); setPkgRatingValue(4.8); setPkgRatingCount(0); setPkgReviewsText("");
    setPkgEnrollmentCount(0); setPkgShowEnrollmentCount(true); setPkgShowMetaLectures(true); setPkgShowMetaHours(true);
    setPkgShowMetaValidity(true); setPkgShowMetaResources(true); setPkgShowMetaViews(true); setPkgShowMetaPerHour(true); setPkgShowMetaLanguage(true);
    setPkgOpen(true);
  };

  const openEditPackage = (course: ManagedCourse) => {
    setPkgEditingId(course.id); setPkgTab("courses");
    setPkgTitle(course.title); setPkgThumbnail(course.thumbnail || "");
    setPkgCategory(course.category || ""); setPkgSubcategory(course.subcategory || "");
    setPkgPrice(course.price); setPkgOriginalPrice(course.originalPrice);
    setPkgTaxPct(Number(course.taxPercentage || 0));
    setPkgMasterCombinationRows(
      Array.isArray(course.masterConfig?.combinations)
        ? course.masterConfig.combinations
            .map((item, index) => ({
              id: String(item.id || `pkg-combo-${index + 1}`),
              label: String(item.label || ""),
              viewModeId: item.viewModeId ? String(item.viewModeId) : null,
              validityOptionId: item.validityOptionId ? String(item.validityOptionId) : null,
              attemptOptionId: item.attemptOptionId ? String(item.attemptOptionId) : null,
              deliveryModeId: item.deliveryModeId ? String(item.deliveryModeId) : null,
              languageId: item.languageId ? String(item.languageId) : null,
              price: Number(item.price || 0),
              originalPrice: item.originalPrice === null || item.originalPrice === undefined ? null : Number(item.originalPrice || 0),
              isActive: true,
              sortOrder: index + 1,
            }))
        : [],
    );
    setPkgCombinationUseView(
      course.masterConfig?.combinationBasis?.useView
        ?? Boolean(course.masterConfig?.combinations?.some((item) => item.viewModeId)),
    );
    setPkgCombinationUseValidity(
      course.masterConfig?.combinationBasis?.useValidity
        ?? Boolean(course.masterConfig?.combinations?.some((item) => item.validityOptionId)),
    );
    setPkgCombinationUseAttempt(
      course.masterConfig?.combinationBasis?.useAttempt
        ?? Boolean(course.masterConfig?.combinations?.some((item) => item.attemptOptionId)),
    );
    setPkgCombinationUseMode(
      course.masterConfig?.combinationBasis?.useMode
        ?? Boolean(course.masterConfig?.combinations?.some((item) => item.deliveryModeId)),
    );
    setPkgSelectedViewModeIds([]); setPkgSelectedValidityIds([]); setPkgSelectedAttemptIds([]); setPkgSelectedDeliveryModeIds([]);
    setPkgLanguage(course.language || "Hindi + English"); setPkgProfessor(course.professor || "Multiple Faculty");
    setPkgCourseIds(Array.isArray(course.packageCourseIds) ? course.packageCourseIds : []);
    setPkgSearch("");
    setPkgViewPricingEnabled(Boolean(course.viewPricingEnabled));
    setPkgUnlimitedViews(Boolean(course.unlimitedViewsEnabled));
    setPkgViewOptionsText((course.viewOptions?.length ? course.viewOptions : [1,2]).join(","));
    setPkgValidityEnabled(Boolean(course.validityPricingEnabled));
    setPkgValidityDaysText((course.validityOptionsDays?.length ? course.validityOptionsDays : [30,90,180]).join(","));
    setPkgDeliveryEnabled(Boolean(course.deliveryModePricingEnabled));
    setPkgOnlineMode(Boolean(course.deliveryModes?.some(m => m.id === "online")));
    setPkgOnlinePrice(course.deliveryModes?.find(m => m.id === "online")?.price ?? course.price);
    setPkgDriveMode(Boolean(course.deliveryModes?.some(m => m.id === "google-drive")));
    setPkgDrivePrice(course.deliveryModes?.find(m => m.id === "google-drive")?.price ?? course.price);
    setPkgPenMode(Boolean(course.deliveryModes?.some(m => m.id === "pen-drive")));
    setPkgPenPrice(course.deliveryModes?.find(m => m.id === "pen-drive")?.price ?? course.price);
    setPkgBookAddon(Boolean(course.bookAddonEnabled));
    setPkgEnotesEnabled(Boolean(course.bookAddons?.find(a => a.id === "enotes")?.enabled));
    setPkgEnotesPrice(Number(course.bookAddons?.find(a => a.id === "enotes")?.price || 0));
    setPkgPhysBookEnabled(Boolean(course.bookAddons?.find(a => a.id === "physical-book")?.enabled));
    setPkgPhysBookPrice(Number(course.bookAddons?.find(a => a.id === "physical-book")?.price || 0));
    setPkgDemoVideoVisible(Boolean(course.demoVideoVisible));
    setPkgWebPlayEnabled(course.webPlayEnabled === true);
    setPkgDemoVideoTitle(String(course.demoVideoTitle || ""));
    setPkgDemoVideoDescription(String(course.demoVideoDescription || ""));
    setPkgDemoVideoSource((course.demoVideoSource === "upload" || course.demoVideoSource === "direct") ? course.demoVideoSource : "youtube");
    setPkgDemoVideoUrl(decodeDemoVideoValue(course.demoVideoUrl));
    setPkgDemoVideoThumbnailUrl(String(course.demoVideoThumbnailUrl || ""));
    setPkgAboutCourseEnabled(Boolean(course.aboutCourseEnabled));
    setPkgAboutCourseText(String(course.aboutCourseText || ""));
    setPkgRatingsEnabled(course.ratingsEnabled !== false);
    setPkgReviewsEnabled(course.reviewsEnabled !== false);
    setPkgRatingValue(Number(course.ratingValue || 4.8));
    setPkgRatingCount(Number(course.ratingCount || 0));
    setPkgReviewsText((course.reviews || []).map((r) => `${r.name} | ${r.rating} | ${r.comment} | ${r.date || ""}`).join("\n"));
    setPkgEnrollmentCount(Number(course.enrollmentCount || 0));
    setPkgShowEnrollmentCount(course.showEnrollmentCount !== false);
    setPkgShowMetaLectures(course.showMetaLectures !== false);
    setPkgShowMetaHours(course.showMetaHours !== false);
    setPkgShowMetaValidity(course.showMetaValidity !== false);
    setPkgShowMetaResources(course.showMetaResources !== false);
    setPkgShowMetaViews(course.showMetaViews !== false);
    setPkgShowMetaPerHour(course.showMetaPerHour !== false);
    setPkgShowMetaLanguage(course.showMetaLanguage !== false);
    setPkgOpen(true);
  };

  const pkgSelectedCourses = useMemo(() =>
    courses.filter((c) => pkgCourseIds.includes(c.id)),
    [courses, pkgCourseIds]
  );
  const pkgTotalLectures = useMemo(() => pkgSelectedCourses.reduce((s, c) => s + (c.lectures || 0), 0), [pkgSelectedCourses]);
  const pkgTotalHours = useMemo(() => Number(pkgSelectedCourses.reduce((s, c) => s + (c.hours || 0), 0).toFixed(1)), [pkgSelectedCourses]);
  const pkgTotalRetailPrice = useMemo(() => pkgSelectedCourses.reduce((s, c) => s + (c.price || 0), 0), [pkgSelectedCourses]);

  const pkgFilteredCourses = useMemo(() => {
    const q = pkgSearch.trim().toLowerCase();
    return courses
      .filter((c) => !c.isCombo && (q === "" || c.title.toLowerCase().includes(q) || (categoriesById[c.category]?.name || "").toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [courses, categoriesById, pkgSearch]);

  const pkgSubcategoryOptions = useMemo(() => categories.filter((c) => c.parentId === pkgCategory), [categories, pkgCategory]);

  const handleUploadPkgThumbnail = async (file?: File | null) => {
    if (!file) return;
    setPkgThumbnailUploading(true);
    try {
      const base64Data = await fileToBase64(file);
      const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, "packages");
      setPkgThumbnail(uploaded.url);
    } catch { /* ignore */ } finally { setPkgThumbnailUploading(false); }
  };

  const handleUploadPkgDemoVideo = async (file?: File | null) => {
    if (!file) return;
    pkgUploadAbortRef.current?.abort();
    const controller = new AbortController();
    pkgUploadAbortRef.current = controller;
    setPkgDemoVideoUploading(true);
    setUploadPanelMinimized(false);
    setVideoUploadState({
      scope: "package",
      fileName: file.name,
      progress: 0,
      status: "uploading",
      message: "Uploading package demo video...",
    });
    try {
      const uploaded = await adminApi.uploadVideoFileToBunnyWithProgress(file, "demo-videos", {
        signal: controller.signal,
        onProgress: (percent) => {
          setVideoUploadState((prev) => {
            if (!prev || prev.scope !== "package" || prev.status !== "uploading") return prev;
            return { ...prev, progress: percent, message: `Uploading package demo video... ${percent}%` };
          });
        },
      });
      setPkgDemoVideoUrl(uploaded.url);
      setVideoUploadState((prev) => (prev && prev.scope === "package"
        ? { ...prev, progress: 100, status: "success", message: "Upload complete" }
        : prev));
    } catch (e) {
      const cancelled = e instanceof Error && /cancelled/i.test(e.message);
      setVideoUploadState((prev) => (prev && prev.scope === "package"
        ? { ...prev, status: cancelled ? "cancelled" : "error", message: cancelled ? "Upload cancelled" : "Upload failed" }
        : prev));
      alert(e instanceof Error ? e.message : "Demo video upload failed");
    } finally {
      pkgUploadAbortRef.current = null;
      setPkgDemoVideoUploading(false);
    }
  };

  const handleCancelActiveUpload = () => {
    if (!videoUploadState || videoUploadState.status !== "uploading") return;
    if (videoUploadState.scope === "course") {
      courseUploadAbortRef.current?.abort();
      return;
    }
    pkgUploadAbortRef.current?.abort();
  };

  const handleUploadPkgDemoThumbnail = async (file?: File | null) => {
    if (!file) return;
    setPkgDemoThumbUploading(true);
    try {
      const base64Data = await fileToBase64(file);
      const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, "demo-thumbnails");
      setPkgDemoVideoThumbnailUrl(uploaded.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Demo thumbnail upload failed");
    } finally {
      setPkgDemoThumbUploading(false);
    }
  };

  const handleSavePackage = async () => {
    if (!pkgTitle.trim()) { alert("Package name is required"); return; }
    if (pkgCourseIds.length < 2) { alert("Select at least 2 courses for a package"); return; }
    const hasValidPkgComboPrice = (pkgMasterCombinationRows || []).some(
      (row) => row.isActive !== false
        && Number(row.price || 0) > 0
        && Boolean(row.viewModeId || row.validityOptionId || row.attemptOptionId || row.deliveryModeId || row.languageId),
    );
    if (!pkgDeliveryEnabled && pkgPrice <= 0 && !hasValidPkgComboPrice) { alert("Set a valid package price"); return; }
    setPkgSaving(true);
    try {
      const id = pkgEditingId || `pkg-${Date.now()}`;
      const deliveryModes: Array<{ id: string; label: string; price: number; originalPrice?: number }> = [];
      if (pkgDeliveryEnabled) {
        if (pkgOnlineMode && pkgOnlinePrice > 0) deliveryModes.push({ id: "online", label: "Online", price: pkgOnlinePrice, originalPrice: pkgOriginalPrice || pkgOnlinePrice });
        if (pkgDriveMode && pkgDrivePrice > 0) deliveryModes.push({ id: "google-drive", label: "Google Drive", price: pkgDrivePrice, originalPrice: pkgOriginalPrice || pkgDrivePrice });
        if (pkgPenMode && pkgPenPrice > 0) deliveryModes.push({ id: "pen-drive", label: "Pen Drive", price: pkgPenPrice, originalPrice: pkgOriginalPrice || pkgPenPrice });
      }
      const bookAddons: Array<{ id: string; label: string; price: number; enabled?: boolean }> = [];
      if (pkgBookAddon) {
        if (pkgEnotesEnabled) bookAddons.push({ id: "enotes", label: "eNotes", price: Math.max(0, pkgEnotesPrice), enabled: true });
        if (pkgPhysBookEnabled) bookAddons.push({ id: "physical-book", label: "Physical Book", price: Math.max(0, pkgPhysBookPrice), enabled: true });
      }
      const normalizedPkgCombos = (pkgMasterCombinationRows || [])
        .map((item, index) => ({
          id: String(item.id || `pkg-combo-${index + 1}`),
          label: String(item.label || "").trim(),
          viewModeId: item.viewModeId ? String(item.viewModeId).trim() : null,
          validityOptionId: item.validityOptionId ? String(item.validityOptionId).trim() : null,
          attemptOptionId: item.attemptOptionId ? String(item.attemptOptionId).trim() : null,
          deliveryModeId: item.deliveryModeId ? String(item.deliveryModeId).trim() : null,
          languageId: item.languageId ? String(item.languageId).trim() : null,
          price: Number(item.price || 0),
          originalPrice: item.originalPrice === null || item.originalPrice === undefined ? null : Number(item.originalPrice || 0),
          isActive: item.isActive !== false,
          sortOrder: Number(item.sortOrder || index + 1),
        }))
        .filter((item) => item.isActive !== false && item.price > 0 && Boolean(item.viewModeId || item.validityOptionId || item.attemptOptionId || item.deliveryModeId || item.languageId));


      const comboBasedPrice = normalizedPkgCombos.length > 0 ? Number(normalizedPkgCombos[0].price || 0) : 0;
      const comboBasedOriginal = normalizedPkgCombos.length > 0
        ? Number(normalizedPkgCombos[0].originalPrice || normalizedPkgCombos[0].price || 0)
        : 0;

      const derivedPrice = pkgDeliveryEnabled ? (deliveryModes[0]?.price || 0) : (comboBasedPrice || pkgPrice);
      const originalPrice = pkgOriginalPrice > 0
        ? pkgOriginalPrice
        : (comboBasedOriginal || pkgTotalRetailPrice || derivedPrice);
      const discount = originalPrice > derivedPrice ? Math.round(((originalPrice - derivedPrice) / originalPrice) * 100) : 0;

      const comboViewModes = normalizedPkgCombos
        .map((item) => (item.viewModeId ? masterViewModeMap[item.viewModeId] : null))
        .filter((item): item is CourseMasterViewMode => Boolean(item));
      const comboValidityModes = normalizedPkgCombos
        .map((item) => (item.validityOptionId ? masterValidityMap[item.validityOptionId] : null))
        .filter((item): item is CourseMasterValidityOption => Boolean(item));

      const pkg: ManagedCourse = {
        id, title: pkgTitle.trim(), category: pkgCategory || "general",
        subcategory: pkgSubcategory || "general", language: pkgLanguage || "Hindi + English",
        professor: pkgProfessor.trim() || "Multiple Faculty",
        price: derivedPrice, originalPrice, taxPercentage: Math.max(0, pkgTaxPct),
        discount, image: "/placeholder.svg", thumbnail: pkgThumbnail.trim(),
        lectures: pkgTotalLectures, hours: pkgTotalHours,
        isCombo: true, isMaterial: false, isVisible: true,
        packageCourseIds: pkgCourseIds,
        viewPricingEnabled: normalizedPkgCombos.length > 0 ? true : pkgViewPricingEnabled,
        unlimitedViewsEnabled: normalizedPkgCombos.length > 0
          ? comboViewModes.some((item) => item.isLifetime === true)
          : pkgUnlimitedViews,
        validityPricingEnabled: normalizedPkgCombos.length > 0 ? true : pkgValidityEnabled,
        viewOptions: normalizedPkgCombos.length > 0
          ? Array.from(new Set(comboViewModes.map((item) => Number(item.maxViews || 0)).filter((value) => Number.isFinite(value) && value >= 1)))
          : parsePositiveNumberList(pkgViewOptionsText, [1,2]),
        validityOptionsDays: normalizedPkgCombos.length > 0
          ? Array.from(new Set(comboValidityModes.map((item) => Number(item.days || 0)).filter((value) => Number.isFinite(value) && value >= 1)))
          : parsePositiveNumberList(pkgValidityDaysText, [30,90,180]),
        selectedViews: 1, selectedValidityDays: 30,
        deliveryModePricingEnabled: pkgDeliveryEnabled, deliveryModes,
        selectedDeliveryModeId: deliveryModes[0]?.id || "online",
        selectedDeliveryModeIds: deliveryModes.length > 0 ? [deliveryModes[0].id] : ["online"],
        bookAddonEnabled: pkgBookAddon, bookAddons, selectedBookAddonIds: [],
        aboutCourseEnabled: pkgAboutCourseEnabled,
        aboutCourseText: String(pkgAboutCourseText || "").trim(),
        ratingsEnabled: pkgRatingsEnabled,
        reviewsEnabled: pkgReviewsEnabled,
        ratingValue: Math.max(0, Math.min(5, Number(pkgRatingValue || 4.8))),
        ratingCount: Math.max(0, Number(pkgRatingCount || 0)),
        reviews: parseReviewsText(pkgReviewsText || ""),
        enrollmentCount: Math.max(0, Number(pkgEnrollmentCount || 0)),
        showEnrollmentCount: pkgShowEnrollmentCount,
        showMetaLectures: pkgShowMetaLectures,
        showMetaHours: pkgShowMetaHours,
        showMetaValidity: pkgShowMetaValidity,
        showMetaResources: pkgShowMetaResources,
        showMetaViews: pkgShowMetaViews,
        showMetaPerHour: pkgShowMetaPerHour,
        showMetaLanguage: pkgShowMetaLanguage,
        demoVideoVisible: pkgDemoVideoVisible,
        webPlayEnabled: pkgWebPlayEnabled,
        demoVideoTitle: String(pkgDemoVideoTitle || "").trim(),
        demoVideoDescription: String(pkgDemoVideoDescription || "").trim(),
        demoVideoSource: pkgDemoVideoSource,
        demoVideoUrl: String(pkgDemoVideoUrl || "").trim(),
        demoVideoThumbnailUrl: String(pkgDemoVideoThumbnailUrl || "").trim(),
        masterConfig: {
          combinationIds: normalizedPkgCombos.map((item) => item.id),
          combinationPrices: Object.fromEntries(normalizedPkgCombos.map((item) => [item.id, {
            price: Number(item.price || 0),
            originalPrice: item.originalPrice === null || item.originalPrice === undefined ? null : Number(item.originalPrice || 0),
          }])),
          combinations: normalizedPkgCombos.map((item) => ({
            id: item.id,
            label: item.label || [
              item.viewModeId ? masterViewModeMap[item.viewModeId]?.name : null,
              item.validityOptionId ? masterValidityMap[item.validityOptionId]?.label : null,
              item.attemptOptionId ? masterAttemptMap[item.attemptOptionId]?.label : null,
              item.deliveryModeId ? masterDeliveryModeMap[item.deliveryModeId]?.name : null,
              item.languageId ? masterLanguageMap[item.languageId]?.name : null,
            ].filter((part): part is string => Boolean(part)).join(" | "),
            viewModeId: item.viewModeId,
            viewModeName: item.viewModeId ? (masterViewModeMap[item.viewModeId]?.name || "") : "",
            viewCount: item.viewModeId
              ? (() => {
                  const mode = masterViewModeMap[item.viewModeId];
                  const direct = Number(mode?.maxViews || 0);
                  const parsed = parseFirstPositiveInt(mode?.name) || parseFirstPositiveInt(item.label);
                  const next = parsed > direct ? parsed : direct;
                  return next > 0 ? next : null;
                })()
              : null,
            validityOptionId: item.validityOptionId,
            validityLabel: item.validityOptionId ? (masterValidityMap[item.validityOptionId]?.label || "") : "",
            validityDays: item.validityOptionId ? Number(masterValidityMap[item.validityOptionId]?.days || 0) : null,
            attemptOptionId: item.attemptOptionId,
            attemptLabel: item.attemptOptionId ? (masterAttemptMap[item.attemptOptionId]?.label || "") : "",
            attemptEndDate: item.attemptOptionId ? (masterAttemptMap[item.attemptOptionId]?.endDate || "") : null,
            deliveryModeId: item.deliveryModeId || null,
            deliveryModeName: item.deliveryModeId ? (masterDeliveryModeMap[item.deliveryModeId]?.name || "") : "",
            languageId: item.languageId || null,
            languageName: item.languageId ? (masterLanguageMap[item.languageId]?.name || "") : "",
            price: Number(item.price || 0),
            originalPrice: item.originalPrice === null || item.originalPrice === undefined ? null : Number(item.originalPrice || 0),
          })),
          combinationBasis: {
            useView: pkgCombinationUseView,
            useValidity: pkgCombinationUseValidity,
            useAttempt: pkgCombinationUseAttempt,
            useMode: pkgCombinationUseMode,
          },
        },
      };
      upsertCourse(pkg);
      await adminApi.upsertCourse(pkg);
      setPkgOpen(false);
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to save package"); }
    finally { setPkgSaving(false); }
  };

  /* ─── Dialog Tabs ────────────────────────────────────────────── */
  const dialogTabs: { key: DialogTab; label: string; icon: React.ElementType }[] = [
    { key: "basic",    label: "Basic",    icon: BookOpen },
    { key: "pricing",  label: "Pricing",  icon: DollarSign },
    { key: "content",  label: "Content",  icon: FileText },
  ];

  const selectCls = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 shadow-sm hover:border-slate-300";

  return (
    <div className="space-y-5 font-['Inter']">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
            <p className="mt-0.5 text-xs text-slate-500">{filteredCourses.length} courses total</p>
          </div>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl border-slate-200 text-xs"
            onClick={() => setShowHeaderFilters((prev) => !prev)}
          >
            Filters {showHeaderFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          {showHeaderFilters && (
            <>
              <select
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
                value={courseFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setCourseFilter(next);
                  setLevelFilter("all");
                  setSubjectFilter("all");
                  setChapterFilter("all");
                }}
              >
                <option value="all">All Courses</option>
                {courseFilterOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value);
                  setSubjectFilter("all");
                  setChapterFilter("all");
                }}
              >
                <option value="all">All Levels</option>
                {levelFilterOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
                value={subjectFilter}
                onChange={(e) => {
                  setSubjectFilter(e.target.value);
                  setChapterFilter("all");
                }}
              >
                <option value="all">All Subjects</option>
                {subjectFilterOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
              >
                <option value="all">All Chapters</option>
                {chapterFilterOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {(courseFilter !== "all" || levelFilter !== "all" || subjectFilter !== "all" || chapterFilter !== "all") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-slate-200 text-xs"
                  onClick={() => {
                    setCourseFilter("all");
                    setLevelFilter("all");
                    setSubjectFilter("all");
                    setChapterFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold shadow-lg shadow-primary/20" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5" /> Add Course
              </Button>
            </DialogTrigger>

            {/* ─── Package Builder Button + Dialog ─────────── */}
            <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl border-violet-200 bg-violet-50 px-4 text-xs font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-300" onClick={openCreatePackage}>
              <Layers className="h-3.5 w-3.5" /> Create Package
            </Button>

            {/* Package Builder Dialog */}
            <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
              <DialogContent className="flex max-h-[94vh] max-w-5xl flex-col overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
                <DialogHeader className="shrink-0 relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-purple-600 px-6 py-5">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiIC8+PC9zdmc+')] opacity-20"></div>
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                      <Layers className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-white">{pkgEditingId ? "Edit Package" : "Create Course Package"}</DialogTitle>
                      <p className="text-xs text-white/70 mt-0.5">Bundle multiple courses into one combo package with custom pricing</p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Tabs */}
                <div className="shrink-0 flex border-b border-slate-100 bg-white px-6 shadow-sm">
                  {([
                    { key: "courses" as const, label: "Courses", icon: BookOpen },
                    { key: "details" as const, label: "Details", icon: Tag },
                    { key: "pricing" as const, label: "Pricing", icon: DollarSign },
                    { key: "content" as const, label: "Content", icon: FileText },
                  ]).map((t) => (
                    <button key={t.key} type="button" onClick={() => setPkgTab(t.key)}
                      className={`group flex items-center gap-2 px-4 py-3.5 text-xs font-semibold transition-all relative ${pkgTab === t.key ? "text-violet-600" : "text-slate-400 hover:text-slate-600"}`}>
                      <div className={`p-1.5 rounded-lg transition-all ${pkgTab === t.key ? "bg-violet-100" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                        <t.icon className={`h-3.5 w-3.5 transition-colors ${pkgTab === t.key ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                      </div>
                      {t.label}
                      {t.key === "courses" && pkgCourseIds.length > 0 && <span className="ml-0.5 rounded-full bg-violet-100 px-1.5 text-[9px] font-bold text-violet-600">{pkgCourseIds.length}</span>}
                      {pkgTab === t.key && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {/* ── COURSES TAB ── */}
                  {pkgTab === "courses" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Select Courses (min 2)</Label>
                        {pkgCourseIds.length > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{pkgCourseIds.length} selected</span>}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input className={`${fieldCls} pl-9`} placeholder="Search courses…" value={pkgSearch} onChange={(e) => setPkgSearch(e.target.value)} />
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {pkgFilteredCourses.length === 0 ? (
                          <p className="py-8 text-center text-xs text-slate-400">No courses found</p>
                        ) : pkgFilteredCourses.map((c) => {
                          const sel = pkgCourseIds.includes(c.id);
                          return (
                            <label key={c.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${sel ? "bg-primary/5" : "hover:bg-slate-50"}`}>
                              <input type="checkbox" className="accent-primary h-3.5 w-3.5 shrink-0" checked={sel}
                                onChange={(e) => setPkgCourseIds((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id))} />
                              {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-9 w-14 rounded-md object-cover shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold line-clamp-1 ${sel ? "text-primary" : "text-slate-700"}`}>{c.title}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">₹{c.price.toLocaleString()} · {c.lectures} lec · {c.hours}h · {c.professor}</p>
                              </div>
                              {sel && <CheckCircle2 className="shrink-0 h-3.5 w-3.5 text-primary" />}
                            </label>
                          );
                        })}
                      </div>
                      {pkgCourseIds.length > 0 && (
                        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Package Summary</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-white border border-slate-200 p-2"><p className="text-base font-extrabold text-slate-900">{pkgCourseIds.length}</p><p className="text-[9px] text-slate-400">Courses</p></div>
                            <div className="rounded-lg bg-white border border-slate-200 p-2"><p className="text-base font-extrabold text-slate-900">{pkgTotalLectures}</p><p className="text-[9px] text-slate-400">Lectures</p></div>
                            <div className="rounded-lg bg-white border border-slate-200 p-2"><p className="text-base font-extrabold text-slate-900">{pkgTotalHours}h</p><p className="text-[9px] text-slate-400">Watch Time</p></div>
                          </div>
                          <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Total retail value</span><span className="font-bold text-slate-700">₹{pkgTotalRetailPrice.toLocaleString()}</span></div>
                          {pkgPrice > 0 && pkgTotalRetailPrice > pkgPrice && (
                            <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Package savings</span><span className="font-bold text-emerald-600">₹{(pkgTotalRetailPrice - pkgPrice).toLocaleString()} off</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── DETAILS TAB ── */}
                  {pkgTab === "details" && (
                    <div className="space-y-5">
                      {/* Package Identity Card */}
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-slate-100 px-5 py-3">
                          <div className="h-5 w-5 rounded-md bg-violet-600 flex items-center justify-center shrink-0"><Package className="h-3 w-3 text-white" /></div>
                          <p className="text-xs font-bold text-violet-700 uppercase tracking-wider">Package Identity</p>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="space-y-1.5">
                            <Label>Package Name *</Label>
                            <Input className={fieldCls} placeholder="e.g., CA Final Complete Combo Pack" value={pkgTitle} onChange={(e) => setPkgTitle(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label>Category</Label>
                              <select className={selectCls} value={pkgCategory} onChange={(e) => { setPkgCategory(e.target.value); setPkgSubcategory(categories.find((c) => c.parentId === e.target.value)?.id || "general"); }}>
                                {parentCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Subcategory / Level</Label>
                              <select className={selectCls} value={pkgSubcategory} onChange={(e) => setPkgSubcategory(e.target.value)}>
                                {pkgSubcategoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label>Language</Label>
                              {masterLanguages.length > 0 ? (
                                <select className={selectCls} value={pkgLanguage} onChange={(e) => setPkgLanguage(e.target.value)}>
                                  <option value="">Select Language</option>
                                  {masterLanguages.map((lang) => <option key={lang.id} value={lang.name}>{lang.name}</option>)}
                                </select>
                              ) : (
                                <Input className={fieldCls} value={pkgLanguage} onChange={(e) => setPkgLanguage(e.target.value)} />
                              )}
                            </div>
                            <div className="space-y-1.5"><Label>Faculty</Label><Input className={fieldCls} value={pkgProfessor} onChange={(e) => setPkgProfessor(e.target.value)} /></div>
                          </div>
                        </div>
                      </div>
                      {/* Thumbnail Card */}
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-slate-100 px-5 py-3">
                          <div className="h-5 w-5 rounded-md bg-sky-600 flex items-center justify-center shrink-0"><Settings className="h-3 w-3 text-white" /></div>
                          <p className="text-xs font-bold text-sky-700 uppercase tracking-wider">Package Thumbnail</p>
                        </div>
                        <div className="p-5">
                          <div className="flex gap-4 items-start">
                            {pkgThumbnail ? (
                              <div className="relative shrink-0 group">
                                <img src={pkgThumbnail} alt="thumbnail" className="h-24 w-36 rounded-xl object-cover shadow-md ring-2 ring-sky-200" />
                                <button type="button" onClick={() => setPkgThumbnail("")} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="h-24 w-36 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center shrink-0 gap-1">
                                <Settings className="h-6 w-6 text-slate-300" />
                                <p className="text-[9px] text-slate-400 font-medium">No thumbnail</p>
                              </div>
                            )}
                            <div className="flex-1 space-y-3">
                              <div className="space-y-1.5">
                                <Label>Image URL</Label>
                                <Input className={fieldCls} placeholder="https://…" value={pkgThumbnail} onChange={(e) => setPkgThumbnail(e.target.value)} />
                              </div>
                              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 hover:border-sky-400 transition-colors w-fit">
                                {pkgThumbnailUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                                {pkgThumbnailUploading ? "Uploading..." : "Upload Image"}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadPkgThumbnail(e.target.files?.[0])} />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── PRICING TAB ── */}
                  {pkgTab === "pricing" && (
                    <div className="space-y-4">
                      {/* Base price */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-800">Base Price</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5"><Label>Package Price (₹) *</Label><Input className={fieldCls} type="number" placeholder="24999" value={pkgPrice || ""} onChange={(e) => setPkgPrice(Number(e.target.value) || 0)} /></div>
                          <div className="space-y-1.5"><Label>Original / MRP (₹)</Label><Input className={fieldCls} type="number" placeholder="Auto from retail" value={pkgOriginalPrice || ""} onChange={(e) => setPkgOriginalPrice(Number(e.target.value) || 0)} /></div>
                          <div className="space-y-1.5"><Label>Tax (%)</Label><Input className={fieldCls} type="number" min={0} step={0.01} placeholder="0" value={pkgTaxPct || ""} onChange={(e) => setPkgTaxPct(Math.max(0, Number(e.target.value) || 0))} /></div>
                        </div>
                        {pkgPrice > 0 && (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] space-y-1">
                            <div className="flex justify-between"><span className="text-slate-500">Package Price</span><span className="font-bold">₹{pkgPrice.toLocaleString()}</span></div>
                            {(pkgOriginalPrice > pkgPrice || pkgTotalRetailPrice > pkgPrice) && <div className="flex justify-between"><span className="text-slate-500">Savings</span><span className="font-bold text-emerald-600">₹{((pkgOriginalPrice || pkgTotalRetailPrice) - pkgPrice).toLocaleString()} off</span></div>}
                            {pkgTaxPct > 0 && <div className="flex justify-between"><span className="text-slate-500">With Tax</span><span className="font-bold">₹{(pkgPrice * (1 + pkgTaxPct / 100)).toFixed(0)}</span></div>}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
                        <p className="text-xs font-bold text-orange-800">Package Price Combinations</p>
                        <p className="text-[11px] text-orange-700">Master se options aayenge. Yahan tick karke select karein kis base par bechna hai, phir possibilities generate karke price set karein.</p>
                        <div className="rounded-lg border border-orange-100 bg-white p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-slate-700">Sell Based On</p>
                            <a href="/admin/masters" target="_blank" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                              <Settings className="h-3 w-3" /> Configure Masters
                            </a>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-all ${pkgCombinationUseView ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}>
                              <input type="checkbox" checked={pkgCombinationUseView} onChange={(e) => setPkgCombinationUseView(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-primary" />
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-700">View</span>
                                <span className={`text-[10px] ${activeMasterViewModes.length > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {activeMasterViewModes.length} option{activeMasterViewModes.length !== 1 ? 's' : ''} available
                                </span>
                              </div>
                            </label>
                            <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-all ${pkgCombinationUseValidity ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}>
                              <input type="checkbox" checked={pkgCombinationUseValidity} onChange={(e) => { setPkgCombinationUseValidity(e.target.checked); if (e.target.checked) setPkgCombinationUseAttempt(false); }} className="h-4 w-4 rounded border-slate-300 accent-primary" />
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-700">Validity</span>
                                <span className={`text-[10px] ${activeMasterValidityOptions.length > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {activeMasterValidityOptions.length} option{activeMasterValidityOptions.length !== 1 ? 's' : ''} available
                                </span>
                              </div>
                            </label>
                            <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-all ${pkgCombinationUseAttempt ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}>
                              <input type="checkbox" checked={pkgCombinationUseAttempt} onChange={(e) => { setPkgCombinationUseAttempt(e.target.checked); if (e.target.checked) setPkgCombinationUseValidity(false); }} className="h-4 w-4 rounded border-slate-300 accent-primary" />
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-700">Attempt</span>
                                <span className={`text-[10px] ${activeMasterAttemptOptions.length > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {activeMasterAttemptOptions.length} option{activeMasterAttemptOptions.length !== 1 ? 's' : ''} available
                                </span>
                              </div>
                            </label>
                            <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-all ${pkgCombinationUseMode ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}>
                              <input type="checkbox" checked={pkgCombinationUseMode} onChange={(e) => setPkgCombinationUseMode(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-primary" />
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-700">Lecture Mode</span>
                                <span className={`text-[10px] ${activeMasterDeliveryModes.length > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {activeMasterDeliveryModes.length} option{activeMasterDeliveryModes.length !== 1 ? 's' : ''} available
                                </span>
                              </div>
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9"
                              onClick={() => openPackageCombinationSelector()}
                            >
                              Generate Possibilities
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9"
                              onClick={() => setPkgMasterCombinationRows((prev) => prev.filter((row) => row.isActive !== false))}
                            >
                              Remove Inactive
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {pkgMasterCombinationRows.map((combo, index) => (
                            <div key={`${combo.id}-${index}`} className="grid gap-2 rounded-lg border border-orange-100 bg-white p-3 md:grid-cols-[90px_1fr_1fr_1fr_120px_120px_auto]">
                              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={combo.isActive !== false}
                                  onChange={(event) => {
                                    const nextRows = [...pkgMasterCombinationRows];
                                    nextRows[index] = { ...combo, isActive: event.target.checked };
                                    setPkgMasterCombinationRows(nextRows);
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 accent-primary"
                                />
                                Active
                              </label>
                              <select
                                className={selectCls}
                                value={combo.viewModeId || ""}
                                disabled={!pkgCombinationUseView}
                                onChange={(event) => {
                                  const nextRows = [...pkgMasterCombinationRows];
                                  nextRows[index] = { ...combo, viewModeId: event.target.value || null };
                                  setPkgMasterCombinationRows(nextRows);
                                }}
                              >
                                <option value="">{pkgCombinationUseView ? "View" : "Not used"}</option>
                                {activeMasterViewModes.map((item) => (
                                  <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                              </select>
                              <select
                                className={selectCls}
                                value={combo.validityOptionId || ""}
                                disabled={!pkgCombinationUseValidity}
                                onChange={(event) => {
                                  const nextRows = [...pkgMasterCombinationRows];
                                  nextRows[index] = { ...combo, validityOptionId: event.target.value || null };
                                  setPkgMasterCombinationRows(nextRows);
                                }}
                              >
                                <option value="">{pkgCombinationUseValidity ? "Validity" : "Not used"}</option>
                                {activeMasterValidityOptions.map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                              <select
                                className={selectCls}
                                value={combo.attemptOptionId || ""}
                                disabled={!pkgCombinationUseAttempt}
                                onChange={(event) => {
                                  const nextRows = [...pkgMasterCombinationRows];
                                  nextRows[index] = { ...combo, attemptOptionId: event.target.value || null };
                                  setPkgMasterCombinationRows(nextRows);
                                }}
                              >
                                <option value="">{pkgCombinationUseAttempt ? "Attempt" : "Not used"}</option>
                                {activeMasterAttemptOptions.map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                              <select
                                className={selectCls}
                                value={combo.deliveryModeId || ""}
                                disabled={!pkgCombinationUseMode}
                                onChange={(event) => {
                                  const nextRows = [...pkgMasterCombinationRows];
                                  nextRows[index] = { ...combo, deliveryModeId: event.target.value || null };
                                  setPkgMasterCombinationRows(nextRows);
                                }}
                              >
                                <option value="">{pkgCombinationUseMode ? "Lecture mode" : "Not used"}</option>
                                {activeMasterDeliveryModes.map((item) => (
                                  <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                              </select>
                              <Input
                                className={fieldCls}
                                type="number"
                                min={0}
                                placeholder="Price"
                                value={Number(combo.price || 0)}
                                onChange={(event) => {
                                  const nextRows = [...pkgMasterCombinationRows];
                                  nextRows[index] = { ...combo, price: Number(event.target.value) || 0 };
                                  setPkgMasterCombinationRows(nextRows);
                                }}
                              />
                              <Input
                                className={fieldCls}
                                type="number"
                                min={0}
                                placeholder="Original"
                                value={Number(combo.originalPrice || 0)}
                                onChange={(event) => {
                                  const nextRows = [...pkgMasterCombinationRows];
                                  const nextOriginal = Number(event.target.value) || 0;
                                  nextRows[index] = { ...combo, originalPrice: nextOriginal > 0 ? nextOriginal : null };
                                  setPkgMasterCombinationRows(nextRows);
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9"
                                onClick={() => setPkgMasterCombinationRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          onClick={() => {
                            setPkgMasterCombinationRows((prev) => [
                              ...prev,
                              {
                                id: `pkg-combo-${Date.now()}-${prev.length + 1}`,
                                label: "",
                                viewModeId: pkgCombinationUseView ? (activeMasterViewModes[0]?.id || null) : null,
                                validityOptionId: pkgCombinationUseValidity ? (activeMasterValidityOptions[0]?.id || null) : null,
                                attemptOptionId: pkgCombinationUseAttempt ? (activeMasterAttemptOptions[0]?.id || null) : null,
                                deliveryModeId: pkgCombinationUseMode ? (activeMasterDeliveryModes[0]?.id || null) : null,
                                price: 0,
                                originalPrice: null,
                                isActive: true,
                                sortOrder: prev.length + 1,
                              },
                            ]);
                          }}
                        >
                          Add Combination
                        </Button>
                      </div>
                      {/* Book addons */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-800">Book Addons</p>
                        {checkboxRow("Enable book addons", pkgBookAddon, setPkgBookAddon)}
                        {pkgBookAddon && (
                          <div className="pl-5 space-y-2">
                            <div className="flex items-center gap-3">
                              {checkboxRow("eNotes", pkgEnotesEnabled, setPkgEnotesEnabled)}
                              {pkgEnotesEnabled && <Input className={`${fieldCls} w-28`} type="number" placeholder="Price" value={pkgEnotesPrice || ""} onChange={(e) => setPkgEnotesPrice(Number(e.target.value) || 0)} />}
                            </div>
                            <div className="flex items-center gap-3">
                              {checkboxRow("Physical Book", pkgPhysBookEnabled, setPkgPhysBookEnabled)}
                              {pkgPhysBookEnabled && <Input className={`${fieldCls} w-28`} type="number" placeholder="Price" value={pkgPhysBookPrice || ""} onChange={(e) => setPkgPhysBookPrice(Number(e.target.value) || 0)} />}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── CONTENT TAB ── */}
                  {pkgTab === "content" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-800">Demo Lecture Settings</p>
                        {checkboxRow("Show Demo Lecture on Course Page", pkgDemoVideoVisible, setPkgDemoVideoVisible)}
                        {checkboxRow("WebPlay (ON/OFF Toggle)", pkgWebPlayEnabled, setPkgWebPlayEnabled)}
                        {!pkgWebPlayEnabled && (
                          <p className="text-[11px] text-amber-700">When OFF, video will not play on website. An app install popup will be shown.</p>
                        )}
                        {pkgDemoVideoVisible && (
                          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                            <div className="space-y-1.5">
                              <Label>Demo Lecture Title</Label>
                              <Input className={fieldCls} placeholder="Introduction Lecture" value={pkgDemoVideoTitle} onChange={(e) => setPkgDemoVideoTitle(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Description</Label>
                              <textarea className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" value={pkgDemoVideoDescription} onChange={(e) => setPkgDemoVideoDescription(e.target.value)} placeholder="Brief description..." />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Video Source</Label>
                              <div className="flex gap-3">
                                {(["youtube", "upload", "direct"] as const).map((src) => (
                                  <label key={src} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
                                    <input
                                      type="radio"
                                      name="pkgVideoSource"
                                      value={src}
                                      checked={pkgDemoVideoSource === src}
                                      onChange={() => setPkgDemoVideoSource(src)}
                                      className="accent-primary"
                                    />
                                    {src === "youtube" ? "YouTube" : src === "upload" ? "CDN Upload" : "Direct URL"}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label>{pkgDemoVideoSource === "youtube" ? "YouTube Video ID" : "Video URL"}</Label>
                              <Input
                                className={fieldCls}
                                placeholder={pkgDemoVideoSource === "youtube" ? "e.g., dQw4w9WgXcQ" : "https://..."}
                                value={pkgDemoVideoUrl}
                                onChange={(e) => setPkgDemoVideoUrl(e.target.value)}
                              />
                              {pkgDemoVideoSource !== "youtube" && (
                                <div className="flex items-center gap-2">
                                  <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:text-primary">
                                  {pkgDemoVideoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                                  {pkgDemoVideoUploading ? `Uploading ${pkgUploadPercent}%...` : "Upload Video File"}
                                  <input type="file" accept="video/*" className="hidden" onChange={(e) => handleUploadPkgDemoVideo(e.target.files?.[0])} />
                                  </label>
                                  {pkgDemoVideoUploading && (
                                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl border-red-200 px-3 text-[11px] text-red-600 hover:bg-red-50" onClick={handleCancelActiveUpload}>
                                      Cancel
                                    </Button>
                                  )}
                                </div>
                              )}
                              {pkgDemoVideoSource === "youtube" && pkgDemoVideoUrl && (
                                <p className="text-[10px] text-slate-400">Preview: youtube.com/embed/{pkgDemoVideoUrl}</p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label>Video Thumbnail URL (Optional)</Label>
                              <Input className={fieldCls} placeholder="https://..." value={pkgDemoVideoThumbnailUrl} onChange={(e) => setPkgDemoVideoThumbnailUrl(e.target.value)} />
                              <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:text-primary">
                                {pkgDemoThumbUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                                {pkgDemoThumbUploading ? "Uploading..." : "Upload Thumbnail"}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadPkgDemoThumbnail(e.target.files?.[0])} />
                              </label>
                              {pkgDemoVideoThumbnailUrl && <img src={pkgDemoVideoThumbnailUrl} alt="thumb" className="mt-1 h-16 rounded-xl object-cover" />}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-800">About Course Section</p>
                        {checkboxRow("Show About Course section on package page", pkgAboutCourseEnabled, setPkgAboutCourseEnabled)}
                        {pkgAboutCourseEnabled && (
                          <div className="space-y-1.5">
                            <Label>About Course Text</Label>
                            <textarea
                              className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                              placeholder="Dear Students, this package covers…"
                              value={pkgAboutCourseText}
                              onChange={(e) => setPkgAboutCourseText(e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-800">Sidebar Display Controls</p>
                        <div className="space-y-1.5">
                          <Label>Enrollment Count</Label>
                          <Input
                            className={fieldCls}
                            type="number"
                            min={0}
                            value={pkgEnrollmentCount}
                            onChange={(e) => setPkgEnrollmentCount(Number(e.target.value) || 0)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {checkboxRow("Show enrolled count", pkgShowEnrollmentCount, setPkgShowEnrollmentCount)}
                          {checkboxRow("Show lectures", pkgShowMetaLectures, setPkgShowMetaLectures)}
                          {checkboxRow("Show hours", pkgShowMetaHours, setPkgShowMetaHours)}
                          {checkboxRow("Show validity", pkgShowMetaValidity, setPkgShowMetaValidity)}
                          {checkboxRow("Show resources", pkgShowMetaResources, setPkgShowMetaResources)}
                          {checkboxRow("Show views", pkgShowMetaViews, setPkgShowMetaViews)}
                          {checkboxRow("Show ₹/hr", pkgShowMetaPerHour, setPkgShowMetaPerHour)}
                          {checkboxRow("Show language", pkgShowMetaLanguage, setPkgShowMetaLanguage)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500" /> Ratings & Reviews</p>
                        <div className="grid grid-cols-2 gap-3">
                          {checkboxRow("Show Ratings tab", pkgRatingsEnabled, setPkgRatingsEnabled)}
                          {checkboxRow("Show Reviews tab", pkgReviewsEnabled, setPkgReviewsEnabled)}
                        </div>
                        {pkgRatingsEnabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><Label>Rating Value (0-5)</Label><Input className={fieldCls} type="number" step={0.1} min={0} max={5} value={pkgRatingValue} onChange={(e) => setPkgRatingValue(Number(e.target.value) || 0)} /></div>
                            <div className="space-y-1.5"><Label>Rating Count</Label><Input className={fieldCls} type="number" min={0} value={pkgRatingCount} onChange={(e) => setPkgRatingCount(Number(e.target.value) || 0)} /></div>
                          </div>
                        )}
                        {pkgReviewsEnabled && (
                          <div className="space-y-1.5">
                            <Label>Reviews (one per line)</Label>
                            <textarea className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Name | 5 | Great package | 2 weeks ago" value={pkgReviewsText} onChange={(e) => setPkgReviewsText(e.target.value)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${pkgCourseIds.length >= 2 ? "bg-emerald-100" : "bg-amber-100"}`}>
                      <Layers className={`h-4 w-4 ${pkgCourseIds.length >= 2 ? "text-emerald-600" : "text-amber-600"}`} />
                    </div>
                    <p className="text-xs font-medium text-slate-600">{pkgCourseIds.length < 2 ? "Select at least 2 courses to create a package" : `${pkgCourseIds.length} courses · ${pkgTotalLectures} lectures · ${pkgTotalHours}h total`}</p>
                  </div>
                  <div className="flex gap-2.5">
                    <Button type="button" variant="outline" size="sm" className="rounded-xl text-xs font-medium hover:bg-slate-50" onClick={() => setPkgOpen(false)}>Cancel</Button>
                    <Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold shadow-lg shadow-violet-500/20" onClick={handleSavePackage} disabled={pkgSaving || pkgCourseIds.length < 2}>
                      {pkgSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                      {pkgEditingId ? "Update Package" : "Save Package"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* ─── Course Dialog ─────────────────────────────────── */}
            <DialogContent className="flex max-h-[95vh] max-w-5xl flex-col overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
              {/* ── Gradient Header ── */}
              <DialogHeader className="shrink-0 relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-600 to-primary px-7 py-5">
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                <div className="relative flex items-center gap-4">
                  <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm shadow-xl ring-1 ring-white/20">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <DialogTitle className="text-xl font-bold text-white">{editingId ? "Edit Course" : "Create New Course"}</DialogTitle>
                    <p className="text-xs text-white/60 mt-0.5">{editingId ? "Update course details, pricing & content settings" : "Fill in the details to publish a new course to your catalog"}</p>
                  </div>
                  {form.thumbnail && (
                    <img src={form.thumbnail} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover ring-2 ring-white/30 shadow-lg" />
                  )}
                </div>
              </DialogHeader>

              {/* ── Two-panel body ── */}
              <div className="flex flex-1 overflow-hidden">

                {/* Left sidebar navigation */}
                <nav className="shrink-0 w-44 border-r border-slate-100 bg-slate-50/70 flex flex-col gap-1 p-3 overflow-y-auto">
                  {dialogTabs.map((tab) => {
                    const isActive = dialogTab === tab.key;
                    const colors: Record<string, {grad: string; bg: string; text: string; border: string}> = {
                      basic:    { grad: "from-indigo-500 to-blue-500",   bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" },
                      demo:     { grad: "from-violet-500 to-purple-500", bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" },
                      pricing:  { grad: "from-emerald-500 to-teal-500",  bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                      delivery: { grad: "from-orange-500 to-amber-500",  bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
                      content:  { grad: "from-rose-500 to-pink-500",     bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
                    };
                    const c = colors[tab.key] ?? colors.basic;
                    return (
                      <button key={tab.key} type="button" onClick={() => setDialogTab(tab.key)}
                        className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all ${isActive ? `border ${c.border} ${c.bg} ${c.text} shadow-sm` : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm border border-transparent"}`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${c.grad} shadow-sm`}>
                          <tab.icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        {tab.label}
                      </button>
                    );
                  })}
                  {/* Auto stats widget */}
                  <div className="mt-auto pt-3 border-t border-slate-200 space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Auto Stats</p>
                    <div className="rounded-xl bg-white border border-slate-200 px-2 py-2 text-center">
                      <p className="text-lg font-black text-slate-800">{autoMeta.lectures}</p>
                      <p className="text-[10px] text-slate-400">Lectures</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 px-2 py-2 text-center">
                      <p className="text-base font-black text-slate-800 tabular-nums">{autoMeta.formattedDuration.slice(0,5)}</p>
                      <p className="text-[10px] text-slate-400">Duration</p>
                    </div>
                  </div>
                </nav>

                {/* Right content panel */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-7 py-5 space-y-5">

                    {/* ── BASIC TAB ── */}
                    {dialogTab === "basic" && (
                      <div className="space-y-5">
                        {/* Course Identity */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-100 px-5 py-3">
                            <div className="h-5 w-5 rounded-md bg-indigo-600 flex items-center justify-center shrink-0"><BookOpen className="h-3 w-3 text-white" /></div>
                            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Course Identity</p>
                          </div>
                          <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                              <Label>Course Title *</Label>
                              <Input className={fieldCls} placeholder="e.g., CA Final Advanced Accounting" value={form.title} onChange={(e) => sf({ title: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label>Category *</Label>
                                <select
                                  className={selectCls}
                                  value={form.category}
                                  onChange={(e) => {
                                    const nextCategory = e.target.value;
                                    sf({
                                      category: nextCategory,
                                      subcategory: "",
                                      ...(editingId ? {} : { id: getNextCategoryCourseCode(nextCategory || "general", form.id) }),
                                    });
                                  }}
                                >
                                  <option value="">Select Category</option>
                                  {parentCategories.length === 0 && <option value="general">General</option>}
                                  {parentCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Level / Subcategory</Label>
                                <select className={selectCls} value={form.subcategory} onChange={(e) => sf({ subcategory: e.target.value })}>
                                  <option value="">Select Level</option>
                                  {subcategoryOptions.length === 0 && <option value="general">General</option>}
                                  {subcategoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label>Subject</Label>
                                <select
                                  className={selectCls}
                                  value={form.subject}
                                  onChange={(e) => sf({ subject: e.target.value, chapter: "" })}
                                >
                                  <option value="">Select Subject</option>
                                  {subjectOptions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Chapter</Label>
                                <div className={`rounded-xl border border-slate-200 bg-white p-2 ${!form.subject ? "opacity-60" : ""}`}>
                                  {!form.subject ? (
                                    <p className="px-1 py-2 text-xs text-slate-400">Select Subject First</p>
                                  ) : chapterOptions.length === 0 ? (
                                    <p className="px-1 py-2 text-xs text-slate-400">No chapters found for this subject</p>
                                  ) : (
                                    <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                                      {chapterOptions.map((item) => {
                                        const checked = form.selectedChapters.includes(item.name);
                                        return (
                                          <label key={item.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${checked ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"}`}>
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(e) => toggleChapterSelection(item.name, e.target.checked)}
                                              className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600"
                                            />
                                            <span className="font-medium">{item.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  {form.selectedChapters.length > 0
                                    ? `${form.selectedChapters.length} chapter${form.selectedChapters.length > 1 ? "s" : ""} selected`
                                    : "Select one or more chapters"}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label>Professor / Faculty</Label>
                                <Input className={fieldCls} placeholder="Faculty Name" list="course-faculty-options2" value={form.professor} onChange={(e) => sf({ professor: e.target.value })} />
                                <datalist id="course-faculty-options2">{suggestedFaculty.map((name) => <option key={name} value={name} />)}</datalist>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Language</Label>
                                {masterLanguages.length > 0 ? (
                                  <select className={selectCls} value={form.language} onChange={(e) => sf({ language: e.target.value })}>
                                    <option value="">Select Language</option>
                                    {masterLanguages.map((lang) => <option key={lang.id} value={lang.name}>{lang.name}</option>)}
                                  </select>
                                ) : (
                                  <Input className={fieldCls} placeholder="Hindi / English" value={form.language} onChange={(e) => sf({ language: e.target.value })} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Thumbnail */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-100 px-5 py-3">
                            <div className="h-5 w-5 rounded-md bg-blue-600 flex items-center justify-center shrink-0"><Eye className="h-3 w-3 text-white" /></div>
                            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Thumbnail</p>
                          </div>
                          <div className="p-5">
                            <div className="flex items-start gap-4">
                              {form.thumbnail ? (
                                <img src={form.thumbnail} alt="" className="h-20 w-28 shrink-0 rounded-xl object-cover ring-2 ring-indigo-100 shadow-md" />
                              ) : (
                                <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border-2 border-dashed border-slate-200 text-slate-300">
                                  <BookOpen className="h-8 w-8" />
                                </div>
                              )}
                              <div className="flex-1 space-y-2">
                                <Input className={fieldCls} placeholder="Paste image URL here or upload →" value={form.thumbnail || ""} onChange={(e) => sf({ thumbnail: e.target.value })} />
                                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[11px] font-bold text-white shadow-md shadow-indigo-200/50 transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-95">
                                  {courseThumbnailUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                                  {courseThumbnailUploading ? "Uploading..." : "Upload Image"}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadCourseThumbnail(e.target.files?.[0])} />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Base Pricing */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100 px-5 py-3">
                            <div className="h-5 w-5 rounded-md bg-emerald-600 flex items-center justify-center shrink-0"><DollarSign className="h-3 w-3 text-white" /></div>
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Base Pricing</p>
                          </div>
                          <div className="p-5">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label>Sell Price (₹) *</Label>
                                <Input className={`${fieldCls} font-bold text-emerald-700`} type="number" placeholder="3999" value={form.price || ""} disabled={Boolean(form.deliveryModePricingEnabled)} onChange={(e) => sf({ price: Number(e.target.value) || 0 })} />
                                {form.deliveryModePricingEnabled && <p className="text-[10px] text-slate-400">Set via mode pricing</p>}
                              </div>
                              <div className="space-y-1.5">
                                <Label>Original / MRP (₹)</Label>
                                <Input className={`${fieldCls} text-slate-500 line-through-placeholder`} type="number" placeholder="5999" value={form.originalPrice || ""} disabled={Boolean(form.deliveryModePricingEnabled)} onChange={(e) => sf({ originalPrice: Number(e.target.value) || 0 })} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Tax (%)</Label>
                                <Input className={fieldCls} type="number" min={0} step={0.01} placeholder="18" value={form.taxPercentage || ""} onChange={(e) => sf({ taxPercentage: Math.max(0, Number(e.target.value) || 0) })} />
                              </div>
                            </div>
                            {form.price > 0 && form.originalPrice > form.price && (
                              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                                <span className="text-xs text-emerald-700">Student saves:</span>
                                <span className="text-sm font-extrabold text-emerald-700">₹{(form.originalPrice - form.price).toLocaleString()} ({Math.round(((form.originalPrice - form.price) / form.originalPrice) * 100)}% off)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── PRICING TAB ── */}
                    {dialogTab === "pricing" && (
                      <div className="space-y-5">
                        {(form.masterCombinationRows || []).length > 0 && (
                          <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-5 py-4 shadow-sm">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-md">
                              <CheckCircle2 className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-emerald-900">Price Combinations Active</p>
                              <p className="text-xs text-emerald-700">
                                {(form.masterCombinationRows || []).filter((row) => row.isActive !== false).length} combination(s) configured
                              </p>
                            </div>
                            <a href="/admin/masters" target="_blank" className="text-xs font-semibold text-emerald-600 hover:underline">
                              Masters
                            </a>
                          </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-5 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
                                <DollarSign className="h-3 w-3 text-white" />
                              </div>
                              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Master Price Combinations</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => sf({ masterCombinationsEnabled: !form.masterCombinationsEnabled })}
                                className={`h-7 rounded-lg border px-3 text-xs font-semibold transition-all ${
                                  form.masterCombinationsEnabled
                                    ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-white border-slate-300 text-slate-600 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-700"
                                }`}
                              >
                                {form.masterCombinationsEnabled ? "Enabled" : "Disabled"}
                              </button>
                              <a href="/admin/masters" target="_blank" className="text-[10px] text-blue-600 hover:underline">
                                Configure Masters
                              </a>
                            </div>
                          </div>

                          {!form.masterCombinationsEnabled && (
                            <div className="p-5 space-y-4">
                              <p className="text-xs text-slate-500">Master combinations are disabled. Base course price will be used.</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label>Sell Price (₹)</Label>
                                  <Input
                                    className={`${fieldCls} font-bold text-emerald-700`}
                                    type="number"
                                    value={form.price || ""}
                                    onChange={(e) => sf({ price: Number(e.target.value) || 0 })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Original / MRP (₹)</Label>
                                  <Input
                                    className={`${fieldCls} text-slate-500`}
                                    type="number"
                                    value={form.originalPrice || ""}
                                    onChange={(e) => sf({ originalPrice: Number(e.target.value) || 0 })}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {form.masterCombinationsEnabled && (
                            <div className="p-5 space-y-4">
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                                <p className="text-xs font-semibold text-emerald-800">Base / Fallback Price</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label>Sell Price (₹)</Label>
                                    <Input
                                      className={`${fieldCls} font-bold text-emerald-700`}
                                      type="number"
                                      value={form.price || ""}
                                      onChange={(e) => sf({ price: Number(e.target.value) || 0 })}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Original / MRP (₹)</Label>
                                    <Input
                                      className={`${fieldCls} text-slate-500`}
                                      type="number"
                                      value={form.originalPrice || ""}
                                      onChange={(e) => sf({ originalPrice: Number(e.target.value) || 0 })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { key: "combinationUseView" as const, label: "View Mode", count: activeMasterViewModes.length },
                                  { key: "combinationUseValidity" as const, label: "Validity", count: activeMasterValidityOptions.length },
                                  { key: "combinationUseAttempt" as const, label: "Attempt", count: activeMasterAttemptOptions.length },
                                  { key: "combinationUseMode" as const, label: "Lecture Mode", count: activeMasterDeliveryModes.length },
                                ].map(({ key, label, count }) => (
                                  <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${form[key] ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(form[key])}
                                      onChange={(e) => {
                                        if (key === "combinationUseAttempt" && e.target.checked) {
                                          sf({ combinationUseAttempt: true, combinationUseValidity: false });
                                        } else if (key === "combinationUseValidity" && e.target.checked) {
                                          sf({ combinationUseValidity: true, combinationUseAttempt: false });
                                        } else {
                                          sf({ [key]: e.target.checked });
                                        }
                                      }}
                                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                                    />
                                    <div>
                                      <p className="text-xs font-bold text-slate-700">{label}</p>
                                      <p className={`text-[10px] font-semibold ${count > 0 ? "text-emerald-600" : "text-red-500"}`}>{count} active</p>
                                    </div>
                                  </label>
                                ))}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button type="button" className="h-9 gap-2 rounded-xl bg-blue-600 text-xs font-semibold shadow hover:bg-blue-700" onClick={openCourseCombinationSelector}>
                                  <Settings className="h-3.5 w-3.5" /> Select &amp; Generate
                                </Button>
                                {(form.masterCombinationRows || []).length > 0 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 rounded-xl text-xs"
                                    onClick={() => sf({ masterCombinationRows: (form.masterCombinationRows || []).filter((row) => row.isActive !== false) })}
                                  >
                                    Clean Inactive
                                  </Button>
                                )}
                              </div>

                              {(form.masterCombinationRows || []).length > 0 && (
                                <div className="space-y-2 border-t border-blue-100 pt-2">
                                  <p className="text-xs font-semibold text-slate-700">Pricing Grid ({(form.masterCombinationRows || []).length} rows)</p>
                                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                    {(form.masterCombinationRows || []).map((combo, index) => (
                                      <div
                                        key={`${combo.id}-${index}`}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${combo.isActive !== false ? "border-blue-100 bg-blue-50/60" : "border-slate-100 bg-slate-50 opacity-50"}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={combo.isActive !== false}
                                          onChange={(ev) => {
                                            const rows = [...(form.masterCombinationRows || [])];
                                            rows[index] = { ...combo, isActive: ev.target.checked };
                                            sf({ masterCombinationRows: rows });
                                          }}
                                          className="h-3.5 w-3.5 shrink-0 rounded accent-blue-600"
                                        />
                                        <Input
                                          className="h-7 w-24 shrink-0 rounded-lg border-slate-200 text-[10px] font-bold text-emerald-700"
                                          type="number"
                                          min={0}
                                          value={Number(combo.price || 0)}
                                          onChange={(ev) => {
                                            const rows = [...(form.masterCombinationRows || [])];
                                            rows[index] = { ...combo, price: Number(ev.target.value) || 0 };
                                            sf({ masterCombinationRows: rows });
                                          }}
                                        />
                                        <Input
                                          className="h-7 w-24 shrink-0 rounded-lg border-slate-200 text-[10px] text-slate-400"
                                          type="number"
                                          min={0}
                                          value={Number(combo.originalPrice || 0)}
                                          onChange={(ev) => {
                                            const rows = [...(form.masterCombinationRows || [])];
                                            const value = Number(ev.target.value) || 0;
                                            rows[index] = { ...combo, originalPrice: value > 0 ? value : null };
                                            sf({ masterCombinationRows: rows });
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                                          onClick={() => sf({ masterCombinationRows: (form.masterCombinationRows || []).filter((_, i) => i !== index) })}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-xl border-dashed text-xs"
                                    onClick={() => {
                                      const rows = [...(form.masterCombinationRows || [])];
                                      rows.push({
                                        id: `c-combo-${Date.now()}-${rows.length + 1}`,
                                        label: "",
                                        viewModeId: form.combinationUseView ? (activeMasterViewModes[0]?.id || null) : null,
                                        validityOptionId: form.combinationUseValidity ? (activeMasterValidityOptions[0]?.id || null) : null,
                                        attemptOptionId: form.combinationUseAttempt ? (activeMasterAttemptOptions[0]?.id || null) : null,
                                        deliveryModeId: form.combinationUseMode ? (activeMasterDeliveryModes[0]?.id || null) : null,
                                        price: 0,
                                        originalPrice: null,
                                        isActive: true,
                                        sortOrder: rows.length + 1,
                                      });
                                      sf({ masterCombinationRows: rows });
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Add Row
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-slate-100 px-5 py-3">
                            <div className="h-5 w-5 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
                              <BookOpen className="h-3 w-3 text-white" />
                            </div>
                            <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">Book Add-ons</p>
                          </div>
                          <div className="p-5 space-y-3">
                            {checkboxRow("Enable book selection add-ons", form.bookAddonEnabled || false, (v) => sf({ bookAddonEnabled: v }))}
                            {form.bookAddonEnabled && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                {[
                                  { key: "enableEnotesAddon", label: "eNotes", priceKey: "enotesAddonPrice" },
                                  { key: "enablePhysicalBookAddon", label: "Physical Book", priceKey: "physicalBookAddonPrice" },
                                ].map(({ key, label, priceKey }) => (
                                  <div key={key} className="flex items-center gap-4">
                                    <div className="w-32">{checkboxRow(label, Boolean(form[key as keyof CourseForm]), (v) => sf({ [key]: v }))}</div>
                                    <Input
                                      className={`${fieldCls} flex-1`}
                                      type="number"
                                      value={(form[priceKey as keyof CourseForm] as number) || 0}
                                      onChange={(e) => sf({ [priceKey]: Number(e.target.value) || 0 })}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── CONTENT TAB ── */}
                    {dialogTab === "content" && (
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 bg-gradient-to-r from-rose-50 to-pink-50 border-b border-slate-100 px-5 py-3">
                            <div className="h-5 w-5 rounded-md bg-rose-600 flex items-center justify-center shrink-0"><FileText className="h-3 w-3 text-white" /></div>
                            <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">About Course Section</p>
                          </div>
                          <div className="p-5 space-y-4">
                            {checkboxRow("Show About Course section on course page", form.aboutCourseEnabled || false, (v) => sf({ aboutCourseEnabled: v }))}
                            {form.aboutCourseEnabled && (
                              <div className="space-y-1.5">
                                <Label>Course Description Text</Label>
                                <textarea
                                  className="min-h-[200px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300/40"
                                  value={form.aboutCourseText || ""}
                                  onChange={(e) => sf({ aboutCourseText: e.target.value })}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-slate-100 px-5 py-3">
                            <div className="h-5 w-5 rounded-md bg-violet-600 flex items-center justify-center shrink-0"><Video className="h-3 w-3 text-white" /></div>
                            <p className="text-xs font-bold text-violet-700 uppercase tracking-wider">Demo Lecture Settings</p>
                          </div>
                          <div className="p-5 space-y-4">
                            {checkboxRow("Show Demo Lecture on Course Page", form.demoVideoVisible || false, (v) => sf({ demoVideoVisible: v }))}
                            {checkboxRow("WebPlay (ON/OFF Toggle)", form.webPlayEnabled === true, (v) => sf({ webPlayEnabled: v }))}
                            {form.demoVideoVisible && (
                              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label>Demo Lecture Title</Label>
                                    <Input className={fieldCls} value={form.demoVideoTitle || ""} onChange={(e) => sf({ demoVideoTitle: e.target.value })} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Video Source</Label>
                                    <div className="flex gap-2 pt-1">
                                      {(["youtube", "upload", "direct"] as const).map((src) => (
                                        <label key={src} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${form.demoVideoSource === src ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600"}`}>
                                          <input type="radio" name="videoSource" value={src} checked={form.demoVideoSource === src} onChange={() => sf({ demoVideoSource: src })} className="h-3 w-3 accent-violet-600" />
                                          {src === "youtube" ? "YouTube" : src === "upload" ? "CDN" : "Direct"}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Description</Label>
                                  <textarea className="h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30" value={form.demoVideoDescription || ""} onChange={(e) => sf({ demoVideoDescription: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>{form.demoVideoSource === "youtube" ? "YouTube Video ID" : "Video URL"}</Label>
                                  <Input className={fieldCls} value={form.demoVideoUrl || ""} onChange={(e) => sf({ demoVideoUrl: e.target.value })} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100 px-4 py-3">
                              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sidebar Display</p>
                            </div>
                            <div className="p-4 space-y-2">
                              <div className="space-y-1.5 mb-3">
                                <Label>Enrollment Count</Label>
                                <Input className={fieldCls} type="number" min={0} value={form.enrollmentCount || 0} onChange={(e) => sf({ enrollmentCount: Number(e.target.value) || 0 })} />
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                {[
                                  ["showEnrollmentCount", "Enrolled"],
                                  ["showMetaLectures", "Lectures"],
                                  ["showMetaHours", "Hours"],
                                  ["showMetaValidity", "Validity"],
                                  ["showMetaResources", "Resources"],
                                  ["showMetaViews", "Views"],
                                  ["showMetaPerHour", "Per Hour"],
                                  ["showMetaLanguage", "Language"],
                                ].map(([key, label]) => checkboxRow(label, Boolean(form[key as keyof CourseForm]), (v) => sf({ [key]: v })))}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-slate-100 px-4 py-3">
                              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Ratings &amp; Reviews</p>
                            </div>
                            <div className="p-4 space-y-3">
                              {checkboxRow("Show Ratings tab", form.ratingsEnabled !== false, (v) => sf({ ratingsEnabled: v }))}
                              {checkboxRow("Show Reviews tab", form.reviewsEnabled !== false, (v) => sf({ reviewsEnabled: v }))}
                              {form.ratingsEnabled && (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <div className="space-y-1"><Label>Rating (0-5)</Label><Input className={fieldCls} type="number" step={0.1} min={0} max={5} value={form.ratingValue || 0} onChange={(e) => sf({ ratingValue: Number(e.target.value) || 0 })} /></div>
                                  <div className="space-y-1"><Label>Count</Label><Input className={fieldCls} type="number" min={0} value={form.ratingCount || 0} onChange={(e) => sf({ ratingCount: Number(e.target.value) || 0 })} /></div>
                                </div>
                              )}
                              {form.reviewsEnabled && (
                                <div className="space-y-1.5">
                                  <Label>Reviews (one per line)</Label>
                                  <textarea className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300/40" value={form.reviewsText || ""} onChange={(e) => sf({ reviewsText: e.target.value })} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* ── Sticky footer ── */}
              <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-white/95 backdrop-blur-sm px-7 py-3.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-1.5">
                  {dialogTabs.map((tab) => (
                    <button key={tab.key} type="button" onClick={() => setDialogTab(tab.key)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${dialogTab === tab.key ? "w-8 bg-gradient-to-r from-indigo-500 to-blue-500" : "w-3 bg-slate-200 hover:bg-slate-300"}`} />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {dialogTab !== dialogTabs[dialogTabs.length - 1].key && (
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs font-medium" onClick={() => { const idx = dialogTabs.findIndex((t) => t.key === dialogTab); if (idx < dialogTabs.length - 1) setDialogTab(dialogTabs[idx + 1].key); }}>Next →</Button>
                  )}
                  <Button size="sm" className="gap-2 rounded-xl px-6 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-300/30 transition-all hover:scale-[1.02] active:scale-95" onClick={handleSaveCourse} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : editingId ? "✓ Update Course" : "✓ Create Course"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Course List ──────────────────────────────────────── */}
      <Dialog open={courseComboSelectorOpen} onOpenChange={setCourseComboSelectorOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle>Select Master Options For Generation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Choose only the View, Validity, Attempt, and Lecture Mode options you want from Master module. Same selected options se combinations generate honge.
            </p>

            {form.combinationUseView && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">View Options</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-blue-600 hover:underline"
                      onClick={() => setCourseSelectedViewModeIds(activeMasterViewModes.map((item) => item.id))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:underline"
                      onClick={() => setCourseSelectedViewModeIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterViewModes.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={courseSelectedViewModeIds.includes(item.id)}
                        onChange={(event) => setCourseSelectedViewModeIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.combinationUseValidity && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Validity Options</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-blue-600 hover:underline"
                      onClick={() => setCourseSelectedValidityIds(activeMasterValidityOptions.map((item) => item.id))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:underline"
                      onClick={() => setCourseSelectedValidityIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterValidityOptions.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={courseSelectedValidityIds.includes(item.id)}
                        onChange={(event) => setCourseSelectedValidityIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.combinationUseAttempt && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Attempt Options</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-blue-600 hover:underline"
                      onClick={() => setCourseSelectedAttemptIds(activeMasterAttemptOptions.map((item) => item.id))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:underline"
                      onClick={() => setCourseSelectedAttemptIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterAttemptOptions.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={courseSelectedAttemptIds.includes(item.id)}
                        onChange={(event) => setCourseSelectedAttemptIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.combinationUseMode && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Lecture Mode Options</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-blue-600 hover:underline"
                      onClick={() => setCourseSelectedDeliveryModeIds(activeMasterDeliveryModes.map((item) => item.id))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:underline"
                      onClick={() => setCourseSelectedDeliveryModeIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterDeliveryModes.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={courseSelectedDeliveryModeIds.includes(item.id)}
                        onChange={(event) => setCourseSelectedDeliveryModeIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCourseComboSelectorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={generateCourseCombinationsFromSelected}>
              Generate Selected
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Package Combo Selector Dialog ───────────────────── */}
      <Dialog open={pkgComboSelectorOpen} onOpenChange={setPkgComboSelectorOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle>Select Master Options For Package Generation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Choose only the View, Validity, Attempt, and Lecture Mode options you want from Master module. Same selected options se combinations generate honge.
            </p>

            {pkgCombinationUseView && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">View Options</p>
                  <div className="flex gap-2">
                    <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => setPkgSelectedViewModeIds(activeMasterViewModes.map((item) => item.id))}>
                      Select all
                    </button>
                    <button type="button" className="text-[11px] text-slate-500 hover:underline" onClick={() => setPkgSelectedViewModeIds([])}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterViewModes.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={pkgSelectedViewModeIds.includes(item.id)}
                        onChange={(event) => setPkgSelectedViewModeIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {pkgCombinationUseValidity && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Validity Options</p>
                  <div className="flex gap-2">
                    <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => setPkgSelectedValidityIds(activeMasterValidityOptions.map((item) => item.id))}>
                      Select all
                    </button>
                    <button type="button" className="text-[11px] text-slate-500 hover:underline" onClick={() => setPkgSelectedValidityIds([])}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterValidityOptions.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={pkgSelectedValidityIds.includes(item.id)}
                        onChange={(event) => setPkgSelectedValidityIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {pkgCombinationUseAttempt && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Attempt Options</p>
                  <div className="flex gap-2">
                    <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => setPkgSelectedAttemptIds(activeMasterAttemptOptions.map((item) => item.id))}>
                      Select all
                    </button>
                    <button type="button" className="text-[11px] text-slate-500 hover:underline" onClick={() => setPkgSelectedAttemptIds([])}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterAttemptOptions.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={pkgSelectedAttemptIds.includes(item.id)}
                        onChange={(event) => setPkgSelectedAttemptIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {pkgCombinationUseMode && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Lecture Mode Options</p>
                  <div className="flex gap-2">
                    <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => setPkgSelectedDeliveryModeIds(activeMasterDeliveryModes.map((item) => item.id))}>
                      Select all
                    </button>
                    <button type="button" className="text-[11px] text-slate-500 hover:underline" onClick={() => setPkgSelectedDeliveryModeIds([])}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeMasterDeliveryModes.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={pkgSelectedDeliveryModeIds.includes(item.id)}
                        onChange={(event) => setPkgSelectedDeliveryModeIds((prev) => event.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((id) => id !== item.id))}
                      />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPkgComboSelectorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={generatePackageCombinationsFromSelected}>
              Generate Selected
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <BookOpen className="h-8 w-8 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No courses found</p>
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
              <div key={course.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-primary/20">
                {/* Thumbnail */}
                <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
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
                    {course.isCombo && <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"><Layers className="h-2.5 w-2.5" />Package</span>}
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
                  <button type="button" onClick={() => course.isCombo ? openEditPackage(course) : openEditDialog(course)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-primary/10 hover:text-primary">
                    {course.isCombo ? <Layers className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
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
                    <button type="button" onClick={() => course.isCombo ? openEditPackage(course) : openEditDialog(course)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary">
                      {course.isCombo ? <Layers className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
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

      {videoUploadState && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs">
          {uploadPanelMinimized ? (
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg"
              onClick={() => setUploadPanelMinimized(false)}
            >
              {videoUploadState.status === "uploading"
                ? `Uploading ${videoUploadState.progress}%`
                : `${videoUploadState.status.toUpperCase()} - Open`}
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-slate-800">{videoUploadState.fileName}</p>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-md px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100" onClick={() => setUploadPanelMinimized(true)}>Minimize</button>
                  <button type="button" className="rounded-md px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100" onClick={() => setVideoUploadState(null)}>Close</button>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${videoUploadState.status === "error" ? "bg-red-500" : videoUploadState.status === "cancelled" ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.max(2, videoUploadState.progress)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-600">{videoUploadState.message || videoUploadState.status}</p>
                {videoUploadState.status === "uploading" && (
                  <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg border-red-200 px-2 text-[10px] text-red-600 hover:bg-red-50" onClick={handleCancelActiveUpload}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
