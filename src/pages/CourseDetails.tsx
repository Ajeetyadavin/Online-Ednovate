import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import LoginModal from "@/components/LoginModal";
import VideoPlayer from "@/components/VideoPlayer";
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
import { useEffect, useMemo, useState } from "react";
import { type ManagedCourse, usePlatformData } from "@/context/PlatformDataContext";
import { decodeVideoUrl, getYouTubeEmbedUrl } from "@/lib/video-utils";
import { getBunnyStreamVideoUrl } from "@/lib/bunnystream-api";
import { adminApi } from "@/services/adminApi";

const defaultContent = [
  { title: "Module 1 - Core Concepts", lectures: 25 },
  { title: "Module 2 - Advanced Topics", lectures: 30 },
  { title: "Module 3 - Practice & Revision", lectures: 20 },
];

const defaultReviews = [
  { name: "Priya S.", rating: 5, comment: "Excellent course! The faculty explains concepts very clearly. Highly recommended for serious students.", date: "2 weeks ago" },
  { name: "Rahul M.", rating: 5, comment: "Best investment for my CA preparation. The combo pack covers everything needed.", date: "1 month ago" },
  { name: "Sneha K.", rating: 4, comment: "Good content and great value. The doubt solving feature is very helpful.", date: "1 month ago" },
  { name: "Amit V.", rating: 5, comment: "Cleared my exam in first attempt thanks to these lectures. Quality is top notch!", date: "2 months ago" },
];

const FALLBACK_COURSE: ManagedCourse = {
  id: "",
  title: "",
  category: "general",
  subcategory: "general",
  language: "English",
  lectures: 0,
  hours: 0,
  price: 0,
  originalPrice: 0,
  discount: 0,
  image: "/placeholder.svg",
  thumbnail: "",
  professor: "",
  isVisible: false,
  viewPricingEnabled: false,
  unlimitedViewsEnabled: false,
  validityPricingEnabled: false,
  viewOptions: [1, 2],
  validityOptionsDays: [30, 90, 180],
  selectedViews: 1,
  selectedValidityDays: 30,
  deliveryModePricingEnabled: false,
  deliveryModes: [],
  selectedDeliveryModeId: "online",
  selectedDeliveryModeIds: [],
  bookAddonEnabled: false,
  bookAddons: [],
  selectedBookAddonIds: [],
  aboutCourseEnabled: false,
  aboutCourseText: "",
  ratingsEnabled: true,
  reviewsEnabled: true,
  ratingValue: 4.8,
  ratingCount: 0,
  reviews: [],
  enrollmentCount: 0,
  showEnrollmentCount: true,
  showMetaLectures: true,
  showMetaHours: true,
  showMetaValidity: true,
  showMetaResources: true,
  showMetaViews: true,
  showMetaPerHour: true,
  showMetaLanguage: true,
  isCombo: false,
  isMaterial: false,
  packageCourseIds: [],
};

const parseLessonDurationToSeconds = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return 0;

  if (raw.includes(":")) {
    const parts = raw.split(":").map((item) => Number(item.trim()));
    if (parts.some((item) => !Number.isFinite(item) || item < 0)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Math.floor(Number(raw) * 60);
  }

  const hours = Number((raw.match(/(\d+(?:\.\d+)?)\s*h/) || [])[1] || 0);
  const minutes = Number((raw.match(/(\d+(?:\.\d+)?)\s*m/) || [])[1] || 0);
  const seconds = Number((raw.match(/(\d+(?:\.\d+)?)\s*s/) || [])[1] || 0);
  return Math.max(0, Math.floor(hours * 3600 + minutes * 60 + seconds));
};

const formatSecondsToHms = (seconds: number) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hrs, mins, secs].map((item) => String(item).padStart(2, "0")).join(":");
};

const formatDaysToValidityLabel = (days: number) => {
  const normalized = Math.max(1, Math.floor(Number(days) || 1));
  if (normalized % 30 === 0) {
    const months = Math.max(1, normalized / 30);
    return `${months} Month${months > 1 ? "s" : ""}`;
  }
  return `${normalized} Days`;
};

