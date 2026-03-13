import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How long can I access the courses?",
    a: "You can access your enrolled courses unlimited times until the validity period ends. Most courses are valid until the exam date.",
  },
  {
    q: "Are demo classes available?",
    a: "Yes! Free demo lectures are available for every course. Visit the course details page to watch the demo.",
  },
  {
    q: "What payment options are available?",
    a: "We accept UPI, Credit/Debit Cards, Net Banking, and EMI options. All payments are secure and encrypted.",
  },
  {
    q: "Will the courses work on mobile?",
    a: "Absolutely! All courses run smoothly on mobile, tablet, and desktop. Learn anytime, anywhere.",
  },
  {
    q: "What is the refund policy?",
    a: "If you're not satisfied within 7 days of starting the course, you'll get a full refund. Terms & Conditions apply.",
  },
];

const FAQ = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  return (
    <section className="py-8 md:py-10 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`text-center mb-8 reveal-up ${isVisible ? "visible" : ""}`}>
          <span className="text-primary text-sm font-extrabold uppercase tracking-widest">FAQs</span>
          <h2 className="section-title mt-2">
            Frequently Asked <span className="text-primary">Questions</span>
          </h2>
          <p className="section-subtitle">Answers to your most common questions</p>
        </div>

        <div className={`max-w-2xl mx-auto reveal-up ${isVisible ? "visible" : ""}`} style={{ transitionDelay: "200ms" }}>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-card border border-border rounded-xl px-5 data-[state=open]:border-primary/20 data-[state=open]:shadow-sm transition-all duration-300"
              >
                <AccordionTrigger className="text-base font-extrabold text-foreground hover:no-underline py-4 [&[data-state=open]>svg]:text-primary">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm font-semibold text-foreground leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
