import { quickCategories } from "@/data/courses";
import { Link } from "react-router-dom";
import { BookOpen, Scale, Calculator, TrendingUp, FileText, GraduationCap, School } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

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
  const { ref, isVisible } = useScrollReveal();

  return (
    <section ref={ref} className="py-6 bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className={`flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide stagger-children ${isVisible ? "visible" : ""}`}>
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap mr-1">Browse:</span>
          {quickCategories.map((cat) => {
            const Icon = iconMap[cat.id];
            return (
              <Link
                key={cat.id}
                to={`/packages?category=${cat.id}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground/75 whitespace-nowrap border border-border hover:border-primary hover:shadow-sm tap-bounce hover-wiggle shine-sweep"
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {cat.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryPills;
