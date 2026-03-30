import { Search, ShoppingCart, PlayCircle, Award, ChevronRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const steps = [
  {
    icon: Search,
    title: "Browse Courses",
    desc: "Explore our wide range of CA, CS & CMA courses",
    gradient: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/25",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    ring: "ring-blue-100 dark:ring-blue-900/40",
  },
  {
    icon: ShoppingCart,
    title: "Enroll Instantly",
    desc: "Quick checkout with secure payment options",
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/25",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    ring: "ring-emerald-100 dark:ring-emerald-900/40",
  },
  {
    icon: PlayCircle,
    title: "Start Learning",
    desc: "Access video lectures, notes & materials anytime",
    gradient: "from-orange-500 to-rose-600",
    shadow: "shadow-orange-500/25",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    ring: "ring-orange-100 dark:ring-orange-900/40",
  },
  {
    icon: Award,
    title: "Ace Your Exams",
    desc: "Clear exams with confidence & top ranks",
    gradient: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/25",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    ring: "ring-violet-100 dark:ring-violet-900/40",
  },
];

const stepGradients = [
  { gradient: "from-blue-500 to-indigo-600", shadow: "shadow-blue-500/25", bg: "bg-blue-50 dark:bg-blue-950/30", ring: "ring-blue-100 dark:ring-blue-900/40" },
  { gradient: "from-emerald-500 to-teal-600", shadow: "shadow-emerald-500/25", bg: "bg-emerald-50 dark:bg-emerald-950/30", ring: "ring-emerald-100 dark:ring-emerald-900/40" },
  { gradient: "from-orange-500 to-rose-600", shadow: "shadow-orange-500/25", bg: "bg-orange-50 dark:bg-orange-950/30", ring: "ring-orange-100 dark:ring-orange-900/40" },
  { gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/25", bg: "bg-violet-50 dark:bg-violet-950/30", ring: "ring-violet-100 dark:ring-violet-900/40" },
];

const stepIconMap: Record<string, React.ElementType> = {
  Search,
  ShoppingCart,
  PlayCircle,
  Award,
};

const HowItWorks = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const { settings } = useSiteSettings();
  const configured = settings.homepageContent?.howItWorks;
  const displayTitle = configured?.title || "How It Works";
  const displaySubtitle = configured?.subtitle || "Start your learning journey in 4 simple steps";
  const backgroundColor = configured?.backgroundColor || "#FFFFFF";
  const textColor = configured?.textColor || "#0F172A";
  const displaySteps = configured?.steps?.length ? configured.steps : steps;

  return (
    <section className="py-12 md:py-16 relative overflow-hidden" style={{ backgroundColor }}>
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/[0.03] rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/[0.03] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div ref={ref} className={`text-center mb-10 md:mb-14 reveal-up ${isVisible ? "visible" : ""}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Simple Process</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3" style={{ color: textColor }}>
            {displayTitle}
          </h2>
          <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: textColor, opacity: 0.65 }}>{displaySubtitle}</p>
        </div>

        {/* Steps */}
        <div className={`relative stagger-children ${isVisible ? "visible" : ""}`}>
          {/* Desktop connector line */}
          <div className="hidden lg:block absolute top-[72px] left-[12%] right-[12%] h-[2px]">
            <div className="w-full h-full bg-gradient-to-r from-blue-200 via-emerald-200 via-orange-200 to-violet-200 dark:from-blue-800 dark:via-emerald-800 dark:via-orange-800 dark:to-violet-800 rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-5">
            {displaySteps.map((step, i) => {
              const StepIcon = typeof step.icon === "string" ? (stepIconMap[step.icon] || Search) : step.icon;
              const style = stepGradients[i % stepGradients.length];
              return (
                <div key={step.title} className="relative group">
                  <div className={`relative z-10 text-center p-6 sm:p-7 rounded-2xl ${style.bg} ring-1 ${style.ring} hover:shadow-xl ${style.shadow} transition-all duration-500 hover:-translate-y-2`}>
                    {/* Step number badge */}
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${style.gradient} flex items-center justify-center mx-auto mb-5 shadow-lg ${style.shadow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <StepIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>

                    {/* Step counter */}
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                      <span className={`text-3xl sm:text-4xl font-black bg-gradient-to-br ${style.gradient} bg-clip-text text-transparent opacity-20 select-none`}>
                        0{i + 1}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base sm:text-lg mb-2" style={{ color: textColor }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: textColor, opacity: 0.6 }}>{step.desc}</p>

                    {/* Arrow indicator on mobile between cards */}
                    {i < displaySteps.length - 1 && (
                      <div className="sm:hidden flex justify-center mt-4 -mb-2">
                        <ChevronRight className="w-5 h-5 rotate-90 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Desktop arrow between cards */}
                  {i < displaySteps.length - 1 && (
                    <div className="hidden lg:flex absolute top-[56px] -right-[18px] z-20 w-9 h-9 rounded-full bg-background ring-1 ring-border items-center justify-center shadow-sm">
                      <ChevronRight className={`w-4 h-4 bg-gradient-to-r ${style.gradient} bg-clip-text text-transparent`} style={{ color: `var(--tw-gradient-from)` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
