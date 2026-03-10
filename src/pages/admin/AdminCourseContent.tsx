import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Copy,
  ExternalLink,
  FileText,
  Lock,
  Plus,
  Search,
  Save,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { usePlatformData, type Chapter, type Lesson } from "@/context/PlatformDataContext";
import {
  decodeVideoUrl,
  detectVideoSource,
  encodeVideoUrl,
  getYouTubeEmbedUrl,
  type LessonVideoSource,
} from "@/lib/video-utils";

type SelectedLessonRef = { chapterId: string; lessonId: string };

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const lessonDurationByType: Record<Lesson["type"], string> = {
  video: "10:00",
  pdf: "PDF",
  quiz: "10 Qs",
};

const lessonTypeLabel: Record<Lesson["type"], string> = {
  video: "Video",
  pdf: "PDF",
  quiz: "Quiz",
};

const defaultVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4";

const createLesson = (type: Lesson["type"] = "video"): Lesson => ({
  id: `ls-${makeId()}`,
  title: `New ${lessonTypeLabel[type]} Lesson`,
  description: "",
  duration: lessonDurationByType[type],
  type,
  completed: false,
  locked: false,
  isPreview: false,
  isHomepageDemo: false,
  videoSource: "direct",
  videoUrl: type === "video" ? encodeVideoUrl(defaultVideoUrl) : "",
  resourceUrl: "",
  thumbnailUrl: "",
});

const createChapter = (index: number): Chapter => ({
  id: `ch-${makeId()}`,
  title: `Chapter ${index + 1}`,
  description: "",
  lessons: [createLesson("video")],
});

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const updated = [...items];
  const [item] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, item);
  return updated;
};

const getLessonTypeIcon = (type: Lesson["type"]) => {
  if (type === "video") return <Video className="w-3.5 h-3.5 text-primary" />;
  if (type === "pdf") return <FileText className="w-3.5 h-3.5 text-orange-600" />;
  return <BarChart3 className="w-3.5 h-3.5 text-accent" />;
};

