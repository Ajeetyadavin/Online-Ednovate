import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSiteSettings } from "@/context/SiteSettingsContext";

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
  const { settings } = useSiteSettings();
  const faqTitle = settings.homepageContent?.faq?.title || "Frequently Asked Questions";
  const faqSubtitle = settings.homepageContent?.faq?.subtitle || "Answers to your most common questions";
  const faqsFromSettings = settings.homepageContent?.faq?.items || [];
  const displayFaqs = faqsFromSettings.length > 0
    ? faqsFromSettings.map((item) => ({ q: item.question, a: item.answer }))
    : faqs;

  return (
    <section className="py-8 md:py-10 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`text-center mb-8 reveal-up ${isVisible ? "visible" : ""}`}>
          <span className="text-primary text-sm font-extrabold uppercase tracking-widest">FAQs</span>
          <h2 className="section-title mt-2">{faqTitle}</h2>
          <p className="section-subtitle">{faqSubtitle}</p>
        </div>

        <div className={`max-w-2xl mx-auto reveal-up ${isVisible ? "visible" : ""}`} style={{ transitionDelay: "200ms" }}>
          <Accordion type="single" collapsible className="space-y-2">
            {displayFaqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-card border border-border rounded-xl px-5 data-[state=open]:border-primary/20 data-[state=open]:shadow-sm transition-all duration-300"
              >
                <AccordionTrigger className="text-base font-extrabold text-foreground hover:no-underline py-4 [&[data-state=open]>svg]:text-primary">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
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
