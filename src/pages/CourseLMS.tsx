import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  PlayCircle, CheckCircle2, Lock, Clock, FileText, ChevronLeft,
  BookOpen, BarChart3, MessageSquare, Download, Menu, X,
  Award, SkipForward, SkipBack
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import LoginModal from "@/components/LoginModal";
import { downloadStudyMaterialPdf } from "@/lib/studyMaterial";
import {
  usePlatformData,
  type Chapter,
  type Lesson,
} from "@/context/PlatformDataContext";
import { decodeVideoUrl, getYouTubeEmbedUrl } from "@/lib/video-utils";

const fallbackVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4";

const CourseLMS = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses, getCurriculumForCourse, setCurriculumForCourse } = usePlatformData();
  const { isLoggedIn } = useAuth();
  const { isPurchased } = useCart();
  const course = courses.find((c) => c.id === id);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);

  const [curriculum, setCurriculum] = useState<Chapter[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  if (!isPurchased(course.id)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Course Not Purchased</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Purchase this course to unlock videos, PDFs, and study materials.
          </p>
          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(`/course/${course.id}`)}>
            Buy This Course
          </Button>
        </div>
      </div>
    );
  }

  const totalLessons = curriculum.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const completedLessons = curriculum.reduce(
    (sum, ch) => sum + ch.lessons.filter((l) => l.completed).length, 0
  );
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const allLessons = curriculum.flatMap((ch) => ch.lessons);
  const currentLessonId = activeLesson?.id || allLessons[0]?.id || "";
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

  const markComplete = () => {
    if (!activeLesson || !course) return;
    setCurriculum((prev) => {
      const next = prev.map((ch) => ({
        ...ch,
        lessons: ch.lessons.map((l) =>
          l.id === activeLesson.id ? { ...l, completed: true } : l,
        ),
      }));
      setCurriculumForCourse(course.id, next);
      return next;
    });
    setActiveLesson((prev) => (prev ? { ...prev, completed: true } : prev));
  };

  const getLessonIcon = (lesson: Lesson) => {
    if (lesson.completed) return <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />;
    if (lesson.locked) return <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />;
    if (lesson.type === "video") return <PlayCircle className="w-4 h-4 text-primary shrink-0" />;
    if (lesson.type === "pdf") return <FileText className="w-4 h-4 text-muted-foreground shrink-0" />;
    return <BarChart3 className="w-4 h-4 text-accent shrink-0" />;
  };

  const currentChapter = curriculum.find((ch) => ch.lessons.some((l) => l.id === currentLessonId));

  if (!activeLesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading lesson content...</p>
      </div>
    );
  }

  const resolvedLessonVideoUrl = decodeVideoUrl(activeLesson.videoUrl || "") || fallbackVideoUrl;
  const youtubeEmbedUrl = getYouTubeEmbedUrl(resolvedLessonVideoUrl);
  const shouldRenderYouTube =
    activeLesson.type === "video" && (activeLesson.videoSource === "youtube" || Boolean(youtubeEmbedUrl));

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
                  background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(4 90% 65%))'
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
          <div className="bg-gradient-to-b from-black via-black to-foreground/95 aspect-video w-full max-h-[60vh] relative group/player">
            {activeLesson.type === "video" ? (
              <>
                {shouldRenderYouTube && youtubeEmbedUrl ? (
                  <iframe
                    key={activeLesson.id}
                    src={youtubeEmbedUrl}
                    className="w-full h-full"
                    title={activeLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video
                    key={activeLesson.id}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                    src={resolvedLessonVideoUrl}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                {/* Floating lesson nav buttons */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover/player:opacity-100 transition-opacity pointer-events-none">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={goToPrevLesson}
                    disabled={currentIndex === 0}
                    className="pointer-events-auto bg-black/60 hover:bg-black/80 text-white rounded-full h-8 px-3 text-[11px] backdrop-blur-sm disabled:opacity-30"
                  >
                    <SkipBack className="w-3.5 h-3.5 mr-1" /> Previous
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={goToNextLesson}
                    disabled={currentIndex >= allLessons.length - 1}
                    className="pointer-events-auto bg-black/60 hover:bg-black/80 text-white rounded-full h-8 px-3 text-[11px] backdrop-blur-sm disabled:opacity-30"
                  >
                    Next <SkipForward className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
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
                  <p className="text-white text-lg font-bold">{activeLesson.title}</p>
                  <p className="text-white/50 text-sm mt-1">{activeLesson.type === "pdf" ? "Download and study" : "Test your knowledge"}</p>
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
                <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-2">About this Lesson</h3>
                    <p className="text-sm text-foreground/70 leading-relaxed">
                      {activeLesson.description?.trim()
                        ? activeLesson.description
                        : (
                          <>
                            This lecture covers the essential concepts of <strong className="text-foreground">{activeLesson.title}</strong> as part of the {course.title} course. Pay close attention to the key concepts discussed.
                          </>
                        )}
                    </p>
                  </div>
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
