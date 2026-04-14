import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Input } from "@/components/ui/input";

const BRAND_BLUE = "rgb(38,71,150)";
const BRAND_ORANGE = "#e74723";

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

  const hasActiveFilters = Boolean(searchQuery.trim()) || selectedCategories.length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f5f2] text-slate-900">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${BRAND_BLUE} 0%, ${BRAND_ORANGE} 100%)` }} />
        <div
          className="absolute inset-0"
          style={{
            background: collection.heroImageUrl
              ? `linear-gradient(130deg, rgba(15,23,42,0.72), rgba(15,23,42,0.4)), url(${collection.heroImageUrl}) center/cover no-repeat`
              : `linear-gradient(145deg, ${BRAND_BLUE} 0%, #1f4aa3 55%, ${BRAND_ORANGE} 100%)`,
          }}
        />
        <div className="relative container mx-auto px-4 py-10 text-white md:py-14">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-white/90 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>

          <div className="mt-6 max-w-3xl">
            {collection.badge && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/45 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                <Sparkles className="h-3 w-3" />
                {collection.badge}
              </span>
            )}

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
              Curated Collection
            </p>

            <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight md:text-5xl">{collection.title}</h1>

            <p className="mt-4 max-w-2xl text-sm text-white/85 md:text-base">
              {collection.description || "Curated collection selected by the academic team."}
            </p>

            <div className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Courses</p>
                <p className="mt-1 text-lg font-bold">{selectedCourses.length}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Categories</p>
                <p className="mt-1 text-lg font-bold">{collectionCategories.length}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 col-span-2 sm:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Visibility</p>
                <p className="mt-1 text-sm font-semibold">{isWithinCollectionWindow ? "Active" : "Scheduled"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 md:py-10">
        {(collection.enableSearch || collection.enableCategoryFilter) && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Refine Collection</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-50"
                  style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              {collection.enableSearch && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Search Courses</label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND_BLUE }} />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 border-slate-300 pl-8 text-sm"
                      placeholder={collection.searchPlaceholder || "Search courses..."}
                    />
                  </div>
                </div>
              )}

              {collection.enableCategoryFilter && collectionCategories.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {collection.categoryFilterLabel || "Filter by Category"}
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {collectionCategories.map((category) => {
                      const checked = selectedCategories.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            checked
                              ? "text-white"
                              : "bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                          style={checked ? { borderColor: BRAND_ORANGE, backgroundColor: BRAND_ORANGE } : { borderColor: "#cbd5e1" }}
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
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-2xl font-semibold" style={{ color: BRAND_BLUE }}>{collection.emptyStateText || "No courses found"}</p>
            <p className="mt-2 text-sm text-slate-600">
              Admin can edit this collection from Header module in admin panel.
            </p>
            <Link
              to="/packages"
              className="mt-5 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: BRAND_ORANGE }}
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
