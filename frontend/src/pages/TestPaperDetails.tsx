import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, BookOpen, Check, ChevronRight, Clock, FileText, Globe, GraduationCap, Headphones, IndianRupee, ListChecks, MessageCircle, Phone, Shield, ShoppingCart, Target } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";

const TestPaperDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { testPapers, categories } = usePlatformData();
  const { settings } = useSiteSettings();
  const { addToCart, removeFromCart, isInCart } = useCart();

  const paper = testPapers.find((item) => item.id === id);
  const inCart = paper ? isInCart(paper.id) : false;

  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const courseName = paper ? categoryById.get(paper.courseId)?.name || "Test Series" : "";
  const levelName = paper ? categoryById.get(paper.levelId)?.name || "" : "";
  const subjectName = (() => {
    if (!paper?.subjectId) return "";
    const subjects = Array.isArray(settings.courseMasters?.subjects) ? settings.courseMasters.subjects : [];
    const subject = subjects.find((item: any) => item.id === paper.subjectId);
    return subject?.name || paper.subjectId;
  })();
  const chapterName = (() => {
    if (!paper?.subjectId || !paper.chapterId) return "";
    const subjects = Array.isArray(settings.courseMasters?.subjects) ? settings.courseMasters.subjects : [];
    const subject = subjects.find((item: any) => item.id === paper.subjectId);
    const chapter = Array.isArray(subject?.chapters)
      ? subject.chapters.find((item: any) => (item.id || item.name) === paper.chapterId)
      : null;
    return chapter?.name || paper.chapterId;
  })();

  if (!paper) {
    return (
      <div className="min-h-[60vh] bg-secondary px-4 py-20 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8 shadow-sm">
          <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-black text-foreground">Test paper not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This test series is not available right now.</p>
          <Button className="mt-5" onClick={() => navigate("/test-series")}>Back to Test Series</Button>
        </div>
      </div>
    );
  }

  const thumbnailUrl = resolveUploadAssetUrl(paper.thumbnailUrl || "", "/placeholder.svg");
  const discount = paper.originalPrice && paper.originalPrice > paper.price
    ? Math.round(((paper.originalPrice - paper.price) / paper.originalPrice) * 100)
    : 0;

  const handleAddToCart = () => {
    if (inCart) {
      removeFromCart(paper.id);
      return;
    }
    addToCart(paper);
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.75 }, colors: ["#E53935", "#1A3A6E", "#FFD700"] });
  };

  const handleBuyNow = () => {
    if (!inCart) addToCart(paper);
    navigate("/checkout");
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/test-series");
  };

  const metaItems = [
    { icon: Clock, label: "Duration", value: `${paper.totalTime} Minutes` },
    { icon: Target, label: "Passing", value: `${paper.passingPercent}%` },
    { icon: Globe, label: "Attempts", value: paper.attemptsAllowed > 1 ? `${paper.attemptsAllowed} Attempts` : "Single Attempt" },
    { icon: ListChecks, label: "Nature", value: paper.nature || "Objective" },
  ];

  return (
    <div className="bg-background pb-36 lg:pb-12">
      <div className="border-b border-border bg-secondary/50">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:text-sm">
          <button
            type="button"
            onClick={handleBack}
            className="mr-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-primary/15 bg-background px-3 text-[11px] font-bold text-primary shadow-sm active:scale-95 md:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <Link to="/" className="hover:text-accent">Home</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link to="/test-series" className="hover:text-accent">Test Series</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[220px] truncate font-medium text-foreground">{paper.title}</span>
        </div>
      </div>

      <section>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:py-8">
          <div className="min-w-0 flex-1 space-y-5">
            <div className="overflow-hidden rounded-xl border border-border bg-secondary shadow-sm">
              <div className="relative aspect-video">
                <img src={thumbnailUrl} alt={paper.title} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">{paper.nature}</span>
                {discount > 0 && <span className="rounded-md bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">{discount}% OFF</span>}
              </div>
              <h1 className="max-w-3xl text-xl font-black leading-tight text-foreground sm:text-3xl lg:text-4xl">{paper.title}</h1>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {metaItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                  <item.icon className="mb-2 h-5 w-5 text-accent" />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-black text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h2 className="mb-3 text-lg font-black text-foreground">About This Test Series</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {paper.description || "Practice with a structured test paper designed for exam preparation. Review your readiness with timed attempts and clear passing criteria."}
              </p>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl bg-secondary p-3">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Course</span>
                  <p className="font-bold text-foreground">{courseName}</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Level</span>
                  <p className="font-bold text-foreground">{levelName || "All Levels"}</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Subject</span>
                  <p className="font-bold text-foreground">{subjectName || "All Subjects"}</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Chapter</span>
                  <p className="font-bold text-foreground">{chapterName || "Selected Chapters"}</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="hidden w-[360px] shrink-0 space-y-4 lg:block lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground">₹{paper.price.toLocaleString()}</span>
                  {paper.originalPrice && paper.originalPrice > paper.price && (
                    <span className="text-sm font-semibold text-muted-foreground line-through">₹{paper.originalPrice.toLocaleString()}</span>
                  )}
                </div>
                {discount > 0 && <p className="mt-1 text-xs font-bold text-emerald-600">You save ₹{((paper.originalPrice || 0) - paper.price).toLocaleString()}</p>}
              </div>

              <div className="mb-4 space-y-3 border-y border-border py-4">
                {metaItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <item.icon className="h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">{item.label}:</span>
                    <span className="ml-auto font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant={inCart ? "default" : "outline"} className="h-11 font-bold" onClick={handleAddToCart}>
                  {inCart ? <Check className="mr-1 h-4 w-4" /> : <ShoppingCart className="mr-1 h-4 w-4" />}
                  {inCart ? "Added" : "Add"}
                </Button>
                <Button className="h-11 bg-accent font-bold text-accent-foreground hover:bg-accent/90" onClick={handleBuyNow}>
                  Buy Now
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-around">
                <div className="text-left">
                  <Award className="mb-1 h-6 w-6 text-accent" />
                  <span className="text-[10px] font-medium text-muted-foreground">Exam Ready</span>
                </div>
                <div className="text-left">
                  <Shield className="mb-1 h-6 w-6 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground">Secure Pay</span>
                </div>
                <div className="text-left">
                  <IndianRupee className="mb-1 h-6 w-6 text-accent" />
                  <span className="text-[10px] font-medium text-muted-foreground">Instant Access</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="border-t border-border bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="mr-auto flex min-w-0 flex-col">
                <span className="text-lg font-extrabold text-foreground">₹{paper.price.toLocaleString()}</span>
                {paper.originalPrice && paper.originalPrice > paper.price && (
                  <span className="text-xs text-muted-foreground line-through">₹{paper.originalPrice.toLocaleString()}</span>
                )}
              </div>
              <Button
                onClick={handleAddToCart}
                variant={inCart ? "default" : "outline"}
                size="sm"
                className={`h-9 px-4 font-semibold tap-bounce ${inCart ? "bg-primary text-primary-foreground" : ""}`}
              >
                {inCart ? <Check className="mr-1 h-4 w-4" /> : <ShoppingCart className="mr-1 h-4 w-4" />}
                {inCart ? "Added" : "Add"}
              </Button>
              <Button
                onClick={handleBuyNow}
                size="sm"
                className="h-9 px-4 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 tap-bounce"
              >
                Buy Now
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-around border-t border-primary-foreground/10 bg-[rgb(38,72,151)] py-2">
          <Link to="/" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 transition-all hover:text-accent tap-bounce active:scale-110">
            <GraduationCap className="h-5 w-5" />
            <span className="text-[9px] font-semibold">Home</span>
          </Link>
          <Link to="/packages" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 transition-all hover:text-accent tap-bounce active:scale-110">
            <BookOpen className="h-5 w-5" />
            <span className="text-[9px] font-semibold">Courses</span>
          </Link>
          <a href="tel:+919876543210" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 transition-all hover:text-accent tap-bounce active:scale-110">
            <Phone className="h-5 w-5" />
            <span className="text-[9px] font-semibold">Call Us</span>
          </a>
          <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 transition-all hover:text-accent tap-bounce active:scale-110">
            <MessageCircle className="h-5 w-5" />
            <span className="text-[9px] font-semibold">WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TestPaperDetails;
