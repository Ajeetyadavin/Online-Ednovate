import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroBanner from "@/components/HeroBanner";
import AnnouncementBar from "@/components/AnnouncementBar";
import StatsCounter from "@/components/StatsCounter";
import WhyChooseUs from "@/components/WhyChooseUs";
import PopularCourses from "@/components/PopularCourses";
import Testimonials from "@/components/Testimonials";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const Index = () => {
  const { settings } = useSiteSettings();
  const s = settings.sections;

  return (
    <>
      {s.heroBanner && <HeroBanner />}
      {s.announcementBar && <AnnouncementBar />}
      {s.statsCounter && <StatsCounter />}
      {s.howItWorks && <HowItWorks />}
      {s.popularCourses && <PopularCourses />}
      {s.whyChooseUs && <WhyChooseUs />}
      {s.testimonials && <Testimonials />}
      {s.faq && <FAQ />}

      {/* CTA Band */}
      {s.ctaBand && (
        <div className="py-6 md:py-8 bg-background">
          <div className="w-full">
            <div
              className="relative overflow-hidden border-y border-[rgba(38,72,151,0.7)] shadow-[0_18px_50px_-30px_rgba(38,72,151,0.75)]"
              style={{ backgroundColor: "rgb(38,72,151)" }}
            >
              <div className="absolute inset-0 opacity-[0.05]" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                backgroundSize: "20px 20px"
              }} />
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-accent/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-accent/10 rounded-full blur-3xl" />

              <div className="relative z-10 px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-1.5 bg-primary-foreground/10 text-primary-foreground/80 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-3">
                    <Sparkles className="w-3 h-3" /> Get Started Today
                  </div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-primary-foreground tracking-tight">
                    Ready to Start Learning?
                  </h3>
                  <p className="text-primary-foreground/75 text-sm md:text-base mt-2 max-w-xl">
                    Join 50,000+ students already learning with Ednovate. Start your journey towards success today.
                  </p>
                </div>
                <Link to="/packages">
                  <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm px-8 h-11 rounded-xl gap-2 shadow-lg shadow-accent/25 hover:shadow-accent/40 transition-all hover:scale-[1.03] tap-bounce">
                    Browse Courses <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Index;
