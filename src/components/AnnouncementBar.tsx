import { Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const AnnouncementBar = () => {
  const { announcements } = usePlatformData();
  const visibleAnnouncements = announcements.filter((announcement) => announcement.isVisible);
  const { settings } = useSiteSettings();
  const speedSeconds = settings.header.announcementSpeedSeconds || 28;

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <section className="bg-background py-1.5 md:py-2 overflow-x-clip">
      <div className="w-full">
        <div className="relative overflow-hidden border-y border-[rgba(38,72,151,0.25)] bg-[rgb(38,72,151)] shadow-[0_18px_45px_-30px_rgba(38,72,151,0.85)]">
          {/* subtle pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />

          <div className="flex items-center h-11 md:h-12">
            <div className="relative z-10 flex items-center gap-2 shrink-0 px-3.5 sm:px-4 bg-white/10 h-full border-r border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[rgb(231,70,35)] animate-pulse" />
              <Megaphone className="hidden sm:block w-4 h-4 text-white/90" />
              <span className="text-[10px] md:text-[11px] font-extrabold text-white uppercase tracking-[0.14em]">
                Notice
              </span>
            </div>

            <div className="flex-1 overflow-hidden relative">
              <div
                className="flex animate-marquee whitespace-nowrap gap-8 sm:gap-12 py-2 px-3.5 sm:px-5 hover:[animation-play-state:paused]"
                style={{ animationDuration: `${speedSeconds}s` }}
              >
                {[...visibleAnnouncements, ...visibleAnnouncements].map((item, i) => (
                  <Link
                    key={i}
                    to={item.link}
                    className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-white/85 hover:text-white transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[rgb(231,70,35)] shrink-0" />
                    <span className="text-white font-extrabold">{item.title}</span>
                    <span className="text-white/70">•</span>
                    <span className="text-white/80">{item.content}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnnouncementBar;
