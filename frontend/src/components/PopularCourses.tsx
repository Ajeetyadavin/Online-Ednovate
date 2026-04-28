import { useEffect, useMemo, useState } from "react";
import CourseCard from "./CourseCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Sparkles } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const PopularCourses = () => {
  const { courses, categories } = usePlatformData();
  const { settings } = useSiteSettings();
  const [activeTab, setActiveTab] = useState("all");
  const { ref: titleRef, isVisible: titleVisible } = useScrollReveal();
  const { ref: gridRef, isVisible: gridVisible } = useScrollReveal({ threshold: 0.05 });

  const visibleCourses = useMemo(
    () => courses.filter((course) => course.isVisible),
    [courses],
  );

  const exploreCategoryIds = useMemo(
    () =>
      Array.isArray(settings.exploreCategoryIds)
        ? settings.exploreCategoryIds.map((id) => String(id).trim()).filter(Boolean)
        : [],
    [settings.exploreCategoryIds],
  );

  const exploreCategorySet = useMemo(() => new Set(exploreCategoryIds), [exploreCategoryIds]);

  const homepageCourses = useMemo(() => {
    if (exploreCategorySet.size === 0) return [];
    return visibleCourses.filter(
      (course) => exploreCategorySet.has(course.category) || exploreCategorySet.has(course.subcategory || ""),
    );
  }, [visibleCourses, exploreCategorySet]);

  const tabs = useMemo(() => {
    const orderedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

    const categoryTabs = (exploreCategoryIds.length > 0
      ? exploreCategoryIds
          .map((id) => orderedCategories.find((category) => category.id === id))
          .filter(Boolean)
      : orderedCategories)
      .map((category) => ({ id: category.id, label: category.name }));

    return [
      { id: "all", label: "All Courses" },
      ...categoryTabs,
    ];
  }, [categories, exploreCategoryIds]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("all");
    }
  }, [activeTab, tabs]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return homepageCourses;
    return homepageCourses.filter(
      (course) => course.category === activeTab || course.subcategory === activeTab,
    );
  }, [activeTab, homepageCourses]);

  const activeTabLabel = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.label || "All Courses",
    [activeTab, tabs],
  );

  return (
    <section id="courses" className="py-7 md:py-10 relative overflow-hidden bg-gradient-to-b from-muted/20 via-background to-muted/35">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="w-full px-4 md:px-6 relative z-10">
        <div ref={titleRef} className={`text-center mb-7 md:mb-9 reveal-up ${titleVisible ? "visible" : ""}`}>
          <h2 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">Explore Courses</h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto mt-2">
            Choose from our wide range of professional courses
          </p>

        </div>

        <div className={`flex justify-center mb-7 md:mb-8 reveal-up ${titleVisible ? "visible" : ""}`}>
          <div className="inline-flex gap-2 p-2 bg-card/90 backdrop-blur rounded-2xl border border-border shadow-sm overflow-x-auto max-w-full scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap tap-bounce ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={gridRef}
          className={`rounded-2xl border border-border/70 bg-card/50 backdrop-blur-sm p-3 md:p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)] stagger-children ${gridVisible ? "visible" : ""}`}
        >
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
          {filtered.slice(0, 8).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📚</span>
            </div>
            <p className="text-muted-foreground text-sm">No courses in this category yet</p>
          </div>
        )}

        <div className="text-center mt-8 md:mt-10">
          <Link to="/packages">
            <Button className="font-bold text-sm gap-2 h-11 px-7 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all tap-bounce">
              View All Courses <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PopularCourses;
