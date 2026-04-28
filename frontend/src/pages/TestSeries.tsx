import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import TestPaperCard from "@/components/TestPaperCard";
import { Search, X, ChevronDown, ChevronUp, Filter, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePlatformData } from "@/context/PlatformDataContext";

const sortOptions = [
  { id: "default", label: "Relevance" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "discount", label: "Max Discount" },
];

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
    <div className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-[500px] pb-3 px-1 opacity-100" : "max-h-0 opacity-0"}`}>
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
  <label onClick={onChange} className={`flex items-center gap-2.5 py-1.5 cursor-pointer group ${indent ? "ml-4" : ""}`}>
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${checked ? "bg-accent border-accent" : "border-border group-hover:border-muted-foreground"}`}>
      {checked && (
        <svg className="w-2.5 h-2.5 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
    <span className={`text-xs flex-1 transition-colors ${checked ? "text-accent font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
      {label}
    </span>
    {count !== undefined && <span className="text-[10px] text-muted-foreground/50">{count}</span>}
  </label>
);

const TestSeries = () => {
  const { testPapers, categories: managedCategories } = usePlatformData();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const categoriesById = useMemo(
    () => new Map(managedCategories.map((c) => [c.id, c])),
    [managedCategories],
  );

  const resolveLevelId = (p: (typeof testPapers)[number]) => String(p.levelId || "").trim();
  const resolveParentId = (p: (typeof testPapers)[number]) => {
    const lvl = resolveLevelId(p);
    return categoriesById.get(lvl)?.parentId || String(p.courseId || lvl).trim();
  };

  const visibleCategoryIds = useMemo(
    () => new Set(managedCategories.filter((c) => c.isVisible).map((c) => c.id)),
    [managedCategories],
  );

  const papers = useMemo(
    () => testPapers.filter((p) => p.isVisible),
    [testPapers],
  );

  const dynamicGroups = useMemo(() => {
    const parentMap = new Map<string, Set<string>>();
    const labels = new Map<string, string>();
    const orders = new Map<string, number>();
    const visibleCats = managedCategories.filter((c) => c.isVisible);
    const visibleSet = new Set(visibleCats.map((c) => c.id));

    visibleCats.forEach((cat) => {
      labels.set(cat.id, cat.name);
      orders.set(cat.id, cat.sortOrder ?? 0);
      if (cat.parentId && visibleSet.has(cat.parentId)) {
        if (!parentMap.has(cat.parentId)) parentMap.set(cat.parentId, new Set());
        parentMap.get(cat.parentId)!.add(cat.id);
      } else {
        if (!parentMap.has(cat.id)) parentMap.set(cat.id, new Set());
      }
    });

    for (const p of papers) {
      const lvl = resolveLevelId(p);
      const par = resolveParentId(p);
      if (!lvl && !par) continue;
      const cat = managedCategories.find((c) => c.id === lvl);
      if (cat && cat.isVisible) {
        if (cat.parentId && visibleSet.has(cat.parentId)) {
          if (!parentMap.has(cat.parentId)) parentMap.set(cat.parentId, new Set());
          parentMap.get(cat.parentId)!.add(lvl);
        } else {
          if (!parentMap.has(lvl)) parentMap.set(lvl, new Set());
        }
      } else if (!cat && par) {
        if (!parentMap.has(par)) {
          parentMap.set(par, new Set());
          const parCat = managedCategories.find((c) => c.id === par);
          labels.set(par, parCat?.name || par);
          orders.set(par, parCat?.sortOrder ?? 9999);
        }
        if (lvl && lvl !== par) parentMap.get(par)!.add(lvl);
      }
    }

    return Array.from(parentMap.entries())
      .map(([parentId, childIds]) => ({
        id: parentId,
        label: labels.get(parentId) || parentId,
        order: orders.get(parentId) ?? 0,
        children: Array.from(childIds)
          .map((id) => ({ id, label: labels.get(id) || id, order: orders.get(id) ?? 0 }))
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
          .map(({ id, label }) => ({ id, label })),
      }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [papers, managedCategories]);

  const [selectedParentGroups, setSelectedParentGroups] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    categories: false,
    levels: false,
    subjects: false,
  });

  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleFilter = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, value: string) =>
    setList((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);

  useEffect(() => {
    const category = searchParams.get("category");
    if (category && dynamicGroups.length > 0) {
      const parentGroup = dynamicGroups.find((g) => g.children.some((c) => c.id === category));
      if (parentGroup && !selectedParentGroups.includes(parentGroup.id)) {
        setSelectedParentGroups([parentGroup.id]);
        setSelectedSubcategories([category]);
        setOpenSections((prev) => ({ ...prev, categories: true }));
      }
    }
  }, [searchParams, dynamicGroups]);

  const activeFilterCount = selectedParentGroups.length + selectedSubcategories.length + selectedSubjects.length;

  const clearAllFilters = () => {
    setSelectedParentGroups([]);
    setSelectedSubcategories([]);
    setSelectedSubjects([]);
    setSearchQuery("");
    setSortBy("default");
  };

  const poolAfterCategory = useMemo(() => {
    if (selectedParentGroups.length === 0 && selectedSubcategories.length === 0) return papers;
    const parentSet = new Set(selectedParentGroups);
    const subSet = new Set(selectedSubcategories);
    return papers.filter((p) => {
      const lvl = resolveLevelId(p);
      const par = resolveParentId(p);
      const matchParent = parentSet.size > 0 && parentSet.has(par);
      const matchLevel = subSet.size > 0 && subSet.has(lvl);
      if (parentSet.size > 0 && subSet.size > 0) return matchParent && matchLevel;
      return matchParent || matchLevel;
    });
  }, [selectedParentGroups, selectedSubcategories, papers]);

  const availableLevels = useMemo(() => {
    if (selectedParentGroups.length === 0) return [];
    const result: { id: string; label: string; count: number }[] = [];
    const seen = new Set<string>();
    selectedParentGroups.forEach((parentId) => {
      const group = dynamicGroups.find((g) => g.id === parentId);
      group?.children.forEach((child) => {
        if (!seen.has(child.id)) {
          seen.add(child.id);
          result.push({ id: child.id, label: child.label, count: papers.filter((p) => resolveLevelId(p) === child.id).length });
        }
      });
    });
    return result;
  }, [selectedParentGroups, dynamicGroups, papers]);

  const dynamicSubjects = useMemo(() => {
    const subMap = new Map<string, number>();
    poolAfterCategory.forEach((p) => {
      if (p.subjectId) {
        subMap.set(p.subjectId, (subMap.get(p.subjectId) || 0) + 1);
      }
    });
    return Array.from(subMap.entries())
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [poolAfterCategory]);

  const filtered = useMemo(() => {
    let result = poolAfterCategory;
    if (selectedSubjects.length > 0) result = result.filter((p) => p.subjectId && selectedSubjects.includes(p.subjectId));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.title.toLowerCase().includes(q) || p.paperCode.toLowerCase().includes(q));
    }
    if (sortBy === "price-low") result = [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [poolAfterCategory, selectedSubjects, searchQuery, sortBy]);

  const filterSidebar = (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <Filter className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-sm font-extrabold text-foreground">Filters</span>
        </div>
        {activeFilterCount > 0 && (
          <button onClick={clearAllFilters} className="text-[10px] text-accent hover:underline font-bold flex items-center gap-1 bg-accent/5 px-2 py-1 rounded-full">
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1 mb-3 px-1 pb-3 border-b border-border/60">
          {selectedParentGroups.map((id) => {
            const group = dynamicGroups.find((g) => g.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full">
                {group?.label || id}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => {
                  toggleFilter(selectedParentGroups, setSelectedParentGroups, id);
                  setSelectedSubcategories((prev) => prev.filter((sub) => !dynamicGroups.find((g) => g.id === id)?.children.some((c) => c.id === sub)));
                }} />
              </span>
            );
          })}
          {selectedSubcategories.map((id) => {
            const child = dynamicGroups.flatMap((g) => g.children).find((c) => c.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                {child?.label || id}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedSubcategories, setSelectedSubcategories, id)} />
              </span>
            );
          })}
          {selectedSubjects.map((id) => {
            const sub = dynamicSubjects.find((s) => s.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-700 text-[10px] font-bold rounded-full">
                {sub?.label || id}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => toggleFilter(selectedSubjects, setSelectedSubjects, id)} />
              </span>
            );
          })}
        </div>
      )}

      <FilterSection title="Courses" isOpen={openSections.categories} onToggle={() => toggleSection("categories")} badge={selectedParentGroups.length}>
        <div className="space-y-1">
          {dynamicGroups.map((group) => {
            const count = papers.filter((p) => resolveParentId(p) === group.id).length;
            return (
              <CheckItem
                key={group.id}
                label={group.label}
                checked={selectedParentGroups.includes(group.id)}
                onChange={() => {
                  toggleFilter(selectedParentGroups, setSelectedParentGroups, group.id);
                  setSelectedSubjects([]);
                }}
                count={count}
              />
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Levels" isOpen={openSections.levels} onToggle={() => toggleSection("levels")} badge={selectedSubcategories.length}>
        <div className="space-y-0">
          {availableLevels.length > 0 ? (
            availableLevels.map((level) => (
              <CheckItem
                key={level.id}
                label={level.label}
                checked={selectedSubcategories.includes(level.id)}
                onChange={() => { toggleFilter(selectedSubcategories, setSelectedSubcategories, level.id); setSelectedSubjects([]); }}
                count={level.count}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">Select a course to see levels</p>
          )}
        </div>
      </FilterSection>

      <FilterSection title="Subjects" isOpen={openSections.subjects} onToggle={() => toggleSection("subjects")} badge={selectedSubjects.length}>
        <div className="space-y-0">
          {dynamicSubjects.length > 0 ? (
            dynamicSubjects.map((subject) => (
              <CheckItem
                key={subject.id}
                label={subject.label}
                checked={selectedSubjects.includes(subject.id)}
                onChange={() => toggleFilter(selectedSubjects, setSelectedSubjects, subject.id)}
                count={subject.count}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">Select a course or level to see subjects</p>
          )}
        </div>
      </FilterSection>
    </div>
  );

  return (
    <div className="bg-secondary pb-24 md:pb-0">

      {/* Breadcrumb + Sort */}
      <div className="bg-background border-b border-border">
        <div className="container mx-auto px-3 md:px-4 py-3">
          {/* Mobile */}
          <div className="md:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <a href="/" className="hover:text-accent transition-colors">Home</a>
                <span className="text-border">›</span>
                <span className="text-foreground font-bold">Test Series</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setMobileFiltersOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg shadow-sm"
                >
                  <Filter className="w-3 h-3" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="bg-accent text-accent-foreground text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-[11px] border border-border rounded-lg px-2 py-1.5 bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  {sortOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search test series, paper code..."
                className="pl-9 h-9 text-xs bg-secondary border-border rounded-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <a href="/" className="hover:text-accent transition-colors">Home</a>
              <span className="text-border">›</span>
              <span className="text-foreground font-bold">Test Series</span>
              <span className="ml-2 bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
                {filtered.length} results
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative w-[300px] lg:w-[340px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search test series, paper code..."
                  className="pl-9 h-9 text-xs bg-secondary border-border rounded-lg w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-[11px] border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  {sortOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
              </div>
            </div>
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

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {selectedParentGroups.length === 0 && selectedSubcategories.length === 0 && (
              <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">Tip:</span> Select a course category from Filters to see relevant test series.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 md:gap-4">
              {filtered.map((paper) => (
                <TestPaperCard key={paper.id} paper={paper} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-background flex items-center justify-center mx-auto mb-4 border border-border shadow-sm">
                  <span className="text-2xl">🔍</span>
                </div>
                <p className="text-foreground text-sm font-bold">No test series found</p>
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

export default TestSeries;
