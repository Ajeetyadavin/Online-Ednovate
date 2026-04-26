import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Edit2, Save, Video, FileText, CheckCircle2, Lock, Upload, Loader2,
  Check, ChevronsUpDown, BookOpen, ChevronRight, AlertCircle, X, Eye, GripVertical, FolderPlus, RefreshCw, FolderOpen,
} from "lucide-react";
import { decodeVideoUrl, encodeVideoUrl, extractYouTubeVideoId, type LessonVideoSource } from "@/lib/video-utils";
import { adminApi, type BunnyLibraryVideo } from "@/services/adminApi";
import { toast } from "sonner";
import { useConfirm } from "@/context/ConfirmContext";

/* ─── Types ─────────────────────────────────────────────────── */
interface NewLesson {
  title: string; description: string; duration: string;
  type: "video" | "pdf" | "quiz"; videoSource?: LessonVideoSource;
  videoUrl?: string; resourceUrl?: string; isPreview?: boolean;
  instructorShares?: Array<{ facultyId: string; sharePercent: number }>;
}
interface FacultyOption { id: string; name: string; courseIds: string[]; isActive: boolean; }
interface EditingChapter { id: string; title: string; description?: string }
type LessonUploadState = {
  fileName: string;
  progress: number;
  status: "uploading" | "success" | "error" | "cancelled";
  message?: string;
};
type ChapterCollectionVideoDrafts = Record<string, string>;

const INITIAL_LESSON: NewLesson = { title: "", description: "", duration: "", type: "video", videoSource: "direct", videoUrl: "", resourceUrl: "", isPreview: false, instructorShares: [] };
const INITIAL_CHAPTER = { title: "", description: "" };

/* ─── Utils ──────────────────────────────────────────────────── */
const emitCurriculumUpdated = (courseId: string) =>
  window.dispatchEvent(new CustomEvent("curriculum-updated", { detail: { courseId, updatedAt: Date.now() } }));

const formatSecondsToHms = (seconds: number) => {
  const t = Math.max(0, Math.floor(Number(seconds) || 0));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
};

const loadVideoDurationFromUrl = (url: string) =>
  new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    let cleaned = false;
    const clean = () => { if (cleaned) return; cleaned = true; video.removeAttribute("src"); video.load(); };
    const timeoutId = window.setTimeout(() => { clean(); reject(new Error("Timed out while reading video duration")); }, 15000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.clearTimeout(timeoutId);
      const d = Number(video.duration || 0); clean();
      if (!Number.isFinite(d) || d <= 0) { reject(new Error("Duration not available")); return; }
      resolve(Math.floor(d));
    };
    video.onerror = () => { window.clearTimeout(timeoutId); clean(); reject(new Error("Unable to load video metadata")); };
    video.src = url; video.load();
  });

type YouTubeWindow = Window & {
  YT?: { Player: new (el: HTMLElement, opts: { height?: string; width?: string; videoId: string; events?: { onReady?: () => void; onError?: () => void } }) => { getDuration?: () => number; destroy?: () => void } };
  onYouTubeIframeAPIReady?: () => void;
  __ednovateYoutubeApiReady?: Promise<void>;
};

const loadYouTubeIframeApi = () => {
  const w = window as YouTubeWindow;
  if (w.YT?.Player) return Promise.resolve();
  if (w.__ednovateYoutubeApiReady) return w.__ednovateYoutubeApiReady;
  w.__ednovateYoutubeApiReady = new Promise<void>((resolve, reject) => {
    if (w.YT?.Player) { resolve(); return; }
    w.onYouTubeIframeAPIReady = () => { w.onYouTubeIframeAPIReady = undefined; resolve(); };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
      s.onerror = () => { w.__ednovateYoutubeApiReady = undefined; reject(new Error("Failed to load YouTube API")); };
      document.head.appendChild(s);
    }
  });
  return w.__ednovateYoutubeApiReady;
};

const loadYouTubeDurationSeconds = async (videoId: string) => {
  await loadYouTubeIframeApi();
  const w = window as YouTubeWindow;
  if (!w.YT?.Player) throw new Error("YouTube API not available");
  return new Promise<number>((resolve, reject) => {
    const mount = document.createElement("div");
    Object.assign(mount.style, { position: "fixed", left: "-9999px", top: "-9999px", width: "1px", height: "1px" });
    document.body.appendChild(mount);
    let settled = false;
    let player: { getDuration?: () => number; destroy?: () => void } | null = null;
    const clean = () => { try { player?.destroy?.(); } catch { /* ignore */ } mount.remove(); };
    const fin = (cb: () => void) => { if (settled) return; settled = true; cb(); clean(); };
    const tid = window.setTimeout(() => fin(() => reject(new Error("Timed out reading YouTube duration"))), 15000);
    player = new w.YT!.Player(mount, { height: "1", width: "1", videoId, events: {
      onReady: () => { const d = Math.floor(Number(player?.getDuration?.() || 0)); window.clearTimeout(tid); if (!Number.isFinite(d) || d <= 0) { fin(() => reject(new Error("YouTube duration not available"))); return; } fin(() => resolve(d)); },
      onError: () => { window.clearTimeout(tid); fin(() => reject(new Error("Failed to load YouTube video"))); },
    }});
  });
};

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

/* ─── Constants ──────────────────────────────────────────────── */
const TYPE_ICON = { video: Video, pdf: FileText, quiz: CheckCircle2 };
const TYPE_STYLE: Record<string, string> = {
  video: "bg-blue-100 text-blue-700", pdf: "bg-purple-100 text-purple-700", quiz: "bg-emerald-100 text-emerald-700"
};
const TYPE_LABEL: Record<string, string> = { video: "Video", pdf: "PDF", quiz: "Quiz" };

/* ─── Field label ─────────────────────────────────────────────── */
const FL = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
);
const fCls = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";
const sCls = "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40";

