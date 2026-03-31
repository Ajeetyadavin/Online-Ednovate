import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Input } from "@/components/ui/input";

const CourseCollection = () => {
  const { slug = "" } = useParams();
  const { courses: managedCourses, categories } = usePlatformData();
  const { settings } = useSiteSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const visibleCategoryIds = useMemo(
    () => new Set(categories.filter((category) => category.isVisible).map((category) => category.id)),
    [categories],
  );

  const visibleCourses = useMemo(
    () =>
      managedCourses.filter(
        (course) =>
          course.isVisible &&
          (visibleCategoryIds.size === 0 || visibleCategoryIds.has(course.category)),
      ),
    [managedCourses, visibleCategoryIds],
  );

  const collection = useMemo(
    () =>
      settings.header.courseCollections
        .filter((item) => item.visible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .find((item) => item.slug === slug),
    [settings.header.courseCollections, slug],
  );

  if (!collection) {
    return <Navigate to="/packages" replace />;
  }

  const selectedIds = new Set(collection.courseIds);
  const allowedCategorySet = new Set(collection.categoryIds || []);
  const now = new Date();
  const visibleFromDate = collection.courseVisibleFrom ? new Date(collection.courseVisibleFrom) : null;
  const visibleUntilDate = collection.courseVisibleUntil ? new Date(collection.courseVisibleUntil) : null;
  const startsOk = !collection.enableCourseSchedule || !visibleFromDate || Number.isNaN(visibleFromDate.getTime()) || now >= visibleFromDate;
  const endsOk = !collection.enableCourseSchedule || !visibleUntilDate || Number.isNaN(visibleUntilDate.getTime()) || now <= visibleUntilDate;
  const isWithinCollectionWindow = startsOk && endsOk;
  const selectedCourses = visibleCourses.filter(
    (course) =>
      isWithinCollectionWindow &&
      selectedIds.has(course.id) &&
      (allowedCategorySet.size === 0 || allowedCategorySet.has(course.category)),
  );

  const collectionCategorySet = useMemo(() => {
    return new Set(
      selectedCourses
        .map((course) => course.category)
        .filter((categoryId) => allowedCategorySet.size === 0 || allowedCategorySet.has(categoryId)),
    );
  }, [allowedCategorySet, selectedCourses]);

  const collectionCategories = useMemo(
    () =>
      categories
        .filter((category) => category.isVisible && collectionCategorySet.has(category.id))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories, collectionCategorySet],
  );

  const filteredCourses = useMemo(() => {
    let result = selectedCourses;

    if (collection.enableCategoryFilter && selectedCategories.length > 0) {
      const selectedSet = new Set(selectedCategories);
      result = result.filter((course) => selectedSet.has(course.category));
    }

    if (collection.enableSearch && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((course) =>
        [course.title, course.professor, course.language].join(" ").toLowerCase().includes(query),
      );
    }

    return result;
  }, [collection.enableCategoryFilter, collection.enableSearch, searchQuery, selectedCategories, selectedCourses]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  return (
    <div className="min-h-screen bg-secondary">
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div
          className="absolute inset-0"
          style={{
            background: collection.heroImageUrl
              ? `linear-gradient(135deg, rgba(0,0,0,0.52), rgba(0,0,0,0.18)), url(${collection.heroImageUrl}) center/cover no-repeat`
              : "linear-gradient(140deg, #12213a 0%, #1e3a5f 48%, #0f172a 100%)",
          }}
        />
        <div className="relative container mx-auto px-4 py-10 md:py-14 text-white">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-white/90 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="mt-5 max-w-2xl">
            {collection.badge && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                {collection.badge}
              </span>
            )}
            <h1 className="mt-3 text-3xl md:text-5xl font-black leading-tight">{collection.title}</h1>
            <p className="mt-3 text-sm md:text-base text-white/85 max-w-xl">
              {collection.description || "Curated collection selected by the academic team."}
            </p>
            <div className="mt-5 inline-flex items-center rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold">
              {selectedCourses.length} selected courses
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 md:py-10">
        {(collection.enableSearch || collection.enableCategoryFilter) && (
          <div className="mb-5 rounded-xl border border-border bg-background p-3 md:p-4 shadow-sm">
            <div className="grid md:grid-cols-2 gap-3 items-start">
              {collection.enableSearch && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Search Courses</label>
                  <div className="relative mt-1">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-xs"
                      placeholder={collection.searchPlaceholder || "Search courses..."}
                    />
                  </div>
                </div>
              )}

              {collection.enableCategoryFilter && collectionCategories.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    {collection.categoryFilterLabel || "Filter by Category"}
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {collectionCategories.map((category) => {
                      const checked = selectedCategories.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                            checked
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-background text-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 md:gap-4">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-background p-10 text-center shadow-sm">
            <p className="text-lg font-bold text-foreground">{collection.emptyStateText || "No courses found"}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Admin can edit this collection from Header module in admin panel.
            </p>
            <Link
              to="/packages"
              className="inline-flex mt-5 items-center rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-foreground"
            >
              Browse all courses
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default CourseCollection;
