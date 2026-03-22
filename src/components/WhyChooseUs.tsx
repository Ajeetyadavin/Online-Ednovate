import { BookOpen, Monitor, Users, Globe, Wifi, Layers, Award, MessageCircle, Target } from "lucide-react";
import { whyChooseUs } from "@/data/courses";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const iconMap: Record<string, React.ElementType> = {
  BookOpen, Monitor, Users, Globe, Wifi, Layers, Award, MessageCircle, Target,
};

const WhyChooseUs = () => {
  const { ref: titleRef, isVisible: titleVisible } = useScrollReveal();
  const { ref: gridRef, isVisible: gridVisible } = useScrollReveal({ threshold: 0.05 });
  const { settings } = useSiteSettings();
  const configured = settings.homepageContent?.whyChooseUs;
  const displayTitle = configured?.title || "Everything You Need to Succeed";
  const displaySubtitle = configured?.subtitle || "A complete learning ecosystem built for serious students";
  const displayItems = configured?.items?.length ? configured.items : whyChooseUs;

  return (
    <section id="why-choose" className="py-8 md:py-10 bg-muted/50">
      <div className="container mx-auto px-4">
        <div ref={titleRef} className={`text-center mb-8 reveal-up ${titleVisible ? "visible" : ""}`}>
          <span className="text-primary text-sm font-extrabold uppercase tracking-widest">Why Ednovate</span>
          <h2 className="section-title mt-2">
            {displayTitle}
          </h2>
          <p className="section-subtitle">
            {displaySubtitle}
          </p>
        </div>
        <div ref={gridRef} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 stagger-children ${gridVisible ? "visible" : ""}`}>
          {displayItems.map((item) => {
            const Icon = iconMap[item.icon || ""] || BookOpen;
            return (
              <div
                key={item.title}
                className="group relative p-5 rounded-xl bg-card border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 tap-bounce"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-base text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