/* ─── Main ─────────────────────────────────────────────────────── */
export default function AdminCourseContent() {
  const { courses, categories, getCurriculumForCourse, setCurriculumForCourse } = usePlatformData();
  const { confirm } = useConfirm();
  const nonPackageCourses = useMemo(() => courses.filter((course) => !course.isCombo), [courses]);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [coursePickerQuery, setCoursePickerQuery] = useState("");
  const [courseFilterId, setCourseFilterId] = useState("all");
  const [levelFilterId, setLevelFilterId] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [professorFilter, setProfessorFilter] = useState("all");

  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);

  const [editingChapter, setEditingChapter] = useState<EditingChapter | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState<NewLesson>(INITIAL_LESSON);
  const [newChapter, setNewChapter] = useState(INITIAL_CHAPTER);

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [lessonUploadState, setLessonUploadState] = useState<LessonUploadState | null>(null);
  const [lessonUploadMinimized, setLessonUploadMinimized] = useState(false);
  const lessonUploadAbortRef = useRef<AbortController | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [collectionNameDraft, setCollectionNameDraft] = useState("");
  const [collectionVideos, setCollectionVideos] = useState<BunnyLibraryVideo[]>([]);
  const [collectionVideoDrafts, setCollectionVideoDrafts] = useState<ChapterCollectionVideoDrafts>({});
  const [selectedCollectionVideoIds, setSelectedCollectionVideoIds] = useState<Set<string>>(new Set());
  const [isLoadingCollectionVideos, setIsLoadingCollectionVideos] = useState(false);
  const [isRefreshingCollection, setIsRefreshingCollection] = useState(false);
  const [isSavingCollectionName, setIsSavingCollectionName] = useState(false);
  const [isSwitchingCollection, setIsSwitchingCollection] = useState(false);
  const [showCollectionSwitcher, setShowCollectionSwitcher] = useState(false);
  const [availableCollections, setAvailableCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [switchCollectionId, setSwitchCollectionId] = useState("");
  const [uploadingCollectionVideo, setUploadingCollectionVideo] = useState(false);
  const [collectionUploadProgress, setCollectionUploadProgress] = useState(0);
  const [renamingVideoId, setRenamingVideoId] = useState("");
  const [deletingCollectionVideoId, setDeletingCollectionVideoId] = useState("");
  const [importingCollectionVideos, setImportingCollectionVideos] = useState(false);
  const collectionUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Drag-and-drop state
  const dragChapterIdx = useRef<number | null>(null);
  const dragOverChapterIdx = useRef<number | null>(null);
  const dragLessonIdx = useRef<number | null>(null);
  const dragOverLessonIdx = useRef<number | null>(null);
  const [dragChapterActive, setDragChapterActive] = useState(false);
  const [dragLessonActive, setDragLessonActive] = useState(false);

  const persistOrder = async (updated: typeof curriculum) => {
    if (!selectedCourse) return;
    setCurriculumForCourse(selectedCourse.id, updated);
    try { await adminApi.saveCurriculum(selectedCourse.id, updated); emitCurriculumUpdated(selectedCourse.id); }
    catch { /* silent — UI already updated */ }
  };

  const handleChapterDrop = () => {
    const from = dragChapterIdx.current;
    const to = dragOverChapterIdx.current;
    if (from === null || to === null || from === to) { setDragChapterActive(false); return; }
    const reordered = [...curriculum];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setDragChapterActive(false);
    dragChapterIdx.current = null; dragOverChapterIdx.current = null;
    void persistOrder(reordered);
  };

  const handleLessonDrop = () => {
    const from = dragLessonIdx.current;
    const to = dragOverLessonIdx.current;
    if (from === null || to === null || from === to || !selectedChapter) { setDragLessonActive(false); return; }
    const lessons = [...selectedChapter.lessons];
    const [moved] = lessons.splice(from, 1);
    lessons.splice(to, 0, moved);
    const updated = curriculum.map((ch) => ch.id === selectedChapter.id ? { ...ch, lessons } : ch);
    setDragLessonActive(false);
    dragLessonIdx.current = null; dragOverLessonIdx.current = null;
    void persistOrder(updated);
  };

  const selectedCourse = useMemo(() => nonPackageCourses.find((c) => c.id === selectedCourseId), [selectedCourseId, nonPackageCourses]);
  const categoriesById = useMemo(() => Object.fromEntries((categories || []).map((item) => [item.id, item])), [categories]);
  const courseFilterOptions = useMemo(() => {
    const used = new Set(nonPackageCourses.map((course) => String(course.category || "")).filter(Boolean));
    return (categories || [])
      .filter((item) => item.parentId === null)
      .filter((item) => used.has(item.id));
  }, [categories, nonPackageCourses]);
  const levelFilterOptions = useMemo(() => {
    const pool = nonPackageCourses.filter((course) => courseFilterId === "all" || String(course.category || "") === courseFilterId);
    const used = new Set(pool.map((course) => String(course.subcategory || "")).filter(Boolean));
    return (categories || []).filter((item) => used.has(item.id));
  }, [categories, nonPackageCourses, courseFilterId]);
  const subjectFilterOptions = useMemo(() => {
    const pool = nonPackageCourses.filter((course) => {
      if (courseFilterId !== "all" && String(course.category || "") !== courseFilterId) return false;
      if (levelFilterId !== "all" && String(course.subcategory || "") !== levelFilterId) return false;
      return true;
    });
    return Array.from(new Set(pool.map((course) => String(course.subject || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [nonPackageCourses, courseFilterId, levelFilterId]);
  const professorFilterOptions = useMemo(() => {
    const pool = nonPackageCourses.filter((course) => {
      if (courseFilterId !== "all" && String(course.category || "") !== courseFilterId) return false;
      if (levelFilterId !== "all" && String(course.subcategory || "") !== levelFilterId) return false;
      if (subjectFilter !== "all" && String(course.subject || "").trim() !== subjectFilter) return false;
      return true;
    });
    return Array.from(new Set(pool.map((course) => String(course.professor || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [nonPackageCourses, courseFilterId, levelFilterId, subjectFilter]);
  const filteredCoursePickerOptions = useMemo(() => {
    const query = coursePickerQuery.trim().toLowerCase();
    return nonPackageCourses.filter((course) => {
      if (courseFilterId !== "all" && String(course.category || "") !== courseFilterId) return false;
      if (levelFilterId !== "all" && String(course.subcategory || "") !== levelFilterId) return false;
      if (subjectFilter !== "all" && String(course.subject || "").trim() !== subjectFilter) return false;
      if (professorFilter !== "all" && String(course.professor || "").trim() !== professorFilter) return false;
      if (!query) return true;
      const categoryName = String(categoriesById[String(course.category || "")]?.name || course.category || "").toLowerCase();
      const levelName = String(categoriesById[String(course.subcategory || "")]?.name || course.subcategory || "").toLowerCase();
      return String(course.title || "").toLowerCase().includes(query)
        || String(course.professor || "").toLowerCase().includes(query)
        || String(course.subject || "").toLowerCase().includes(query)
        || categoryName.includes(query)
        || levelName.includes(query);
    });
  }, [nonPackageCourses, courseFilterId, levelFilterId, subjectFilter, professorFilter, coursePickerQuery, categoriesById]);

  const lessonFacultyOptions = useMemo(() => {
    if (!selectedCourseId) return facultyOptions;

    const courseFacultyIds = new Set(
      (Array.isArray((selectedCourse as { facultyIds?: unknown[] } | undefined)?.facultyIds)
        ? ((selectedCourse as { facultyIds?: unknown[] }).facultyIds || [])
        : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    );

    const professorTokens = String((selectedCourse as { professor?: unknown } | undefined)?.professor || "")
      .split(/,|\||&| and /i)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return facultyOptions.filter((item) => {
      if (item.courseIds.includes(selectedCourseId)) return true;
      if (courseFacultyIds.has(item.id)) return true;
      if (professorTokens.length > 0 && professorTokens.includes(item.name.trim().toLowerCase())) return true;
      return false;
    });
  }, [facultyOptions, selectedCourse, selectedCourseId]);

  const curriculum = useMemo(() => selectedCourse ? getCurriculumForCourse(selectedCourse.id, selectedCourse.title) : [], [selectedCourseId, selectedCourse, getCurriculumForCourse]);
  const selectedChapter = useMemo(() => curriculum.find((ch) => ch.id === selectedChapterId) || curriculum[0] || null, [selectedChapterId, curriculum]);
  const sharedCourseCollection = useMemo(() => {
    const sourceChapter = curriculum.find((chapter) => String(chapter.bunnyCollectionId || "").trim());
    if (!sourceChapter) return { id: "", name: "" };
    return {
      id: String(sourceChapter.bunnyCollectionId || "").trim(),
      name: String(sourceChapter.bunnyCollectionName || "").trim(),
    };
  }, [curriculum]);

  useEffect(() => {
    if (!selectedCourseId) return;
    if (!nonPackageCourses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId("");
      setSelectedChapterId(null);
    }
  }, [selectedCourseId, nonPackageCourses]);

  useEffect(() => {
    if (courseFilterId === "all") return;
    if (!courseFilterOptions.some((item) => item.id === courseFilterId)) setCourseFilterId("all");
  }, [courseFilterId, courseFilterOptions]);

  useEffect(() => {
    if (levelFilterId === "all") return;
    if (!levelFilterOptions.some((item) => item.id === levelFilterId)) setLevelFilterId("all");
  }, [levelFilterId, levelFilterOptions]);

  useEffect(() => {
    if (subjectFilter === "all") return;
    if (!subjectFilterOptions.includes(subjectFilter)) setSubjectFilter("all");
  }, [subjectFilter, subjectFilterOptions]);

  useEffect(() => {
    if (professorFilter === "all") return;
    if (!professorFilterOptions.includes(professorFilter)) setProfessorFilter("all");
  }, [professorFilter, professorFilterOptions]);

  useEffect(() => {
    if (curriculum.length > 0 && !selectedChapterId) setSelectedChapterId(curriculum[0].id);
    else if (curriculum.length === 0) setSelectedChapterId(null);
  }, [selectedCourseId, curriculum, selectedChapterId]);

  useEffect(() => { if (!chapterDialogOpen) { setEditingChapter(null); setNewChapter(INITIAL_CHAPTER); } }, [chapterDialogOpen]);
  useEffect(() => { if (!lessonDialogOpen) { setEditingLessonId(null); setNewLesson(INITIAL_LESSON); } }, [lessonDialogOpen]);
  useEffect(() => {
    let mounted = true;
    void adminApi.listFaculty().then((result) => {
      if (!mounted) return;
      const items = Array.isArray(result.items) ? result.items : [];
      setFacultyOptions(
        items.map((item) => ({
          id: String(item.id || "").trim(),
          name: String(item.name || "").trim(),
          courseIds: Array.isArray(item.courseIds) ? item.courseIds.map((id) => String(id || "").trim()).filter(Boolean) : [],
          isActive: item.isActive !== false,
        })).filter((item) => item.id && item.name && item.isActive),
      );
    }).catch(() => {
      if (!mounted) return;
      setFacultyOptions([]);
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!collectionDialogOpen) {
      setCollectionVideos([]);
      setCollectionVideoDrafts({});
      setCollectionUploadProgress(0);
      setShowCollectionSwitcher(false);
    }
  }, [collectionDialogOpen]);
  useEffect(() => {
    if (!importDialogOpen) {
      setSelectedCollectionVideoIds(new Set());
    }
  }, [importDialogOpen]);
  useEffect(() => {
    setCollectionNameDraft(String(sharedCourseCollection.name || selectedCourse?.title || selectedChapter?.title || "").trim());
  }, [sharedCourseCollection.name, selectedCourse?.title, selectedChapter?.title]);
  useEffect(() => {
    setCollectionDialogOpen(false);
    setImportDialogOpen(false);
  }, [selectedChapterId]);

  const updateCourseCollectionMeta = async (updates: { bunnyCollectionId?: string; bunnyCollectionName?: string }) => {
    if (!selectedCourse) throw new Error("Select a course first");
    const updated = curriculum.map((chapter) => ({
      ...chapter,
      ...(Object.prototype.hasOwnProperty.call(updates, "bunnyCollectionId") ? { bunnyCollectionId: String(updates.bunnyCollectionId || "").trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "bunnyCollectionName") ? { bunnyCollectionName: String(updates.bunnyCollectionName || "").trim() } : {}),
    }));
    setCurriculumForCourse(selectedCourse.id, updated);
    const result = await adminApi.saveCurriculum(selectedCourse.id, updated);
    if (!result.ok) throw new Error("Failed to save chapter collection details");
    emitCurriculumUpdated(selectedCourse.id);
  };

  const hydrateCollectionVideoDrafts = (videos: BunnyLibraryVideo[]) => {
    setCollectionVideoDrafts(Object.fromEntries(videos.map((video) => [video.id, video.title])));
  };

  const loadAvailableCollections = async () => {
    const result = await adminApi.getBunnyLibrary({ limit: 1 });
    const next = Array.isArray(result.collections)
      ? result.collections.map((item) => ({ id: String(item.id || "").trim(), name: String(item.name || "").trim() })).filter((item) => item.id)
      : [];
    setAvailableCollections(next);
    setSwitchCollectionId(String(sharedCourseCollection.id || "").trim());
  };

  const loadSelectedChapterCollectionVideos = async (options?: { silent?: boolean; nextCollectionName?: string; collectionId?: string }) => {
    const collectionId = String(options?.collectionId || sharedCourseCollection.id || selectedChapter?.bunnyCollectionId || "").trim();
    if (!collectionId) return;
    const silent = options?.silent === true;
    if (silent) setIsRefreshingCollection(true);
    else setIsLoadingCollectionVideos(true);

    try {
      const result = await adminApi.getBunnyLibrary({ collectionId, limit: 250 });
      const videos = Array.isArray(result.videos) ? result.videos : [];
      setCollectionVideos(videos);
      hydrateCollectionVideoDrafts(videos);
      const resolvedCollectionName = options?.nextCollectionName
        || result.collections.find((item) => item.id === collectionId)?.name
        || String(sharedCourseCollection.name || selectedCourse?.title || "").trim();
      setCollectionNameDraft(resolvedCollectionName);
      return { videos, collectionName: resolvedCollectionName };
    } finally {
      setIsLoadingCollectionVideos(false);
      setIsRefreshingCollection(false);
    }
  };

  const openCollectionManager = async () => {
    if (!sharedCourseCollection.id) return;
    setCollectionDialogOpen(true);
    setCollectionNameDraft(String(sharedCourseCollection.name || selectedCourse?.title || "").trim());
    try {
      await loadAvailableCollections();
      await loadSelectedChapterCollectionVideos();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to load collection videos");
    }
  };

  const handleSwitchCollection = async () => {
    const nextCollectionId = String(switchCollectionId || "").trim();
    if (!nextCollectionId) {
      setSaveError("Select a collection to switch");
      return;
    }

    try {
      setIsSwitchingCollection(true);
      const verify = await adminApi.getBunnyLibrary({ collectionId: nextCollectionId, limit: 1 });
      const resolvedName = String(
        verify.collections?.find((item) => String(item.id || "").trim() === nextCollectionId)?.name
        || collectionNameDraft
        || availableCollections.find((item) => item.id === nextCollectionId)?.name
        || nextCollectionId,
      ).trim();
      await updateCourseCollectionMeta({
        bunnyCollectionId: nextCollectionId,
        bunnyCollectionName: resolvedName,
      });
      setCollectionNameDraft(resolvedName);
      setShowCollectionSwitcher(false);
      await loadSelectedChapterCollectionVideos({ collectionId: nextCollectionId, nextCollectionName: resolvedName });
      toast.success("Collection switched for this course");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to switch collection");
    } finally {
      setIsSwitchingCollection(false);
    }
  };

  const handleCreateCollectionForChapter = async () => {
    if (!selectedChapter) {
      setSaveError("Select a chapter first");
      return;
    }

    if (sharedCourseCollection.id) {
      try {
        await updateCourseCollectionMeta({
          bunnyCollectionId: sharedCourseCollection.id,
          bunnyCollectionName: sharedCourseCollection.name || selectedCourse?.title || "",
        });
        toast.success("Shared course collection linked to all chapters");
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Failed to link shared course collection");
      }
      return;
    }

    try {
      setIsSavingCollectionName(true);
      const defaultName = String(selectedCourse?.title || "Course").trim();
      const result = await adminApi.createBunnyCollection(defaultName);
      await updateCourseCollectionMeta({
        bunnyCollectionId: result.collection.id,
        bunnyCollectionName: result.collection.name,
      });
      setCollectionNameDraft(result.collection.name);
      setCollectionDialogOpen(true);
      await loadSelectedChapterCollectionVideos({ collectionId: result.collection.id, nextCollectionName: result.collection.name });
      toast.success("Chapter collection created in Bunny");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to create Bunny collection");
    } finally {
      setIsSavingCollectionName(false);
    }
  };

  const handleRenameCollection = async () => {
    const collectionId = String(sharedCourseCollection.id || selectedChapter?.bunnyCollectionId || "").trim();
    const nextName = collectionNameDraft.trim();
    if (!collectionId || !selectedCourse) return;
    if (!nextName) {
      setSaveError("Collection name is required");
      return;
    }

    try {
      setIsSavingCollectionName(true);
      await adminApi.renameBunnyCollection(collectionId, nextName);
      await updateCourseCollectionMeta({ bunnyCollectionName: nextName });
      toast.success("Collection renamed");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to rename collection");
    } finally {
      setIsSavingCollectionName(false);
    }
  };

  const handleCollectionVideoUpload = async (file?: File | null) => {
    const collectionId = String(sharedCourseCollection.id || selectedChapter?.bunnyCollectionId || "").trim();
    if (!file || !collectionId) return;

    try {
      setUploadingCollectionVideo(true);
      setCollectionUploadProgress(0);
      await adminApi.uploadVideoFileToBunnyWithProgress(file, "course-collections", {
        collectionId,
        onProgress: (progress) => setCollectionUploadProgress(progress),
      });
      toast.success("Video uploaded to collection");
      await loadSelectedChapterCollectionVideos({ silent: true });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to upload collection video");
    } finally {
      setUploadingCollectionVideo(false);
      setCollectionUploadProgress(0);
      if (collectionUploadInputRef.current) collectionUploadInputRef.current.value = "";
    }
  };

  const handleRenameCollectionVideo = async (videoId: string) => {
    const nextTitle = String(collectionVideoDrafts[videoId] || "").trim();
    if (!nextTitle) {
      setSaveError("Video title is required");
      return;
    }

    try {
      setRenamingVideoId(videoId);
      await adminApi.renameBunnyVideo(videoId, nextTitle);
      setCollectionVideos((prev) => prev.map((video) => video.id === videoId ? { ...video, title: nextTitle } : video));
      toast.success("Video renamed");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to rename video");
    } finally {
      setRenamingVideoId("");
    }
  };

  const handleDeleteCollectionVideo = async (videoId: string, title: string) => {
    const isConfirmed = await confirm({ title: "Delete Video?", description: `Delete video "${title}" from this Bunny collection?` });
    if (!isConfirmed) return;
    try {
      setDeletingCollectionVideoId(videoId);
      await adminApi.deleteBunnyVideo(videoId);
      setCollectionVideos((prev) => prev.filter((video) => video.id !== videoId));
      setSelectedCollectionVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      toast.success("Video deleted");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to delete video");
    } finally {
      setDeletingCollectionVideoId("");
    }
  };

  const openImportDialog = async () => {
    if (!sharedCourseCollection.id) return;
    setImportDialogOpen(true);
    setSelectedCollectionVideoIds(new Set());
    if (!collectionVideos.length) {
      try {
        await loadSelectedChapterCollectionVideos();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Failed to load collection videos");
      }
    }
  };

  const toggleCollectionVideoSelection = (videoId: string, checked: boolean) => {
    setSelectedCollectionVideoIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(videoId);
      else next.delete(videoId);
      return next;
    });
  };

  const handleImportVideosAsLessons = async () => {
    if (!selectedCourse || !selectedChapter) return;
    const selectedVideos = collectionVideos.filter((video) => selectedCollectionVideoIds.has(video.id));
    if (!selectedVideos.length) {
      setSaveError("Select at least one video to create lessons");
      return;
    }

    const existingVideoIds = new Set(
      selectedChapter.lessons
        .filter((lesson) => lesson.type === "video")
        .map((lesson) => decodeVideoUrl(String(lesson.videoUrl || "")).trim())
        .filter(Boolean),
    );

    const freshVideos = selectedVideos.filter((video) => !existingVideoIds.has(video.id));
    if (!freshVideos.length) {
      setSaveError("Selected videos are already added as lessons in this chapter");
      return;
    }

    const importedLessons = freshVideos.map((video, index) => ({
      id: `l_${Date.now()}_${index + 1}`,
      title: String(video.title || `Video ${index + 1}`).trim(),
      description: `Imported from Bunny collection ${String(sharedCourseCollection.name || selectedCourse?.title || "").trim()}`.trim(),
      duration: formatSecondsToHms(Number(video.lengthSeconds || 0)),
      type: "video" as const,
      completed: false,
      locked: false,
      isPreview: false,
      isHomepageDemo: false,
      videoSource: "upload" as const,
      videoUrl: encodeVideoUrl(video.id),
      resourceUrl: "",
      thumbnailUrl: "",
    }));

    const updated = curriculum.map((chapter) => (
      chapter.id === selectedChapter.id
        ? { ...chapter, lessons: [...chapter.lessons, ...importedLessons] }
        : chapter
    ));

    try {
      setImportingCollectionVideos(true);
      setCurriculumForCourse(selectedCourse.id, updated);
      const result = await adminApi.saveCurriculum(selectedCourse.id, updated);
      if (!result.ok) throw new Error("Failed to add imported videos as lessons");
      emitCurriculumUpdated(selectedCourse.id);
      setImportDialogOpen(false);
      setSelectedCollectionVideoIds(new Set());
      const skippedCount = selectedVideos.length - freshVideos.length;
      toast.success(skippedCount > 0
        ? `${freshVideos.length} lesson(s) created, ${skippedCount} duplicate skipped`
        : `${freshVideos.length} lesson(s) created from collection`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to import videos as lessons");
    } finally {
      setImportingCollectionVideos(false);
    }
  };

  /* chapter handlers */
  const handleOpenAddChapter = () => { setEditingChapter(null); setNewChapter(INITIAL_CHAPTER); setSaveError(null); setChapterDialogOpen(true); };
  const handleOpenEditChapter = (ch: any) => { setEditingChapter({ id: ch.id, title: ch.title, description: ch.description }); setNewChapter({ title: ch.title, description: ch.description || "" }); setSaveError(null); setChapterDialogOpen(true); };

  const handleSaveChapter = async () => {
    if (!selectedCourse || !newChapter.title.trim()) { setSaveError("Chapter title is required"); return; }
    setIsSaving(true); setSaveError(null);
    try {
      let updated;
      if (editingChapter) {
        updated = curriculum.map((ch) => ch.id === editingChapter.id ? { ...ch, title: editingChapter.title.trim(), description: editingChapter.description?.trim() || "" } : ch);
      } else {
        const ch = { id: `ch_${Date.now()}`, title: newChapter.title.trim(), description: newChapter.description.trim() || "", lessons: [] };
        updated = [...curriculum, ch];
        setTimeout(() => setSelectedChapterId(ch.id), 50);
      }
      setCurriculumForCourse(selectedCourse.id, updated);
      const r = await adminApi.saveCurriculum(selectedCourse.id, updated);
      if (r.ok) { emitCurriculumUpdated(selectedCourse.id); setChapterDialogOpen(false); }
      else setSaveError("Failed to save chapter. Please try again.");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Failed to save chapter"); }
    finally { setIsSaving(false); }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!selectedCourse) return;
    const isConfirmed = await confirm({ title: "Delete Chapter?", description: "Delete this chapter and all its lessons?" });
    if (!isConfirmed) return;
    setIsSaving(true); setSaveError(null);
    const updated = curriculum.filter((ch) => ch.id !== chapterId);
    try { setCurriculumForCourse(selectedCourse.id, updated); await adminApi.saveCurriculum(selectedCourse.id, updated); emitCurriculumUpdated(selectedCourse.id); setSelectedChapterId(null); }
    catch (e) { setSaveError(e instanceof Error ? e.message : "Failed to delete chapter"); }
    finally { setIsSaving(false); }
  };

  /* lesson handlers */
  const handleOpenAddLesson = () => { setEditingLessonId(null); setNewLesson(INITIAL_LESSON); setSaveError(null); setLessonDialogOpen(true); };
  const handleOpenEditLesson = (l: any) => {
    setEditingLessonId(l.id);
    setNewLesson({
      title: l.title,
      description: l.description || "",
      duration: l.duration || "0:00",
      type: l.type || "video",
      videoSource: l.videoSource || "direct",
      videoUrl: l.videoUrl ? decodeVideoUrl(l.videoUrl) : "",
      resourceUrl: l.resourceUrl || "",
      isPreview: l.isPreview || false,
      instructorShares: Array.isArray(l.instructorShares)
        ? l.instructorShares
          .map((row: any) => ({
            facultyId: String(row?.facultyId || "").trim(),
            sharePercent: Number(row?.sharePercent || 0),
          }))
          .filter((row: { facultyId: string; sharePercent: number }) => row.facultyId && Number.isFinite(row.sharePercent) && row.sharePercent > 0)
        : [],
    });
    setSaveError(null); setLessonDialogOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse || !selectedChapter || !newLesson.title.trim()) { setSaveError("Lesson title is required"); return; }
    if (newLesson.type === "video" && !newLesson.videoUrl?.trim()) { setSaveError("Please provide a video URL"); return; }
    const sanitizedInstructorShares = (Array.isArray(newLesson.instructorShares) ? newLesson.instructorShares : [])
      .map((row) => ({
        facultyId: String(row.facultyId || "").trim(),
        sharePercent: Number(row.sharePercent || 0),
      }))
      .filter((row) => row.facultyId && Number.isFinite(row.sharePercent) && row.sharePercent > 0);
    const shareTotal = sanitizedInstructorShares.reduce((sum, row) => sum + row.sharePercent, 0);
    const normalizedInstructorShares = shareTotal > 0
      ? sanitizedInstructorShares.map((row) => ({
        facultyId: row.facultyId,
        sharePercent: Number(((row.sharePercent / shareTotal) * 100).toFixed(2)),
      }))
      : [];
    setIsSaving(true); setSaveError(null);
    let updated;
    if (editingLessonId) {
      updated = curriculum.map((ch) => ch.id === selectedChapter.id ? { ...ch, lessons: ch.lessons.map((l) => l.id === editingLessonId ? { ...l, title: newLesson.title.trim(), description: newLesson.description?.trim() || "", duration: newLesson.duration || l.duration || "0:00", type: newLesson.type as "video" | "pdf" | "quiz", isPreview: newLesson.isPreview || false, videoSource: (newLesson.type === "video" ? newLesson.videoSource : undefined) as LessonVideoSource | undefined, videoUrl: newLesson.type === "video" ? encodeVideoUrl(newLesson.videoUrl || "") : undefined, resourceUrl: newLesson.type !== "video" ? newLesson.resourceUrl : undefined, instructorShares: newLesson.type === "video" ? normalizedInstructorShares : [] } : l) } : ch);
    } else {
      const lesson = { id: `l_${Date.now()}`, title: newLesson.title.trim(), description: newLesson.description?.trim() || "", duration: newLesson.duration || "0:00", type: newLesson.type as "video" | "pdf" | "quiz", completed: false, locked: false, isPreview: newLesson.isPreview || false, isHomepageDemo: false, videoSource: (newLesson.type === "video" ? newLesson.videoSource : undefined) as LessonVideoSource | undefined, videoUrl: newLesson.type === "video" ? encodeVideoUrl(newLesson.videoUrl || "") : undefined, resourceUrl: newLesson.type !== "video" ? newLesson.resourceUrl : undefined, instructorShares: newLesson.type === "video" ? normalizedInstructorShares : [] };
      updated = curriculum.map((ch) => ch.id === selectedChapter.id ? { ...ch, lessons: [...ch.lessons, lesson] } : ch);
    }
    try {
      setCurriculumForCourse(selectedCourse.id, updated);
      const r = await adminApi.saveCurriculum(selectedCourse.id, updated);
      if (r.ok) { emitCurriculumUpdated(selectedCourse.id); setLessonDialogOpen(false); setNewLesson(INITIAL_LESSON); }
      else setSaveError("Failed to save lesson. Please try again.");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Failed to save lesson"); }
    finally { setIsSaving(false); }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!selectedCourse || !selectedChapter) return;
    const isConfirmed = await confirm({ title: "Delete Lesson?", description: "Delete this lesson?" });
    if (!isConfirmed) return;
    setIsSaving(true); setSaveError(null);
    const updated = curriculum.map((ch) => ch.id === selectedChapter.id ? { ...ch, lessons: ch.lessons.filter((l) => l.id !== lessonId) } : ch);
    try { setCurriculumForCourse(selectedCourse.id, updated); await adminApi.saveCurriculum(selectedCourse.id, updated); emitCurriculumUpdated(selectedCourse.id); }
    catch (e) { setSaveError(e instanceof Error ? e.message : "Failed to delete lesson"); }
    finally { setIsSaving(false); }
  };

  const handleVideoFileUpload = async (file?: File | null) => {
    if (!file || newLesson.type !== "video") return;
    lessonUploadAbortRef.current?.abort();
    const controller = new AbortController();
    lessonUploadAbortRef.current = controller;
    setIsUploadingVideo(true);
    setLessonUploadMinimized(false);
    setLessonUploadState({ fileName: file.name, progress: 0, status: "uploading", message: "Uploading lesson video..." });
    try {
      const source = newLesson.videoSource || "direct";
      const uploaded = await adminApi.uploadVideoFileToBunnyWithProgress(
        file,
        source === "upload" ? "course-videos" : "direct-videos",
        {
          signal: controller.signal,
          forceStorage: source !== "upload",
          onProgress: (percent) => {
            setLessonUploadState((prev) => {
              if (!prev || prev.status !== "uploading") return prev;
              return { ...prev, progress: percent, message: `Uploading lesson video... ${percent}%` };
            });
          },
        },
      );
      setNewLesson((p) => ({ ...p, videoUrl: uploaded.url }));
      setLessonUploadState((prev) => (prev ? { ...prev, progress: 100, status: "success", message: "Upload complete" } : prev));
    } catch (e) {
      const cancelled = e instanceof Error && /cancelled/i.test(e.message);
      setLessonUploadState((prev) => (prev ? { ...prev, status: cancelled ? "cancelled" : "error", message: cancelled ? "Upload cancelled" : "Upload failed" } : prev));
      toast.error(e instanceof Error ? e.message : "Video upload failed");
    }
    finally {
      lessonUploadAbortRef.current = null;
      setIsUploadingVideo(false);
    }
  };

  const handleCancelLessonUpload = () => {
    if (!lessonUploadState || lessonUploadState.status !== "uploading") return;
    lessonUploadAbortRef.current?.abort();
  };

  /* totals */
  const totalLessons = curriculum.reduce((s, ch) => s + ch.lessons.length, 0);
  const totalVideoLessons = curriculum.reduce((s, ch) => s + ch.lessons.filter((l) => l.type === "video").length, 0);
  const chapterVideoIds = useMemo(
    () => new Set(
      (selectedChapter?.lessons || [])
        .filter((lesson) => lesson.type === "video")
        .map((lesson) => decodeVideoUrl(String(lesson.videoUrl || "")).trim())
        .filter(Boolean),
    ),
    [selectedChapter],
  );
  const alreadyAddedInChapterCount = useMemo(
    () => collectionVideos.filter((video) => chapterVideoIds.has(String(video.id || "").trim())).length,
    [collectionVideos, chapterVideoIds],
  );
  const otherChapterVideoMap = useMemo(() => {
    const map = new Map<string, string[]>();
    curriculum.forEach((chapter) => {
      if (chapter.id === selectedChapter?.id) return;
      const chapterName = String(chapter.title || "Untitled Chapter").trim();
      chapter.lessons
        .filter((lesson) => lesson.type === "video")
        .forEach((lesson) => {
          const videoId = decodeVideoUrl(String(lesson.videoUrl || "")).trim();
          if (!videoId) return;
          const existing = map.get(videoId) || [];
          if (!existing.includes(chapterName)) {
            map.set(videoId, [...existing, chapterName]);
          }
        });
    });
    return map;
  }, [curriculum, selectedChapter?.id]);
  const alreadyAddedInOtherChapterCount = useMemo(
    () => collectionVideos.filter((video) => otherChapterVideoMap.has(String(video.id || "").trim())).length,
    [collectionVideos, otherChapterVideoMap],
  );

  return (
    <div className="space-y-4 font-['Inter']">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Video</h1>
            <p className="text-xs text-slate-500">Manage chapters, lessons & videos</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
              {filteredCoursePickerOptions.length} course(s) found
            </span>
            {(courseFilterId !== "all" || levelFilterId !== "all" || subjectFilter !== "all" || professorFilter !== "all") ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">Filters applied</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">No filters</span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            className={sCls}
            value={courseFilterId}
            onChange={(event) => {
              setCourseFilterId(event.target.value);
              setLevelFilterId("all");
              setSubjectFilter("all");
              setProfessorFilter("all");
            }}
          >
            <option value="all">All Courses</option>
            {courseFilterOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          <select
            className={sCls}
            value={levelFilterId}
            onChange={(event) => {
              setLevelFilterId(event.target.value);
              setSubjectFilter("all");
              setProfessorFilter("all");
            }}
          >
            <option value="all">All Levels</option>
            {levelFilterOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          <select className={sCls} value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setProfessorFilter("all"); }}>
            <option value="all">All Subjects</option>
            {subjectFilterOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select className={sCls} value={professorFilter} onChange={(event) => setProfessorFilter(event.target.value)}>
            <option value="all">All Professors</option>
            {professorFilterOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl border-slate-200 text-xs font-semibold"
            onClick={() => {
              setCourseFilterId("all");
              setLevelFilterId("all");
              setSubjectFilter("all");
              setProfessorFilter("all");
              setCoursePickerQuery("");
            }}
          >
            Clear Filters
          </Button>
        </div>

        {/* Course picker */}
        <div className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="hidden min-w-28 rounded-xl bg-slate-100 px-3 py-2 text-center text-[11px] font-semibold text-slate-600 sm:block">
            Course Select
          </div>

          <Popover open={coursePickerOpen} onOpenChange={setCoursePickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox" aria-expanded={coursePickerOpen}
                className="h-10 w-full justify-between rounded-xl border-slate-200 text-left text-xs font-medium sm:w-[34rem]">
                <span className={`truncate ${!selectedCourse ? "text-slate-400" : "font-semibold"}`}>{selectedCourse?.title || "Search and select a course to manage content..."}</span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] rounded-xl border-slate-200 p-0 shadow-xl" align="start">
              <Command>
                <CommandInput placeholder="Search course / subject / professor..." className="h-9 text-xs border-b border-slate-200 bg-white text-slate-900 placeholder:text-slate-500" value={coursePickerQuery} onValueChange={setCoursePickerQuery} />
                <CommandList>
                  <CommandEmpty className="py-6 text-center text-xs font-medium text-slate-600">No course found for selected filters.</CommandEmpty>
                  <CommandGroup>
                    {filteredCoursePickerOptions.map((course) => (
                      <CommandItem key={course.id} value={`${course.title} ${course.id} ${course.subject || ""} ${course.professor || ""}`} onSelect={() => { setSelectedCourseId(course.id); setSelectedChapterId(null); setCoursePickerOpen(false); }}
                        className="text-xs px-4 py-2.5 cursor-pointer data-[selected]:bg-primary/10 data-[selected]:text-primary hover:bg-slate-100">
                        <Check className={cn("mr-2 h-3.5 w-3.5", selectedCourseId === course.id ? "opacity-100 text-primary font-bold" : "opacity-0")} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{course.title}</p>
                          <p className="truncate text-[11px] text-slate-600">
                            {(categoriesById[String(course.category || "")]?.name || course.category || "General")} • {(categoriesById[String(course.subcategory || "")]?.name || course.subcategory || "Level")} • {course.subject || "No Subject"} • {course.professor || "No Professor"}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{saveError}
          <button type="button" className="ml-auto" onClick={() => setSaveError(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {nonPackageCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-20 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-orange-300" />
          <p className="text-sm font-semibold text-orange-700">No courses available</p>
          <p className="mt-1 text-xs text-orange-500">Create normal courses first. Package/combo courses are hidden here.</p>
        </div>
      ) : (
        <>
          {/* ─── Stats row ──────────────────────────────────── */}
          {selectedCourse && (
            <div className="flex gap-3">
              {[
                { label: "Chapters", value: curriculum.length, color: "bg-primary/10 text-primary" },
                { label: "Total Lessons", value: totalLessons, color: "bg-slate-100 text-slate-700" },
                { label: "Video Lessons", value: totalVideoLessons, color: "bg-blue-100 text-blue-700" },
              ].map((stat) => (
                <div key={stat.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${stat.color}`}>
                  <span className="text-base font-bold">{stat.value}</span>
                  <span className="font-medium">{stat.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ─── 3-panel layout ────────────────────────────── */}
          <div className="grid min-h-[640px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* ── PANEL 1: Chapters ── */}
            <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 items-center border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/60 px-4 py-3">
                <div>
                  <span className="text-xs font-bold text-slate-800">Chapters</span>
                  <p className="text-[10px] text-slate-500">Drag and drop to reorder</p>
                </div>
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{curriculum.length}</span>
                <button type="button" onClick={handleOpenAddChapter} disabled={!selectedCourse || isSaving}
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-white transition-opacity hover:opacity-80 disabled:opacity-40">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {curriculum.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-xs font-semibold text-slate-400">No chapters yet</p>
                    <p className="mt-1 text-[10px] text-slate-300">Click + to create the first chapter</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {curriculum.map((ch, idx) => {
                      const isActive = selectedChapterId === ch.id || (!selectedChapterId && idx === 0);
                      return (
                        <div key={ch.id}
                          draggable
                          onDragStart={() => { dragChapterIdx.current = idx; setDragChapterActive(true); }}
                          onDragEnter={() => { dragOverChapterIdx.current = idx; }}
                          onDragOver={(e) => e.preventDefault()}
                          onDragEnd={handleChapterDrop}
                          className={`group flex w-full items-center rounded-xl border transition-all ${isActive ? "border-primary/20 bg-primary text-white shadow-sm" : "border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"} ${dragChapterActive ? "cursor-grabbing" : "cursor-grab"}`}>
                          {/* Drag handle */}
                          <span className={`flex h-full items-center px-1.5 py-2.5 opacity-30 group-hover:opacity-70 ${isActive ? "text-white" : "text-slate-400"}`}>
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>
                          <button type="button" onClick={() => setSelectedChapterId(ch.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 text-left">
                            <span className={`shrink-0 text-xs font-bold ${isActive ? "text-white/70" : "text-slate-400"}`}>{String(idx + 1).padStart(2, "0")}</span>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{ch.title}</span>
                            <span className={`shrink-0 text-[10px] ${isActive ? "text-white/70" : "text-slate-400"}`}>{ch.lessons.length}</span>
                            <ChevronRight className={`h-3 w-3 shrink-0 ${isActive ? "text-white/70" : "text-slate-300 group-hover:text-slate-500"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── PANEL 2: Lessons ── */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {!selectedChapter ? (
                <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                  <ChevronRight className="mb-3 h-8 w-8 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-400">Select a chapter</p>
                  <p className="mt-1 text-xs text-slate-300">Pick a chapter from the left to view and edit its lessons</p>
                </div>
              ) : (
                <>
                  {/* Lesson panel header */}
                  <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{selectedChapter.title}</p>
                      {selectedChapter.description && <p className="truncate text-xs text-slate-400">{selectedChapter.description}</p>}
                      {sharedCourseCollection.id ? (
                        <p className="mt-1 truncate text-[11px] font-semibold text-emerald-600">
                          Collection: {sharedCourseCollection.name || selectedCourse?.title || "Course Collection"}
                        </p>
                      ) : null}
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2 shrink-0">
                      {sharedCourseCollection.id ? (
                        <>
                          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => void openCollectionManager()} disabled={isSaving || isLoadingCollectionVideos || isSavingCollectionName}>
                            <Edit2 className="h-3.5 w-3.5" />Edit Collection
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50" onClick={() => void openImportDialog()} disabled={isSaving || importDialogOpen || importingCollectionVideos}>
                            <Video className="h-3.5 w-3.5" />Add Video From Collection
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => void handleCreateCollectionForChapter()} disabled={isSaving || isSavingCollectionName}>
                          {isSavingCollectionName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}Make Collection
                        </Button>
                      )}
                      <button type="button" onClick={() => handleOpenEditChapter(selectedChapter)} disabled={isSaving}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteChapter(selectedChapter.id)} disabled={isSaving}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <Button size="sm" className="h-8 gap-1.5 rounded-xl px-3 text-xs font-semibold" onClick={handleOpenAddLesson} disabled={isSaving}>
                        <Plus className="h-3.5 w-3.5" />Add Lesson
                      </Button>
                    </div>
                  </div>

                  {/* Lesson list */}
                  <div className="flex-1 overflow-y-auto">
                    {selectedChapter.lessons.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                        <Video className="mb-3 h-10 w-10 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-400">No lessons yet</p>
                        <p className="mb-4 mt-1 text-xs text-slate-300">Add the first lesson to this chapter</p>
                        <Button size="sm" className="gap-1.5 rounded-xl text-xs" onClick={handleOpenAddLesson}><Plus className="h-3.5 w-3.5" />Add First Lesson</Button>
                      </div>
                    ) : (
                      <div className="space-y-2 bg-slate-50/50 p-3">
                        {selectedChapter.lessons.map((lesson, idx) => {
                          const Icon = TYPE_ICON[lesson.type] || Video;
                          return (
                            <div key={lesson.id}
                              draggable
                              onDragStart={() => { dragLessonIdx.current = idx; setDragLessonActive(true); }}
                              onDragEnter={() => { dragOverLessonIdx.current = idx; }}
                              onDragOver={(e) => e.preventDefault()}
                              onDragEnd={handleLessonDrop}
                              className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow ${dragLessonActive ? "cursor-grabbing" : "cursor-grab"}`}>
                              {/* Drag handle */}
                              <GripVertical className="h-4 w-4 shrink-0 text-slate-300 hover:text-slate-500" />
                              {/* Number + Icon */}
                              <div className="flex shrink-0 items-center gap-3">
                                <span className="w-5 text-center text-[11px] font-bold text-slate-300">{idx + 1}</span>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${TYPE_STYLE[lesson.type]}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                              </div>
                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">{lesson.title}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_STYLE[lesson.type]}`}>{TYPE_LABEL[lesson.type]}</span>
                                  {lesson.duration && <span className="text-[11px] text-slate-400">{lesson.duration}</span>}
                                  {lesson.isPreview && <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600"><Eye className="h-2.5 w-2.5" />Preview</span>}
                                  {lesson.locked && <span className="flex items-center gap-1 text-[10px] text-slate-400"><Lock className="h-2.5 w-2.5" />Locked</span>}
                                </div>
                              </div>
                              {/* Actions */}
                              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-50 p-1" onClick={(e) => e.stopPropagation()}>
                                <button type="button" onClick={() => handleOpenEditLesson(lesson)} title="Edit"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary">
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => handleDeleteLesson(lesson.id)} title="Delete"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Chapter Dialog ──────────────────────────────── */}
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">{editingChapter ? "Edit Chapter" : "Add New Chapter"}</DialogTitle>
          </DialogHeader>
          {saveError && <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-6 py-2.5 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5" />{saveError}</div>}
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <FL>Chapter Title *</FL>
              <Input className={fCls} placeholder="e.g., Introduction to Taxation" autoFocus disabled={isSaving}
                value={editingChapter ? editingChapter.title : newChapter.title}
                onChange={(e) => editingChapter ? setEditingChapter({ ...editingChapter, title: e.target.value }) : setNewChapter({ ...newChapter, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <FL>Description (optional)</FL>
              <textarea className="h-20 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40" disabled={isSaving} placeholder="Brief overview of this chapter..."
                value={editingChapter ? editingChapter.description || "" : newChapter.description}
                onChange={(e) => editingChapter ? setEditingChapter({ ...editingChapter, description: e.target.value }) : setNewChapter({ ...newChapter, description: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs" onClick={() => setChapterDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={handleSaveChapter} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</> : editingChapter ? "Update Chapter" : "Create Chapter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Lesson Dialog ───────────────────────────────── */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="flex max-h-[88vh] max-w-lg flex-col overflow-hidden rounded-2xl border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">{editingLessonId ? "Edit Lesson" : "Add New Lesson"}</DialogTitle>
          </DialogHeader>
          {saveError && <div className="shrink-0 flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-6 py-2.5 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5" />{saveError}</div>}
          <div className="flex-1 overflow-y-auto">
            <LessonForm lesson={newLesson} setLesson={setNewLesson} onSave={handleSaveLesson} isEditing={!!editingLessonId}
              facultyOptions={lessonFacultyOptions}
              onUploadVideo={handleVideoFileUpload} isUploadingVideo={isUploadingVideo} isSaving={isSaving}
              uploadProgress={lessonUploadState?.status === "uploading" ? lessonUploadState.progress : 0}
              onCancelUpload={handleCancelLessonUpload} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col overflow-hidden rounded-2xl border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">Edit Bunny Collection</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1 space-y-1.5">
                  <FL>Collection Name</FL>
                  <div className="flex items-center gap-2">
                    <Input className={fCls} value={collectionNameDraft} onChange={(event) => setCollectionNameDraft(event.target.value)} placeholder="Collection name" />
                    <button
                      type="button"
                      title="Switch Collection"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      onClick={() => setShowCollectionSwitcher((prev) => !prev)}
                      disabled={isSavingCollectionName || isSwitchingCollection}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </button>
                  </div>
                  {showCollectionSwitcher ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        className={fCls}
                        list="bunny-collection-switcher-list"
                        value={switchCollectionId}
                        placeholder="Paste / type Collection ID"
                        onChange={(event) => setSwitchCollectionId(event.target.value)}
                        disabled={isSwitchingCollection}
                      />
                      <datalist id="bunny-collection-switcher-list">
                        {availableCollections.map((item) => (
                          <option key={item.id} value={item.id}>{item.name || item.id}</option>
                        ))}
                      </datalist>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold"
                        onClick={() => void handleSwitchCollection()}
                        disabled={isSwitchingCollection || !switchCollectionId}
                      >
                        {isSwitchingCollection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Apply
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-slate-200 px-3 text-xs" onClick={() => void loadSelectedChapterCollectionVideos({ silent: true })} disabled={isRefreshingCollection || isLoadingCollectionVideos}>
                    <RefreshCw className={`h-3.5 w-3.5 ${(isRefreshingCollection || isLoadingCollectionVideos) ? "animate-spin" : ""}`} />Refresh
                  </Button>
                  <Button type="button" size="sm" className="h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold" onClick={() => void handleRenameCollection()} disabled={isSavingCollectionName}>
                    {isSavingCollectionName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save Collection
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingCollectionVideo ? `Uploading ${collectionUploadProgress}%...` : "Upload Video To Collection"}
                  <input
                    ref={collectionUploadInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => void handleCollectionVideoUpload(event.target.files?.[0] || null)}
                    disabled={uploadingCollectionVideo}
                  />
                </label>
                {uploadingCollectionVideo ? (
                  <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, collectionUploadProgress))}%` }} />
                  </div>
                ) : null}
                <p className="text-[11px] text-slate-500">Uploaded videos are added to this collection and will appear in the chapter import dialog.</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingCollectionVideos ? (
                <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading collection videos...
                </div>
              ) : collectionVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Video className="mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-500">No videos in this collection</p>
                  <p className="mt-1 text-xs text-slate-400">Upload videos here, then import them as lessons in the chapter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collectionVideos.map((video) => (
                    <div key={video.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="flex-1 space-y-1.5">
                          <FL>Video Title</FL>
                          <Input
                            className={fCls}
                            value={collectionVideoDrafts[video.id] || ""}
                            onChange={(event) => setCollectionVideoDrafts((prev) => ({ ...prev, [video.id]: event.target.value }))}
                            placeholder="Video title"
                          />
                        </div>
                        <div className="grid min-w-[220px] grid-cols-2 gap-3 text-[11px] text-slate-500">
                          <div>
                            <p className="font-bold uppercase tracking-wide text-slate-400">Duration</p>
                            <p className="mt-1 font-semibold text-slate-700">{formatSecondsToHms(Number(video.lengthSeconds || 0))}</p>
                          </div>
                          <div>
                            <p className="font-bold uppercase tracking-wide text-slate-400">Status</p>
                            <p className="mt-1 font-semibold text-slate-700">{video.status || "unknown"}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-slate-200 px-3 text-xs" onClick={() => void handleRenameCollectionVideo(video.id)} disabled={renamingVideoId === video.id || deletingCollectionVideoId === video.id}>
                            {renamingVideoId === video.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Rename
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-rose-200 px-3 text-xs text-rose-600 hover:bg-rose-50" onClick={() => void handleDeleteCollectionVideo(video.id, video.title)} disabled={deletingCollectionVideoId === video.id || renamingVideoId === video.id}>
                            {deletingCollectionVideoId === video.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Delete
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>ID: {video.id}</span>
                        <span>Created: {video.dateCreated ? new Date(video.dateCreated).toLocaleString() : "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-2xl border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">Add Videos From Collection</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-xs text-slate-500">
              Chapter: <span className="font-semibold text-slate-700">{selectedChapter?.title || "-"}</span>
              {sharedCourseCollection.name ? (
                <span className="ml-3">Collection: <span className="font-semibold text-emerald-700">{sharedCourseCollection.name}</span></span>
              ) : null}
              <span className="ml-3">Already added in this chapter: <span className="font-semibold text-blue-700">{alreadyAddedInChapterCount}</span></span>
              <span className="ml-3">Already in other chapters: <span className="font-semibold text-amber-700">{alreadyAddedInOtherChapterCount}</span></span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingCollectionVideos ? (
                <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading collection videos...
                </div>
              ) : collectionVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Video className="mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-500">No videos available to import</p>
                  <p className="mt-1 text-xs text-slate-400">Upload videos in Edit Collection first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {collectionVideos.map((video) => {
                    const checked = selectedCollectionVideoIds.has(video.id);
                    const alreadyInChapter = chapterVideoIds.has(String(video.id || "").trim());
                    const alreadyInOtherChapters = otherChapterVideoMap.get(String(video.id || "").trim()) || [];
                    return (
                      <label key={video.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition cursor-pointer ${alreadyInChapter ? "border-blue-300 bg-blue-100/40 opacity-60 cursor-not-allowed" : checked ? "border-primary/60 bg-primary/12 shadow-sm ring-1 ring-primary/20" : alreadyInOtherChapters.length > 0 ? "border-amber-300 bg-amber-100/30 hover:border-amber-400" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}>
                        <input type="checkbox" disabled={alreadyInChapter} className="mt-1 h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40" checked={checked} onChange={(event) => toggleCollectionVideoSelection(video.id, event.target.checked)} />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${alreadyInChapter ? "text-slate-600" : checked ? "text-slate-900" : "text-slate-900"}`}>{video.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                            <span className={alreadyInChapter ? "text-slate-500" : checked ? "text-slate-700" : "text-slate-600"}>{formatSecondsToHms(Number(video.lengthSeconds || 0))}</span>
                            <span className={alreadyInChapter ? "text-slate-500" : checked ? "text-slate-700" : "text-slate-600"}>{video.status || "unknown"}</span>
                            <span className={`truncate ${alreadyInChapter ? "text-slate-500" : checked ? "text-slate-700" : "text-slate-600"}`}>ID: {video.id}</span>
                            {alreadyInChapter ? <span className="rounded-full bg-blue-200/60 px-2 py-0.5 font-semibold text-blue-900">Already added in this chapter</span> : null}
                            {alreadyInOtherChapters.length > 0 ? <span className="rounded-full bg-amber-200/50 px-2 py-0.5 font-semibold text-amber-900">Also in: {alreadyInOtherChapters.join(", ")}</span> : null}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
              <p className="text-xs text-slate-500">Selected videos will be added as video lessons in this chapter using their current titles.</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs" onClick={() => setImportDialogOpen(false)} disabled={importingCollectionVideos}>Cancel</Button>
                <Button type="button" size="sm" className="rounded-xl px-4 text-xs font-semibold" onClick={() => void handleImportVideosAsLessons()} disabled={importingCollectionVideos || selectedCollectionVideoIds.size === 0}>
                  {importingCollectionVideos ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Adding...</> : `Create ${selectedCollectionVideoIds.size} Lesson${selectedCollectionVideoIds.size === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {lessonUploadState && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs">
          {lessonUploadMinimized ? (
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg"
              onClick={() => setLessonUploadMinimized(false)}
            >
              {lessonUploadState.status === "uploading"
                ? `Lesson upload ${lessonUploadState.progress}%`
                : `${lessonUploadState.status.toUpperCase()} - Open`}
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-slate-800">{lessonUploadState.fileName}</p>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-md px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100" onClick={() => setLessonUploadMinimized(true)}>Minimize</button>
                  <button type="button" className="rounded-md px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100" onClick={() => setLessonUploadState(null)}>Close</button>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${lessonUploadState.status === "error" ? "bg-red-500" : lessonUploadState.status === "cancelled" ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.max(2, lessonUploadState.progress)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-600">{lessonUploadState.message || lessonUploadState.status}</p>
                {lessonUploadState.status === "uploading" && (
                  <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg border-red-200 px-2 text-[10px] text-red-600 hover:bg-red-50" onClick={handleCancelLessonUpload}>
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

/* ─── Lesson Form ────────────────────────────────────────────── */
function LessonForm({ lesson, setLesson, onSave, isEditing, facultyOptions, onUploadVideo, isUploadingVideo, isSaving = false, uploadProgress = 0, onCancelUpload }: {
  lesson: NewLesson; setLesson: Dispatch<SetStateAction<NewLesson>>;
  facultyOptions: Array<{ id: string; name: string }>;
  onSave: () => void; isEditing: boolean; onUploadVideo: (file?: File | null) => void;
  isUploadingVideo: boolean; isSaving?: boolean; uploadProgress?: number; onCancelUpload?: () => void;
}) {
  const [isFetchingDuration, setIsFetchingDuration] = useState(false);
  const [durationFetchError, setDurationFetchError] = useState<string | null>(null);
  const autoDurationKeyRef = useRef("");

  useEffect(() => {
    if (lesson.type !== "video") { setDurationFetchError(null); setIsFetchingDuration(false); autoDurationKeyRef.current = ""; return; }
    const source = lesson.videoSource || "direct";
    const videoUrl = String(lesson.videoUrl || "").trim();
    if (!videoUrl) { setDurationFetchError(null); setIsFetchingDuration(false); autoDurationKeyRef.current = ""; return; }
    const ytId = extractYouTubeVideoId(videoUrl);
    const resolvedSource: LessonVideoSource = ytId ? "youtube" : source;
    const nextKey = `${resolvedSource}|${videoUrl}`;
    if (autoDurationKeyRef.current === nextKey) return;

    if (resolvedSource === "upload" && isUuidLike(videoUrl)) {
      let cancelled = false;
      const poll = async () => {
        setDurationFetchError(null);
        setIsFetchingDuration(true);
        try {
          for (let attempt = 0; attempt < 24; attempt += 1) {
            if (cancelled) return;
            const result = await adminApi.getBunnyVideoDuration(videoUrl);
            if (cancelled) return;
            if (Number(result?.durationSeconds || 0) > 0) {
              const fmt = formatSecondsToHms(Number(result.durationSeconds));
              setLesson((p) => String(p.videoUrl || "").trim() !== videoUrl ? p : { ...p, duration: fmt });
              autoDurationKeyRef.current = nextKey;
              setDurationFetchError(null);
              setIsFetchingDuration(false);
              return;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 5000));
          }

          if (!cancelled) {
            setDurationFetchError("Bunny video is still processing. Duration will auto-fill once ready.");
          }
        } catch (e) {
          if (!cancelled) {
            setDurationFetchError(e instanceof Error ? e.message : "Could not fetch Bunny video duration");
          }
        } finally {
          if (!cancelled) setIsFetchingDuration(false);
        }
      };

      void poll();
      return () => { cancelled = true; };
    }

    let cancelled = false;
    const tid = window.setTimeout(async () => {
      try {
        setDurationFetchError(null); setIsFetchingDuration(true);
        const secs = resolvedSource === "youtube"
          ? await loadYouTubeDurationSeconds(ytId || (() => { throw new Error("Invalid YouTube URL/Video ID"); })())
          : await loadVideoDurationFromUrl(videoUrl);
        if (cancelled) return;
        const fmt = formatSecondsToHms(secs);
        setLesson((p) => String(p.videoUrl || "").trim() !== videoUrl ? p : { ...p, duration: fmt });
        autoDurationKeyRef.current = nextKey;
      } catch (e) { if (!cancelled) setDurationFetchError(e instanceof Error ? e.message : "Could not auto-detect duration"); }
      finally { if (!cancelled) setIsFetchingDuration(false); }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(tid); };
  }, [lesson.type, lesson.videoSource, lesson.videoUrl, setLesson]);

  const fCls = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";
  const sCls = "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40";
  const FL2 = ({ children }: { children: React.ReactNode }) => <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>;
  const instructorShares = Array.isArray(lesson.instructorShares) ? lesson.instructorShares : [];
  const selectedInstructorIds = new Set(instructorShares.map((row) => String(row.facultyId || "").trim()).filter(Boolean));
  const instructorTotal = instructorShares.reduce((sum, row) => sum + Number(row.sharePercent || 0), 0);

  const rebalanceShares = (shares: Array<{ facultyId: string; sharePercent: number }>) => {
    const valid = shares
      .map((row) => ({ facultyId: String(row.facultyId || "").trim(), sharePercent: Number(row.sharePercent || 0) }))
      .filter((row) => row.facultyId && Number.isFinite(row.sharePercent) && row.sharePercent > 0);
    const total = valid.reduce((sum, row) => sum + row.sharePercent, 0);
    if (total <= 0) return valid;
    return valid.map((row) => ({
      facultyId: row.facultyId,
      sharePercent: Number(((row.sharePercent / total) * 100).toFixed(2)),
    }));
  };

  const toggleInstructor = (facultyId: string, checked: boolean) => {
    const current = Array.isArray(lesson.instructorShares) ? lesson.instructorShares : [];
    const next = checked
      ? [...current, { facultyId, sharePercent: 100 }]
      : current.filter((row) => String(row.facultyId || "") !== facultyId);
    setLesson({ ...lesson, instructorShares: rebalanceShares(next) });
  };

  const updateInstructorShare = (facultyId: string, nextValue: string) => {
    const numeric = Number(nextValue || 0);
    const current = Array.isArray(lesson.instructorShares) ? lesson.instructorShares : [];
    const next = current.map((row) => String(row.facultyId || "") === facultyId ? { ...row, sharePercent: numeric } : row);
    setLesson({ ...lesson, instructorShares: next });
  };

  return (
    <div className="space-y-4 px-6 py-5">
      <div className="space-y-1.5">
        <FL2>Lesson Title *</FL2>
        <Input className={fCls} placeholder="e.g., Introduction to GST" value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} disabled={isSaving} autoFocus />
      </div>
      <div className="space-y-1.5">
        <FL2>Description (optional)</FL2>
        <textarea className="h-16 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Brief overview..." value={lesson.description} onChange={(e) => setLesson({ ...lesson, description: e.target.value })} rows={2} disabled={isSaving} />
      </div>
      <div className="space-y-1.5">
        <FL2>Lesson Type</FL2>
        <div className="flex gap-2">
          {(["video", "pdf", "quiz"] as const).map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <button key={t} type="button" onClick={() => setLesson({ ...lesson, type: t })} disabled={isSaving}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-all ${lesson.type === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                <Icon className="h-3.5 w-3.5" />{TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>

      {lesson.type === "video" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="space-y-1.5">
            <FL2>Video Source</FL2>
            <div className="flex gap-2">
              {(["direct", "youtube", "upload"] as const).map((s) => (
                <label key={s} className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border py-2 text-[11px] font-semibold transition-all ${lesson.videoSource === s ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}>
                  <input type="radio" name="videoSrc" value={s} checked={lesson.videoSource === s} onChange={() => setLesson({ ...lesson, videoSource: s })} className="sr-only" />
                  {s === "direct" ? "Direct URL" : s === "youtube" ? "YouTube" : "CDN Upload"}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <FL2>{lesson.videoSource === "youtube" ? "YouTube Video ID / URL" : "Video URL"}</FL2>
            <Input className={fCls} placeholder={lesson.videoSource === "youtube" ? "e.g., dQw4w9WgXcQ or full youtube URL" : "https://cdn.example.com/video.mp4"}
              value={lesson.videoUrl} onChange={(e) => setLesson({ ...lesson, videoUrl: e.target.value })} disabled={isSaving} />
            {isFetchingDuration && <p className="flex items-center gap-1 text-[11px] text-slate-400"><Loader2 className="h-3 w-3 animate-spin" />Auto-detecting duration...</p>}
            {durationFetchError && (
              <p className="text-[11px] text-amber-600">
                ⚠ {durationFetchError}
                {/still processing|auto-fill/i.test(durationFetchError) ? "" : " — enter duration manually below"}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <FL2>Duration (HH:MM:SS)</FL2>
            <Input className={fCls} placeholder="00:45:30" value={lesson.duration} onChange={(e) => setLesson({ ...lesson, duration: e.target.value })} disabled={isSaving} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FL2>Instructor Hour Share (%)</FL2>
              <span className={`text-[11px] font-semibold ${Math.abs(instructorTotal - 100) < 0.5 || instructorTotal === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                Total: {instructorTotal.toFixed(2)}%
              </span>
            </div>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 space-y-2">
              {facultyOptions.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-slate-500">No mapped faculty found for this course.</p>
              ) : facultyOptions.map((faculty) => {
                const active = selectedInstructorIds.has(faculty.id);
                const row = instructorShares.find((item) => String(item.facultyId || "") === faculty.id);
                return (
                  <div key={faculty.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={active}
                      onChange={(event) => toggleInstructor(faculty.id, event.target.checked)}
                      disabled={isSaving}
                    />
                    <span className="flex-1 truncate text-xs font-medium text-slate-700">{faculty.name}</span>
                    <Input
                      className="h-8 w-24 rounded-lg border-slate-200 text-xs"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={active ? String(Number(row?.sharePercent || 0).toFixed(2)) : ""}
                      placeholder="0"
                      onChange={(event) => updateInstructorShare(faculty.id, event.target.value)}
                      disabled={!active || isSaving}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-primary/30 hover:text-primary">
                  <Upload className="h-3.5 w-3.5" />
                  {isUploadingVideo ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Uploading {uploadProgress}%...</span> : `Upload Video File`}
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => onUploadVideo(e.target.files?.[0])} disabled={isSaving || isUploadingVideo} />
                </label>
                {isUploadingVideo && (
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl border-red-200 px-3 text-[11px] text-red-600 hover:bg-red-50" onClick={onCancelUpload}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Show as Preview</span>
              <Switch checked={lesson.isPreview} onCheckedChange={(v) => setLesson({ ...lesson, isPreview: v })} disabled={isSaving} />
            </div>
          </div>
        </div>
      )}

      {lesson.type === "pdf" && (
        <div className="space-y-1.5">
          <FL2>PDF URL *</FL2>
          <Input className={fCls} placeholder="https://cdn.example.com/document.pdf" value={lesson.resourceUrl} onChange={(e) => setLesson({ ...lesson, resourceUrl: e.target.value })} disabled={isSaving} />
        </div>
      )}

      {lesson.type === "quiz" && (
        <div className="space-y-1.5">
          <FL2>Duration (minutes)</FL2>
          <Input type="number" className={fCls} placeholder="30" value={lesson.duration} onChange={(e) => setLesson({ ...lesson, duration: e.target.value })} disabled={isSaving} />
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={onSave} disabled={isUploadingVideo || isSaving}>
          {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</> : <><Save className="h-3.5 w-3.5" />{isEditing ? "Update Lesson" : "Add Lesson"}</>}
        </Button>
      </div>
    </div>
  );
}
