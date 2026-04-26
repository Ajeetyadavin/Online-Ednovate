import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, GraduationCap } from "lucide-react";
import { FacultyProfile } from "@/services/adminApi";
import CourseCard from "@/components/CourseCard";

type PublicCourse = {
  id: string;
  title: string;
  category?: string;
  subcategory?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  image?: string;
  thumbnail?: string;
  language?: string;
  professor?: string;
  lectures?: number;
  hours?: number;
  isCombo?: boolean;
  isMaterial?: boolean;
  isVisible?: boolean;
};

const AVATAR_GRADIENTS = [
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
  "from-indigo-400 to-blue-600",
];

const FacultyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState<FacultyProfile | null>(null);
  const [facultyCourses, setFacultyCourses] = useState<PublicCourse[]>([]);
  const [allFaculty, setAllFaculty] = useState<FacultyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        setLoading(true);
        setError(null);
        const [facultyResponse, coursesResponse] = await Promise.all([
          fetch(`/api/faculty`),
          fetch(`/api/courses`),
        ]);
        if (!facultyResponse.ok) throw new Error("Failed to fetch faculty data");
        if (!coursesResponse.ok) throw new Error("Failed to fetch courses data");

        const data = await facultyResponse.json();
        const coursesData = await coursesResponse.json();
        const items: FacultyProfile[] = data.items || [];
        const allCourses: PublicCourse[] = Array.isArray(coursesData?.courses) ? coursesData.courses : [];

        const found = items.find((f) => f.id === id);
        if (!found) { setError("Faculty member not found"); return; }

        const normalizedFacultyName = found.name.trim().toLowerCase();
        const courseById = new Map<string, PublicCourse>(
          allCourses
            .filter((course) => course?.id)
            .map((course) => [String(course.id), course]),
        );

        const linkedCourses: PublicCourse[] = (found.courses || [])
          .map((course) => {
            const dbCourse = courseById.get(course.id);
            if (dbCourse && dbCourse.isVisible === false) return null;
            if (dbCourse) return dbCourse;
            return {
              id: course.id,
              title: course.title,
              thumbnail: course.thumbnail,
              category: "general",
              subcategory: "general",
              price: 0,
              originalPrice: 0,
              discount: 0,
              image: "/placeholder.svg",
              language: "English",
              professor: found.name,
              lectures: 0,
              hours: 0,
              isCombo: false,
              isMaterial: false,
              isVisible: true,
            };
          })
          .filter(Boolean) as PublicCourse[];

        const professorMappedCourses: PublicCourse[] = allCourses
          .filter((course) => {
            const professorName = String(course.professor || "").trim().toLowerCase();
            return professorName && professorName === normalizedFacultyName && course.isVisible !== false;
          });

        const mergedCourses = Array.from(
          new Map([...linkedCourses, ...professorMappedCourses].map((course) => [course.id, course])).values(),
        );

        setFacultyCourses(mergedCourses);
        setFaculty(found);
        setAllFaculty(items.filter((f) => f.id !== id && f.isActive !== false).slice(0, 6));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load faculty details");
      } finally {
        setLoading(false);
      }
    };
    fetchFaculty();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading faculty profile...</p>
        </div>
      </div>
    );
  }

  if (error || !faculty) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="w-9 h-9 text-rose-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {error ? "Couldn't Load Profile" : "Faculty Not Found"}
          </h1>
          <p className="text-slate-500 mb-6">{error || "This instructor profile doesn't exist."}</p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  const avatarGradient = AVATAR_GRADIENTS[faculty.name.length % AVATAR_GRADIENTS.length];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary/5 font-['Inter']">

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="h-4 w-px bg-slate-200" />
          <p className="text-sm font-semibold text-slate-500">Faculty Profile</p>
        </div>
      </div>

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-100 via-white to-primary/10 py-14 border-b border-slate-200">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-6 items-center sm:items-end">
          {/* Large avatar */}
          <div className="relative shrink-0">
            <div className="h-28 w-28 md:h-36 md:w-36 rounded-full overflow-hidden ring-4 ring-slate-200 shadow-2xl">
              {faculty.photoUrl ? (
                <img src={faculty.photoUrl} alt={faculty.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${avatarGradient}`}>
                  <span className="text-5xl font-extrabold text-white/90">{faculty.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <span className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-400 shadow" />
          </div>

          {/* Name + meta */}
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
              <GraduationCap className="h-3 w-3" /> Expert Instructor
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">{faculty.name}</h1>
            {facultyCourses.length > 0 && (
              <p className="text-slate-500 text-sm mt-2 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <BookOpen className="w-4 h-4" />
                <span>{facultyCourses.length} Course{facultyCourses.length !== 1 ? "s" : ""}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left sidebar ── */}
          <div className="lg:col-span-1 space-y-5">
            {/* About */}
            {faculty.about && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">About</p>
                <p className="text-sm text-slate-600 leading-relaxed">{faculty.about}</p>
              </div>
            )}

            {/* Stats */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Stats</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Total Courses</span>
                  <span className="text-sm font-bold text-slate-900">{facultyCourses.length}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Right: courses ── */}
          <div className="lg:col-span-2">
            {facultyCourses.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5">
                {facultyCourses.map((course) => (
                  <CourseCard key={course.id} course={course as any} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">No courses available yet</p>
                <p className="text-xs text-slate-300 mt-1">Check back soon for new content</p>
              </div>
            )}

            {/* Other faculty */}
            {allFaculty.length > 0 && (
              <div className="mt-12">
                <h3 className="text-base font-bold text-slate-800 mb-5">More Instructors</h3>
                <div className="flex flex-wrap gap-4">
                  {allFaculty.map((f, index) => (
                    <Link key={f.id} to={`/faculty/${f.id}`} className="group flex flex-col items-center gap-1.5">
                      <div className={`h-14 w-14 rounded-full overflow-hidden ring-2 ring-white shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-200 bg-gradient-to-br ${AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]}`}>
                        {f.photoUrl ? (
                          <img src={f.photoUrl} alt={f.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="text-xl font-extrabold text-white/90">{f.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-semibold text-slate-600 group-hover:text-primary transition-colors max-w-[56px] text-center leading-tight">
                        {f.name.split(" ")[0]}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyDetail;
