import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import CourseCard from "@/components/CourseCard";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings, type HomepageSection } from "@/context/SiteSettingsContext";
import { ArrowRight } from "lucide-react";

interface DynamicHomepageSectionProps {
  section: HomepageSection;
}

const DynamicHomepageSection = ({ section }: DynamicHomepageSectionProps) => {
  const { courses } = usePlatformData();
  const { settings } = useSiteSettings();

  const exploreCategorySet = useMemo(
    () => new Set(settings.exploreCategoryIds || []),
    [settings.exploreCategoryIds],
  );

  const visibleCourses = useMemo(() => {
    const filtered = courses.filter((course) => course.isVisible);
    if (exploreCategorySet.size === 0) return [];
    return filtered.filter(
      (course) => exploreCategorySet.has(course.category) || exploreCategorySet.has(course.subcategory || ""),
    );
  }, [courses, exploreCategorySet]);

  if (!section.visible) return null;

  const baseSectionStyle = {
    backgroundColor: section.backgroundColor,
    color: section.textColor,
    fontFamily: section.fontFamily,
  };

  switch (section.type) {
    case "hero":
      return (
        <section style={baseSectionStyle} className="py-8 md:py-12 lg:py-16">
          <div className="container mx-auto px-4">
            {section.imageUrl && (
              <img
                src={section.imageUrl}
                alt={section.title}
                className="w-full h-64 md:h-96 object-cover rounded-lg mb-6"
              />
            )}
            <div className="max-w-2xl">
              <h1 style={{ fontSize: `${Number(section.fontSize) * 2.5}px` }} className="font-bold mb-4">
                {section.title}
              </h1>
              {section.subtitle && (
                <p style={{ fontSize: `${Number(section.fontSize) * 1.25}px` }} className="mb-6 opacity-90">
                  {section.subtitle}
                </p>
              )}
              {section.content && (
                <div style={{ fontSize: `${section.fontSize}px` }} className="mb-6 leading-relaxed">
                  {section.content}
                </div>
              )}
            </div>
          </div>
        </section>
      );

    case "banner":
      return (
        <section style={baseSectionStyle} className="py-6 md:py-8">
          <div className="container mx-auto px-4">
            {section.imageUrl && (
              <img
                src={section.imageUrl}
                alt={section.title}
                className="w-full rounded-lg object-cover"
              />
            )}
          </div>
        </section>
      );

    case "text":
      return (
        <section style={baseSectionStyle} className="py-8 md:py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            {section.title && (
              <h2 style={{ fontSize: `${Number(section.fontSize) * 1.75}px` }} className="font-bold mb-4">
                {section.title}
              </h2>
            )}
            {section.subtitle && (
              <p style={{ fontSize: `${Number(section.fontSize) * 1.1}px` }} className="mb-6 opacity-80">
                {section.subtitle}
              </p>
            )}
            {section.content && (
              <div
                style={{ fontSize: `${section.fontSize}px` }}
                className="prose prose-sm max-w-none leading-relaxed whitespace-pre-wrap"
              >
                {section.content}
              </div>
            )}
          </div>
        </section>
      );

    case "courses":
      return (
        <section style={baseSectionStyle} className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            {section.title && (
              <div className="text-center mb-8">
                <h2 style={{ fontSize: `${Number(section.fontSize) * 1.75}px` }} className="font-bold mb-2">
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p style={{ fontSize: `${Number(section.fontSize) * 1.1}px` }} className="opacity-80">
                    {section.subtitle}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {visibleCourses.slice(0, 8).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
            {visibleCourses.length === 0 && (
              <div className="text-center py-12">
                <p style={{ fontSize: `${section.fontSize}px` }} className="opacity-60">
                  No courses available in selected categories.
                </p>
              </div>
            )}
          </div>
        </section>
      );

    case "features":
      return (
        <section style={baseSectionStyle} className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            {section.title && (
              <div className="text-center mb-8">
                <h2 style={{ fontSize: `${Number(section.fontSize) * 1.75}px` }} className="font-bold mb-2">
                  {section.title}
                </h2>
              </div>
            )}
            {section.content && (
              <div
                style={{ fontSize: `${section.fontSize}px` }}
                className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto"
              >
                {section.content.split("\n").map((line, idx) => (
                  <div key={idx} className="p-4 rounded text-center border border-current border-opacity-20">
                    <p>{line.trim()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case "cta":
      return (
        <section style={baseSectionStyle} className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              {section.title && (
                <h2 style={{ fontSize: `${Number(section.fontSize) * 1.75}px` }} className="font-bold mb-4">
                  {section.title}
                </h2>
              )}
              {section.content && (
                <p style={{ fontSize: `${section.fontSize}px` }} className="mb-6 opacity-90 leading-relaxed">
                  {section.content}
                </p>
              )}
              <Link to="/packages">
                <Button
                  size="lg"
                  style={{
                    backgroundColor: section.textColor,
                    color: section.backgroundColor,
                  }}
                  className="gap-2"
                >
                  Explore Now <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      );

    case "custom":
    default:
      return (
        <section style={baseSectionStyle} className="py-8 md:py-12">
          <div
            className="container mx-auto px-4"
            dangerouslySetInnerHTML={{
              __html: section.content || `<p>${section.title}</p>`,
            }}
          />
        </section>
      );
  }
};

export default DynamicHomepageSection;
