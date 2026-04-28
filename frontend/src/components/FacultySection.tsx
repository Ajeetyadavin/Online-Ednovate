import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, GraduationCap } from "lucide-react";
import { FacultyProfile } from "@/services/adminApi";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const FacultySection = () => {
  const { settings } = useSiteSettings();
  const backgroundColor = settings.homepageContent.faculty.backgroundColor || "#F8FAFC";
  const textColor = settings.homepageContent.faculty.textColor || "#0F172A";
  const [faculty, setFaculty] = useState<FacultyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const sortedFaculty = useMemo(() => {
    const getSecondWord = (name: string) => {
      const parts = String(name || "")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      return parts[1] || parts[0] || "";
    };

    return [...faculty].sort((a, b) => {
      const secondWordCompare = getSecondWord(a.name).localeCompare(getSecondWord(b.name), undefined, { sensitivity: "base" });
      if (secondWordCompare !== 0) return secondWordCompare;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    });
  }, [faculty]);

  useEffect(() => {
    if (!settings.sections.faculty) {
      setLoading(false);
      return;
    }
    const fetchFaculty = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/faculty");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setFaculty((data.items || []).filter((f: FacultyProfile) => f.isActive !== false));
      } catch {
        setFaculty([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFaculty();
  }, [settings.sections.faculty]);

  if (!settings.sections.faculty) {
    return null;
  }

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (sortedFaculty.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden py-8 md:py-10"
      style={{ background: `linear-gradient(135deg, ${backgroundColor}, #ffffff)` }}
      aria-label="Faculty section"
    >
      <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-4 md:mb-5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary">
            <GraduationCap className="h-3 w-3" />
            Our Faculty
          </div>
          <h2 className="mt-2 text-xl font-extrabold leading-tight md:text-3xl" style={{ color: textColor }}>
            {settings.homepageContent.faculty.title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs md:text-sm" style={{ color: textColor, opacity: 0.82 }}>
            {settings.homepageContent.faculty.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedFaculty.map((member, index) => (
            <Link
              key={member.id}
              to={`/faculty/${member.id}`}
              className="group rounded-xl border border-slate-200 bg-white/90 p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="mx-auto h-14 w-14 overflow-hidden rounded-full ring-2 ring-slate-100 sm:h-16 sm:w-16 md:h-18 md:w-18">
                {member.photoUrl ? (
                  <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center text-lg font-extrabold text-white ${
                      [
                        "bg-gradient-to-br from-violet-500 to-purple-600",
                        "bg-gradient-to-br from-sky-500 to-blue-600",
                        "bg-gradient-to-br from-emerald-500 to-teal-600",
                        "bg-gradient-to-br from-amber-500 to-orange-600",
                        "bg-gradient-to-br from-rose-500 to-pink-600",
                        "bg-gradient-to-br from-indigo-500 to-blue-700",
                      ][index % 6]
                    }`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="mt-2 text-center">
                <p className="line-clamp-1 text-xs font-semibold text-slate-900 sm:text-[13px]">{member.name}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500 sm:text-[11px]">
                  {member.courses?.length ? `${member.courses.length} Course${member.courses.length > 1 ? "s" : ""}` : "Faculty"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FacultySection;
