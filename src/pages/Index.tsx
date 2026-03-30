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
import DynamicHomepageSection from "@/components/DynamicHomepageSection";
import FacultySection from "@/components/FacultySection";
import { useSiteSettings, type HomepageSectionAnchor } from "@/context/SiteSettingsContext";

const Index = () => {
  const { settings } = useSiteSettings();
  const s = settings.sections;
  const sectionGapPxRaw = Number(settings.layout?.sectionGapPx || 0);
  // Keep homepage compact by default; admin can still increase spacing via Site Config.
  const sectionGapPx = Math.min(120, Math.max(-64, sectionGapPxRaw - 16));
  const visibleCustomSections = (settings.customHomepageSections || [])
    .filter((section) => section.visible)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const sectionNodes: React.ReactNode[] = [];

  const pushSection = (key: string, node: React.ReactNode) => {
    sectionNodes.push(
      <div key={key} style={{ marginTop: sectionNodes.length === 0 ? 0 : sectionGapPx }}>
        {node}
      </div>,
    );
  };

  const pushCustomSections = (anchor: HomepageSectionAnchor) => {
    visibleCustomSections
      .filter((section) => (section.insertAfter || "faq") === anchor)
      .forEach((section) => {
        pushSection(`custom-${anchor}-${section.id}`, <DynamicHomepageSection section={section} />);
      });
  };

  pushCustomSections("before-hero");
  if (s.heroBanner) pushSection("heroBanner", <HeroBanner />);
  pushCustomSections("heroBanner");
  if (s.announcementBar) pushSection("announcementBar", <AnnouncementBar />);
  pushCustomSections("announcementBar");
  if (s.statsCounter) pushSection("statsCounter", <StatsCounter />);
  pushCustomSections("statsCounter");
  if (s.howItWorks) pushSection("howItWorks", <HowItWorks />);
  pushCustomSections("howItWorks");
  if (s.popularCourses) pushSection("popularCourses", <PopularCourses />);
  pushCustomSections("popularCourses");
  if (s.whyChooseUs) pushSection("whyChooseUs", <WhyChooseUs />);
  pushCustomSections("whyChooseUs");
  if (s.testimonials) pushSection("testimonials", <Testimonials />);
  pushCustomSections("testimonials");
  pushSection("faculty", <FacultySection />);
  pushCustomSections("faculty");
  if (s.faq) pushSection("faq", <FAQ />);
  pushCustomSections("faq");

  if (s.ctaBand) {
    pushSection(
      "ctaBand",
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
                <h3 className="text-xl md:text-3xl font-extrabold text-primary-foreground tracking-tight">
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
      </div>,
    );
  }
  pushCustomSections("ctaBand");

  visibleCustomSections
    .filter((section) => !section.insertAfter)
    .forEach((section) => {
      pushSection(`custom-trailing-${section.id}`, <DynamicHomepageSection section={section} />);
    });

  return (
    <>{sectionNodes}</>
  );
};

export default Index;
