import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import CourseCard from "@/components/CourseCard";
import { courses, categories, courseGroups } from "@/data/courses";
import { Search, X, ChevronDown, ChevronUp, Filter, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filter states
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedProfessors, setSelectedProfessors] = useState<string[]>([]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    courses: true,
    levels: true,
    types: true,
    language: false,
    professor: false,
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

  const activeFilterCount =
    selectedCourses.length +
    selectedLevels.length +
    selectedTypes.length +
    selectedLanguages.length +
    selectedProfessors.length;

  const clearAllFilters = () => {
    setSelectedCourses([]);
    setSelectedLevels([]);
    setSelectedTypes([]);
    setSelectedLanguages([]);
    setSelectedProfessors([]);
    setSearchQuery("");
    setSortBy("default");
  };

  // ── Determine which courses match selected course groups ──────────
  const coursePoolAfterCategory = useMemo(() => {
    if (selectedCourses.length === 0) return courses;
    return courses.filter((c) =>
      selectedCourses.some(
        (cat) => c.category === cat || c.category.startsWith(cat + "-")  || c.category === cat
      )
    );
  }, [selectedCourses]);

  // ── Dynamic filter options based on selected course category ──────
  const dynamicLevels = useMemo(() => {
    // Get levels relevant to selected courses
    const relevantGroups =
      selectedCourses.length > 0
        ? courseGroups.filter((g) =>
            selectedCourses.some((sc) => sc === g.id || sc.startsWith(g.id + "-"))
          )
        : courseGroups;

    const levels: { id: string; label: string }[] = [];
    relevantGroups.forEach((g) => {
      g.children.forEach((child) => {
        const levelName = child.label; // Foundation, Inter, Final, Executive, Professional
        if (!levels.find((l) => l.label === levelName)) {
          levels.push({ id: child.id, label: levelName });
        }
      });
    });
    // For groups without children (CMA, CFA etc.) don't add levels
    return levels;
  }, [selectedCourses]);

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

  // ── When course selection changes, auto-open dependent sections ───
  // Also clean up stale filters when course changes
  useMemo(() => {
    if (selectedCourses.length > 0) {
      // Auto-open levels & types when a course is selected
      setOpenSections((prev) => ({ ...prev, levels: true, types: true, language: true }));

      // Remove levels that no longer exist
      const validLevelIds = dynamicLevels.map((l) => l.id);
      setSelectedLevels((prev) => prev.filter((l) => validLevelIds.includes(l)));

      // Remove types that no longer exist
      const validTypeIds = dynamicTypes.map((t) => t.id);
      setSelectedTypes((prev) => prev.filter((t) => validTypeIds.includes(t)));

      // Remove languages that no longer exist
      const validLangs = dynamicLanguages.map((l) => l.label);
      setSelectedLanguages((prev) => prev.filter((l) => validLangs.includes(l)));

      // Remove professors that no longer exist
      const validProfs = dynamicProfessors.map((p) => p.label);
      setSelectedProfessors((prev) => prev.filter((p) => validProfs.includes(p)));
    }
  }, [selectedCourses]);

  // ── Final filtered results ────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = coursePoolAfterCategory;

    if (selectedLevels.length > 0) {
      result = result.filter((c) =>
        selectedLevels.some((level) => c.category === level)
      );
    }

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
  }, [coursePoolAfterCategory, selectedLevels, selectedTypes, selectedLanguages, selectedProfessors, searchQuery, sortBy]);

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
          {selectedCourses.map((id) => {
            const group = courseGroups.find((g) => g.id === id);
            const cat = categories.find((c) => c.id === id);
            const label = group?.label || cat?.label || id;
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full">
                {label}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedCourses, setSelectedCourses, id)} />
              </span>
            );
          })}
          {selectedLevels.map((id) => {
            const child = courseGroups.flatMap((g) => g.children).find((c) => c.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                {child?.label || id}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedLevels, setSelectedLevels, id)} />
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
        </div>
      )}

      {/* ─── 1. COURSES (parent pills) ─── */}
      <FilterSection
        title="Courses"
        isOpen={openSections.courses}
        onToggle={() => toggleSection("courses")}
        badge={selectedCourses.length}
      >
        <div className="space-y-0">
          {courseGroups.map((group) => {
            const isSelected = selectedCourses.includes(group.id);
            const count = courses.filter(
              (c) => c.category === group.id || c.category.startsWith(group.id + "-")
            ).length;
            return (
              <CheckItem
                key={group.id}
                label={group.label}
                checked={isSelected}
                onChange={() => {
                  toggleFilter(selectedCourses, setSelectedCourses, group.id);
                  setSelectedLevels([]);
                  setSelectedTypes([]);
                }}
                count={count}
              />
            );
          })}
        </div>
      </FilterSection>

      {/* ─── 2. LEVELS (dynamic based on course) ─── */}
      {dynamicLevels.length > 0 && (
        <FilterSection
          title="Levels"
          isOpen={openSections.levels}
          onToggle={() => toggleSection("levels")}
          badge={selectedLevels.length}
        >
          {selectedCourses.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Select a course above to see levels
            </p>
          ) : (
            <div className="space-y-0">
              {dynamicLevels.map((level) => {
                const count = coursePoolAfterCategory.filter(
                  (c) => c.category === level.id
                ).length;
                return (
                  <CheckItem
                    key={level.id}
                    label={level.label}
                    checked={selectedLevels.includes(level.id)}
                    onChange={() => toggleFilter(selectedLevels, setSelectedLevels, level.id)}
                    count={count}
                    indent
                  />
                );
              })}
            </div>
          )}
        </FilterSection>
      )}

      {/* ─── 3. TYPES (dynamic) ─── */}
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
            {selectedCourses.length === 0 && (
              <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">Tip:</span> Select a course (CA, CS, CMA...) from Filters to see relevant levels, types & professors.
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
