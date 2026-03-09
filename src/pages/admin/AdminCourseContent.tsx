import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus, Save, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { usePlatformData, type Chapter, type Lesson } from "@/context/PlatformDataContext";

const lessonDurationByType: Record<Lesson["type"], string> = {
  video: "10:00",
  pdf: "PDF",
  quiz: "10 Qs",
};

const createLesson = (): Lesson => ({
  id: Date.now().toString(),
  title: "New Lesson",
  duration: lessonDurationByType.video,
  type: "video",
  completed: false,
  locked: false,
  videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
});

const createChapter = (index: number): Chapter => ({
  id: `ch-${Date.now()}-${index}`,
  title: `Chapter ${index + 1}`,
  lessons: [createLesson()],
});

const AdminCourseContent = () => {
  const { courses, categories, getCurriculumForCourse, setCurriculumForCourse } = usePlatformData();

  const availableCourses = useMemo(
    () => courses.filter((course) => course.isVisible),
    [courses],
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>(availableCourses[0]?.id || "");
  const [draftCurriculum, setDraftCurriculum] = useState<Chapter[]>([]);
  const [courseNotes, setCourseNotes] = useState("");

  useEffect(() => {
    if (!selectedCourseId && availableCourses[0]?.id) {
      setSelectedCourseId(availableCourses[0].id);
    }
  }, [availableCourses, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setDraftCurriculum([]);
      return;
    }

    const selectedCourse = courses.find((course) => course.id === selectedCourseId);
    setDraftCurriculum(getCurriculumForCourse(selectedCourseId, selectedCourse?.title));
  }, [selectedCourseId, courses, getCurriculumForCourse]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);

  const updateChapterTitle = (chapterId: string, title: string) => {
    setDraftCurriculum((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, title } : chapter,
      ),
    );
  };

  const addChapter = () => {
    setDraftCurriculum((prev) => [...prev, createChapter(prev.length)]);
  };

  const removeChapter = (chapterId: string) => {
    setDraftCurriculum((prev) => prev.filter((chapter) => chapter.id !== chapterId));
  };

  const addLesson = (chapterId: string) => {
    setDraftCurriculum((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, lessons: [...chapter.lessons, createLesson()] }
          : chapter,
      ),
    );
  };

  const removeLesson = (chapterId: string, lessonId: string) => {
    setDraftCurriculum((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              lessons: chapter.lessons.filter((lesson) => lesson.id !== lessonId),
            }
          : chapter,
      ),
    );
  };

  const updateLesson = (
    chapterId: string,
    lessonId: string,
    updater: (lesson: Lesson) => Lesson,
  ) => {
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

  const saveCurriculum = () => {
    if (!selectedCourseId) {
      toast.error("Please select a course first.");
      return;
    }

    const validCurriculum = draftCurriculum
      .map((chapter) => ({
        ...chapter,
        title: chapter.title.trim() || "Untitled Chapter",
        lessons: chapter.lessons
          .map((lesson) => ({
            ...lesson,
            title: lesson.title.trim() || "Untitled Lesson",
            duration: lesson.duration.trim() || lessonDurationByType[lesson.type],
          }))
          .filter((lesson) => lesson.title.trim().length > 0),
      }))
      .filter((chapter) => chapter.lessons.length > 0);

    if (validCurriculum.length === 0) {
      toast.error("At least one chapter with one lesson is required.");
      return;
    }

    setCurriculumForCourse(selectedCourseId, validCurriculum);
    toast.success("LMS curriculum updated successfully.");
  };

  if (availableCourses.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            No visible courses found. Please make at least one course visible in Courses section.
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
            Add chapters, lessons, and video links that students will see in LMS.
          </p>
        </div>
        <Button onClick={saveCurriculum} className="gap-2">
          <Save className="w-4 h-4" /> Save Curriculum
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Course</CardTitle>
          <CardDescription>Choose a course to edit its LMS structure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {availableCourses.map((course) => {
              const categoryName =
                categories.find((category) => category.id === course.category)?.name ||
                course.category;
              return (
                <option key={course.id} value={course.id}>
                  {course.title} ({categoryName})
                </option>
              );
            })}
          </select>

          <Textarea
            value={courseNotes}
            onChange={(e) => setCourseNotes(e.target.value)}
            placeholder="Optional admin notes (not visible to students)"
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {draftCurriculum.map((chapter, chapterIndex) => (
          <Card key={chapter.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <Input
                    value={chapter.title}
                    onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                    className="font-semibold"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeChapter(chapter.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {chapter.lessons.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Lesson Title</label>
                      <Input
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(chapter.id, lesson.id, (prev) => ({ ...prev, title: e.target.value }))
                        }
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Type</label>
                      <select
                        value={lesson.type}
                        onChange={(e) => {
                          const nextType = e.target.value as Lesson["type"];
                          updateLesson(chapter.id, lesson.id, (prev) => ({
                            ...prev,
                            type: nextType,
                            duration: lessonDurationByType[nextType],
                          }));
                        }}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="video">Video</option>
                        <option value="pdf">PDF</option>
                        <option value="quiz">Quiz</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Duration</label>
                      <Input
                        value={lesson.duration}
                        onChange={(e) =>
                          updateLesson(chapter.id, lesson.id, (prev) => ({ ...prev, duration: e.target.value }))
                        }
                        placeholder={lessonDurationByType[lesson.type]}
                      />
                    </div>

                    <div className="md:col-span-3 flex items-end gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={lesson.locked}
                          onChange={(e) =>
                            updateLesson(chapter.id, lesson.id, (prev) => ({ ...prev, locked: e.target.checked }))
                          }
                          className="rounded"
                        />
                        Locked
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive ml-auto"
                        onClick={() => removeLesson(chapter.id, lesson.id)}
                        title={`Delete lesson ${lessonIndex + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {lesson.type === "video" && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Video URL</label>
                      <div className="relative">
                        <Video className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={lesson.videoUrl || ""}
                          onChange={(e) =>
                            updateLesson(chapter.id, lesson.id, (prev) => ({
                              ...prev,
                              videoUrl: e.target.value,
                            }))
                          }
                          className="pl-9"
                          placeholder="https://example.com/video.mp4"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => addLesson(chapter.id)}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Lesson
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addChapter} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Add Chapter
      </Button>

      {selectedCourse && (
        <p className="text-xs text-muted-foreground">
          Editing curriculum for: <span className="font-semibold text-foreground">{selectedCourse.title}</span>
        </p>
      )}
    </div>
  );
};

export default AdminCourseContent;
