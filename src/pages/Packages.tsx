import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import CourseCard from "@/components/CourseCard";
import { Search, X, ChevronDown, ChevronUp, Filter, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePlatformData } from "@/context/PlatformDataContext";

const sortOptions = [
  { id: "default", label: "Relevance" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "discount", label: "Max Discount" },
];

// ── Reusable UI pieces ──────────────────────────────────────────────

interface FilterSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
}

const FilterSection = ({ title, isOpen, onToggle, children, badge }: FilterSectionProps) => (
  <div className="border-b border-border/60 last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-1 text-[13px] font-bold text-foreground hover:text-accent transition-colors"
    >
      <span className="flex items-center gap-2">
        {title}
        {badge !== undefined && badge > 0 && (
          <span className="bg-accent text-accent-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {badge}
          </span>
        )}
      </span>
      {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
    <div
      className={`overflow-hidden transition-all duration-200 ${
        isOpen ? "max-h-[500px] pb-3 px-1 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      {children}
    </div>
  </div>
);

interface CheckItemProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
  indent?: boolean;
}

const CheckItem = ({ label, checked, onChange, count, indent }: CheckItemProps) => (
  <label
    onClick={onChange}
    className={`flex items-center gap-2.5 py-1.5 cursor-pointer group ${indent ? "ml-4" : ""}`}
  >
    <div
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
        checked
          ? "bg-accent border-accent"
          : "border-border group-hover:border-muted-foreground"
      }`}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
    <span className={`text-xs flex-1 transition-colors ${checked ? "text-accent font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
      {label}
    </span>
    {count !== undefined && (
      <span className="text-[10px] text-muted-foreground/50">{count}</span>
    )}
  </label>
);

// ── Main component ──────────────────────────────────────────────────

const Packages = () => {
  const { courses: managedCourses, categories: managedCategories } = usePlatformData();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const visibleCategoryIds = useMemo(
    () => new Set(managedCategories.filter((category) => category.isVisible).map((category) => category.id)),
    [managedCategories],
  );

  const courses = useMemo(
    () =>
      managedCourses.filter(
        (course) =>
          course.isVisible &&
          (visibleCategoryIds.size === 0 || visibleCategoryIds.has(course.category)),
      ),
    [managedCourses, visibleCategoryIds],
  );

  // ── Build dynamic parent categories from managed categories (show all visible), with course fallbacks ──────────────────
  const dynamicCourseGroups = useMemo(() => {
    // Step 1: Build parent->children map from visible managed categories
    const parentMap = new Map<string, Set<string>>();
    const categoryLabels = new Map<string, string>();
    const categorySortOrder = new Map<string, number>();
    const visibleCategories = managedCategories.filter((cat) => cat.isVisible);
    const visibleCategorySet = new Set(visibleCategories.map((cat) => cat.id));
    
    // First pass: register all categories
    visibleCategories.forEach((cat) => {
      categoryLabels.set(cat.id, cat.name);
      categorySortOrder.set(cat.id, cat.sortOrder ?? 0);
      
      if (cat.parentId && visibleCategorySet.has(cat.parentId)) {
        // This is a child category
        if (!parentMap.has(cat.parentId)) {
          parentMap.set(cat.parentId, new Set());
        }
        parentMap.get(cat.parentId)!.add(cat.id);
      } else {
        // Root category or child whose parent is not visible
        if (!parentMap.has(cat.id)) {
          parentMap.set(cat.id, new Set());
        }
      }
    });

    // Step 2: Get all course categories
    const courseCategoryIds = new Set(courses.map((c) => c.category));

    // Step 3: Ensure course categories not present in managed categories still appear
    for (const courseCatId of courseCategoryIds) {
      const category = managedCategories.find((c) => c.id === courseCatId);
      
      if (category && category.isVisible) {
        if (category.parentId && visibleCategorySet.has(category.parentId)) {
          // It has a parent, ensure parent exists in map
          if (!parentMap.has(category.parentId)) {
            parentMap.set(category.parentId, new Set());
          }
          parentMap.get(category.parentId)!.add(courseCatId);
        } else {
          // It's a visible root category
          if (!parentMap.has(courseCatId)) {
            parentMap.set(courseCatId, new Set());
          }
        }
      } else if (!category) {
        // Category doesn't exist in managedCategories - treat as standalone parent
        if (!parentMap.has(courseCatId)) {
          parentMap.set(courseCatId, new Set());
          categoryLabels.set(courseCatId, courseCatId);
          categorySortOrder.set(courseCatId, 9999);
        }
      }
    }

    // Step 4: Build final groups from all collected parents
    const groupsToRender = Array.from(parentMap.entries())
      .map(([parentId, childrenIds]) => {
        const childrenArray = Array.from(childrenIds)
          .map((childId) => ({
            id: childId,
            label: categoryLabels.get(childId) || childId,
            order: categorySortOrder.get(childId) ?? 0,
          }))
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

        return {
          id: parentId,
          label: categoryLabels.get(parentId) || parentId,
          order: categorySortOrder.get(parentId) ?? 0,
          children: childrenArray.map(({ id, label }) => ({ id, label })),
        };
      })
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)) as Array<{
        id: string;
        label: string;
        order: number;
        children: Array<{ id: string; label: string }>;
      }>;

    return groupsToRender;
  }, [courses, managedCategories]);

  const categories = useMemo(
    () => [
      { id: "all", label: "All Courses" },
      ...managedCategories
        .filter((category) => category.isVisible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((category) => ({ id: category.id, label: category.name })),
    ],
    [managedCategories],
  );

  // Filter states
  const [selectedParentGroups, setSelectedParentGroups] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedProfessors, setSelectedProfessors] = useState<string[]>([]);
  const [selectedDeliveryModes, setSelectedDeliveryModes] = useState<string[]>([]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    categories: false,
    levels: false,
    types: false,
    language: false,
    professor: false,
    deliveryMode: false,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleFilter = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) =>
    setList((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );

  useEffect(() => {
    const category = searchParams.get("category");
    if (category && dynamicCourseGroups.length > 0) {
      // Find parent group for this subcategory
      const parentGroup = dynamicCourseGroups.find((g) =>
        g.children.some((c) => c.id === category),
      );
      if (parentGroup && !selectedParentGroups.includes(parentGroup.id)) {
        setSelectedParentGroups([parentGroup.id]);
        setSelectedSubcategories([category]);
        setOpenSections((prev) => ({ ...prev, categories: true }));
      }
    }
  }, [searchParams, selectedParentGroups, dynamicCourseGroups]);

  const activeFilterCount =
    selectedParentGroups.length +
    selectedSubcategories.length +
    selectedTypes.length +
    selectedLanguages.length +
    selectedProfessors.length +
    selectedDeliveryModes.length;

  const clearAllFilters = () => {
    setSelectedParentGroups([]);
    setSelectedSubcategories([]);
    setSelectedTypes([]);
    setSelectedLanguages([]);
    setSelectedProfessors([]);
    setSelectedDeliveryModes([]);
    setSearchQuery("");
    setSortBy("default");
  };

  // ── Determine which courses match selected categories ──────────
  const coursePoolAfterCategory = useMemo(() => {
    if (selectedParentGroups.length === 0 && selectedSubcategories.length === 0) return courses;
    const selectedSet = new Set([...selectedParentGroups, ...selectedSubcategories]);
    return courses.filter((c) => selectedSet.has(c.category));
  }, [selectedParentGroups, selectedSubcategories, courses]);

  // ── Get available levels (children) for selected parent groups ──────────
  const availableLevels = useMemo(() => {
    if (selectedParentGroups.length === 0) return [];
    const childrenArr: { id: string; label: string; count: number }[] = [];
    const childIds = new Set<string>();
    
    selectedParentGroups.forEach((parentId) => {
      const group = dynamicCourseGroups.find((g) => g.id === parentId);
      if (group) {
        group.children.forEach((child) => {
          if (!childIds.has(child.id)) {
            childIds.add(child.id);
            const count = courses.filter((c) => c.category === child.id).length;
            childrenArr.push({ id: child.id, label: child.label, count });
          }
        });
      }
    });
    return childrenArr;
  }, [selectedParentGroups, dynamicCourseGroups, courses]);

  const dynamicDeliveryModes = useMemo(() => {
    const pool = coursePoolAfterCategory;
    const modesMap = new Map<string, number>();
    pool.forEach((c) => {
      if (Array.isArray(c.deliveryModes)) {
        c.deliveryModes.forEach((mode) => {
          const count = modesMap.get(mode.id) || 0;
          modesMap.set(mode.id, count + 1);
        });
      }
    });
    return Array.from(modesMap, ([id, count]) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1), count }));
  }, [coursePoolAfterCategory]);

  const dynamicTypes = useMemo(() => {
    const pool = coursePoolAfterCategory;
    const types: { id: string; label: string; count: number }[] = [];
    const comboCount = pool.filter((c) => c.isCombo).length;
    const materialCount = pool.filter((c) => c.isMaterial).length;
    const singleCount = pool.filter((c) => !c.isCombo && !c.isMaterial).length;
    if (comboCount > 0) types.push({ id: "combo", label: "Combo Packs", count: comboCount });
    if (materialCount > 0) types.push({ id: "material", label: "Study Materials", count: materialCount });
    if (singleCount > 0) types.push({ id: "single", label: "Single Subject", count: singleCount });
    return types;
  }, [coursePoolAfterCategory]);

  const dynamicLanguages = useMemo(() => {
    const pool = coursePoolAfterCategory;
    const langs = [...new Set(pool.map((c) => c.language))];
    return langs.map((l) => ({
      label: l,
      count: pool.filter((c) => c.language === l).length,
    }));
  }, [coursePoolAfterCategory]);

  const dynamicProfessors = useMemo(() => {
    const pool = coursePoolAfterCategory;
    const profs = [...new Set(pool.map((c) => c.professor))];
    return profs.map((p) => ({
      label: p,
      count: pool.filter((c) => c.professor === p).length,
    }));
  }, [coursePoolAfterCategory]);

  // Keep filter selections valid as filter options change.
  useEffect(() => {
    const validTypeIds = dynamicTypes.map((t) => t.id);
    setSelectedTypes((prev) => prev.filter((t) => validTypeIds.includes(t)));

    const validLangs = dynamicLanguages.map((l) => l.label);
    setSelectedLanguages((prev) => prev.filter((l) => validLangs.includes(l)));

    const validProfs = dynamicProfessors.map((p) => p.label);
    setSelectedProfessors((prev) => prev.filter((p) => validProfs.includes(p)));

    const validModes = dynamicDeliveryModes.map((m) => m.id);
    setSelectedDeliveryModes((prev) => prev.filter((m) => validModes.includes(m)));
  }, [dynamicTypes, dynamicLanguages, dynamicProfessors, dynamicDeliveryModes]);

  // ── Final filtered results ────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = coursePoolAfterCategory;

    if (selectedTypes.length > 0) {
      result = result.filter((c) => {
        if (selectedTypes.includes("combo") && c.isCombo) return true;
        if (selectedTypes.includes("material") && c.isMaterial) return true;
        if (selectedTypes.includes("single") && !c.isCombo && !c.isMaterial) return true;
        return false;
      });
    }

    if (selectedLanguages.length > 0) {
      result = result.filter((c) => selectedLanguages.includes(c.language));
    }

    if (selectedProfessors.length > 0) {
      result = result.filter((c) => selectedProfessors.includes(c.professor));
    }

    if (selectedDeliveryModes.length > 0) {
      result = result.filter((c) =>
        selectedDeliveryModes.some((mode) =>
          Array.isArray(c.deliveryModes) && c.deliveryModes.some((dm) => dm.id === mode),
        ),
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.professor.toLowerCase().includes(q)
      );
    }

    if (sortBy === "price-low") result = [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") result = [...result].sort((a, b) => b.price - a.price);
    if (sortBy === "discount") result = [...result].sort((a, b) => b.discount - a.discount);

    return result;
  }, [coursePoolAfterCategory, selectedTypes, selectedLanguages, selectedProfessors, selectedDeliveryModes, searchQuery, sortBy]);

  // ── Sidebar content ───────────────────────────────────────────────
  const filterSidebar = (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <Filter className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-sm font-extrabold text-foreground">Filters</span>
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-[10px] text-accent hover:underline font-bold flex items-center gap-1 bg-accent/5 px-2 py-1 rounded-full"
          >
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1 mb-3 px-1 pb-3 border-b border-border/60">
          {selectedParentGroups.map((id) => {
            const group = dynamicCourseGroups.find((g) => g.id === id);
            const label = group?.label || id;
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full">
                {label}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => {
                  toggleFilter(selectedParentGroups, setSelectedParentGroups, id);
                  setSelectedSubcategories((prev) => prev.filter((sub) => !dynamicCourseGroups.find((g) => g.id === id)?.children.some((c) => c.id === sub)));
                }} />
              </span>
            );
          })}
          {selectedSubcategories.map((id) => {
            const child = dynamicCourseGroups.flatMap((g) => g.children).find((c) => c.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                {child?.label || id}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedSubcategories, setSelectedSubcategories, id)} />
              </span>
            );
          })}
          {selectedTypes.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/80 text-primary-foreground text-[10px] font-bold rounded-full">
              {id === "combo" ? "Combo" : id === "material" ? "Material" : "Single"}
              <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedTypes, setSelectedTypes, id)} />
            </span>
          ))}
          {selectedLanguages.map((lang) => (
            <span key={lang} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground text-[10px] font-bold rounded-full">
              {lang}
              <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedLanguages, setSelectedLanguages, lang)} />
            </span>
          ))}
          {selectedProfessors.map((prof) => (
            <span key={prof} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground text-[10px] font-bold rounded-full">
              {prof}
              <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedProfessors, setSelectedProfessors, prof)} />
            </span>
          ))}
          {selectedDeliveryModes.map((mode) => (
            <span key={mode} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full">
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
              <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedDeliveryModes, setSelectedDeliveryModes, mode)} />
            </span>
          ))}
        </div>
      )}

      {/* ─── 1. COURSES (parent categories only) ─── */}
      <FilterSection
        title="Courses"
        isOpen={openSections.categories}
        onToggle={() => toggleSection("categories")}
        badge={selectedParentGroups.length}
      >
        <div className="space-y-1">
          {dynamicCourseGroups.map((group) => {
            const parentCourseCount = courses.filter(
              (c) => c.category === group.id || group.children.some((child) => c.category === child.id)
            ).length;
            return (
              <CheckItem
                key={group.id}
                label={group.label}
                checked={selectedParentGroups.includes(group.id)}
                onChange={() => {
                  toggleFilter(selectedParentGroups, setSelectedParentGroups, group.id);
                  if (!selectedParentGroups.includes(group.id)) {
                    // When selecting parent, auto-clear any old selected types/languages to reset filters
                    setSelectedTypes([]);
                  }
                }}
                count={parentCourseCount}
              />
            );
          })}
        </div>
      </FilterSection>

      {/* ─── 2. LEVELS (children of selected parents) - ALWAYS VISIBLE ─── */}
      <FilterSection
        title="Levels"
        isOpen={openSections.levels}
        onToggle={() => toggleSection("levels")}
        badge={selectedSubcategories.length}
      >
        <div className="space-y-0">
          {availableLevels.length > 0 ? (
            availableLevels.map((level) => (
              <CheckItem
                key={level.id}
                label={level.label}
                checked={selectedSubcategories.includes(level.id)}
                onChange={() => toggleFilter(selectedSubcategories, setSelectedSubcategories, level.id)}
                count={level.count}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">Select a course to see levels</p>
          )}
        </div>
      </FilterSection>

      {/* ─── 3. TYPES ─── */}
      <FilterSection
        title="Types"
        isOpen={openSections.types}
        onToggle={() => toggleSection("types")}
        badge={selectedTypes.length}
      >
        <div className="space-y-0">
          {dynamicTypes.map((type) => (
            <CheckItem
              key={type.id}
              label={type.label}
              checked={selectedTypes.includes(type.id)}
              onChange={() => toggleFilter(selectedTypes, setSelectedTypes, type.id)}
              count={type.count}
            />
          ))}
        </div>
      </FilterSection>

      {/* ─── 4. LANGUAGE (dynamic) ─── */}
      <FilterSection
        title="Language"
        isOpen={openSections.language}
        onToggle={() => toggleSection("language")}
        badge={selectedLanguages.length}
      >
        <div className="space-y-0">
          {dynamicLanguages.map((lang) => (
            <CheckItem
              key={lang.label}
              label={lang.label}
              checked={selectedLanguages.includes(lang.label)}
              onChange={() => toggleFilter(selectedLanguages, setSelectedLanguages, lang.label)}
              count={lang.count}
            />
          ))}
        </div>
      </FilterSection>

      {/* ─── 5. PROFESSOR (dynamic) ─── */}
      <FilterSection
        title="Professor"
        isOpen={openSections.professor}
        onToggle={() => toggleSection("professor")}
        badge={selectedProfessors.length}
      >
        <div className="space-y-0">
          {dynamicProfessors.map((prof) => (
            <CheckItem
              key={prof.label}
              label={prof.label}
              checked={selectedProfessors.includes(prof.label)}
              onChange={() => toggleFilter(selectedProfessors, setSelectedProfessors, prof.label)}
              count={prof.count}
            />
          ))}
        </div>
      </FilterSection>

      {/* ─── 6. DELIVERY MODE (dynamic) ─── */}
      {dynamicDeliveryModes.length > 0 && (
        <FilterSection
          title="Delivery Mode"
          isOpen={openSections.deliveryMode}
          onToggle={() => toggleSection("deliveryMode")}
          badge={selectedDeliveryModes.length}
        >
          <div className="space-y-0">
            {dynamicDeliveryModes.map((mode) => (
              <CheckItem
                key={mode.id}
                label={mode.label}
                checked={selectedDeliveryModes.includes(mode.id)}
                onChange={() => toggleFilter(selectedDeliveryModes, setSelectedDeliveryModes, mode.id)}
                count={mode.count}
              />
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="bg-secondary">

      {/* Breadcrumb + Sort */}
      <div className="bg-background border-b border-border">
        <div className="container mx-auto px-3 md:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <a href="/" className="hover:text-accent transition-colors">Home</a>
            <span className="text-border">›</span>
            <span className="text-foreground font-bold">Courses</span>
            <span className="ml-2 bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
              {filtered.length} results
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-sm"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-accent text-accent-foreground text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-[11px] border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-background border-b border-border">
        <div className="container mx-auto px-3 md:px-4 py-2">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search courses, professors..."
              className="pl-9 h-9 text-xs bg-secondary border-border rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
          <div className="relative w-[300px] max-w-[85vw] bg-background h-full overflow-y-auto p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent" /> Filters
              </h3>
              <button onClick={() => setMobileFiltersOpen(false)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterSidebar}
            {/* Apply button */}
            <div className="sticky bottom-0 pt-3 pb-2 bg-background border-t border-border mt-4">
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full py-2.5 bg-accent text-accent-foreground text-xs font-bold rounded-lg shadow-sm"
              >
                Show {filtered.length} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main: sidebar + grid */}
      <div className="container mx-auto px-3 md:px-4 py-6">
        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden md:block w-[250px] flex-shrink-0">
            <div className="sticky top-20 bg-background rounded-xl border border-border p-4 max-h-[calc(100vh-100px)] overflow-y-auto shadow-sm">
              {filterSidebar}
            </div>
          </aside>

          {/* Course grid */}
          <div className="flex-1 min-w-0">
            {/* Smart hint */}
            {selectedParentGroups.length === 0 && selectedSubcategories.length === 0 && (
              <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">Tip:</span> Select a course category (CA, CS, CMA...) from Filters to see relevant offerings.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 md:gap-4">
              {filtered.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-background flex items-center justify-center mx-auto mb-4 border border-border shadow-sm">
                  <span className="text-2xl">🔍</span>
                </div>
                <p className="text-foreground text-sm font-bold">No courses found</p>
                <p className="text-muted-foreground text-xs mt-1">Try changing or clearing your filters</p>
                <button onClick={clearAllFilters} className="mt-3 px-4 py-1.5 bg-accent text-accent-foreground text-xs font-bold rounded-full hover:bg-accent/90 transition-colors">
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Packages;
