import { Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlatformData } from "@/context/PlatformDataContext";

const AnnouncementBar = () => {
  const { announcements } = usePlatformData();
  const visibleAnnouncements = announcements.filter((announcement) => announcement.isVisible);

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <section className="bg-background py-1.5 md:py-2 overflow-x-clip">
      <div className="w-full">
        <div className="relative overflow-hidden border-y border-primary/15 bg-gradient-to-r from-primary/[0.08] via-background to-background shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 sm:w-32 bg-gradient-to-r from-primary/15 to-transparent" />

          <div className="flex items-center h-10 md:h-11">
            <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 shrink-0 px-2.5 sm:px-3.5 md:px-4 bg-primary/10 h-full border-r border-primary/15">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <Megaphone className="hidden sm:block w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] md:text-[11px] font-extrabold text-primary uppercase tracking-[0.12em]">Notice</span>
            </div>

            <div className="flex-1 overflow-hidden relative">
              <div className="flex animate-marquee whitespace-nowrap gap-6 sm:gap-10 py-2 px-3 sm:px-4 [animation-duration:30s] sm:[animation-duration:25s]">
                {[...visibleAnnouncements, ...visibleAnnouncements].map((item, i) => (
                  <Link
                    key={i}
                    to={item.link}
                    className="inline-flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-foreground/70 hover:text-primary transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/90 shrink-0" />
                    {item.title}: {item.content}
                  </Link>
                ))}
              </div>
            </div>

            <div className="hidden md:flex items-center h-full px-4 border-l border-primary/15 text-[10px] font-bold uppercase tracking-[0.12em] text-primary/75 bg-primary/[0.06]">
              Verified Updates
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnnouncementBar;
