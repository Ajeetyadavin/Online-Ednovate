import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import LoginModal from "@/components/LoginModal";
import confetti from "canvas-confetti";
import {
  PlayCircle,
  Clock,
  Globe,
  User,
  ShoppingCart,
  Check,
  ChevronRight,
  BookOpen,
  Download,
  Eye,
  IndianRupee,
  Star,
  ChevronDown,
  ChevronUp,
  Shield,
  Award,
  Headphones,
  GraduationCap,
  Phone,
  MessageCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { decodeVideoUrl, getYouTubeEmbedUrl } from "@/lib/video-utils";

const defaultContent = [
  { title: "Module 1 - Core Concepts", lectures: 25 },
  { title: "Module 2 - Advanced Topics", lectures: 30 },
  { title: "Module 3 - Practice & Revision", lectures: 20 },
];

const reviews = [
  { name: "Priya S.", rating: 5, comment: "Excellent course! The faculty explains concepts very clearly. Highly recommended for serious students.", date: "2 weeks ago" },
  { name: "Rahul M.", rating: 5, comment: "Best investment for my CA preparation. The combo pack covers everything needed.", date: "1 month ago" },
  { name: "Sneha K.", rating: 4, comment: "Good content and great value. The doubt solving feature is very helpful.", date: "1 month ago" },
  { name: "Amit V.", rating: 5, comment: "Cleared my exam in first attempt thanks to these lectures. Quality is top notch!", date: "2 months ago" },
];

const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { courses, getCurriculumForCourse } = usePlatformData();
  const { addToCart, removeFromCart, isInCart, isPurchased } = useCart();
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<"content" | "ratings" | "reviews">("content");
  const [openAccordion, setOpenAccordion] = useState<number | null>(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);

  const course = courses.find((c) => c.id === id);

  if (!course) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Course Not Found</h2>
          <p className="text-muted-foreground mb-4">The course you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const inCart = isInCart(course.id);
  const purchased = isPurchased(course.id);
  const content = useMemo(() => {
    const curriculum = getCurriculumForCourse(course.id, course.title);
    if (!curriculum || curriculum.length === 0) {
      return defaultContent;
    }

    return curriculum.map((chapter) => ({
      title: chapter.title,
      lectures: chapter.lessons.length,
    }));
  }, [course.id, course.title, getCurriculumForCourse]);

  const courseDemo = useMemo(() => {
    const dedicatedDemoUrl = decodeVideoUrl(course.demoVideoUrl || "");
    if (!course.demoVideoVisible || !dedicatedDemoUrl) {
      return null;
    }

    return {
      label: course.demoVideoTitle?.trim() || "Dedicated Course Demo",
      videoUrl: dedicatedDemoUrl,
      youtubeEmbedUrl: getYouTubeEmbedUrl(dedicatedDemoUrl),
      thumbnailUrl: course.demoVideoThumbnailUrl?.trim() || "",
    };
  }, [
    course.demoVideoTitle,
    course.demoVideoThumbnailUrl,
    course.demoVideoUrl,
    course.demoVideoVisible,
  ]);

  const totalLectures = content.reduce((sum, c) => sum + c.lectures, 0);
  const validityMonths = course.hours > 400 ? 18 : 12;
  const perHourCost = course.hours > 0 ? (course.price / course.hours).toFixed(2) : "0";

  const handleAddToCart = (e: React.MouseEvent) => {
    if (inCart) {
      removeFromCart(course.id);
    } else {
      addToCart(course);
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
        colors: ["#E53935", "#1A3A6E", "#FFD700", "#4CAF50"],
        scalar: 0.8,
        gravity: 1.1,
        ticks: 100,
      });
    }
  };

  const handleBuyNow = () => {
    if (!isLoggedIn) {
      if (!inCart) addToCart(course);
      setSignupMode(false);
      setLoginOpen(true);
      return;
    }

    if (!inCart) addToCart(course);
    navigate("/checkout");
  };

  return (
    <div className="pb-36 md:pb-0">

      {/* Breadcrumb */}
      <div className="bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <Link to="/packages" className="hover:text-primary transition-colors capitalize">{course.category.replace("-", " ")}</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{course.title}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="flex-1 min-w-0">
            {/* Course Banner */}
            <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-[rgb(38,72,151)] via-[rgba(38,72,151,0.9)] to-accent/60 aspect-video mb-6 group">
              {courseDemo ? (
                <>
                  {courseDemo.youtubeEmbedUrl ? (
                    <iframe
                      src={courseDemo.youtubeEmbedUrl}
                      title={`${course.title} demo video`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      controls
                      preload="metadata"
                      className="w-full h-full object-cover"
                      src={courseDemo.videoUrl}
                      poster={courseDemo.thumbnailUrl || undefined}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 pointer-events-none">
                    <p className="inline-flex items-center rounded-full bg-accent/90 text-accent-foreground text-[10px] font-bold px-2.5 py-1 uppercase tracking-wider mb-2">
                      Course Demo
                    </p>
                    <h2 className="text-primary-foreground text-lg sm:text-2xl font-bold mb-1">{course.title}</h2>
                    <p className="text-primary-foreground/80 text-xs sm:text-sm">
                      {courseDemo.label} • {course.professor}
                    </p>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                      <PlayCircle className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
                    </div>
                    <h2 className="text-primary-foreground text-lg sm:text-2xl font-bold mb-2">{course.title}</h2>
                    <p className="text-primary-foreground/70 text-sm">{course.professor}</p>
                  </div>
                </div>
              )}
              {course.discount > 0 && (
                <div className="absolute top-4 right-4 bg-accent text-accent-foreground text-xs font-bold px-3 py-1.5 rounded-lg animate-pulse shadow-lg">
                  {course.discount}% OFF
                </div>
              )}
              {course.isCombo && (
                <div className="absolute top-4 left-4 bg-primary-foreground text-primary text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
                  Combo Pack
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-border mb-6 gap-0">
              {[
                { key: "content" as const, label: "Course Content" },
                { key: "ratings" as const, label: "Ratings" },
                { key: "reviews" as const, label: "Reviews" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-3 text-sm font-semibold text-center transition-all duration-300 border-b-2 tap-bounce ${
                    activeTab === tab.key
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Description */}
            <div className="bg-card rounded-xl border border-border p-5 sm:p-6 mb-6">
              <p className="text-foreground/90 text-sm leading-relaxed mb-4">
                Dear Students,
              </p>
              <p className="text-foreground/80 text-sm leading-relaxed mb-3">
                This {course.title} course provides comprehensive coverage of all topics. 
                The course is designed for students preparing for the upcoming examination attempts.
              </p>
              <ul className="space-y-2 text-sm text-foreground/80 mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  Soft copy of notes will be provided
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  Online prelims and mock tests available
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  Recorded lectures are well updated and suitable for upcoming attempts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  24/7 doubt solving support available
                </li>
              </ul>
              <p className="text-muted-foreground text-xs">
                Helpline: 1800-XXX-XXXX (Toll Free)
              </p>
            </div>

            {/* Tab Content */}
            {activeTab === "content" && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground mb-1">Course Content</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {totalLectures} Lectures • {course.hours} hrs
                </p>
                <div className="space-y-2">
                  {content.map((section, idx) => (
                    <div key={idx} className="border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setOpenAccordion(openAccordion === idx ? null : idx)}
                        className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors tap-bounce"
                      >
                        <span className="font-semibold text-sm text-foreground text-left">{section.title}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{section.lectures} lectures</span>
                          {openAccordion === idx ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                      {openAccordion === idx && (
                        <div className="p-4 bg-card space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                          {Array.from({ length: Math.min(section.lectures, 5) }, (_, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                              <PlayCircle className="w-4 h-4 text-accent/60 shrink-0" />
                              <span>Lecture {i + 1}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {Math.floor(Math.random() * 40 + 30)} min
                              </span>
                            </div>
                          ))}
                          {section.lectures > 5 && (
                            <p className="text-xs text-muted-foreground pt-1">
                              + {section.lectures - 5} more lectures
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "ratings" && (
              <div className="mb-6">
                <div className="bg-card rounded-xl border border-border p-6 text-center">
                  <div className="text-5xl font-extrabold text-foreground mb-2">4.8</div>
                  <div className="flex justify-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-5 h-5 ${s <= 5 ? "fill-yellow-400 text-yellow-400" : "text-border"}`} />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">Based on {Math.floor(Math.random() * 200 + 100)} ratings</p>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const pct = star === 5 ? 72 : star === 4 ? 18 : star === 3 ? 6 : star === 2 ? 3 : 1;
                    return (
                      <div key={star} className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-foreground w-4">{star}</span>
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="mb-6 space-y-4">
                {reviews.map((review, idx) => (
                  <div key={idx} className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {review.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{review.name}</p>
                          <p className="text-xs text-muted-foreground">{review.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-border"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar - Sticky on Desktop, hidden on mobile (mobile has sticky bottom bar) */}
          <div className="hidden lg:block lg:w-[360px] shrink-0">
            <div className="sticky top-[76px] space-y-4">
              {/* Price Card */}
              <div className="bg-card rounded-xl border border-border p-5 sm:p-6 shadow-sm">
                <h1 className="text-xl font-bold text-foreground mb-3 leading-tight">{course.title}</h1>
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex -space-x-2">
                    {["P", "R", "S", "A"].map((initial, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-primary font-bold text-xs">
                        {initial}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">+200 enrolled</span>
                </div>

                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-3xl font-extrabold text-foreground">₹{course.price.toLocaleString()}</span>
                  {course.originalPrice > course.price && (
                    <span className="text-sm text-muted-foreground line-through">₹{course.originalPrice.toLocaleString()}</span>
                  )}
                </div>

                {purchased ? (
                  <Button
                    onClick={() => navigate(`/learn/${course.id}`)}
                    className="w-full h-11 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 tap-bounce"
                  >
                    <PlayCircle className="w-4 h-4 mr-1" /> Start Learning
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddToCart}
                      variant={inCart ? "default" : "outline"}
                      className={`flex-1 h-11 font-semibold tap-bounce transition-all duration-300 ${
                        inCart ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {inCart ? <Check className="w-4 h-4 mr-1" /> : <ShoppingCart className="w-4 h-4 mr-1" />}
                      {inCart ? "Added" : "Add to Cart"}
                    </Button>
                    <Button
                      onClick={handleBuyNow}
                      className="flex-1 h-11 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 tap-bounce"
                    >
                      Buy Now
                    </Button>
                  </div>
                )}

                {/* Course Meta */}
                <div className="space-y-3 pt-4 border-t border-border">
                  {[
                    { icon: PlayCircle, label: `${totalLectures} Lectures` },
                    { icon: Clock, label: `${course.hours} hrs on-demand video` },
                    { icon: Shield, label: `Valid Upto : ${validityMonths} Months`, bold: `${validityMonths} Months` },
                    { icon: Download, label: "Downloadable resources" },
                    { icon: Eye, label: "2 Times Views" },
                    { icon: IndianRupee, label: `₹${perHourCost} / Hour` },
                    { icon: Globe, label: `${course.language}  |  Full Course`, bold: "Full Course" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <item.icon className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-foreground/80">
                        {item.bold ? (
                          <>
                            {item.label.split(item.bold)[0]}
                            <span className="font-bold text-foreground">{item.bold}</span>
                            {item.label.split(item.bold)[1]}
                          </>
                        ) : (
                          item.label
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-around">
                <div className="text-center">
                  <Award className="w-6 h-6 text-accent mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground font-medium">Certified</span>
                </div>
                <div className="text-center">
                  <Shield className="w-6 h-6 text-primary mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground font-medium">Secure Pay</span>
                </div>
                <div className="text-center">
                  <Headphones className="w-6 h-6 text-accent mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground font-medium">24/7 Support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom - Cart bar + Footer nav combined */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        {/* Add to Cart & Buy Now */}
        <div className="bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {purchased ? (
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex flex-col mr-auto">
                <span className="text-sm font-semibold text-accent">✓ Purchased</span>
              </div>
              <Button
                onClick={() => navigate(`/learn/${course.id}`)}
                size="sm"
                className="h-9 px-6 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 tap-bounce"
              >
                <PlayCircle className="w-4 h-4 mr-1" /> Start Learning
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex flex-col mr-auto">
                <span className="text-lg font-extrabold text-foreground">₹{course.price.toLocaleString()}</span>
                {course.originalPrice > course.price && (
                  <span className="text-xs text-muted-foreground line-through">₹{course.originalPrice.toLocaleString()}</span>
                )}
              </div>
              <Button
                onClick={handleAddToCart}
                variant={inCart ? "default" : "outline"}
                size="sm"
                className={`h-9 px-4 font-semibold tap-bounce ${inCart ? "bg-primary text-primary-foreground" : ""}`}
              >
                {inCart ? <Check className="w-4 h-4 mr-1" /> : <ShoppingCart className="w-4 h-4 mr-1" />}
                {inCart ? "Added" : "Add to Cart"}
              </Button>
              <Button
                onClick={handleBuyNow}
                size="sm"
                className="h-9 px-4 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 tap-bounce"
              >
                Buy Now
              </Button>
            </div>
          )}
        </div>
        {/* Footer Nav */}
        <div className="bg-[rgb(38,72,151)] flex items-center justify-around py-2 border-t border-primary-foreground/10">
          <Link to="/" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
            <GraduationCap className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Home</span>
          </Link>
          <Link to="/packages" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
            <BookOpen className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Courses</span>
          </Link>
          <a href="tel:+919876543210" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
            <Phone className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Call Us</span>
          </a>
          <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
            <MessageCircle className="w-5 h-5" />
            <span className="text-[9px] font-semibold">WhatsApp</span>
          </a>
        </div>
      </div>

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        isSignup={signupMode}
        redirectPath="/checkout"
        onToggleMode={() => setSignupMode((prev) => !prev)}
      />
      
    </div>
  );
};

export default CourseDetails;