const AdminCourseContent = () => {
  const { courses, categories, getCurriculumForCourse, setCurriculumForCourse, updateCourseDemoVideo } = usePlatformData();

  const availableCourses = useMemo(
    () =>
      [...courses].sort((a, b) => {
        if (a.isVisible === b.isVisible) {
          return a.title.localeCompare(b.title);
        }
        return a.isVisible ? -1 : 1;
      }),
    [courses],
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>(availableCourses[0]?.id || "");
  const [courseSearch, setCourseSearch] = useState("");
  const [draftCurriculum, setDraftCurriculum] = useState<Chapter[]>([]);
  const [selectedLessonRef, setSelectedLessonRef] = useState<SelectedLessonRef | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastSyncedHashRef = useRef("");

  useEffect(() => {
    if (availableCourses.length === 0) {
      if (selectedCourseId) {
        setSelectedCourseId("");
      }
      return;
    }

    const hasSelectedCourse = availableCourses.some((course) => course.id === selectedCourseId);
    if (!hasSelectedCourse) {
      setSelectedCourseId(availableCourses[0].id);
    }
  }, [availableCourses, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setDraftCurriculum([]);
      setSelectedLessonRef(null);
      lastSyncedHashRef.current = "";
      return;
    }

    const selectedCourse = courses.find((course) => course.id === selectedCourseId);
    const nextCurriculum = sanitizeCurriculum(
      getCurriculumForCourse(selectedCourseId, selectedCourse?.title),
    );
    setDraftCurriculum(nextCurriculum);
    lastSyncedHashRef.current = JSON.stringify(nextCurriculum);

    const firstLesson = nextCurriculum[0]?.lessons[0];
    setSelectedLessonRef(
      firstLesson
        ? {
            chapterId: nextCurriculum[0].id,
            lessonId: firstLesson.id,
          }
        : null,
    );
  }, [selectedCourseId, courses, getCurriculumForCourse]);

  useEffect(() => {
    if (!selectedLessonRef) {
      const firstChapter = draftCurriculum[0];
      const firstLesson = firstChapter?.lessons[0];
      if (firstChapter && firstLesson) {
        setSelectedLessonRef({ chapterId: firstChapter.id, lessonId: firstLesson.id });
      }
      return;
    }

    const chapter = draftCurriculum.find((item) => item.id === selectedLessonRef.chapterId);
    const lesson = chapter?.lessons.find((item) => item.id === selectedLessonRef.lessonId);
    if (!lesson) {
      const firstChapter = draftCurriculum[0];
      const firstLesson = firstChapter?.lessons[0];
      setSelectedLessonRef(
        firstChapter && firstLesson
          ? { chapterId: firstChapter.id, lessonId: firstLesson.id }
          : null,
      );
    }
  }, [draftCurriculum, selectedLessonRef]);

  useEffect(() => {
    if (!selectedCourseId) return;

    const normalized = sanitizeCurriculum(draftCurriculum);
    if (normalized.length === 0) return;

    const nextHash = JSON.stringify(normalized);
    if (nextHash === lastSyncedHashRef.current) return;

    setIsAutoSyncing(true);
    const timeout = window.setTimeout(() => {
      setCurriculumForCourse(selectedCourseId, normalized);
      lastSyncedHashRef.current = nextHash;
      setIsAutoSyncing(false);
      setLastSyncedAt(new Date());
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      setIsAutoSyncing(false);
    };
  }, [draftCurriculum, selectedCourseId, setCurriculumForCourse]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return availableCourses;

    return availableCourses.filter((course) => {
      const categoryName =
        categories.find((category) => category.id === course.category)?.name || course.category;
      return (
        course.title.toLowerCase().includes(query) ||
        course.professor.toLowerCase().includes(query) ||
        categoryName.toLowerCase().includes(query)
      );
    });
  }, [availableCourses, categories, courseSearch]);

  useEffect(() => {
    if (!selectedCourseId || filteredCourses.length === 0) return;
    const inFiltered = filteredCourses.some((course) => course.id === selectedCourseId);
    if (!inFiltered) {
      setSelectedCourseId(filteredCourses[0].id);
    }
  }, [filteredCourses, selectedCourseId]);

  const selectedLessonContext = useMemo(() => {
    if (!selectedLessonRef) return null;

    const chapterIndex = draftCurriculum.findIndex((chapter) => chapter.id === selectedLessonRef.chapterId);
    if (chapterIndex === -1) return null;

    const chapter = draftCurriculum[chapterIndex];
    const lessonIndex = chapter.lessons.findIndex((lesson) => lesson.id === selectedLessonRef.lessonId);
    if (lessonIndex === -1) return null;

    return {
      chapterIndex,
      lessonIndex,
      chapter,
      lesson: chapter.lessons[lessonIndex],
    };
  }, [draftCurriculum, selectedLessonRef]);

  const selectedLesson = selectedLessonContext?.lesson || null;
  const selectedCourseDemoUrl = decodeVideoUrl(selectedCourse?.demoVideoUrl || "");
  const selectedCourseDemoEmbedUrl = getYouTubeEmbedUrl(selectedCourseDemoUrl);

  const sanitizeCurriculum = (curriculum: Chapter[]) => {
    return curriculum
      .map((chapter) => ({
        ...chapter,
        title: chapter.title.trim() || "Untitled Chapter",
        description: chapter.description?.trim() || "",
        lessons: chapter.lessons
          .map((lesson) => {
            const rawVideo = decodeVideoUrl(lesson.videoUrl?.trim() || "");
            const safeVideoSource: LessonVideoSource =
              lesson.videoSource === "youtube" || lesson.videoSource === "upload" || lesson.videoSource === "direct"
                ? lesson.videoSource
                : detectVideoSource(rawVideo);

            return {
              ...lesson,
              title: lesson.title.trim() || "Untitled Lesson",
              description: lesson.description?.trim() || "",
              duration: lesson.duration.trim() || lessonDurationByType[lesson.type],
              isHomepageDemo: lesson.type === "video" ? Boolean(lesson.isHomepageDemo) : false,
              videoSource: lesson.type === "video" ? safeVideoSource : "direct",
              videoUrl:
                lesson.type === "video"
                  ? (rawVideo ? encodeVideoUrl(rawVideo) : "")
                  : "",
              resourceUrl: lesson.resourceUrl?.trim() || "",
              thumbnailUrl: lesson.thumbnailUrl?.trim() || "",
            };
          })
          .filter((lesson) => lesson.title.trim().length > 0),
      }))
      .filter((chapter) => chapter.lessons.length > 0);
  };

  const totalLessons = draftCurriculum.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  const videoCount = draftCurriculum.reduce(
    (sum, chapter) => sum + chapter.lessons.filter((lesson) => lesson.type === "video").length,
    0,
  );

  const updateChapter = (chapterId: string, updater: (chapter: Chapter) => Chapter) => {
    setDraftCurriculum((prev) =>
      prev.map((chapter) => (chapter.id === chapterId ? updater(chapter) : chapter)),
    );
  };

  const updateLesson = (chapterId: string, lessonId: string, updater: (lesson: Lesson) => Lesson) => {
    setDraftCurriculum((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              lessons: chapter.lessons.map((lesson) =>
                lesson.id === lessonId ? updater(lesson) : lesson,
              ),
            }
          : chapter,
      ),
    );
  };

  const addChapter = () => {
    setDraftCurriculum((prev) => {
      const nextChapter = createChapter(prev.length);
      const next = [...prev, nextChapter];
      setSelectedLessonRef({ chapterId: nextChapter.id, lessonId: nextChapter.lessons[0].id });
      return next;
    });
  };

  const removeChapter = (chapterId: string) => {
    setDraftCurriculum((prev) => prev.filter((chapter) => chapter.id !== chapterId));
  };

  const moveChapter = (chapterId: string, direction: "up" | "down") => {
    setDraftCurriculum((prev) => {
      const index = prev.findIndex((chapter) => chapter.id === chapterId);
      if (index === -1) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      return moveItem(prev, index, nextIndex);
    });
  };

  const addLesson = (chapterId: string, type: Lesson["type"]) => {
    const nextLesson = createLesson(type);
    updateChapter(chapterId, (chapter) => ({
      ...chapter,
      lessons: [...chapter.lessons, nextLesson],
    }));
    setSelectedLessonRef({ chapterId, lessonId: nextLesson.id });
  };

  const removeLesson = (chapterId: string, lessonId: string) => {
    updateChapter(chapterId, (chapter) => ({
      ...chapter,
      lessons: chapter.lessons.filter((lesson) => lesson.id !== lessonId),
    }));
  };

  const moveLesson = (chapterId: string, lessonId: string, direction: "up" | "down") => {
    updateChapter(chapterId, (chapter) => {
      const index = chapter.lessons.findIndex((lesson) => lesson.id === lessonId);
      if (index === -1) return chapter;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      return {
        ...chapter,
        lessons: moveItem(chapter.lessons, index, nextIndex),
      };
    });
  };

  const duplicateSelectedLesson = () => {
    if (!selectedLessonContext) return;

    const { chapter, lesson, lessonIndex } = selectedLessonContext;
    const duplicate: Lesson = {
      ...lesson,
      id: `ls-${makeId()}`,
      title: `${lesson.title} (Copy)`,
    };

    updateChapter(chapter.id, (item) => ({
      ...item,
      lessons: [
        ...item.lessons.slice(0, lessonIndex + 1),
        duplicate,
        ...item.lessons.slice(lessonIndex + 1),
      ],
    }));

    setSelectedLessonRef({ chapterId: chapter.id, lessonId: duplicate.id });
  };

  const updateSelectedLesson = (updater: (lesson: Lesson) => Lesson) => {
    if (!selectedLessonContext) return;
    updateLesson(selectedLessonContext.chapter.id, selectedLessonContext.lesson.id, updater);
  };

  const updateSelectedCourseDemo = (
    updates: Partial<
      Pick<
        NonNullable<typeof selectedCourse>,
        | "demoVideoVisible"
        | "demoVideoTitle"
        | "demoVideoDescription"
        | "demoVideoSource"
        | "demoVideoUrl"
        | "demoVideoThumbnailUrl"
      >
    >,
  ) => {
    if (!selectedCourseId) return;
    updateCourseDemoVideo(selectedCourseId, updates);
  };

  const handleCourseDemoUpload = (file: File | null) => {
    if (!file || !selectedCourseId) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file.");
      return;
    }

    const maxSizeMb = 3;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error("Video too large. Keep demo upload up to 3MB or use external URL.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = typeof event.target?.result === "string" ? event.target.result : "";
      if (!dataUrl) {
        toast.error("Demo video upload failed.");
        return;
      }

      updateCourseDemoVideo(selectedCourseId, {
        demoVideoVisible: true,
        demoVideoSource: "upload",
        demoVideoUrl: encodeVideoUrl(dataUrl),
      });
      toast.success("Course demo video uploaded.");
    };

    reader.readAsDataURL(file);
  };

  const handleCourseDemoThumbnailUpload = (file: File | null) => {
    if (!file || !selectedCourseId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const maxSizeMb = 2;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error("Thumbnail image is too large. Keep it up to 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = typeof event.target?.result === "string" ? event.target.result : "";
      if (!dataUrl) {
        toast.error("Thumbnail upload failed.");
        return;
      }

      updateCourseDemoVideo(selectedCourseId, { demoVideoThumbnailUrl: dataUrl });
      toast.success("Thumbnail image uploaded.");
    };

    reader.readAsDataURL(file);
  };

  const openCourseDemoPreview = () => {
    if (!selectedCourseDemoUrl) {
      toast.error("Please add demo video URL/upload first.");
      return;
    }

    window.open(selectedCourseDemoEmbedUrl || selectedCourseDemoUrl, "_blank", "noopener,noreferrer");
  };

  const clearCourseDemo = () => {
    if (!selectedCourseId) return;
    updateCourseDemoVideo(selectedCourseId, {
      demoVideoVisible: false,
      demoVideoTitle: "",
      demoVideoDescription: "",
      demoVideoSource: "direct",
      demoVideoUrl: "",
      demoVideoThumbnailUrl: "",
    });
    toast.success("Course demo video cleared.");
  };

  const handleVideoUpload = (file: File | null) => {
    if (!file || !selectedLesson || selectedLesson.type !== "video") return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file.");
      return;
    }

    const maxSizeMb = 3;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error("Video too large for browser storage. Use up to 3MB demo file or external URL.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = typeof event.target?.result === "string" ? event.target.result : "";
      if (!dataUrl) {
        toast.error("Video upload failed. Please try again.");
        return;
      }

      updateSelectedLesson((lesson) => ({
        ...lesson,
        videoSource: "upload",
        videoUrl: encodeVideoUrl(dataUrl),
      }));
      toast.success("Video uploaded and linked to this lesson.");
    };

    reader.readAsDataURL(file);
  };

  const openLessonLink = () => {
    if (!selectedLesson) return;
    const targetUrl =
      selectedLesson.type === "video"
        ? decodeVideoUrl(selectedLesson.videoUrl || "")
        : selectedLesson.resourceUrl;

    if (!targetUrl?.trim()) {
      toast.error("Please add URL first.");
      return;
    }

    if (selectedLesson.type === "video") {
      const youtubeEmbedUrl = getYouTubeEmbedUrl(targetUrl);
      window.open(youtubeEmbedUrl || targetUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const saveCurriculum = () => {
    if (!selectedCourseId) {
      toast.error("Please select a course first.");
      return;
    }

    const validCurriculum = sanitizeCurriculum(draftCurriculum);

    if (validCurriculum.length === 0) {
      toast.error("At least one chapter with one lesson is required.");
      return;
    }

    setCurriculumForCourse(selectedCourseId, validCurriculum);
    lastSyncedHashRef.current = JSON.stringify(validCurriculum);
    setLastSyncedAt(new Date());
    toast.success("LMS content saved successfully.");
  };

  if (availableCourses.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            No courses found. Please add at least one course in Courses section.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">LMS Course Content</h1>
          <p className="text-sm text-muted-foreground">
            Manage course demo and curriculum in one place with auto-sync.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className="bg-green-100 text-green-700 border-0">Auto Sync ON</Badge>
            <Badge variant="outline">
              {isAutoSyncing
                ? "Syncing..."
                : lastSyncedAt
                  ? `Last synced: ${lastSyncedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                  : "Waiting for changes"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addChapter} className="gap-2">
            <Plus className="w-4 h-4" /> Add Chapter
          </Button>
          <Button onClick={saveCurriculum} className="gap-2">
            <Save className="w-4 h-4" /> Sync Now
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Steps</CardTitle>
          <CardDescription>Follow this order for a simple workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3 bg-muted/10">
              <p className="text-xs font-semibold text-primary">Step 1</p>
              <p className="text-sm font-medium text-foreground mt-1">Select Course</p>
              <p className="text-xs text-muted-foreground mt-1">Search and choose the exact course you want to edit.</p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/10">
              <p className="text-xs font-semibold text-primary">Step 2</p>
              <p className="text-sm font-medium text-foreground mt-1">Set Course Demo</p>
              <p className="text-xs text-muted-foreground mt-1">Add a dedicated demo video (URL, YouTube, or upload).</p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/10">
              <p className="text-xs font-semibold text-primary">Step 3</p>
              <p className="text-sm font-medium text-foreground mt-1">Edit Curriculum</p>
              <p className="text-xs text-muted-foreground mt-1">Update chapters and lessons. Changes auto-sync in LMS.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 1: Course Selection</CardTitle>
          <CardDescription>Use search to quickly find the course, then open it for editing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              placeholder="Course search: title, faculty, category"
              className="pl-10"
            />
          </div>

          {filteredCourses.length === 0 && (
            <p className="text-xs text-destructive">No matching course found for search term.</p>
          )}

          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={filteredCourses.length === 0}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {filteredCourses.map((course) => {
              const categoryName =
                categories.find((category) => category.id === course.category)?.name || course.category;
              return (
                <option key={course.id} value={course.id}>
                  {course.title} ({categoryName}){course.isVisible ? "" : " - Hidden"}
                </option>
              );
            })}
          </select>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{filteredCourses.length} Found</Badge>
            <Badge variant="secondary">{draftCurriculum.length} Chapters</Badge>
            <Badge variant="secondary">{totalLessons} Lessons</Badge>
            <Badge variant="secondary">{videoCount} Videos</Badge>
            {selectedCourse && <Badge variant="outline">Editing: {selectedCourse.title}</Badge>}
          </div>
        </CardContent>
      </Card>

      {selectedCourse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 2: Dedicated Course Demo Video</CardTitle>
            <CardDescription>
              This demo is independent from LMS lessons and appears on the course page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 w-fit">
              <input
                type="checkbox"
                checked={Boolean(selectedCourse.demoVideoVisible)}
                onChange={(e) => updateSelectedCourseDemo({ demoVideoVisible: e.target.checked })}
                className="rounded"
              />
              Show Demo on Course Page
            </label>
            <p className="text-xs text-muted-foreground">
              Status: {selectedCourse.demoVideoVisible ? "Visible on course page" : "Hidden on course page"}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Demo Label (optional)</label>
                <Input
                  value={selectedCourse.demoVideoTitle || ""}
                  onChange={(e) => updateSelectedCourseDemo({ demoVideoTitle: e.target.value })}
                  placeholder="Eg: Free Demo Lecture - Chapter 1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Video Source</label>
                <select
                  value={selectedCourse.demoVideoSource || detectVideoSource(selectedCourse.demoVideoUrl || "")}
                  onChange={(e) =>
                    updateSelectedCourseDemo({
                      demoVideoSource: e.target.value as LessonVideoSource,
                      demoVideoUrl:
                        e.target.value === "upload"
                          ? selectedCourse.demoVideoUrl || ""
                          : selectedCourse.demoVideoUrl || encodeVideoUrl(defaultVideoUrl),
                    })
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="direct">Direct Video URL</option>
                  <option value="youtube">YouTube Link</option>
                  <option value="upload">Upload Demo Video</option>
                </select>
              </div>
            </div>

            {(selectedCourse.demoVideoSource || detectVideoSource(selectedCourse.demoVideoUrl || "")) !== "upload" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {(selectedCourse.demoVideoSource || detectVideoSource(selectedCourse.demoVideoUrl || "")) === "youtube"
                    ? "YouTube URL / Video ID"
                    : "Direct Video URL"}
                </label>
                <Input
                  value={selectedCourseDemoUrl}
                  onChange={(e) => updateSelectedCourseDemo({ demoVideoUrl: encodeVideoUrl(e.target.value) })}
                  placeholder={
                    (selectedCourse.demoVideoSource || detectVideoSource(selectedCourse.demoVideoUrl || "")) === "youtube"
                      ? "https://youtube.com/watch?v=..."
                      : "https://example.com/demo.mp4"
                  }
                />
              </div>
            )}

            {(selectedCourse.demoVideoSource || detectVideoSource(selectedCourse.demoVideoUrl || "")) === "upload" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Upload Demo Video</label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleCourseDemoUpload(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                <p className="text-[11px] text-muted-foreground">
                  Uploads are stored in browser storage. Keep files up to 3MB for stability.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Demo Description (optional)</label>
              <Textarea
                value={selectedCourse.demoVideoDescription || ""}
                onChange={(e) => updateSelectedCourseDemo({ demoVideoDescription: e.target.value })}
                placeholder="Short demo description"
                className="min-h-[84px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Thumbnail URL (optional)</label>
              <Input
                value={selectedCourse.demoVideoThumbnailUrl || ""}
                onChange={(e) => updateSelectedCourseDemo({ demoVideoThumbnailUrl: e.target.value })}
                placeholder="https://example.com/demo-thumb.jpg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Upload Thumbnail Image</label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleCourseDemoThumbnailUpload(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground">Recommended: JPG/PNG, up to 2MB.</p>
              {selectedCourse.demoVideoThumbnailUrl && (
                <img
                  src={selectedCourse.demoVideoThumbnailUrl}
                  alt="Demo thumbnail preview"
                  className="h-28 w-full max-w-xs rounded-md border border-border object-cover"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openCourseDemoPreview}>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Preview Demo
              </Button>
              <Button variant="destructive" size="sm" onClick={clearCourseDemo}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear Demo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Step 3: Curriculum Structure</CardTitle>
            <CardDescription>Select a chapter and lesson from the left panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {draftCurriculum.length === 0 && (
              <p className="text-sm text-muted-foreground">No chapters yet. Add your first chapter.</p>
            )}

            {draftCurriculum.map((chapter, chapterIndex) => (
              <div key={chapter.id} className="rounded-xl border border-border p-3 space-y-3 bg-muted/15">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Chapter {chapterIndex + 1}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveChapter(chapter.id, "up")}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveChapter(chapter.id, "down")}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive ml-auto"
                    onClick={() => removeChapter(chapter.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <Input
                  value={chapter.title}
                  onChange={(e) => updateChapter(chapter.id, (item) => ({ ...item, title: e.target.value }))}
                  placeholder="Chapter title"
                  className="font-semibold"
                />

                <Textarea
                  value={chapter.description || ""}
                  onChange={(e) => updateChapter(chapter.id, (item) => ({ ...item, description: e.target.value }))}
                  placeholder="Chapter short description"
                  className="min-h-[72px]"
                />

                <div className="space-y-1.5">
                  {chapter.lessons.map((lesson, lessonIndex) => {
                    const isSelected =
                      selectedLessonRef?.chapterId === chapter.id &&
                      selectedLessonRef.lessonId === lesson.id;

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => setSelectedLessonRef({ chapterId: chapter.id, lessonId: lesson.id })}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-background"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {getLessonTypeIcon(lesson.type)}
                          <p className="text-xs font-semibold text-foreground truncate flex-1">
                            {lessonIndex + 1}. {lesson.title}
                          </p>
                          {lesson.locked && !lesson.isPreview && <Lock className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                            {lessonTypeLabel[lesson.type]}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                            {lesson.duration}
                          </span>
                          {lesson.isPreview && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                              Preview
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => addLesson(chapter.id, "video")}>
                    + Video
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => addLesson(chapter.id, "pdf")}>
                    + PDF
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => addLesson(chapter.id, "quiz")}>
                    + Quiz
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected Lesson Editor</CardTitle>
            <CardDescription>Edit lesson details, media, and access settings.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedLessonContext || !selectedLesson ? (
              <p className="text-sm text-muted-foreground">Select a lesson from left panel to start editing.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">Chapter: {selectedLessonContext.chapter.title}</Badge>
                  <Badge variant="outline">Type: {lessonTypeLabel[selectedLesson.type]}</Badge>
                  <Badge variant="outline">Lesson #{selectedLessonContext.lessonIndex + 1}</Badge>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic Details</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Lesson Title</label>
                  <Input
                    value={selectedLesson.title}
                    onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Lesson Description</label>
                  <Textarea
                    value={selectedLesson.description || ""}
                    onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, description: e.target.value }))}
                    placeholder="What this lesson covers"
                    className="min-h-[96px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Lesson Type</label>
                    <select
                      value={selectedLesson.type}
                      onChange={(e) => {
                        const nextType = e.target.value as Lesson["type"];
                        updateSelectedLesson((lesson) => ({
                          ...lesson,
                          type: nextType,
                          duration: lessonDurationByType[nextType],
                          isHomepageDemo: nextType === "video" ? lesson.isHomepageDemo : false,
                          videoSource: nextType === "video" ? lesson.videoSource || "direct" : "direct",
                          videoUrl:
                            nextType === "video"
                              ? lesson.videoUrl || encodeVideoUrl(defaultVideoUrl)
                              : "",
                        }));
                      }}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                      <option value="quiz">Quiz</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Duration / Label</label>
                    <Input
                      value={selectedLesson.duration}
                      onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, duration: e.target.value }))}
                      placeholder={lessonDurationByType[selectedLesson.type]}
                    />
                  </div>
                </div>

                {selectedLesson.type === "video" && (
                  <div className="space-y-3 rounded-xl border border-border p-3 bg-muted/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Video Media</p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Video Source</label>
                      <select
                        value={selectedLesson.videoSource || detectVideoSource(selectedLesson.videoUrl || "")}
                        onChange={(e) => {
                          const nextSource = e.target.value as LessonVideoSource;
                          updateSelectedLesson((lesson) => ({
                            ...lesson,
                            videoSource: nextSource,
                            videoUrl:
                              nextSource === "upload"
                                ? lesson.videoUrl
                                : lesson.videoUrl || encodeVideoUrl(defaultVideoUrl),
                          }));
                        }}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="direct">Direct Video URL (MP4/HLS)</option>
                        <option value="youtube">YouTube Link</option>
                        <option value="upload">Upload Demo Video</option>
                      </select>
                    </div>

                    {(selectedLesson.videoSource || detectVideoSource(selectedLesson.videoUrl || "")) !== "upload" && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          {(selectedLesson.videoSource || detectVideoSource(selectedLesson.videoUrl || "")) === "youtube"
                            ? "YouTube URL or Video ID"
                            : "Direct Video URL"}
                        </label>
                        <Input
                          value={decodeVideoUrl(selectedLesson.videoUrl || "")}
                          onChange={(e) =>
                            updateSelectedLesson((lesson) => ({
                              ...lesson,
                              videoUrl: encodeVideoUrl(e.target.value),
                              videoSource:
                                lesson.videoSource === "youtube" || lesson.videoSource === "upload" || lesson.videoSource === "direct"
                                  ? lesson.videoSource
                                  : detectVideoSource(e.target.value),
                            }))
                          }
                          placeholder={
                            (selectedLesson.videoSource || detectVideoSource(selectedLesson.videoUrl || "")) === "youtube"
                              ? "https://youtube.com/watch?v=..."
                              : "https://example.com/video.mp4"
                          }
                        />
                      </div>
                    )}

                    {(selectedLesson.videoSource || detectVideoSource(selectedLesson.videoUrl || "")) === "upload" && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Upload Video (Demo use)</label>
                        <Input
                          type="file"
                          accept="video/*"
                          onChange={(e) => handleVideoUpload(e.target.files?.[0] || null)}
                          className="cursor-pointer"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Keep upload size up to 3MB. Use external links for larger videos.
                        </p>
                      </div>
                    )}

                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Resource URL (optional)</label>
                  <Input
                    value={selectedLesson.resourceUrl || ""}
                    onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, resourceUrl: e.target.value }))}
                    placeholder="Notes / quiz / document link"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Thumbnail URL (optional)</label>
                  <Input
                    value={selectedLesson.thumbnailUrl || ""}
                    onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, thumbnailUrl: e.target.value }))}
                    placeholder="https://example.com/thumb.jpg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <p className="sm:col-span-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access and Status</p>
                  <label className="flex items-center gap-2 text-xs border border-border rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedLesson.locked}
                      onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, locked: e.target.checked }))}
                      className="rounded"
                    />
                    Locked
                  </label>
                  <label className="flex items-center gap-2 text-xs border border-border rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedLesson.isPreview)}
                      onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, isPreview: e.target.checked }))}
                      className="rounded"
                    />
                    Preview Access
                  </label>
                  <label className="flex items-center gap-2 text-xs border border-border rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedLesson.completed}
                      onChange={(e) => updateSelectedLesson((lesson) => ({ ...lesson, completed: e.target.checked }))}
                      className="rounded"
                    />
                    Mark Completed
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <p className="w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lesson Actions</p>
                  <Button variant="outline" size="sm" onClick={duplicateSelectedLesson}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveLesson(selectedLessonContext.chapter.id, selectedLesson.id, "up")}
                  >
                    <ArrowUp className="w-3.5 h-3.5 mr-1.5" /> Move Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveLesson(selectedLessonContext.chapter.id, selectedLesson.id, "down")}
                  >
                    <ArrowDown className="w-3.5 h-3.5 mr-1.5" /> Move Down
                  </Button>
                  <Button variant="outline" size="sm" onClick={openLessonLink}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Link
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeLesson(selectedLessonContext.chapter.id, selectedLesson.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Lesson
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCourseContent;
