import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { bannerSlides } from "@/data/courses";
import { Link } from "react-router-dom";

const HeroBanner = () => {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning]);

  useEffect(() => {
    const timer = setInterval(() => {
      goTo((current + 1) % bannerSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [current, goTo]);

  const prev = () => goTo((current - 1 + bannerSlides.length) % bannerSlides.length);
  const next = () => goTo((current + 1) % bannerSlides.length);

  return (
    <section className="relative overflow-hidden group bg-gradient-to-b from-muted/35 to-background">
      <div className="w-full py-1 md:py-2">
        <div className="relative overflow-hidden border-y border-border/60 shadow-[0_24px_55px_-35px_hsl(var(--primary)/0.55)]">
          <Link to="/packages" className="block">
            <div className="relative aspect-[16/6.3] sm:aspect-[16/5.5] md:aspect-[16/4.7] xl:aspect-[16/4.4]">
              {bannerSlides.map((slide, i) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                    i === current ? "opacity-100 scale-100" : "opacity-0 scale-105"
                  }`}
                >
                  <img
                    src={slide.image}
                    alt={`Banner ${slide.id}`}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/35" />
                </div>
              ))}

              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground/15 z-20">
                <div
                  className="h-full bg-accent transition-all ease-linear"
                  style={{
                    width: "100%",
                    animation: "progress 5s linear infinite",
                  }}
                  key={current}
                />
              </div>
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
            {bannerSlides.map((_, i) => (
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