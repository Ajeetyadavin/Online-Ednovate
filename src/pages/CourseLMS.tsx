import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  PlayCircle, CheckCircle2, Lock, Clock, FileText, ChevronLeft,
  BookOpen, BarChart3, MessageSquare, Download, Menu, X,
  Award, SkipForward, SkipBack, Maximize2, Minimize2, ChevronDown
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import VideoPlayer from "@/components/VideoPlayer";
import LoginModal from "@/components/LoginModal";
import { downloadStudyMaterialPdf } from "@/lib/studyMaterial";
import {
  usePlatformData,
  type Chapter,
  type Lesson,
} from "@/context/PlatformDataContext";
import { decodeVideoUrl } from "@/lib/video-utils";
import { isCourseAccessActive } from "@/lib/studentAccess";
import { adminApi } from "@/services/adminApi";
import {
  completeStudentLessonApi,
  getStudentCourseAccessApi,
  recordStudentVideoActivityApi,
  syncStudentWatchProgressApi,
  type StudentCourseAccessSelf,
} from "@/services/authApi";

const fallbackVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4";

const CourseLMS = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses, getCurriculumForCourse, setCurriculumForCourse } = usePlatformData();
  const { isLoggedIn, user } = useAuth();
  const { addToCart, updateProgress } = useCart();
  const course = courses.find((c) => c.id === id);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [hasCourseAccess, setHasCourseAccess] = useState(false);
  const [accessItem, setAccessItem] = useState<StudentCourseAccessSelf | null>(null);
  const [accessMessage, setAccessMessage] = useState("");
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const completionInFlightRef = useRef<Set<string>>(new Set());
  const lastCompletionAtRef = useRef<Record<string, number>>({});
  const watchBufferSecondsRef = useRef(0);
  const watchSyncInFlightRef = useRef(false);
  const lastObservedSecondRef = useRef<number | null>(null);
  const [pendingWatchSeconds, setPendingWatchSeconds] = useState(0);

  const [curriculum, setCurriculum] = useState<Chapter[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const playerShellRef = useRef<HTMLDivElement | null>(null);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);

  useEffect(() => {
    if (!course) {
      setCurriculum([]);
      setActiveLesson(null);
      return;
    }

    const nextCurriculum = getCurriculumForCourse(course.id, course.title);
    setCurriculum(nextCurriculum);

    setActiveLesson((prev) => {
      if (!prev) return nextCurriculum[0]?.lessons[0] || null;
      const stillExists = nextCurriculum
        .flatMap((chapter) => chapter.lessons)
        .find((lesson) => lesson.id === prev.id);
      return stillExists || nextCurriculum[0]?.lessons[0] || null;
    });
  }, [course, getCurriculumForCourse]);

  useEffect(() => {
    if (!isLoggedIn || !course?.id) {
      setHasCourseAccess(false);
      return;
    }

    const loadAccess = async () => {
      setAccessLoading(true);
      try {
        const response = await getStudentCourseAccessApi();
        if (!response.ok || !response.data) {
          setAccessItem(null);
          setAccessMessage("Course access not found.");
          setHasCourseAccess(false);
          return;
        }

        const item = response.data.find((entry) => entry.courseId === course.id);
        setAccessItem(item || null);

        if (!item) {
          setAccessMessage("Course access not found.");
          setHasCourseAccess(false);
          return;
        }

        if (item.isEnabled === false) {
          setAccessMessage("Course access is disabled by admin.");
          setHasCourseAccess(false);
          return;
        }

        if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) {
          setAccessMessage("Course validity expired.");
          setHasCourseAccess(false);
          return;
        }

        const remainingViews = Math.max(0, Number(item.remainingViews ?? (item.totalViews - item.usedViews)));
        if (!item.isUnlimitedViews && remainingViews <= 0) {
          setAccessMessage("Course views exhausted.");
          setHasCourseAccess(false);
          return;
        }

        setAccessMessage("");
        setHasCourseAccess(isCourseAccessActive(item));
      } finally {
        setAccessLoading(false);
      }
    };

    loadAccess();
  }, [isLoggedIn, course?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsPlayerFullscreen(document.fullscreenElement === playerShellRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const allLessons = curriculum.flatMap((ch) => ch.lessons);
  const currentLessonId = activeLesson?.id || allLessons[0]?.id || "";
  const currentChapter = curriculum.find((ch) => ch.lessons.some((l) => l.id === currentLessonId));

  useEffect(() => {
    if (!course?.id || !activeLesson?.id) return;
    watchBufferSecondsRef.current = 0;
    setPendingWatchSeconds(0);
    lastObservedSecondRef.current = null;

    adminApi.trackEvent("lesson_view", course.id, undefined, {
      lessonId: activeLesson.id,
      lessonTitle: activeLesson.title,
      type: activeLesson.type,
    }).catch(() => {
      // Ignore analytics network failures.
    });

    recordStudentVideoActivityApi({
      courseId: course.id,
      chapterTitle: currentChapter?.title || "",
      lessonTitle: activeLesson.title,
      progressPercent: activeLesson.completed ? 100 : 10,
      viewedSeconds: 0,
    }).catch(() => {
      // Ignore activity logging failures.
    });
  }, [course?.id, activeLesson?.id, activeLesson?.title, activeLesson?.type, activeLesson?.completed, currentChapter?.title]);

  const totalLessons = curriculum.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const completedLessons = curriculum.reduce(
    (sum, ch) => sum + ch.lessons.filter((l) => l.completed).length, 0
  );
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);
  const isLessonAccessible = (lesson: Lesson) => !lesson.locked || Boolean(lesson.isPreview);

  const handleLessonClick = (lesson: Lesson) => {
    if (!isLessonAccessible(lesson)) return;
    setActiveLesson(lesson);
    setSidebarOpen(false);
  };

  const goToNextLesson = () => {
    for (let index = currentIndex + 1; index < allLessons.length; index += 1) {
      const candidate = allLessons[index];
      if (isLessonAccessible(candidate)) {
        setActiveLesson(candidate);
        break;
      }
    }
  };

  const goToPrevLesson = () => {
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      const candidate = allLessons[index];
      if (isLessonAccessible(candidate)) {
        setActiveLesson(candidate);
        break;
      }
    }
  };

  const syncWatchProgress = async (force = false) => {
    if (!course?.id || !activeLesson || !hasCourseAccess) return;
    if (watchSyncInFlightRef.current) return;

    const bufferedSeconds = Math.floor(watchBufferSecondsRef.current);
    if (bufferedSeconds <= 0) return;
    if (!force && bufferedSeconds < 5) return;

    watchBufferSecondsRef.current = 0;
    setPendingWatchSeconds(0);
    watchSyncInFlightRef.current = true;

    const response = await syncStudentWatchProgressApi({
      courseId: course.id,
      chapterTitle: currentChapter?.title || "",
      lessonTitle: activeLesson.title,
      progressPercent: durationSec > 0 ? Math.round((currentTimeSec / durationSec) * 100) : 0,
      watchedSeconds: bufferedSeconds,
    });

    watchSyncInFlightRef.current = false;

    if (!response.ok || !response.data) {
      watchBufferSecondsRef.current += bufferedSeconds;
      setPendingWatchSeconds(Math.floor(watchBufferSecondsRef.current));
      if ((response.message || "").toLowerCase().includes("budget") || (response.message || "").toLowerCase().includes("expired")) {
        setHasCourseAccess(false);
        setAccessMessage(response.message || "Course access expired.");
      }
      return;
    }

    setAccessItem(response.data.access);
    setHasCourseAccess(Boolean(response.data.accessActive));
    if (!response.data.accessActive) {
      setAccessMessage("Your course access has expired because watch-time budget is finished.");
      return;
    }
    setAccessMessage("");
  };

  useEffect(() => {
    if (!hasCourseAccess) return;
    const timer = window.setInterval(() => {
      void syncWatchProgress(false);
    }, 5000);

    return () => {
      window.clearInterval(timer);
      void syncWatchProgress(true);
    };
  }, [hasCourseAccess, course?.id, activeLesson?.id, currentChapter?.title]);

  const markComplete = async () => {
    if (!activeLesson || !course) return;

    const now = Date.now();
    const lastCompletionAt = Number(lastCompletionAtRef.current[activeLesson.id] || 0);
    if (now - lastCompletionAt < 8000) return;

    if (completionInFlightRef.current.has(activeLesson.id)) return;
    completionInFlightRef.current.add(activeLesson.id);

    if (activeLesson.type === "video") {
      await syncWatchProgress(true);

      const completeResponse = await completeStudentLessonApi({
        courseId: course.id,
        lessonId: activeLesson.id,
        chapterTitle: currentChapter?.title || "",
        lessonTitle: activeLesson.title,
        viewedSeconds: Math.floor(currentTimeSec),
      });

      if (!completeResponse.ok) {
        setAccessMessage(completeResponse.message || "Unable to complete lesson.");
        completionInFlightRef.current.delete(activeLesson.id);
        return;
      }

      if (completeResponse.data) {
        lastCompletionAtRef.current[activeLesson.id] = now;
        setAccessItem(completeResponse.data.access);
        setHasCourseAccess(Boolean(completeResponse.data.accessActive));
        if (!completeResponse.data.accessActive) {
          setAccessMessage("Your course access has expired due to validity/watch-time budget.");
        } else {
          setAccessMessage("");
        }
      }
    }

    const next = curriculum.map((ch) => ({
      ...ch,
      lessons: ch.lessons.map((l) => (l.id === activeLesson.id ? { ...l, completed: true } : l)),
    }));

    setCurriculum(next);
    setCurriculumForCourse(course.id, next);
    setActiveLesson((prev) => (prev ? { ...prev, completed: true } : prev));

    const nextTotal = next.reduce((sum, ch) => sum + ch.lessons.length, 0);
    const nextCompleted = next.reduce((sum, ch) => sum + ch.lessons.filter((l) => l.completed).length, 0);
    const nextProgressPercent = nextTotal > 0 ? Math.round((nextCompleted / nextTotal) * 100) : 0;
    updateProgress(course.id, nextProgressPercent);

    recordStudentVideoActivityApi({
      courseId: course.id,
      chapterTitle: currentChapter?.title || "",
      lessonTitle: activeLesson.title,
      progressPercent: 100,
      viewedSeconds: Math.floor(currentTimeSec),
    }).catch(() => {
      // Ignore completion sync failures.
    });

    completionInFlightRef.current.delete(activeLesson.id);
  };

  const formatHms = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getLessonIcon = (lesson: Lesson) => {
    if (lesson.completed) return <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />;
    if (lesson.locked) return <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />;
    if (lesson.type === "video") return <PlayCircle className="w-4 h-4 text-primary shrink-0" />;
    if (lesson.type === "pdf") return <FileText className="w-4 h-4 text-muted-foreground shrink-0" />;
    return <BarChart3 className="w-4 h-4 text-accent shrink-0" />;
  };

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Course not found</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Login Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Please login or sign up to access course content.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSignupMode(false);
                setLoginOpen(true);
              }}
            >
              Login
            </Button>
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => {
                setSignupMode(true);
                setLoginOpen(true);
              }}
            >
              Sign Up
            </Button>
          </div>
          <Button variant="ghost" className="mt-3" onClick={() => navigate(`/course/${course.id}`)}>
            Back to Course
          </Button>
          <LoginModal
            open={loginOpen}
            onOpenChange={setLoginOpen}
            isSignup={signupMode}
            redirectPath={`/learn/${course.id}`}
            onToggleMode={() => setSignupMode((prev) => !prev)}
          />
        </div>
      </div>
    );
  }

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Checking course access...</h2>
          <p className="text-sm text-muted-foreground mt-2">Please wait.</p>
        </div>
      </div>
    );
  }

  if (!hasCourseAccess) {
    const canRepurchase = Boolean(accessItem);

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Course Access Unavailable</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            {accessMessage || "Purchase this course to unlock videos, PDFs, and study materials."}
          </p>
          <div className="space-y-2">
            {canRepurchase ? (
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => {
                  addToCart(course);
                  navigate("/checkout");
                }}
              >
                Repurchase / Renew Access
              </Button>
            ) : (
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(`/course/${course.id}`)}>
                Buy This Course
              </Button>
            )}

            <Button variant="outline" className="w-full" onClick={() => navigate(`/course/${course.id}`)}>
              View Course Options
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeLesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading lesson content...</p>
      </div>
    );
  }

  const lessonVideoUrl = decodeVideoUrl(activeLesson.videoUrl || "") || fallbackVideoUrl;
  const lessonVideoSource = activeLesson.videoSource || "direct";
  const isUnlimitedViews = accessItem?.isUnlimitedViews === true;
  const baseRemainingWatchSeconds = Math.max(
    0,
    Number(accessItem?.remainingWatchSeconds ?? ((accessItem?.allowedWatchSeconds || 0) - (accessItem?.usedWatchSeconds || 0))),
  );
  const remainingWatchSeconds = Math.max(0, baseRemainingWatchSeconds - pendingWatchSeconds);
  const validityLeftLabel = accessItem?.expiresAt
    ? (() => {
        const diff = new Date(accessItem.expiresAt).getTime() - nowTick;
        if (diff <= 0) return "Expired";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h left`;
      })()
    : "No expiry";

  const watermarkEmail = user?.email?.trim() || "";

  const togglePlayerFullscreen = async () => {
    const container = playerShellRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
        return;
      }
      await container.requestFullscreen();
    } catch {
      // Ignore fullscreen API failures and keep normal mode.
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar - Sleek dark header */}
      <div className="bg-gradient-to-r from-[rgb(38,72,151)] via-[rgb(38,72,151)] to-[rgba(38,72,151,0.95)] text-primary-foreground h-14 flex items-center px-3 md:px-5 gap-3 shrink-0 z-20 sticky top-0 shadow-lg">
        <Button variant="ghost" size="icon" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-full" onClick={() => navigate("/dashboard")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">{course.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 max-w-[120px] h-1.5 bg-primary-foreground/15 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background: "linear-gradient(90deg, hsl(var(--accent)), hsl(4 90% 65%))",
                }}
              />
            </div>
            <span className="text-[10px] text-primary-foreground/70 font-medium">{progressPercent}% • {completedLessons}/{totalLessons}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          <Badge className="bg-primary-foreground/10 text-primary-foreground/80 text-[10px] border-0">
            <Award className="w-3 h-3 mr-1" /> {course.professor}
          </Badge>
        </div>

        <Button variant="ghost" size="icon" className="lg:hidden text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-full" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar - Premium curriculum panel */}
        <aside className={`
          absolute lg:relative inset-y-0 left-0 z-10 w-[320px] bg-card
          border-r border-border shadow-xl lg:shadow-none
          transform transition-transform duration-300 ease-out lg:transform-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col overflow-hidden shrink-0
        `}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border bg-gradient-to-b from-muted/50 to-transparent">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Course Content
              </h2>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {curriculum.length} Chapters
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Progress value={progressPercent} className="flex-1 h-2 bg-muted" />
              <span className="text-[11px] font-bold text-foreground">{progressPercent}%</span>
            </div>
          </div>

          {/* Lessons List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <Accordion type="multiple" defaultValue={["ch1", "ch2"]} className="w-full">
              {curriculum.map((chapter, chIdx) => {
                const chCompleted = chapter.lessons.filter((l) => l.completed).length;
                const isActiveChapter = chapter.lessons.some((l) => l.id === activeLesson.id);
                return (
                  <AccordionItem key={chapter.id} value={chapter.id} className="border-b border-border/60">
                    <AccordionTrigger className={`px-4 py-3 hover:bg-muted/50 text-left transition-colors ${isActiveChapter ? 'bg-accent/5' : ''}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0
                          ${chCompleted === chapter.lessons.length 
                            ? 'bg-accent/15 text-accent' 
                            : isActiveChapter 
                              ? 'bg-primary/10 text-primary' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                          {chCompleted === chapter.lessons.length ? <CheckCircle2 className="w-4 h-4" /> : chIdx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{chapter.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {chCompleted}/{chapter.lessons.length} lessons
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-1">
                      {chapter.lessons.map((lesson, lIdx) => (
                        <button
                          key={lesson.id}
                          onClick={() => handleLessonClick(lesson)}
                          disabled={!isLessonAccessible(lesson)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-200 group
                            ${activeLesson.id === lesson.id 
                              ? "bg-primary/8 border-l-3 border-primary ml-0" 
                              : "hover:bg-muted/60 border-l-3 border-transparent"
                            }
                            ${!isLessonAccessible(lesson) ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}
                          `}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                            ${lesson.completed ? '' : activeLesson.id === lesson.id ? 'ring-2 ring-primary/30' : ''}
                          `}>
                            {getLessonIcon(lesson)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] leading-snug transition-colors
                              ${activeLesson.id === lesson.id 
                                ? "font-bold text-primary" 
                                : lesson.completed 
                                  ? "text-muted-foreground line-through decoration-1" 
                                  : "text-foreground/80 group-hover:text-foreground"
                              }`}>
                              {lesson.title}
                            </p>
                          </div>
                          <span className={`text-[10px] shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md
                            ${lesson.type === "video" ? "bg-primary/5 text-primary" : 
                              lesson.type === "pdf" ? "bg-muted text-muted-foreground" : 
                              "bg-accent/5 text-accent"
                            }`}>
                            {lesson.type === "video" && <Clock className="w-2.5 h-2.5" />}
                            {lesson.type === "pdf" && <FileText className="w-2.5 h-2.5" />}
                            {lesson.type === "quiz" && <BarChart3 className="w-2.5 h-2.5" />}
                            {lesson.duration}
                          </span>
                          {lesson.isPreview && (
                            <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-md bg-green-100 text-green-700">
                              Preview
                            </span>
                          )}
                        </button>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[5] lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-secondary/20">
          {/* Video Player Area */}
          <div className="w-full bg-background border-b border-border px-2 sm:px-3 lg:px-4 pt-2 sm:pt-3 lg:pt-4">
            <div ref={playerShellRef} className="relative group/player w-full aspect-video lg:max-w-[1100px] lg:mx-auto lg:aspect-[16/9] bg-black">
              {activeLesson.type === "video" ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 z-30 h-8 w-8 bg-black/55 text-white border border-white/20 hover:bg-black/75"
                    onClick={togglePlayerFullscreen}
                  >
                    {isPlayerFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                  <div className="w-full" key={activeLesson.id}>
                  <VideoPlayer
                    videoUrl={lessonVideoUrl}
                    source={lessonVideoSource}
                    autoplay
                    controls
                    disableNativeFullscreen
                    aspectRatio="aspect-video"
                    onProgress={({ currentTime, duration, progressPercent }) => {
                      setCurrentTimeSec(currentTime);
                      setDurationSec(duration);

                      const previousObserved = lastObservedSecondRef.current;
                      if (previousObserved !== null) {
                        const rawDelta = Math.max(0, currentTime - previousObserved);
                        const boundedDelta = Math.min(rawDelta, 2);
                        if (boundedDelta > 0) {
                          watchBufferSecondsRef.current += boundedDelta;
                          setPendingWatchSeconds(Math.floor(watchBufferSecondsRef.current));
                        }
                      }
                      lastObservedSecondRef.current = currentTime;

                      if (watchBufferSecondsRef.current >= 5) {
                        void syncWatchProgress(false);
                      }

                      if (
                        activeLesson?.id &&
                        progressPercent >= 99.5
                      ) {
                        void markComplete();
                      }
                    }}
                    onEnded={() => {
                      if (!activeLesson?.id) return;
                      void markComplete();
                    }}
                  />
                  </div>

                  {watermarkEmail && (
                    <div className="pointer-events-none absolute inset-0 select-none">
                      <span className="absolute left-[6%] top-[14%] text-white/35 text-[10px] sm:text-xs font-semibold tracking-wide max-w-[70%] truncate">{watermarkEmail}</span>
                      <span className="absolute right-[8%] top-[48%] text-white/30 text-[10px] sm:text-xs font-semibold tracking-wide max-w-[70%] truncate">{watermarkEmail}</span>
                      <span className="absolute left-[24%] bottom-[12%] text-white/30 text-[10px] sm:text-xs font-semibold tracking-wide max-w-[70%] truncate">{watermarkEmail}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center
                  ${activeLesson.type === "pdf" ? "bg-muted" : "bg-accent/20"}
                `}>
                    {activeLesson.type === "pdf" ? (
                      <FileText className="w-10 h-10 text-muted-foreground" />
                    ) : (
                      <BarChart3 className="w-10 h-10 text-accent" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-foreground text-lg font-bold">{activeLesson.title}</p>
                    <p className="text-muted-foreground text-sm mt-1">{activeLesson.type === "pdf" ? "Download and study" : "Test your knowledge"}</p>
                  </div>
                  <Button
                    className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-6 h-10 font-semibold shadow-lg"
                    onClick={() => {
                      if (activeLesson.type === "pdf") {
                        if (activeLesson.resourceUrl) {
                          window.open(activeLesson.resourceUrl, "_blank", "noopener,noreferrer");
                          return;
                        }
                        downloadStudyMaterialPdf(`${course.title}-${activeLesson.title}`);
                        return;
                      }

                      if (activeLesson.type === "quiz" && activeLesson.resourceUrl) {
                        window.open(activeLesson.resourceUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    {activeLesson.type === "pdf" ? (
                      <><Download className="w-4 h-4 mr-2" /> Download PDF</>
                    ) : (
                      <>Start Quiz</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Lesson Info Bar */}
          <div className="bg-card border-b border-border px-4 md:px-6 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] font-bold border-0 px-2 py-0.5
                    ${activeLesson.type === "video" ? "bg-primary/8 text-primary" : 
                      activeLesson.type === "pdf" ? "bg-muted text-muted-foreground" : 
                      "bg-accent/8 text-accent"
                    }`}>
                    {activeLesson.type === "video" ? "VIDEO" : activeLesson.type === "pdf" ? "PDF" : "QUIZ"}
                  </Badge>
                  {activeLesson.completed && (
                    <Badge className="bg-accent/10 text-accent text-[10px] border-0">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" /> Done
                    </Badge>
                  )}
                  {activeLesson.isPreview && (
                    <Badge className="bg-green-100 text-green-700 text-[10px] border-0">Preview</Badge>
                  )}
                  {!isUnlimitedViews && (
                    <Badge className="bg-rose-100 text-rose-700 text-[10px] border-0">
                      Watch Time: {formatHms(remainingWatchSeconds)}
                    </Badge>
                  )}
                  <Badge className="bg-indigo-100 text-indigo-700 text-[10px] border-0">
                    Validity: {validityLeftLabel}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm md:text-base font-bold text-foreground truncate">{activeLesson.title}</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {currentChapter?.title} • {activeLesson.duration}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!activeLesson.completed && (
                  <Button onClick={markComplete} size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-8 px-4 text-xs font-semibold shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Complete
                  </Button>
                )}
                <div className="hidden sm:flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={goToPrevLesson} disabled={currentIndex === 0}>
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={goToNextLesson} disabled={currentIndex >= allLessons.length - 1}>
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Tabs */}
          <div className="p-4 md:p-6 flex-1">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-card border border-border shadow-sm h-10 p-0.5 rounded-xl">
                <TabsTrigger value="overview" className="text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Notes
                </TabsTrigger>
                <TabsTrigger value="discussion" className="text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Q&A
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                <div className="bg-card rounded-xl border border-border space-y-4">
                  {/* About this Lesson - Collapsible */}
                  <div className="border-b border-border">
                    <button
                      onClick={() => setIsContentExpanded(!isContentExpanded)}
                      className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors text-left group"
                    >
                      <h3 className="text-sm font-bold text-foreground">About this Lesson</h3>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isContentExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isContentExpanded && (
                      <div className="px-5 pb-4 space-y-4 border-t border-border/50">
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          {activeLesson.description?.trim()
                            ? activeLesson.description
                            : (
                              <>
                                This lecture covers the essential concepts of <strong className="text-foreground">{activeLesson.title}</strong> as part of the {course.title} course. Pay close attention to the key concepts discussed.
                              </>
                            )}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: "Subject", value: course.subcategory || course.category, icon: BookOpen },
                            { label: "Instructor", value: course.professor, icon: Award },
                            { label: "Duration", value: activeLesson.duration, icon: Clock },
                            { label: "Language", value: course.language, icon: MessageSquare },
                          ].map((item) => (
                            <div key={item.label} className="bg-secondary/50 rounded-lg p-3 text-center">
                              <item.icon className="w-4 h-4 mx-auto text-primary mb-1.5" />
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                              <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        {/* Resources */}
                        <div>
                          <h3 className="text-sm font-bold text-foreground mb-2">Resources</h3>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-xs h-8 gap-1.5"
                              onClick={() => downloadStudyMaterialPdf(`${course.title}-lecture-notes`)}
                            >
                              <Download className="w-3.5 h-3.5" /> Lecture Notes
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-xs h-8 gap-1.5"
                              onClick={() => downloadStudyMaterialPdf(`${course.title}-practice-sheet`)}
                            >
                              <FileText className="w-3.5 h-3.5" /> Practice Sheet
                            </Button>
                            {activeLesson.resourceUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full text-xs h-8 gap-1.5"
                                onClick={() => window.open(activeLesson.resourceUrl, "_blank", "noopener,noreferrer")}
                              >
                                <Download className="w-3.5 h-3.5" /> Custom Resource
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3">Your Notes</h3>
                  <textarea
                    placeholder="Write your notes here for this lecture... These are private and only visible to you."
                    className="w-full h-44 p-4 rounded-xl border border-input bg-secondary/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 leading-relaxed"
                  />
                  <div className="flex justify-end mt-3">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 text-xs font-semibold">
                      Save Notes
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="discussion" className="mt-0">
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-7 h-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No questions yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Be the first to ask a question about this lesson</p>
                    <Button variant="outline" size="sm" className="mt-4 rounded-full text-xs font-semibold">
                      Ask a Question
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CourseLMS;
