import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { usePlatformData } from "@/context/PlatformDataContext";

const Testimonials = () => {
  const { testimonials } = usePlatformData();
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(1);
  const { ref, isVisible } = useScrollReveal();

  const visibleTestimonials = testimonials.filter((testimonial) => testimonial.isVisible);

  useEffect(() => {
    if (current >= visibleTestimonials.length) {
      setCurrent(0);
    }
  }, [current, visibleTestimonials.length]);

  useEffect(() => {
    const updateVisibleCount = () => {
      setVisibleCount(window.innerWidth >= 768 ? 3 : 1);
    };

    updateVisibleCount();
    window.addEventListener("resize", updateVisibleCount);
    return () => window.removeEventListener("resize", updateVisibleCount);
  }, []);

  useEffect(() => {
    if (visibleTestimonials.length <= 1) return;
    const timer = setInterval(() => {
      changeTo((current + 1) % visibleTestimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [current, visibleTestimonials.length]);

  if (visibleTestimonials.length === 0) {
    return null;
  }

  const changeTo = (index: number) => {
    if (visibleTestimonials.length === 0) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setAnimating(false);
    }, 200);
  };

  const prev = () => changeTo((current - 1 + visibleTestimonials.length) % visibleTestimonials.length);
  const next = () => changeTo((current + 1) % visibleTestimonials.length);

  const getVisibleTestimonials = () => {
    const items = [];
    for (let i = 0; i < visibleCount; i++) {
      items.push(visibleTestimonials[(current + i) % visibleTestimonials.length]);
    }
    return items;
  };

  return (
    <section className="py-8 md:py-10 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div ref={ref} className={`text-center mb-8 reveal-up ${isVisible ? "visible" : ""}`}>
          <span className="text-primary text-xs font-bold uppercase tracking-widest">Testimonials</span>
          <h2 className="section-title mt-2">
            Student <span className="text-primary">Success Stories</span>
          </h2>
          <p className="section-subtitle">Hear what our students have to say</p>
        </div>

        <div className={`reveal-up ${isVisible ? "visible" : ""}`} style={{ transitionDelay: "200ms" }}>
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
            {getVisibleTestimonials().map((t, idx) => (
              <div
                key={`${current}-${idx}`}
                className={`relative bg-muted/50 rounded-2xl p-5 sm:p-6 border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-card-hover ${idx === 0 ? "md:scale-[1.02] md:shadow-lg md:border-primary/15" : ""}`}
              >
                <Quote className="w-6 h-6 text-primary/15 mb-3" />
                
                <p className="text-foreground text-sm leading-relaxed mb-4 line-clamp-4">
                  {t.content}
                </p>

                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < t.rating ? "text-accent fill-accent" : "text-border"}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold text-xs">
                      {t.authorName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-foreground">{t.authorName}</h4>
                    <p className="text-[11px] text-muted-foreground">{t.authorRole}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <button onClick={prev} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted hover:border-primary/20 transition-all tap-bounce hover:scale-110">
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>

            <div className="flex gap-1.5">
              {visibleTestimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => changeTo(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? "bg-primary w-6 scale-y-125" : "bg-border w-1.5 hover:bg-muted-foreground"}`}
                />
              ))}
            </div>

            <button onClick={next} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted hover:border-primary/20 transition-all tap-bounce hover:scale-110">
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
