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
  Check, ChevronsUpDown, BookOpen, ChevronRight, AlertCircle, X, Eye, GripVertical,
} from "lucide-react";
import { decodeVideoUrl, encodeVideoUrl, extractYouTubeVideoId, type LessonVideoSource } from "@/lib/video-utils";
import { adminApi, fileToBase64 } from "@/services/adminApi";

/* ─── Types ─────────────────────────────────────────────────── */
interface NewLesson {
  title: string; description: string; duration: string;
  type: "video" | "pdf" | "quiz"; videoSource?: LessonVideoSource;
  videoUrl?: string; resourceUrl?: string; isPreview?: boolean;
}
interface EditingChapter { id: string; title: string; description?: string }

const INITIAL_LESSON: NewLesson = { title: "", description: "", duration: "", type: "video", videoSource: "direct", videoUrl: "", resourceUrl: "", isPreview: false };
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
  const { courses, getCurriculumForCourse, setCurriculumForCourse } = usePlatformData();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);

  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);

  const [editingChapter, setEditingChapter] = useState<EditingChapter | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState<NewLesson>(INITIAL_LESSON);
  const [newChapter, setNewChapter] = useState(INITIAL_CHAPTER);

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const selectedCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId), [selectedCourseId, courses]);
  const curriculum = useMemo(() => selectedCourse ? getCurriculumForCourse(selectedCourse.id, selectedCourse.title) : [], [selectedCourseId, selectedCourse, getCurriculumForCourse]);
  const selectedChapter = useMemo(() => curriculum.find((ch) => ch.id === selectedChapterId) || curriculum[0] || null, [selectedChapterId, curriculum]);

  useEffect(() => {
    if (curriculum.length > 0 && !selectedChapterId) setSelectedChapterId(curriculum[0].id);
    else if (curriculum.length === 0) setSelectedChapterId(null);
  }, [selectedCourseId, curriculum, selectedChapterId]);

  useEffect(() => { if (!chapterDialogOpen) { setEditingChapter(null); setNewChapter(INITIAL_CHAPTER); } }, [chapterDialogOpen]);
  useEffect(() => { if (!lessonDialogOpen) { setEditingLessonId(null); setNewLesson(INITIAL_LESSON); } }, [lessonDialogOpen]);

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
    if (!selectedCourse || !confirm("Delete this chapter and all its lessons?")) return;
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
    setNewLesson({ title: l.title, description: l.description || "", duration: l.duration || "0:00", type: l.type || "video", videoSource: l.videoSource || "direct", videoUrl: l.videoUrl ? decodeVideoUrl(l.videoUrl) : "", resourceUrl: l.resourceUrl || "", isPreview: l.isPreview || false });
    setSaveError(null); setLessonDialogOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse || !selectedChapter || !newLesson.title.trim()) { setSaveError("Lesson title is required"); return; }
    if (newLesson.type === "video" && !newLesson.videoUrl?.trim()) { setSaveError("Please provide a video URL"); return; }
    setIsSaving(true); setSaveError(null);
    let updated;
    if (editingLessonId) {
      updated = curriculum.map((ch) => ch.id === selectedChapter.id ? { ...ch, lessons: ch.lessons.map((l) => l.id === editingLessonId ? { ...l, title: newLesson.title.trim(), description: newLesson.description?.trim() || "", duration: newLesson.duration || l.duration || "0:00", type: newLesson.type as "video" | "pdf" | "quiz", isPreview: newLesson.isPreview || false, videoSource: (newLesson.type === "video" ? newLesson.videoSource : undefined) as LessonVideoSource | undefined, videoUrl: newLesson.type === "video" ? encodeVideoUrl(newLesson.videoUrl || "") : undefined, resourceUrl: newLesson.type !== "video" ? newLesson.resourceUrl : undefined } : l) } : ch);
    } else {
      const lesson = { id: `l_${Date.now()}`, title: newLesson.title.trim(), description: newLesson.description?.trim() || "", duration: newLesson.duration || "0:00", type: newLesson.type as "video" | "pdf" | "quiz", completed: false, locked: false, isPreview: newLesson.isPreview || false, isHomepageDemo: false, videoSource: (newLesson.type === "video" ? newLesson.videoSource : undefined) as LessonVideoSource | undefined, videoUrl: newLesson.type === "video" ? encodeVideoUrl(newLesson.videoUrl || "") : undefined, resourceUrl: newLesson.type !== "video" ? newLesson.resourceUrl : undefined };
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
    if (!selectedCourse || !selectedChapter || !confirm("Delete this lesson?")) return;
    setIsSaving(true); setSaveError(null);
    const updated = curriculum.map((ch) => ch.id === selectedChapter.id ? { ...ch, lessons: ch.lessons.filter((l) => l.id !== lessonId) } : ch);
    try { setCurriculumForCourse(selectedCourse.id, updated); await adminApi.saveCurriculum(selectedCourse.id, updated); emitCurriculumUpdated(selectedCourse.id); }
    catch (e) { setSaveError(e instanceof Error ? e.message : "Failed to delete lesson"); }
    finally { setIsSaving(false); }
  };

  const handleVideoFileUpload = async (file?: File | null) => {
    if (!file || newLesson.type !== "video") return;
    setIsUploadingVideo(true);
    try {
      const b64 = await fileToBase64(file);
      const uploaded = newLesson.videoSource === "upload"
        ? await adminApi.uploadVideoToBunny(file.name, file.type, b64, "course-videos")
        : await adminApi.uploadImage(file.name, file.type, b64, "direct-videos");
      setNewLesson((p) => ({ ...p, videoUrl: uploaded.url }));
    } catch (e) { alert(e instanceof Error ? e.message : "Video upload failed"); }
    finally { setIsUploadingVideo(false); }
  };

  /* totals */
  const totalLessons = curriculum.reduce((s, ch) => s + ch.lessons.length, 0);
  const totalVideoLessons = curriculum.reduce((s, ch) => s + ch.lessons.filter((l) => l.type === "video").length, 0);

  return (
    <div className="space-y-4 font-['Inter']">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Course Content</h1>
            <p className="text-xs text-slate-400">Manage chapters, lessons & videos</p>
          </div>
        </div>

        {/* Course picker */}
        <div className="ml-auto">
          <Popover open={coursePickerOpen} onOpenChange={setCoursePickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox" aria-expanded={coursePickerOpen}
                className="h-9 w-96 justify-between rounded-xl border-slate-200 text-xs font-medium">
                <span className={`truncate ${!selectedCourse ? "text-slate-400" : "font-semibold"}`}>{selectedCourse?.title || "Search and select a course to manage content..."}</span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] rounded-xl border-slate-200 p-0 shadow-xl" align="start">
              <Command>
                <CommandInput placeholder="Search course..." className="h-9 text-xs" />
                <CommandList>
                  <CommandEmpty className="py-6 text-center text-xs text-slate-400">No course found.</CommandEmpty>
                  <CommandGroup>
                    {courses.map((course) => (
                      <CommandItem key={course.id} value={`${course.title} ${course.id}`} onSelect={() => { setSelectedCourseId(course.id); setSelectedChapterId(null); setCoursePickerOpen(false); }}
                        className="text-xs">
                        <Check className={cn("mr-2 h-3.5 w-3.5", selectedCourseId === course.id ? "opacity-100 text-primary" : "opacity-0")} />
                        {course.title}
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

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-20 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-orange-300" />
          <p className="text-sm font-semibold text-orange-700">No courses available</p>
          <p className="mt-1 text-xs text-orange-500">Create courses first in the Courses section</p>
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
          <div className="flex gap-4 min-h-[600px]">
            {/* ── PANEL 1: Chapters ── */}
            <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 items-center border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                <span className="text-xs font-bold text-slate-700">Chapters</span>
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
                  <div className="space-y-1">
                    {curriculum.map((ch, idx) => {
                      const isActive = selectedChapterId === ch.id || (!selectedChapterId && idx === 0);
                      return (
                        <div key={ch.id}
                          draggable
                          onDragStart={() => { dragChapterIdx.current = idx; setDragChapterActive(true); }}
                          onDragEnter={() => { dragOverChapterIdx.current = idx; }}
                          onDragOver={(e) => e.preventDefault()}
                          onDragEnd={handleChapterDrop}
                          className={`group flex w-full items-center rounded-xl transition-all ${isActive ? "bg-primary text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"} ${dragChapterActive ? "cursor-grabbing" : "cursor-grab"}`}>
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
                  <div className="shrink-0 flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{selectedChapter.title}</p>
                      {selectedChapter.description && <p className="truncate text-xs text-slate-400">{selectedChapter.description}</p>}
                    </div>
                    <div className="ml-auto flex items-center gap-2 shrink-0">
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
                      <div className="divide-y divide-slate-100">
                        {selectedChapter.lessons.map((lesson, idx) => {
                          const Icon = TYPE_ICON[lesson.type] || Video;
                          return (
                            <div key={lesson.id}
                              draggable
                              onDragStart={() => { dragLessonIdx.current = idx; setDragLessonActive(true); }}
                              onDragEnter={() => { dragOverLessonIdx.current = idx; }}
                              onDragOver={(e) => e.preventDefault()}
                              onDragEnd={handleLessonDrop}
                              className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 ${dragLessonActive ? "cursor-grabbing" : "cursor-grab"}`}>
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
                              <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
              onUploadVideo={handleVideoFileUpload} isUploadingVideo={isUploadingVideo} isSaving={isSaving} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Lesson Form ────────────────────────────────────────────── */
function LessonForm({ lesson, setLesson, onSave, isEditing, onUploadVideo, isUploadingVideo, isSaving = false }: {
  lesson: NewLesson; setLesson: Dispatch<SetStateAction<NewLesson>>;
  onSave: () => void; isEditing: boolean; onUploadVideo: (file?: File | null) => void;
  isUploadingVideo: boolean; isSaving?: boolean;
}) {
  const [isFetchingDuration, setIsFetchingDuration] = useState(false);
  const [durationFetchError, setDurationFetchError] = useState<string | null>(null);
  const autoDurationKeyRef = useRef("");

  useEffect(() => {
    if (lesson.type !== "video") { setDurationFetchError(null); setIsFetchingDuration(false); autoDurationKeyRef.current = ""; return; }
    const source = lesson.videoSource || "direct";
    const videoUrl = String(lesson.videoUrl || "").trim();
    if (!videoUrl) { setDurationFetchError(null); setIsFetchingDuration(false); autoDurationKeyRef.current = ""; return; }
    const nextKey = `${source}|${videoUrl}`;
    if (autoDurationKeyRef.current === nextKey) return;
    let cancelled = false;
    const tid = window.setTimeout(async () => {
      try {
        setDurationFetchError(null); setIsFetchingDuration(true);
        const secs = source === "youtube" ? await loadYouTubeDurationSeconds(extractYouTubeVideoId(videoUrl) || (() => { throw new Error("Invalid YouTube URL/Video ID"); })()) : await loadVideoDurationFromUrl(videoUrl);
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
            {durationFetchError && <p className="text-[11px] text-amber-600">⚠ {durationFetchError} — enter duration manually below</p>}
          </div>
          <div className="space-y-1.5">
            <FL2>Duration (HH:MM:SS)</FL2>
            <Input className={fCls} placeholder="00:45:30" value={lesson.duration} onChange={(e) => setLesson({ ...lesson, duration: e.target.value })} disabled={isSaving} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-primary/30 hover:text-primary">
                <Upload className="h-3.5 w-3.5" />
                {isUploadingVideo ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Uploading...</span> : `Upload Video File`}
                <input type="file" accept="video/*" className="hidden" onChange={(e) => onUploadVideo(e.target.files?.[0])} disabled={isSaving || isUploadingVideo} />
              </label>
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
