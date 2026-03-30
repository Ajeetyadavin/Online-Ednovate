import { useEffect, useState, useRef } from "react";
import { stats } from "@/data/courses";
import { ShoppingCart, Users, Video, BookOpen } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const statIcons = [ShoppingCart, Users, Video, BookOpen];

const useCountUp = (target: number, duration = 2000, shouldStart: boolean) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!shouldStart) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, shouldStart]);
  return count;
};

const StatItem = ({ label, value, suffix, inView, icon: Icon, index, textColor, iconColor }: { label: string; value: number; suffix: string; inView: boolean; icon: React.ElementType; index: number; textColor: string; iconColor: string }) => {
  const count = useCountUp(value, 2000, inView);
  return (
    <div className="text-center flex flex-col items-center px-3 py-4 md:px-4 md:py-5 opacity-0 animate-fade-in-up" style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}>
      <div className="w-9 h-9 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center mb-2">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <div className="text-lg sm:text-2xl md:text-[1.75rem] font-extrabold tracking-tight leading-none" style={{ color: textColor }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-[11px] sm:text-xs font-semibold mt-1" style={{ color: textColor, opacity: 0.75 }}>{label}</div>
    </div>
  );
};

const StatsCounter = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const { settings } = useSiteSettings();
  const configuredStats = settings.homepageContent?.stats?.items || [];
  const statsBackgroundColor = settings.homepageContent?.stats?.backgroundColor || "#264897";
  const statsTextColor = settings.homepageContent?.stats?.textColor || "#FFFFFF";
  const statsIconColor = settings.homepageContent?.stats?.iconColor || "#E04040";
  const displayStats = configuredStats.length > 0 ? configuredStats : stats;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-4 md:py-6 bg-background">
      <div className="w-full">
        <div
          className="relative overflow-hidden border-y border-white/10 shadow-[0_18px_45px_-28px_rgba(38,72,151,0.75)]"
          style={{ backgroundColor: statsBackgroundColor }}
        >
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '22px 22px'
          }} />
          <div className="absolute -top-16 -left-10 w-40 h-40 bg-accent/15 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -right-10 w-40 h-40 bg-primary-foreground/10 rounded-full blur-2xl" />

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 divide-y divide-primary-foreground/10 md:divide-y-0 md:divide-x md:divide-primary-foreground/10">
            {displayStats.map((stat, i) => (
              <StatItem key={stat.label} {...stat} inView={inView} icon={statIcons[i % statIcons.length]} index={i} textColor={statsTextColor} iconColor={statsIconColor} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsCounter;
