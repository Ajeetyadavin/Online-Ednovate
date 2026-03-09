import { Search, ShoppingCart, PlayCircle, Award } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const steps = [
  {
    icon: Search,
    title: "Browse Courses",
    desc: "Explore our wide range of CA, CS & CMA courses",
  },
  {
    icon: ShoppingCart,
    title: "Enroll Instantly",
    desc: "Quick checkout with secure payment options",
  },
  {
    icon: PlayCircle,
    title: "Start Learning",
    desc: "Access video lectures, notes & materials anytime",
  },
  {
    icon: Award,
    title: "Ace Your Exams",
    desc: "Clear exams with confidence & top ranks",
  },
];

const HowItWorks = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  return (
    <section className="py-8 md:py-10 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div ref={ref} className={`text-center mb-8 reveal-up ${isVisible ? "visible" : ""}`}>
          <span className="text-accent text-xs font-bold uppercase tracking-widest">Simple Process</span>
          <h2 className="section-title mt-2">
            How It <span className="text-accent">Works</span>
          </h2>
          <p className="section-subtitle">Start your learning journey in 4 simple steps</p>
        </div>

        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 stagger-children ${isVisible ? "visible" : ""}`}>
          {steps.map((step, i) => (
            <div key={step.title} className="relative group">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-border to-transparent z-0" />
              )}
              
              <div className="relative z-10 text-center p-4 sm:p-6 rounded-2xl bg-card border border-border hover:border-accent/20 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 tap-bounce">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
                  {i + 1}
                </div>
                
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/8 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <h3 className="font-bold text-sm sm:text-[15px] text-foreground mb-1">{step.title}</h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
