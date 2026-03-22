import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Calendar, Clock, Eye, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import LoginModal from "@/components/LoginModal";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { getStudentCourseAccessApi, type StudentCourseAccessSelf } from "@/services/authApi";
import { isCourseAccessActive } from "@/lib/studentAccess";

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function CourseAbout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { courses, getCurriculumForCourse } = usePlatformData();
  const { purchasedCourses } = useCart();

  const [accessItem, setAccessItem] = useState<StudentCourseAccessSelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);

  const course = useMemo(() => {
    return purchasedCourses.find((item) => item.id === id) || courses.find((item) => item.id === id);
  }, [courses, id, purchasedCourses]);

  const curriculum = useMemo(() => {
    if (!course) return [];
    return getCurriculumForCourse(course.id, course.title);
  }, [course, getCurriculumForCourse]);

  const lessonCount = useMemo(
    () => curriculum.reduce((sum, chapter) => sum + chapter.lessons.length, 0),
    [curriculum],
  );

  const completedCount = useMemo(
    () => curriculum.reduce((sum, chapter) => sum + chapter.lessons.filter((lesson) => lesson.completed).length, 0),
    [curriculum],
  );

  useEffect(() => {
    if (!isLoggedIn || !id) {
      setLoading(false);
      return;
    }

    const loadAccess = async () => {
      setLoading(true);
      const response = await getStudentCourseAccessApi();
      if (response.ok && response.data) {
        const current = response.data.find((item) => item.courseId === id) || null;
        setAccessItem(current);
      }
      setLoading(false);
    };

    void loadAccess();
  }, [id, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Login Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Please login or sign up to view course details.
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
          <Button variant="ghost" className="mt-3" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
          <LoginModal
            open={loginOpen}
            onOpenChange={setLoginOpen}
            isSignup={signupMode}
            onToggleMode={() => setSignupMode((prev) => !prev)}
          />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Course not found</h2>
          <p className="text-sm text-muted-foreground mt-2">This course is not available in your dashboard.</p>
          <Button className="mt-4" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const totalViews = Math.max(0, Number(accessItem?.totalViews || 0));
  const usedViews = Math.max(0, Number(accessItem?.usedViews || 0));
  const remainingViews = Math.max(0, Number(accessItem?.remainingViews ?? (totalViews - usedViews)));
  const isUnlimitedViews = accessItem?.isUnlimitedViews === true;
  const watchRemainingSeconds = Math.max(
    0,
    Number(accessItem?.remainingWatchSeconds ?? ((accessItem?.allowedWatchSeconds || 0) - (accessItem?.usedWatchSeconds || 0))),
  );
  const watchRemainingHours = (watchRemainingSeconds / 3600).toFixed(2);
  const progressPercent = lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0;
  const localPurchaseDate = "purchasedOn" in course ? course.purchasedOn : undefined;
  const purchaseStamp = accessItem?.createdAt || accessItem?.purchaseDate || localPurchaseDate;

  return (
    <div className="min-h-screen bg-muted/30 pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">About Course</h1>
        </div>

        <Card className="border-border">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <img
                src={course.image}
                alt={course.title}
                className="w-full md:w-56 h-36 object-cover rounded-lg border border-border"
              />
              <div className="space-y-2">
                <Badge variant="secondary">{course.category.replace("-", " ").toUpperCase()}</Badge>
                <CardTitle className="text-xl">{course.title}</CardTitle>
                <p className="text-sm text-muted-foreground">Instructor: {course.professor}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 border-0">Progress: {progressPercent}%</Badge>
                  <Badge className="bg-blue-100 text-blue-700 border-0">Lessons: {completedCount}/{lessonCount}</Badge>
                  <Badge className="bg-violet-100 text-violet-700 border-0">
                    {isUnlimitedViews ? "Unlimited Access" : `Views Left: ${remainingViews}`}
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-700 border-0">Validity: {accessItem?.expiresAt ? formatDate(accessItem.expiresAt) : "No expiry"}</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Bought On</p>
                <p className="text-sm font-semibold mt-1">{formatDateTime(purchaseStamp)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Duration Bought</p>
                <p className="text-sm font-semibold mt-1">{Number(accessItem?.durationDays || 0)} days</p>
              </div>
              {!isUnlimitedViews && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Views</p>
                  <p className="text-sm font-semibold mt-1">{`${remainingViews} left / ${totalViews} total`}</p>
                </div>
              )}
              {!isUnlimitedViews && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Watch Time Left</p>
                  <p className="text-sm font-semibold mt-1">{watchRemainingHours} hours</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Course Progress</p>
                <p className="text-xs text-muted-foreground">{completedCount} of {lessonCount} lessons completed</p>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">Lesson List</p>
                <Badge variant={isCourseAccessActive(accessItem) ? "default" : "destructive"}>
                  {isCourseAccessActive(accessItem) ? "Access Active" : "Access Expired"}
                </Badge>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading access details...</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {curriculum.map((chapter) => (
                    <div key={chapter.id} className="rounded-md border border-border/60 p-2.5">
                      <p className="text-sm font-semibold text-foreground">{chapter.title}</p>
                      <div className="mt-1.5 space-y-1">
                        {chapter.lessons.map((lesson) => (
                          <div key={lesson.id} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                            <span className="truncate">{lesson.title}</span>
                            <span className="shrink-0 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {lesson.duration || "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(`/learn/${course.id}`)}>
                <PlayCircle className="w-4 h-4 mr-1.5" /> Continue Learning
              </Button>
              <Button variant="outline" onClick={() => navigate(`/course/${course.id}`)}>
                View Course Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
