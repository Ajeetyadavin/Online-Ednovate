import { Link } from "react-router-dom";
import { BookOpen, Scale, Calculator, TrendingUp, FileText, GraduationCap, School } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useMemo } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const iconMap: Record<string, React.ElementType> = {
  ca: BookOpen,
  cs: Scale,
  cma: Calculator,
  cfa: TrendingUp,
  acca: FileText,
  fyjc: School,
  syjc: GraduationCap,
};

const CategoryPills = () => {
  const { categories } = usePlatformData();
  const { settings } = useSiteSettings();
  const { ref, isVisible } = useScrollReveal();

  const visibleCategories = useMemo(() => {
    const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

    const selectedIds = Array.isArray(settings.exploreCategoryIds)
      ? settings.exploreCategoryIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (selectedIds.length === 0) return [];

    const byId = new Map(ordered.map((item) => [item.id, item]));
    const selected = selectedIds.map((id) => byId.get(id)).filter(Boolean);
    return selected as typeof ordered;
  }, [categories, settings.exploreCategoryIds]);

  if (visibleCategories.length === 0) return null;

  return (
    <section ref={ref} className="py-6 bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className={`flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide stagger-children ${isVisible ? "visible" : ""}`}>
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap mr-1">Browse:</span>
          {visibleCategories.map((category) => {
            const iconKey = category.id.split("-")[0];
            const Icon = iconMap[iconKey] || BookOpen;
            return (
              <Link
                key={category.id}
                to={`/packages?category=${category.id}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground/75 whitespace-nowrap border border-border hover:border-primary hover:shadow-sm tap-bounce hover-wiggle shine-sweep"
                style={{ borderColor: `${category.color}33` }}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {category.name}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryPills;
