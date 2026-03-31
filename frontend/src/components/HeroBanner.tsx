import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlatformData } from "@/context/PlatformDataContext";

const HeroBanner = () => {
  const { banners } = usePlatformData();
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const visibleBanners = banners
    .filter((banner) => banner.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (current >= visibleBanners.length) {
      setCurrent(0);
    }
  }, [current, visibleBanners.length]);

  const goTo = useCallback((index: number) => {
    if (visibleBanners.length === 0) return;
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning, visibleBanners.length]);

  useEffect(() => {
    if (visibleBanners.length <= 1) return;
    const timer = setInterval(() => {
      goTo((current + 1) % visibleBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [current, goTo, visibleBanners.length]);

  if (visibleBanners.length === 0) return null;

  const prev = () => goTo((current - 1 + visibleBanners.length) % visibleBanners.length);
  const next = () => goTo((current + 1) % visibleBanners.length);

  return (
    <section className="relative overflow-hidden group bg-background -mt-3 md:-mt-5 lg:-mt-6">
      <div className="w-full pt-0 pb-1 md:pb-2">
        <div className="relative overflow-hidden border-b border-border/60 shadow-[0_18px_40px_-34px_hsl(var(--primary)/0.18)]">
          <Link to="/packages" className="block">
            <div className="relative aspect-[16/6.3] sm:aspect-[16/5.9] md:aspect-[16/6.1] xl:aspect-[16/6.4] 2xl:aspect-[16/6.8]">
              {visibleBanners.map((slide, i) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                    i === current ? "opacity-100 scale-100" : "opacity-0 scale-105"
                  }`}
                >
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-contain object-center bg-white"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}

            </div>
          </Link>

          <button
            onClick={prev}
            aria-label="Previous banner"
            className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 md:w-9 md:h-9 rounded-full bg-background/75 backdrop-blur-md border border-border/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300"
          >
            <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground/75" />
          </button>
          <button
            onClick={next}
            aria-label="Next banner"
            className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 md:w-9 md:h-9 rounded-full bg-background/75 backdrop-blur-md border border-border/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300"
          >
            <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground/75" />
          </button>

          <div className="absolute bottom-2.5 md:bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/35 backdrop-blur-md border border-primary-foreground/15">
            {visibleBanners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to banner ${i + 1}`}
                className={`rounded-full transition-all duration-500 ${
                  i === current
                    ? "w-4 h-1 bg-accent"
                    : "w-1.5 h-1.5 bg-primary-foreground/45 hover:bg-primary-foreground/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;