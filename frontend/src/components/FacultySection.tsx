import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
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

  // Check if section is visible
  if (!settings.sections.faculty) {
    return null;
  }

  useEffect(() => {
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
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (sortedFaculty.length === 0) return null;

  return (
    <section className="relative py-16 md:py-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${backgroundColor}, #ffffff)`, color: textColor }} aria-label="Faculty section">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">

          {/* ── LEFT SIDEBAR ─────────────────────────────── */}
          <div className="lg:w-64 shrink-0 sticky top-28 self-start">
            {/* label pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 mb-4">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textColor }}>Our Faculty</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-extrabold leading-snug mb-4" style={{ color: textColor }}>
              {settings.homepageContent.faculty.title}
            </h2>

            <p className="text-sm leading-relaxed mb-6" style={{ color: textColor, opacity: 0.85 }}>
              {settings.homepageContent.faculty.subtitle}
            </p>
          </div>

          {/* ── RIGHT: FLOATING CIRCLES GRID ─────────────── */}
          <div className="flex-1">
            <div className="flex flex-wrap gap-6 items-center">
              {sortedFaculty.map((member, index) => (
                <Link
                  key={member.id}
                  to={`/faculty/${member.id}`}
                  className="group flex flex-col items-center gap-2"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {/* Circle avatar */}
                  <div className="relative">
                    {/* Floating animated ring */}
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/40 via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm scale-110" />
                    <div className="absolute -inset-0.5 rounded-full border-2 border-primary/0 group-hover:border-primary/60 transition-all duration-300" />

                    {/* Avatar circle */}
                    <div className={`relative h-[72px] w-[72px] rounded-full overflow-hidden shadow-md ring-2 ring-white group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 ${
                      [
                        "bg-gradient-to-br from-violet-400 to-purple-600",
                        "bg-gradient-to-br from-sky-400 to-blue-600",
                        "bg-gradient-to-br from-emerald-400 to-teal-600",
                        "bg-gradient-to-br from-amber-400 to-orange-600",
                        "bg-gradient-to-br from-rose-400 to-pink-600",
                        "bg-gradient-to-br from-indigo-400 to-blue-600",
                      ][index % 6]
                    }`}>
                      {member.photoUrl ? (
                        <img
                          src={member.photoUrl}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-2xl font-extrabold text-white/90">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Active dot */}
                    <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow-sm" />
                  </div>


                </Link>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-10 border-t border-slate-100 pt-7">
              <p className="text-xs" style={{ color: textColor, opacity: 0.75 }}>
                Click on any instructor's photo to explore their full profile &amp; courses.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FacultySection;