const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { courses, getCurriculumForCourse } = usePlatformData();
  const { addToCart, removeFromCart, isInCart, isPurchased } = useCart();
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<"content" | "ratings" | "reviews">("content");
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const [openPackageCourseId, setOpenPackageCourseId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [selectedViews, setSelectedViews] = useState<number>(1);
  const [selectedValidityDays, setSelectedValidityDays] = useState<number>(30);
  const [selectedDeliveryModeIds, setSelectedDeliveryModeIds] = useState<string[]>([]);
  const [selectedBookAddonIds, setSelectedBookAddonIds] = useState<string[]>([]);
  const [openDesktopOptionSections, setOpenDesktopOptionSections] = useState({
    modes: true,
    books: false,
    views: false,
    validity: false,
  });
  const [openMobileOptionSections, setOpenMobileOptionSections] = useState({
    modes: false,
    books: false,
    views: false,
    validity: false,
  });
  const [showMobileConfigurator, setShowMobileConfigurator] = useState(false);

  const toggleDesktopOptionSection = (section: "modes" | "books" | "views" | "validity") => {
    setOpenDesktopOptionSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleMobileOptionSection = (section: "modes" | "books" | "views" | "validity") => {
    setOpenMobileOptionSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const matchedCourse = courses.find((c) => c.id === id);
  const course = matchedCourse ?? FALLBACK_COURSE;

  const inCart = isInCart(course.id);
  const purchased = isPurchased(course.id);
  const curriculum = useMemo(() => getCurriculumForCourse(course.id, course.title), [course.id, course.title, getCurriculumForCourse]);

  const content = useMemo(() => {
    if (!curriculum || curriculum.length === 0) {
      return defaultContent;
    }

    return curriculum.map((chapter) => ({
      title: chapter.title,
      lectures: chapter.lessons.length,
    }));
  }, [curriculum]);

  const bundledCourses = useMemo(() => {
    if (!course.isCombo || !Array.isArray(course.packageCourseIds) || course.packageCourseIds.length === 0) {
      return [];
    }
    return course.packageCourseIds
      .map((courseId) => courses.find((item) => item.id === courseId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [course.isCombo, course.packageCourseIds, courses]);

  const packageContent = useMemo(() => {
    if (!course.isCombo) return [];
    return bundledCourses.map((bundled) => {
      const bundledCurriculum = getCurriculumForCourse(bundled.id, bundled.title);
      const chapters = Array.isArray(bundledCurriculum) ? bundledCurriculum : [];
      const chapterItems = chapters.map((chapter, chapterIndex) => {
        const chapterLessons = Array.isArray(chapter.lessons) ? chapter.lessons : [];
        const videoSeconds = chapterLessons.reduce((sum, lesson) => {
          if (String(lesson?.type || "video").toLowerCase() !== "video") return sum;
          return sum + parseLessonDurationToSeconds(lesson.duration);
        }, 0);

        return {
          id: `${bundled.id}-chapter-${chapterIndex + 1}`,
          title: String(chapter.title || `Chapter ${chapterIndex + 1}`),
          lessonsCount: chapterLessons.length,
          videoSeconds,
        };
      });

      const totalSeconds = chapterItems.reduce((sum, chapter) => {
        return sum + chapter.videoSeconds;
      }, 0);
      const totalLectures = chapterItems.reduce((sum, chapter) => sum + chapter.lessonsCount, 0);

      return {
        id: bundled.id,
        title: bundled.title,
        chapters: chapterItems,
        totalLectures,
        totalDurationLabel: formatSecondsToHms(totalSeconds),
      };
    });
  }, [course.isCombo, bundledCourses, getCurriculumForCourse]);

  const totalVideoSeconds = useMemo(() => {
    if (!curriculum || curriculum.length === 0) {
      return Math.max(0, Math.round(Number(course.hours || 0) * 3600));
    }
    return curriculum.reduce((chapterSum, chapter) => {
      const chapterSeconds = (Array.isArray(chapter.lessons) ? chapter.lessons : []).reduce((lessonSum, lesson) => {
        if (lesson?.type !== "video") return lessonSum;
        return lessonSum + parseLessonDurationToSeconds(lesson.duration);
      }, 0);
      return chapterSum + chapterSeconds;
    }, 0);
  }, [curriculum, course.hours]);

  const totalDurationLabel = useMemo(() => formatSecondsToHms(totalVideoSeconds), [totalVideoSeconds]);
  const derivedCourseHours = useMemo(() => totalVideoSeconds / 3600, [totalVideoSeconds]);

  const siteSettings = useSiteSettings();
  const bunnyStreamConfig = useMemo(() => {
    if (siteSettings?.settings?.bunnyStreamApi) {
      return {
        enabled: siteSettings.settings.bunnyStreamApi.enabled,
        libraryId: siteSettings.settings.bunnyStreamApi.libraryId,
        apiKey: siteSettings.settings.bunnyStreamApi.apiKey,
        cdnHostname: siteSettings.settings.bunnyStreamApi.cdnHostname,
        pullZone: siteSettings.settings.bunnyStreamApi.pullZone,
      };
    }
    return { enabled: false, libraryId: "", apiKey: "", cdnHostname: "", pullZone: "" };
  }, [siteSettings?.settings?.bunnyStreamApi]);

  const courseDemo = useMemo(() => {
    const dedicatedDemoUrl = decodeVideoUrl(course.demoVideoUrl || "");
    if (!course.demoVideoVisible || !dedicatedDemoUrl) {
      return null;
    }

    // Determine the actual playback URL based on source type
    let playbackUrl = dedicatedDemoUrl;
    let sourceType: "youtube" | "direct" | "upload" = course.demoVideoSource || "direct";

    if (sourceType === "upload" && bunnyStreamConfig.enabled && bunnyStreamConfig.cdnHostname) {
      // For Bunny Stream uploads, construct the CDN URL from the GUID
      playbackUrl = getBunnyStreamVideoUrl(dedicatedDemoUrl, bunnyStreamConfig);
    }

    return {
      label: course.demoVideoTitle?.trim() || "Dedicated Course Demo",
      videoUrl: dedicatedDemoUrl,
      playbackUrl: playbackUrl,
      sourceType: sourceType,
      youtubeEmbedUrl: sourceType === "youtube" ? getYouTubeEmbedUrl(dedicatedDemoUrl) : null,
      thumbnailUrl: course.demoVideoThumbnailUrl?.trim() || "",
    };
  }, [
    course.demoVideoTitle,
    course.demoVideoThumbnailUrl,
    course.demoVideoUrl,
    course.demoVideoVisible,
    course.demoVideoSource,
    bunnyStreamConfig,
  ]);

  const totalLectures = content.reduce((sum, c) => sum + c.lectures, 0);
  const totalPackageLectures = useMemo(
    () => packageContent.reduce((sum, item) => sum + item.totalLectures, 0),
    [packageContent],
  );
  const totalPackageSeconds = useMemo(
    () => packageContent.reduce((sum, item) => sum + parseLessonDurationToSeconds(item.totalDurationLabel), 0),
    [packageContent],
  );
  const totalPackageDurationLabel = useMemo(
    () => formatSecondsToHms(totalPackageSeconds),
    [totalPackageSeconds],
  );
  const showRatings = course.ratingsEnabled !== false;
  const showReviews = course.reviewsEnabled !== false;
  const effectiveRatingValue = Math.max(0, Math.min(5, Number(course.ratingValue || 4.8)));
  const effectiveRatingCount = Math.max(0, Number(course.ratingCount || 0));
  const effectiveReviews = Array.isArray(course.reviews) && course.reviews.length > 0 ? course.reviews : defaultReviews;
  const availableTabs: Array<{ key: "content" | "ratings" | "reviews"; label: string }> = [
    { key: "content", label: course.isCombo ? "Package Content" : "Course Content" },
    ...(showRatings ? [{ key: "ratings" as const, label: "Ratings" }] : []),
    ...(showReviews ? [{ key: "reviews" as const, label: "Reviews" }] : []),
  ];
  const viewOptions = useMemo(
    () =>
      (course.viewOptions && course.viewOptions.length > 0 ? course.viewOptions : [1, 2])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1),
    [course.viewOptions],
  );
  const validityOptionsDays = useMemo(
    () =>
      (course.validityOptionsDays && course.validityOptionsDays.length > 0
        ? course.validityOptionsDays
        : [30, 90, 180]
      )
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1),
    [course.validityOptionsDays],
  );
  const backendDefaultValidityDays = useMemo(() => {
    const configured = Math.max(1, Number(course.selectedValidityDays || 0));
    if (configured > 0) return configured;
    return Math.max(1, Number(validityOptionsDays[0] || 30));
  }, [course.selectedValidityDays, validityOptionsDays]);
  const deliveryModes = useMemo(
    () =>
      Array.isArray(course.deliveryModes)
        ? course.deliveryModes.filter((mode) => mode && mode.id && Number(mode.price) > 0)
        : [],
    [course.deliveryModes],
  );
  const enabledBookAddons = useMemo(
    () =>
      Array.isArray(course.bookAddons)
        ? course.bookAddons.filter((addon) => addon && addon.enabled !== false)
        : [],
    [course.bookAddons],
  );

  useEffect(() => {
    const defaultViews = Math.max(1, Number(course.selectedViews || viewOptions[0] || 1));
    setSelectedViews(defaultViews);
  }, [course.id, course.selectedViews, viewOptions]);

  useEffect(() => {
    setSelectedValidityDays(backendDefaultValidityDays);
  }, [course.id]);

  useEffect(() => {
    const stored = Array.isArray(course.selectedDeliveryModeIds) ? course.selectedDeliveryModeIds : [];
    const fallback = String(course.selectedDeliveryModeId || "").trim();
    const defaults = stored.length > 0 ? stored : fallback ? [fallback] : deliveryModes[0]?.id ? [deliveryModes[0].id] : [];
    setSelectedDeliveryModeIds(defaults);
  }, [course.id, course.selectedDeliveryModeIds, course.selectedDeliveryModeId, deliveryModes]);

  useEffect(() => {
    const defaults = Array.isArray(course.selectedBookAddonIds) ? course.selectedBookAddonIds : [];
    setSelectedBookAddonIds(defaults);
  }, [course.id, course.selectedBookAddonIds]);

  useEffect(() => {
    // Keep chapter lessons hidden by default until user explicitly opens a chapter.
    setOpenAccordion(null);
    setOpenPackageCourseId(null);
  }, [course.id]);

  const selectedDeliveryModes = course.deliveryModePricingEnabled
    ? deliveryModes.filter((mode) => selectedDeliveryModeIds.includes(mode.id))
    : [];
  const modeBasePrice = selectedDeliveryModes.length > 0
    ? selectedDeliveryModes.reduce((sum, mode) => sum + Number(mode.price || 0), 0)
    : course.price;
  const modeBaseOriginalPrice = selectedDeliveryModes.length > 0
    ? selectedDeliveryModes.reduce(
        (sum, mode) => sum + Number(mode.originalPrice || mode.price || 0),
        0,
      )
    : course.originalPrice;
  const selectedBookAddons = course.bookAddonEnabled
    ? enabledBookAddons.filter((addon) => selectedBookAddonIds.includes(addon.id))
    : [];
  const bookAddOnPrice = selectedBookAddons.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
  const viewMultiplier = course.viewPricingEnabled ? selectedViews : 1;
  const baseOnDemandSeconds = course.isCombo ? totalPackageSeconds : totalVideoSeconds;
  const effectiveOnDemandSeconds = Math.max(0, Math.round(baseOnDemandSeconds * viewMultiplier));
  const effectiveOnDemandLabel = formatSecondsToHms(effectiveOnDemandSeconds);
  const effectiveValidityDays = course.validityPricingEnabled ? selectedValidityDays : backendDefaultValidityDays;
  const validityMultiplier = course.validityPricingEnabled ? effectiveValidityDays / 30 : 1;
  const dynamicPrice = Math.round((modeBasePrice * viewMultiplier * validityMultiplier) + bookAddOnPrice);
  const dynamicOriginalPrice = Math.round((modeBaseOriginalPrice * viewMultiplier * validityMultiplier) + bookAddOnPrice);
  const effectiveHours = derivedCourseHours > 0 ? derivedCourseHours : Number(course.hours || 0);
  const perHourCost = effectiveHours > 0 ? (dynamicPrice / effectiveHours).toFixed(2) : "0";
  const effectiveEnrollmentCount = Math.max(0, Number(course.enrollmentCount || 0));
  const showEnrollmentCount = course.showEnrollmentCount !== false;
  const validityLabel = formatDaysToValidityLabel(effectiveValidityDays);
  const sidebarMetaItems = [
    course.showMetaLectures !== false
      ? { icon: PlayCircle, label: `${totalLectures} Lectures` }
      : null,
    course.showMetaHours !== false
      ? { icon: Clock, label: `${effectiveOnDemandLabel} on-demand video` }
      : null,
    course.showMetaValidity !== false
      ? { icon: Shield, label: `Valid Upto : ${validityLabel}`, bold: validityLabel }
      : null,
    course.showMetaResources !== false
      ? { icon: Download, label: "Downloadable resources" }
      : null,
    course.showMetaViews !== false
      ? { icon: Eye, label: course.viewPricingEnabled ? `${selectedViews} Times Views` : "Unlimited Views" }
      : null,
    course.showMetaPerHour !== false
      ? { icon: IndianRupee, label: `₹${perHourCost} / Hour` }
      : null,
    course.showMetaLanguage !== false
      ? { icon: Globe, label: `${course.language}  |  Full Course`, bold: "Full Course" }
      : null,
  ].filter(Boolean) as Array<{ icon: typeof PlayCircle; label: string; bold?: string }>;

  const buildConfiguredCourse = () => ({
    ...course,
    selectedViews: course.viewPricingEnabled ? selectedViews : 1,
    selectedValidityDays: effectiveValidityDays,
    selectedDeliveryModeId: selectedDeliveryModeIds[0] || "online",
    selectedDeliveryModeIds: course.deliveryModePricingEnabled ? selectedDeliveryModeIds : [],
    selectedBookAddonIds: course.bookAddonEnabled ? selectedBookAddonIds : [],
    price: dynamicPrice,
    originalPrice: dynamicOriginalPrice,
  });

  const aboutCourseLines = useMemo(
    () =>
      String(course.aboutCourseText || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [course.aboutCourseText],
  );

  useEffect(() => {
    if (!course?.id) return;
    adminApi.trackEvent("course_view", course.id, undefined, {
      courseTitle: course.title,
      category: course.category,
    }).catch(() => {
      // Keep UX uninterrupted if analytics call fails.
    });
  }, [course?.id, course?.title, course?.category]);

  useEffect(() => {
    if (!course?.id || !courseDemo?.videoUrl) return;
    adminApi.trackEvent("demo_view", course.id, undefined, {
      source: courseDemo.youtubeEmbedUrl ? "youtube" : "direct",
    }).catch(() => {
      // Keep UX uninterrupted if analytics call fails.
    });
  }, [course?.id, courseDemo?.videoUrl, courseDemo?.youtubeEmbedUrl]);

  useEffect(() => {
    const tabExists = availableTabs.some((tab) => tab.key === activeTab);
    if (!tabExists) {
      setActiveTab("content");
    }
  }, [activeTab, availableTabs]);

  const handleAddToCart = (e: React.MouseEvent) => {
    if (inCart) {
      removeFromCart(course.id);
    } else {
      addToCart(buildConfiguredCourse());
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
      addToCart(buildConfiguredCourse());
      setSignupMode(false);
      setLoginOpen(true);
      return;
    }

    addToCart(buildConfiguredCourse());
    navigate("/checkout");
  };

  const toggleDeliveryModeSelection = (modeId: string, checked: boolean) => {
    setSelectedDeliveryModeIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, modeId]));
      }
      // Keep at least one mode selected.
      if (prev.includes(modeId) && prev.length === 1) {
        return prev;
      }
      return prev.filter((id) => id !== modeId);
    });
  };

  if (!matchedCourse) {
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
            {courseDemo ? (
              <div>
                <VideoPlayer
                  videoUrl={courseDemo.videoUrl}
                  source={courseDemo.sourceType}
                  poster={courseDemo.thumbnailUrl || undefined}
                  aspectRatio="aspect-video"
                  controls={true}
                />
                {/* Demo Info Below Video */}
                <div className="mt-3 mb-8 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
                  <p className="inline-flex items-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-3 py-1.5 uppercase tracking-wider mb-3">
                    Course Demo
                  </p>
                  <h2 className="text-foreground text-xl sm:text-2xl font-extrabold mb-1.5 leading-tight">{course.title}</h2>
                  <p className="text-foreground/85 text-sm sm:text-base font-medium">
                    {courseDemo.label}
                  </p>
                  <p className="text-muted-foreground text-sm mt-1">
                    Faculty: {course.professor}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-[rgb(38,72,151)] via-[rgba(38,72,151,0.9)] to-accent/60 aspect-video mb-6 group flex items-center justify-center">
                {(course.thumbnail || course.image) && (
                  <img
                    src={course.thumbnail || course.image || "/placeholder.svg"}
                    alt={course.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.endsWith("/placeholder.svg")) return;
                      target.src = "/placeholder.svg";
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent" />
                <div className="relative text-center p-6 z-10">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                    <PlayCircle className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
                  </div>
                  <h2 className="text-primary-foreground text-lg sm:text-2xl font-bold mb-2">{course.title}</h2>
                  <p className="text-primary-foreground/70 text-sm">{course.professor}</p>
                </div>
                {course.discount > 0 && (
                  <div className="absolute top-4 right-4 bg-accent text-accent-foreground text-xs font-bold px-3 py-1.5 rounded-lg animate-pulse shadow-lg z-20">
                    {course.discount}% OFF
                  </div>
                )}
                {course.isCombo && (
                  <div className="absolute top-4 left-4 bg-primary-foreground text-primary text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider z-20">
                    Combo Pack
                  </div>
                )}
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-border mb-6 gap-0">
              {availableTabs.map((tab) => (
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
            {course.aboutCourseEnabled && aboutCourseLines.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5 sm:p-6 mb-6">
                <h3 className="text-base font-bold text-foreground mb-3">About Course</h3>
                <div className="space-y-2 text-sm text-foreground/85 leading-relaxed">
                  {aboutCourseLines.map((line, index) => {
                    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
                    const content = isBullet ? line.replace(/^[•\-*]\s*/, "") : line;
                    if (isBullet) {
                      return (
                        <div key={`${index}-${content.slice(0, 10)}`} className="flex items-start gap-2">
                          <span className="text-accent mt-0.5">•</span>
                          <span>{content}</span>
                        </div>
                      );
                    }
                    return <p key={`${index}-${content.slice(0, 10)}`}>{content}</p>;
                  })}
                </div>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === "content" && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground mb-1">{course.isCombo ? "Package Content" : "Course Content"}</h3>
                {course.isCombo ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      {bundledCourses.length} Courses • {totalPackageLectures} Lessons • {effectiveOnDemandLabel}
                    </p>
                    <div className="space-y-2">
                      {packageContent.length === 0 ? (
                        <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                          Package me abhi bundled courses add nahi hain.
                        </div>
                      ) : (
                        packageContent.map((item) => (
                          <div key={item.id} className="border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => setOpenPackageCourseId(openPackageCourseId === item.id ? null : item.id)}
                              className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors tap-bounce"
                            >
                              <span className="font-semibold text-sm text-foreground text-left">{item.title}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{item.totalLectures} lessons</span>
                                {openPackageCourseId === item.id ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </button>
                            {openPackageCourseId === item.id && (
                              <div className="p-4 bg-card space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                                {item.chapters.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Is course ka curriculum abhi add nahi hai.</p>
                                ) : (
                                  item.chapters.map((chapter) => (
                                    <div key={chapter.id} className="flex items-start gap-3 text-sm text-foreground/80">
                                      <PlayCircle className="w-4 h-4 text-accent/60 shrink-0 mt-0.5" />
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-foreground/90">{chapter.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{chapter.lessonsCount} lesson{chapter.lessonsCount !== 1 ? "s" : ""}</p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      {totalLectures} Lectures • {effectiveOnDemandLabel}
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
                  </>
                )}
              </div>
            )}

            {showRatings && activeTab === "ratings" && (
              <div className="mb-6">
                <div className="bg-card rounded-xl border border-border p-6 text-center">
                  <div className="text-5xl font-extrabold text-foreground mb-2">{effectiveRatingValue.toFixed(1)}</div>
                  <div className="flex justify-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-5 h-5 ${s <= Math.round(effectiveRatingValue) ? "fill-yellow-400 text-yellow-400" : "text-border"}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">Based on {effectiveRatingCount} ratings</p>
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

            {showReviews && activeTab === "reviews" && (
              <div className="mb-6 space-y-4">
                {effectiveReviews.map((review, idx) => (
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
                
                {showEnrollmentCount && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex -space-x-2">
                      {["P", "R", "S", "A"].map((initial, i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-primary font-bold text-xs">
                          {initial}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">+{effectiveEnrollmentCount} enrolled</span>
                  </div>
                )}

                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-3xl font-extrabold text-foreground">₹{dynamicPrice.toLocaleString()}</span>
                  {dynamicOriginalPrice > dynamicPrice && (
                    <span className="text-sm text-muted-foreground line-through">₹{dynamicOriginalPrice.toLocaleString()}</span>
                  )}
                </div>

                {(course.deliveryModePricingEnabled || course.bookAddonEnabled || course.viewPricingEnabled || course.validityPricingEnabled) && (
                  <div className="mb-4 space-y-2">
                    {course.deliveryModePricingEnabled && deliveryModes.length > 0 && (
                      <div className="rounded-xl border border-border/70 bg-card/70 p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleDesktopOptionSection("modes")}
                          className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left"
                        >
                          <span className="text-sm font-semibold text-foreground">
                            {deliveryModes.length === 1 ? "Select Mode" : "Select Modes (Multiple)"}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDesktopOptionSections.modes ? "rotate-180" : "rotate-0"}`} />
                        </button>
                        {openDesktopOptionSections.modes && (
                          <div className="pt-1">
                          {deliveryModes.length === 1 ? (
                            <div className="rounded-lg border border-primary/60 bg-primary/15 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-foreground">{deliveryModes[0].label}</p>
                                <span className="inline-flex items-center rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold">Selected</span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-primary">+₹{Number(deliveryModes[0].price || 0).toLocaleString()}</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {deliveryModes.map((mode) => {
                                const checked = selectedDeliveryModeIds.includes(mode.id);
                                return (
                                  <label
                                    key={mode.id}
                                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                                      checked
                                        ? "border-primary/70 bg-primary/15 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]"
                                        : "border-border bg-background/90 hover:bg-muted/60"
                                    }`}
                                  >
                                    <span className="flex items-center gap-2.5 font-medium text-foreground/90">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => toggleDeliveryModeSelection(mode.id, e.target.checked)}
                                        className="w-4 h-4 accent-primary"
                                      />
                                      {mode.label}
                                    </span>
                                    <span className="text-xs font-semibold text-primary">+₹{Number(mode.price || 0).toLocaleString()}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          </div>
                        )}
                      </div>
                    )}

                    {course.bookAddonEnabled && enabledBookAddons.length > 0 && (
                      <div className="rounded-xl border border-border/70 bg-card/70 p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleDesktopOptionSection("books")}
                          className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left"
                        >
                          <span className="text-sm font-semibold text-foreground">Books / Notes</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDesktopOptionSections.books ? "rotate-180" : "rotate-0"}`} />
                        </button>
                        {openDesktopOptionSections.books && (
                        <div className="space-y-2">
                          {enabledBookAddons.map((addon) => {
                            const checked = selectedBookAddonIds.includes(addon.id);
                            return (
                              <label
                                key={addon.id}
                                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                                  checked
                                    ? "border-primary/45 bg-primary/10"
                                    : "border-border bg-background/90 hover:bg-muted/60"
                                }`}
                              >
                                <span className="flex items-center gap-2.5 font-medium text-foreground/90">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setSelectedBookAddonIds((prev) => {
                                        if (e.target.checked) return Array.from(new Set([...prev, addon.id]));
                                        return prev.filter((id) => id !== addon.id);
                                      });
                                    }}
                                    className="w-4 h-4 accent-primary"
                                  />
                                  {addon.label}
                                </span>
                                <span className="text-xs font-semibold text-primary">+₹{Number(addon.price || 0).toLocaleString()}</span>
                              </label>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    )}

                    {course.viewPricingEnabled && (
                      <div className="rounded-xl border border-border/70 bg-card/70 p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleDesktopOptionSection("views")}
                          className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left"
                        >
                          <span className="text-sm font-semibold text-foreground">Select Views</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDesktopOptionSections.views ? "rotate-180" : "rotate-0"}`} />
                        </button>
                        {openDesktopOptionSections.views && (
                          <div className="relative pt-1">
                            <Eye className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                            <select
                              value={selectedViews}
                              onChange={(e) => setSelectedViews(Number(e.target.value) || 1)}
                              className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-2 text-sm font-medium"
                            >
                              {viewOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option} view{option > 1 ? "s" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {course.validityPricingEnabled && (
                      <div className="rounded-xl border border-border/70 bg-card/70 p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleDesktopOptionSection("validity")}
                          className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left"
                        >
                          <span className="text-sm font-semibold text-foreground">Select Validity</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDesktopOptionSections.validity ? "rotate-180" : "rotate-0"}`} />
                        </button>
                        {openDesktopOptionSections.validity && (
                          <div className="relative pt-1">
                            <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                            <select
                              value={selectedValidityDays}
                              onChange={(e) => setSelectedValidityDays(Number(e.target.value) || backendDefaultValidityDays)}
                              className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-2 text-sm font-medium"
                            >
                              {validityOptionsDays.map((days) => (
                                <option key={days} value={days}>
                                  {days} days
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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

                {/* Course Meta */}
                {sidebarMetaItems.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    {sidebarMetaItems.map((item, idx) => (
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
                )}
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
          <div className="px-4 py-2.5 space-y-2">
              {(course.deliveryModePricingEnabled || course.bookAddonEnabled || course.viewPricingEnabled || course.validityPricingEnabled) && (
                <button
                  type="button"
                  onClick={() => setShowMobileConfigurator((prev) => !prev)}
                  className="mx-auto flex h-6 w-12 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
                  aria-label={showMobileConfigurator ? "Hide purchase options" : "Show purchase options"}
                >
                  <ChevronUp className={`h-4 w-4 transition-transform ${showMobileConfigurator ? "rotate-180" : "rotate-0"}`} />
                </button>
              )}
              {(course.deliveryModePricingEnabled || course.bookAddonEnabled || course.viewPricingEnabled || course.validityPricingEnabled) && showMobileConfigurator && (
                <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-accent/[0.06] to-background p-2.5">
                  <div className="grid grid-cols-1 gap-2">
                  {course.deliveryModePricingEnabled && deliveryModes.length > 0 && (
                    <div className="rounded-lg border border-border/70 bg-card/80 p-2">
                      <button
                        type="button"
                        onClick={() => toggleMobileOptionSection("modes")}
                        className="flex w-full items-center justify-between rounded-md px-0.5 py-0.5 text-left"
                      >
                        <span className="text-xs font-semibold text-foreground">
                          {deliveryModes.length === 1 ? "Select Mode" : "Select Modes (Multiple)"}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openMobileOptionSections.modes ? "rotate-180" : "rotate-0"}`} />
                      </button>
                      {openMobileOptionSections.modes && (
                      deliveryModes.length === 1 ? (
                        <div className="mt-1 rounded border border-primary/60 bg-primary/15 px-2 py-1.5 text-xs shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-foreground">{deliveryModes[0].label}</span>
                            <span className="inline-flex items-center rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[9px] font-bold">Selected</span>
                          </div>
                          <div className="mt-1 font-semibold text-primary">+₹{Number(deliveryModes[0].price || 0).toLocaleString()}</div>
                        </div>
                      ) : (
                      <div className="space-y-1.5 pt-1">
                        {deliveryModes.map((mode) => {
                          const checked = selectedDeliveryModeIds.includes(mode.id);
                          return (
                          <label
                            key={mode.id}
                            className={`flex items-center justify-between gap-1.5 rounded border px-2 py-1.5 text-xs ${
                              checked ? "border-primary/70 bg-primary/15 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]" : "border-input bg-background"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate font-medium">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleDeliveryModeSelection(mode.id, e.target.checked)}
                                className="w-3.5 h-3.5 accent-primary"
                              />
                              <span className="truncate">{mode.label}</span>
                            </span>
                            <span className="font-semibold text-primary">+₹{Number(mode.price || 0).toLocaleString()}</span>
                          </label>
                          );
                        })}
                      </div>
                      )
                      )}
                    </div>
                  )}
                  {course.bookAddonEnabled && enabledBookAddons.length > 0 && (
                    <div className="rounded-lg border border-border/70 bg-card/80 p-2">
                      <button
                        type="button"
                        onClick={() => toggleMobileOptionSection("books")}
                        className="flex w-full items-center justify-between rounded-md px-0.5 py-0.5 text-left"
                      >
                        <span className="text-xs font-semibold text-foreground">Books / Notes</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openMobileOptionSections.books ? "rotate-180" : "rotate-0"}`} />
                      </button>
                      {openMobileOptionSections.books && (
                      <div className="space-y-1.5 pt-1">
                        {enabledBookAddons.map((addon) => {
                          const checked = selectedBookAddonIds.includes(addon.id);
                          return (
                          <label
                            key={addon.id}
                            className={`flex items-center justify-between gap-1.5 rounded border px-2 py-1.5 text-xs ${
                              checked ? "border-primary/40 bg-primary/10" : "border-input bg-background"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate font-medium">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedBookAddonIds((prev) => {
                                    if (e.target.checked) return Array.from(new Set([...prev, addon.id]));
                                    return prev.filter((id) => id !== addon.id);
                                  });
                                }}
                                className="w-3.5 h-3.5 accent-primary"
                              />
                              <span className="truncate">{addon.label}</span>
                            </span>
                            <span className="font-semibold text-primary">+₹{Number(addon.price || 0).toLocaleString()}</span>
                          </label>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  )}
                  {course.viewPricingEnabled && (
                    <div className="rounded-lg border border-border/70 bg-card/80 p-2">
                      <button
                        type="button"
                        onClick={() => toggleMobileOptionSection("views")}
                        className="flex w-full items-center justify-between rounded-md px-0.5 py-0.5 text-left"
                      >
                        <span className="text-xs font-semibold text-foreground">Select Views</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openMobileOptionSections.views ? "rotate-180" : "rotate-0"}`} />
                      </button>
                      {openMobileOptionSections.views && (
                      <select
                        value={selectedViews}
                        onChange={(e) => setSelectedViews(Number(e.target.value) || 1)}
                        className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
                      >
                        {viewOptions.map((option) => (
                          <option key={option} value={option}>
                            {option} view{option > 1 ? "s" : ""}
                          </option>
                        ))}
                      </select>
                      )}
                    </div>
                  )}
                  {course.validityPricingEnabled && (
                    <div className="rounded-lg border border-border/70 bg-card/80 p-2">
                      <button
                        type="button"
                        onClick={() => toggleMobileOptionSection("validity")}
                        className="flex w-full items-center justify-between rounded-md px-0.5 py-0.5 text-left"
                      >
                        <span className="text-xs font-semibold text-foreground">Select Validity</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openMobileOptionSections.validity ? "rotate-180" : "rotate-0"}`} />
                      </button>
                      {openMobileOptionSections.validity && (
                      <select
                        value={selectedValidityDays}
                        onChange={(e) => setSelectedValidityDays(Number(e.target.value) || backendDefaultValidityDays)}
                        className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
                      >
                        {validityOptionsDays.map((days) => (
                          <option key={days} value={days}>
                            {days} days
                          </option>
                        ))}
                      </select>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex flex-col mr-auto">
                  <span className="text-lg font-extrabold text-foreground">₹{dynamicPrice.toLocaleString()}</span>
                  {dynamicOriginalPrice > dynamicPrice && (
                    <span className="text-xs text-muted-foreground line-through">₹{dynamicOriginalPrice.toLocaleString()}</span>
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
            </div>
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
