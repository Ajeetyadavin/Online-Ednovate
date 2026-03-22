import { useEffect, useMemo, useState } from "react";
import CourseCard from "./CourseCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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

  return (
    <section id="courses" className="py-8 md:py-10 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={titleRef} className={`text-center mb-8 reveal-up ${titleVisible ? "visible" : ""}`}>
          <span className="text-primary text-sm font-extrabold uppercase tracking-widest">Explore</span>
          <h2 className="section-title mt-2">Popular Courses</h2>
          <p className="section-subtitle">Choose from our wide range of professional courses</p>
        </div>

        <div className={`flex justify-center mb-6 reveal-up ${titleVisible ? "visible" : ""}`}>
          <div className="inline-flex gap-1 p-1 bg-card rounded-xl border border-border shadow-sm overflow-x-auto max-w-full scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap tap-bounce ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={gridRef} className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5 stagger-children ${gridVisible ? "visible" : ""}`}>
          {filtered.slice(0, 8).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📚</span>
            </div>
            <p className="text-muted-foreground text-sm">No courses in this category yet</p>
          </div>
        )}

        <div className="text-center mt-8">
          <Link to="/packages">
            <Button variant="outline" className="font-semibold text-sm gap-2 h-10 px-6 rounded-xl border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all tap-bounce">
              View All Courses <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PopularCourses;
