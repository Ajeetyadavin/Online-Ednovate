import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Course } from "@/data/courses";
import {
  decodeVideoUrl,
  detectVideoSource,
  encodeVideoUrl,
  type LessonVideoSource,
} from "@/lib/video-utils";

export interface ManagedCourse extends Course {
  isVisible: boolean;
  webPlayEnabled?: boolean;
  demoVideoVisible?: boolean;
  demoVideoTitle?: string;
  demoVideoDescription?: string;
  demoVideoSource?: LessonVideoSource;
  demoVideoUrl?: string;
  demoVideoThumbnailUrl?: string;
}

export interface ManagedCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  isVisible: boolean;
  parentId: string | null;
  sortOrder: number;
}

export interface ManagedBanner {
  id: string;
  title: string;
  imageUrl: string;
  isVisible: boolean;
  sortOrder: number;
}

export interface ManagedTestimonial {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  rating: number;
  isVisible: boolean;
  avatarUrl?: string;
}

export interface ManagedAnnouncement {
  id: string;
  title: string;
  content: string;
  link: string;
  isVisible: boolean;
}

export interface ManagedCoupon {
  id: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxDiscount?: number;
  minPurchase?: number;
  appliesToCourseIds?: string[];
  singleCourseOnly?: boolean;
  allowedStudentEmails?: string[];
  singleStudentOnly?: boolean;
  validFrom?: string;
  validTo?: string;
  allowedDaysOfWeek?: number[];
  firstPurchaseOnly?: boolean;
  maxTotalUses?: number;
  maxUsesPerUser?: number;
  maxUniqueUsers?: number;
  allowedPaymentMethods?: string[];
  totalUsed?: number;
  usedBy?: Record<string, number>;
  usageHistory?: Array<{
    email: string;
    usedAt: string;
    orderId?: string;
  }>;
}

export interface ManagedTestPaper {
  id: string;
  paperCode: string;
  title: string;
  nature: "objective" | "subjective" | string;
  category: string;
  remarkTeacher: string;
  remarkStudents: string;
  description: string;
  totalTime: number;
  courseId: string;
  levelId: string;
  subjectId: string;
  chapterId: string;
  subChapterId: string;
  passingPercent: number;
  attemptsAllowed: number;
  thumbnailUrl?: string;
  price: number;
  originalPrice?: number;
  isVisible: boolean;
  questionIds?: string[];
  createdAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  duration: string;
  type: "video" | "pdf" | "quiz";
  completed: boolean;
  locked: boolean;
  isPreview?: boolean;
  isHomepageDemo?: boolean;
  videoSource?: LessonVideoSource;
  videoUrl?: string;
  resourceUrl?: string;
  thumbnailUrl?: string;
  instructorShares?: Array<{
    facultyId: string;
    sharePercent: number;
  }>;
}

export interface Chapter {
  id: string;
  title: string;
  description?: string;
  bunnyCollectionId?: string;
  bunnyCollectionName?: string;
  lessons: Lesson[];
}

interface PlatformDataState {
  courses: ManagedCourse[];
  categories: ManagedCategory[];
  banners: ManagedBanner[];
  testimonials: ManagedTestimonial[];
  announcements: ManagedAnnouncement[];
  coupons: ManagedCoupon[];
  testPapers: ManagedTestPaper[];
  curricula: Record<string, Chapter[]>;
}

interface PlatformDataContextType extends PlatformDataState {
  upsertCourse: (course: ManagedCourse) => void;
  updateCourseDemoVideo: (
    courseId: string,
    demoUpdates: Partial<
      Pick<
        ManagedCourse,
        | "demoVideoVisible"
        | "demoVideoTitle"
        | "demoVideoDescription"
        | "demoVideoSource"
        | "demoVideoUrl"
        | "demoVideoThumbnailUrl"
      >
    >,
  ) => void;
  deleteCourse: (courseId: string) => void;
  toggleCourseVisibility: (courseId: string) => void;
  upsertCategory: (category: ManagedCategory) => void;
  deleteCategory: (categoryId: string) => void;
  toggleCategoryVisibility: (categoryId: string) => void;
  setBanners: (banners: ManagedBanner[]) => void;
  setTestimonials: (testimonials: ManagedTestimonial[]) => void;
  setAnnouncements: (announcements: ManagedAnnouncement[]) => void;
  setCoupons: (coupons: ManagedCoupon[]) => void;
  upsertCoupon: (coupon: ManagedCoupon) => void;
  deleteCoupon: (couponId: string) => void;
  toggleCouponActive: (couponId: string) => void;
  markCouponUsed: (couponCode: string, studentEmail?: string, orderId?: string) => void;
  getCurriculumForCourse: (courseId: string, courseTitle?: string) => Chapter[];
  setCurriculumForCourse: (courseId: string, curriculum: Chapter[]) => void;
  setCourseDemoLesson: (courseId: string, lessonId?: string) => void;
  refreshData: () => Promise<void>;
  resetPlatformData: () => void;
}

const createFallbackCurriculum = (courseName: string): Chapter[] => [
  {
    id: "ch1",
    title: "Introduction & Basics",
    lessons: [
      {
        id: "l1",
        title: `Welcome to ${courseName}`,
        duration: "5:30",
        type: "video",
        completed: false,
        locked: false,
        isPreview: true,
        isHomepageDemo: true,
        videoSource: "direct",
        videoUrl: encodeVideoUrl("https://www.w3schools.com/html/mov_bbb.mp4"),
      },
      {
        id: "l2",
        title: "Course Overview",
        duration: "12:45",
        type: "video",
        completed: false,
        locked: false,
        isHomepageDemo: false,
        videoSource: "direct",
        videoUrl: encodeVideoUrl("https://www.w3schools.com/html/mov_bbb.mp4"),
      },
      {
        id: "l3",
        title: "Study Material PDF",
        duration: "PDF",
        type: "pdf",
        completed: false,
        locked: false,
      },
    ],
  },
  {
    id: "ch2",
    title: "Core Concepts",
    lessons: [
      {
        id: "l4",
        title: "Fundamental Principles",
        duration: "25:10",
        type: "video",
        completed: false,
        locked: false,
        isHomepageDemo: false,
        videoSource: "direct",
        videoUrl: encodeVideoUrl("https://www.w3schools.com/html/mov_bbb.mp4"),
      },
      {
        id: "l5",
        title: "Practice Problems",
        duration: "PDF",
        type: "pdf",
        completed: false,
        locked: false,
      },
      {
        id: "l6",
        title: "Chapter Quiz",
        duration: "10 Qs",
        type: "quiz",
        completed: false,
        locked: false,
      },
    ],
  },
];

const normalizeCourse = (course: Partial<ManagedCourse>, index: number): ManagedCourse => ({
  ...(function () {
    const rawDemoUrl = String(course.demoVideoUrl || "").trim();
    const normalizedDemoUrl = rawDemoUrl ? encodeVideoUrl(decodeVideoUrl(rawDemoUrl)) : "";
    const normalizedDemoSource: LessonVideoSource =
      course.demoVideoSource === "youtube" ||
      course.demoVideoSource === "upload" ||
      course.demoVideoSource === "direct"
        ? course.demoVideoSource
        : detectVideoSource(normalizedDemoUrl);

    return {
      demoVideoVisible: Boolean(course.demoVideoVisible),
      demoVideoTitle: String(course.demoVideoTitle || "").trim(),
      demoVideoDescription: String(course.demoVideoDescription || "").trim(),
      demoVideoSource: normalizedDemoSource,
      demoVideoUrl: normalizedDemoUrl,
      demoVideoThumbnailUrl: String(course.demoVideoThumbnailUrl || "").trim(),
    };
  })(),
  id: String(course.id || `course-${index + 1}`),
  title: course.title || "Untitled Course",
  category: course.category || "general",
  subcategory: course.subcategory || "general",
  subject: String(course.subject || "").trim(),
  chapter: String(course.chapter || "").trim(),
  selectedChapters: Array.isArray(course.selectedChapters)
    ? course.selectedChapters.map((item) => String(item || "").trim()).filter(Boolean)
    : (course.chapter ? [String(course.chapter || "").trim()].filter(Boolean) : []),
  language: course.language || "English",
  lectures: Number(course.lectures || 0),
  hours: Number(course.hours || 0),
  price: Number(course.price || 0),
  originalPrice: Number(course.originalPrice || course.price || 0),
  taxPercentage: Math.max(0, Number(course.taxPercentage || 0)),
  discount: Number(course.discount || 0),
  image: course.image || "/placeholder.svg",
  thumbnail: String(course.thumbnail || "").trim(),
  professor: course.professor || "Ednovate Faculty",
  facultyIds: Array.isArray(course.facultyIds)
    ? course.facultyIds.map((item) => String(item || "").trim()).filter(Boolean)
    : [],
  viewPricingEnabled: Boolean(course.viewPricingEnabled),
  unlimitedViewsEnabled: Boolean(course.unlimitedViewsEnabled),
  validityPricingEnabled: Boolean(course.validityPricingEnabled),
  viewOptions: Array.isArray(course.viewOptions)
    ? course.viewOptions.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 1)
    : [1, 2],
  validityOptionsDays: Array.isArray(course.validityOptionsDays)
    ? course.validityOptionsDays.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 1)
    : [30, 90, 180],
  selectedViews: Math.max(1, Number(course.selectedViews || 1)),
  selectedValidityDays: Math.max(1, Number(course.selectedValidityDays || 30)),
  selectedAttemptOptionId: String(course.selectedAttemptOptionId || "").trim(),
  selectedAttemptEndDate: String(course.selectedAttemptEndDate || "").trim(),
  deliveryModePricingEnabled: Boolean(course.deliveryModePricingEnabled),
  deliveryModes: Array.isArray(course.deliveryModes)
    ? course.deliveryModes
        .map((mode) => {
          const raw = mode as { id?: string; label?: string; price?: number; originalPrice?: number };
          const id = String(raw.id || "").trim();
          const label = String(raw.label || "").trim();
          const price = Number(raw.price || 0);
          const originalPrice = Number(raw.originalPrice || 0);
          if (!id || !label || !Number.isFinite(price) || price <= 0) return null;
          return {
            id,
            label,
            price,
            originalPrice: Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : undefined,
          };
        })
        .filter(Boolean)
    : [],
  selectedDeliveryModeId: String(course.selectedDeliveryModeId || "online"),
  selectedDeliveryModeIds: Array.isArray(course.selectedDeliveryModeIds)
    ? course.selectedDeliveryModeIds.map((id) => String(id)).filter(Boolean)
    : String(course.selectedDeliveryModeId || "").trim()
      ? [String(course.selectedDeliveryModeId || "").trim()]
      : ["online"],
  bookAddonEnabled: Boolean(course.bookAddonEnabled),
  bookAddons: Array.isArray(course.bookAddons)
    ? course.bookAddons
        .map((addon) => {
          const raw = addon as { id?: string; label?: string; price?: number; enabled?: boolean };
          const id = String(raw.id || "").trim();
          const label = String(raw.label || "").trim();
          const price = Number(raw.price || 0);
          if (!id || !label || !Number.isFinite(price) || price < 0) return null;
          return { id, label, price, enabled: raw.enabled !== false };
        })
        .filter(Boolean)
    : [],
  selectedBookAddonIds: Array.isArray(course.selectedBookAddonIds)
    ? course.selectedBookAddonIds.map((id) => String(id)).filter(Boolean)
    : [],
  aboutCourseEnabled: Boolean(course.aboutCourseEnabled),
  aboutCourseText: String(course.aboutCourseText || "").trim(),
  ratingsEnabled: course.ratingsEnabled !== false,
  reviewsEnabled: course.reviewsEnabled !== false,
  ratingValue: Math.max(0, Math.min(5, Number(course.ratingValue || 4.8))),
  ratingCount: Math.max(0, Number(course.ratingCount || 0)),
  reviews: Array.isArray(course.reviews)
    ? course.reviews
        .map((review) => {
          const raw = review as { name?: string; rating?: number; comment?: string; date?: string };
          const name = String(raw.name || "").trim();
          const comment = String(raw.comment || "").trim();
          const rating = Math.max(1, Math.min(5, Number(raw.rating || 5)));
          const date = String(raw.date || "").trim();
          if (!name || !comment) return null;
          return { name, rating, comment, date };
        })
        .filter(Boolean)
    : [],
  enrollmentCount: Math.max(0, Number(course.enrollmentCount || 0)),
  showEnrollmentCount: course.showEnrollmentCount !== false,
  showMetaLectures: course.showMetaLectures !== false,
  showMetaHours: course.showMetaHours !== false,
  showMetaValidity: course.showMetaValidity !== false,
  showMetaResources: course.showMetaResources !== false,
  showMetaViews: course.showMetaViews !== false,
  showMetaPerHour: course.showMetaPerHour !== false,
  showMetaLanguage: course.showMetaLanguage !== false,
  isCombo: Boolean(course.isCombo),
  isMaterial: Boolean(course.isMaterial),
  isVisible: course.isVisible !== false,
  webPlayEnabled: course.webPlayEnabled === true,
  packageCourseIds: Array.isArray(course.packageCourseIds)
    ? course.packageCourseIds.map((id) => String(id).trim()).filter(Boolean)
    : [],
  masterConfig: course.masterConfig && typeof course.masterConfig === "object"
    ? {
        ...course.masterConfig,
        defaultSelectedCombinationId: String(course.masterConfig.defaultSelectedCombinationId || "").trim(),
        combinationIds: Array.isArray(course.masterConfig.combinationIds)
          ? course.masterConfig.combinationIds.map((id) => String(id).trim()).filter(Boolean)
          : [],
        combinations: Array.isArray(course.masterConfig.combinations)
          ? course.masterConfig.combinations
              .map((item) => {
                const row = item as {
                  id?: string;
                  label?: string;
                  viewModeId?: string | null;
                  viewModeName?: string;
                  viewCount?: number | null;
                  validityOptionId?: string | null;
                  validityLabel?: string;
                  validityDays?: number | null;
                  attemptOptionId?: string | null;
                  attemptLabel?: string;
                  attemptEndDate?: string | null;
                  deliveryModeId?: string | null;
                  deliveryModeName?: string;
                  languageId?: string | null;
                  languageName?: string;
                  price?: number;
                  originalPrice?: number | null;
                };
                const id = String(row.id || "").trim();
                const viewModeId = row.viewModeId ? String(row.viewModeId).trim() : null;
                const validityOptionId = row.validityOptionId ? String(row.validityOptionId).trim() : null;
                const attemptOptionId = row.attemptOptionId ? String(row.attemptOptionId).trim() : null;
                const deliveryModeId = row.deliveryModeId ? String(row.deliveryModeId).trim() : null;
                const languageId = row.languageId ? String(row.languageId).trim() : null;
                const price = Number(row.price || 0);
                const hasAtLeastOneDimension = Boolean(viewModeId || validityOptionId || attemptOptionId || deliveryModeId || languageId);
                if (!id || !hasAtLeastOneDimension || !Number.isFinite(price) || price <= 0) return null;
                return {
                  id,
                  label: String(row.label || "").trim(),
                  viewModeId,
                  viewModeName: String(row.viewModeName || "").trim(),
                  viewCount: row.viewCount === null || row.viewCount === undefined ? null : Number(row.viewCount || 0),
                  validityOptionId,
                  validityLabel: String(row.validityLabel || "").trim(),
                  validityDays: row.validityDays === null || row.validityDays === undefined ? null : Number(row.validityDays || 0),
                  attemptOptionId,
                  attemptLabel: String(row.attemptLabel || "").trim(),
                  attemptEndDate: row.attemptEndDate ? String(row.attemptEndDate).trim() : "",
                  deliveryModeId,
                  deliveryModeName: String(row.deliveryModeName || "").trim(),
                  languageId,
                  languageName: String(row.languageName || "").trim(),
                  price,
                  originalPrice: row.originalPrice === null || row.originalPrice === undefined
                    ? null
                    : Number(row.originalPrice || 0),
                };
              })
              .filter(Boolean)
          : [],
        combinationBasis:
          course.masterConfig.combinationBasis && typeof course.masterConfig.combinationBasis === "object"
            ? {
                useView: Boolean((course.masterConfig.combinationBasis as { useView?: boolean }).useView),
                useValidity: Boolean((course.masterConfig.combinationBasis as { useValidity?: boolean }).useValidity),
                useAttempt: Boolean((course.masterConfig.combinationBasis as { useAttempt?: boolean }).useAttempt),
                useMode: Boolean((course.masterConfig.combinationBasis as { useMode?: boolean }).useMode),
                useLanguage: Boolean((course.masterConfig.combinationBasis as { useLanguage?: boolean }).useLanguage),
              }
            : undefined,
        combinationPrices: course.masterConfig.combinationPrices && typeof course.masterConfig.combinationPrices === "object"
          ? Object.fromEntries(
              Object.entries(course.masterConfig.combinationPrices)
                .map(([id, value]) => {
                  const row = value as { price?: number; originalPrice?: number | null };
                  const comboId = String(id || "").trim();
                  const price = Number(row.price || 0);
                  const originalPrice = row.originalPrice === null || row.originalPrice === undefined
                    ? null
                    : Number(row.originalPrice || 0);
                  if (!comboId || !Number.isFinite(price) || price <= 0) return null;
                  return [
                    comboId,
                    {
                      price,
                      originalPrice: Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : null,
                    },
                  ];
                })
                .filter((item): item is [string, { price: number; originalPrice: number | null }] => Boolean(item)),
            )
          : {},
      }
    : undefined,
});

const normalizeCategory = (category: Partial<ManagedCategory>, index: number): ManagedCategory => ({
  id: String(category.id || `category-${index + 1}`),
  name: category.name || "Untitled Category",
  slug: category.slug || String(category.id || `category-${index + 1}`),
  color: category.color || "#475569",
  isVisible: category.isVisible !== false,
  parentId: category.parentId ?? null,
  sortOrder: Number(category.sortOrder || index + 1),
});

const normalizeBanner = (banner: Partial<ManagedBanner>, index: number): ManagedBanner => ({
  id: String(banner.id || `banner-${index + 1}`),
  title: banner.title || `Banner ${index + 1}`,
  imageUrl: banner.imageUrl || "/placeholder.svg",
  isVisible: banner.isVisible !== false,
  sortOrder: Number(banner.sortOrder || index + 1),
});

const normalizeTestimonial = (
  testimonial: Partial<ManagedTestimonial>,
  index: number,
): ManagedTestimonial => ({
  id: String(testimonial.id || `testimonial-${index + 1}`),
  authorName: testimonial.authorName || "Student",
  authorRole: testimonial.authorRole || "Learner",
  content: testimonial.content || "Great learning experience.",
  rating: Math.max(1, Math.min(5, Number(testimonial.rating || 5))),
  isVisible: testimonial.isVisible !== false,
  avatarUrl: String(testimonial.avatarUrl || "").trim(),
});

const normalizeAnnouncement = (
  announcement: Partial<ManagedAnnouncement>,
  index: number,
): ManagedAnnouncement => ({
  id: String(announcement.id || `announcement-${index + 1}`),
  title: announcement.title || "New update",
  content: announcement.content || "",
  link: announcement.link || "/packages",
  isVisible: announcement.isVisible !== false,
});

const normalizeCoupon = (coupon: Partial<ManagedCoupon>, index: number): ManagedCoupon => {
  const discountType = coupon.discountType === "fixed" ? "fixed" : "percent";
  const code = String(coupon.code || `COUPON${index + 1}`).trim().toUpperCase();

  return {
    id: String(coupon.id || `coupon-${index + 1}`),
    code,
    description: String(coupon.description || "").trim(),
    isActive: coupon.isActive !== false,
    createdAt: String(coupon.createdAt || "").trim() || new Date().toISOString(),
    createdBy: String(coupon.createdBy || "").trim() || "Admin",
    updatedAt: String(coupon.updatedAt || "").trim() || undefined,
    discountType,
    discountValue: Math.max(0, Number(coupon.discountValue || 0)),
    maxDiscount: coupon.maxDiscount ? Math.max(0, Number(coupon.maxDiscount)) : undefined,
    minPurchase: coupon.minPurchase ? Math.max(0, Number(coupon.minPurchase)) : undefined,
    appliesToCourseIds: Array.isArray(coupon.appliesToCourseIds)
      ? coupon.appliesToCourseIds.map((id) => String(id).trim()).filter(Boolean)
      : [],
    singleCourseOnly: Boolean(coupon.singleCourseOnly),
    allowedStudentEmails: Array.isArray(coupon.allowedStudentEmails)
      ? coupon.allowedStudentEmails.map((email) => String(email).trim().toLowerCase()).filter(Boolean)
      : [],
    singleStudentOnly: Boolean(coupon.singleStudentOnly),
    validFrom: String(coupon.validFrom || "").trim() || undefined,
    validTo: String(coupon.validTo || "").trim() || undefined,
    allowedDaysOfWeek: Array.isArray(coupon.allowedDaysOfWeek)
      ? coupon.allowedDaysOfWeek
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [],
    firstPurchaseOnly: Boolean(coupon.firstPurchaseOnly),
    maxTotalUses: coupon.maxTotalUses ? Math.max(0, Number(coupon.maxTotalUses)) : undefined,
    maxUsesPerUser: coupon.maxUsesPerUser ? Math.max(0, Number(coupon.maxUsesPerUser)) : undefined,
    maxUniqueUsers: coupon.maxUniqueUsers ? Math.max(0, Number(coupon.maxUniqueUsers)) : undefined,
    allowedPaymentMethods: Array.isArray(coupon.allowedPaymentMethods)
      ? coupon.allowedPaymentMethods.map((method) => String(method).trim()).filter(Boolean)
      : [],
    totalUsed: Math.max(0, Number(coupon.totalUsed || 0)),
    usedBy: coupon.usedBy && typeof coupon.usedBy === "object"
      ? Object.fromEntries(
          Object.entries(coupon.usedBy).map(([email, count]) => [String(email).toLowerCase(), Math.max(0, Number(count || 0))]),
        )
      : {},
    usageHistory: Array.isArray(coupon.usageHistory)
      ? coupon.usageHistory
          .map((entry) => {
            const item = entry as { email?: string; usedAt?: string; orderId?: string };
            return {
              email: String(item.email || "").trim().toLowerCase(),
              usedAt: String(item.usedAt || "").trim() || new Date().toISOString(),
              orderId: String(item.orderId || "").trim() || undefined,
            };
          })
          .filter((entry) => Boolean(entry.email))
      : [],
  };
};

const normalizeCurriculum = (curriculum: unknown): Chapter[] => {
  if (!Array.isArray(curriculum)) {
    return [];
  }

  return curriculum
    .map((chapter, chapterIndex) => {
      const ch = chapter as Partial<Chapter>;
      const lessons = Array.isArray(ch.lessons)
        ? ch.lessons.map((lesson, lessonIndex) => {
            const l = lesson as Partial<Lesson>;
            const lessonType = l.type === "pdf" || l.type === "quiz" ? l.type : "video";
            const rawVideoUrl = String(l.videoUrl || "").trim();
            const normalizedVideoUrl = rawVideoUrl
              ? encodeVideoUrl(decodeVideoUrl(rawVideoUrl))
              : "";
            const normalizedVideoSource: LessonVideoSource =
              l.videoSource === "youtube" || l.videoSource === "upload" || l.videoSource === "direct"
                ? l.videoSource
                : detectVideoSource(normalizedVideoUrl);

            return {
              id: String(l.id || `l-${chapterIndex + 1}-${lessonIndex + 1}`),
              title: l.title || `Lesson ${lessonIndex + 1}`,
              description: l.description || "",
              duration: l.duration || (lessonType === "video" ? "10:00" : lessonType === "pdf" ? "PDF" : "10 Qs"),
              type: lessonType,
              completed: Boolean(l.completed),
              locked: Boolean(l.locked),
              isPreview: Boolean(l.isPreview),
              isHomepageDemo: Boolean(l.isHomepageDemo),
              videoSource: lessonType === "video" ? normalizedVideoSource : "direct",
              videoUrl: lessonType === "video" ? normalizedVideoUrl : "",
              resourceUrl: l.resourceUrl || "",
              thumbnailUrl: l.thumbnailUrl || "",
            } satisfies Lesson;
          })
        : [];

      return {
        id: String(ch.id || `ch-${chapterIndex + 1}`),
        title: ch.title || `Chapter ${chapterIndex + 1}`,
        description: ch.description || "",
        bunnyCollectionId: String(ch.bunnyCollectionId || "").trim(),
        bunnyCollectionName: String(ch.bunnyCollectionName || "").trim(),
        lessons,
      } satisfies Chapter;
    });
};

const pickCourseDemoLessonId = (chapters: Chapter[], preferredLessonId?: string): string | null => {
  const videoLessons = chapters.flatMap((chapter) => chapter.lessons).filter((lesson) => lesson.type === "video");
  if (videoLessons.length === 0) return null;

  if (preferredLessonId && videoLessons.some((lesson) => lesson.id === preferredLessonId)) {
    return preferredLessonId;
  }

  const marked = videoLessons.find((lesson) => lesson.isHomepageDemo);
  return marked?.id || videoLessons[0].id;
};

const withCourseDemoSelection = (chapters: Chapter[], preferredLessonId?: string): Chapter[] => {
  const selectedId = pickCourseDemoLessonId(chapters, preferredLessonId);
  if (!selectedId) return chapters;

  return chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) => ({
      ...lesson,
      isHomepageDemo: lesson.type === "video" && lesson.id === selectedId,
    })),
  }));
};

const ensureCourseScopedDemos = (curricula: Record<string, Chapter[]>): Record<string, Chapter[]> => {
  return Object.fromEntries(
    Object.entries(curricula).map(([courseId, chapters]) => [courseId, withCourseDemoSelection(chapters)]),
  );
};

const createDefaultState = (): PlatformDataState => {
  return {
    courses: [],
    categories: [],
    banners: [],
    testimonials: [],
    announcements: [],
    coupons: [],
    testPapers: [],
    curricula: {},
  };
};

const loadInitialState = (): PlatformDataState => {
  return createDefaultState();
};

const PlatformDataContext = createContext<PlatformDataContextType | null>(null);

export const PlatformDataProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PlatformDataState>(() => loadInitialState());

  const refreshData = async () => {
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      const headers = adminToken ? { "Authorization": `Bearer ${adminToken}` } : {};

      const [coursesRes, categoriesRes, homepageRes, couponsRes, testPapersRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/admin/categories", { headers }).catch(() => ({ ok: false })),
        fetch("/api/homepage").catch(() => ({ ok: false })),
        fetch("/api/admin/coupons", { headers }).catch(() => ({ ok: false })),
        fetch(adminToken ? "/api/admin/crackit/papers" : "/api/test-papers", { headers }).catch(() => ({ ok: false })),
      ]);

      const data = await (coursesRes.ok ? coursesRes.json() : Promise.resolve({ courses: [], curricula: {} }));
      const categoriesData = categoriesRes.ok ? await categoriesRes.json() : { items: [] };
      const homepageData = homepageRes.ok ? await homepageRes.json() : { banners: [], testimonials: [], announcements: [] };
      const couponsData = couponsRes.ok ? await couponsRes.json() : { items: [] };
      const testPapersData = testPapersRes.ok ? await testPapersRes.json() : { items: [] };

      setState((prev) => {
        const nextCourses = Array.isArray(data.courses)
          ? data.courses.map((c: any, i: number) => normalizeCourse(c, i))
          : prev.courses;

        const nextCurricula = { ...prev.curricula };
        nextCourses.forEach((c) => {
          const raw = data.curricula?.[c.id];
          const parsed = normalizeCurriculum(raw);
          nextCurricula[c.id] = parsed.length > 0 ? parsed : (nextCurricula[c.id] || createFallbackCurriculum(c.title));
        });

        return {
          ...prev,
          courses: nextCourses,
          categories: Array.isArray(categoriesData.items) ? categoriesData.items.map(normalizeCategory) : prev.categories,
          banners: Array.isArray(homepageData.banners) ? homepageData.banners.map(normalizeBanner) : prev.banners,
          testimonials: Array.isArray(homepageData.testimonials) ? homepageData.testimonials.map(normalizeTestimonial) : prev.testimonials,
          announcements: Array.isArray(homepageData.announcements) ? homepageData.announcements.map(normalizeAnnouncement) : prev.announcements,
          coupons: Array.isArray(couponsData.items) ? couponsData.items.map(normalizeCoupon) : prev.coupons,
          testPapers: Array.isArray(testPapersData.items) ? testPapersData.items.map((row: any) => ({
                id: String(row.id),
                paperCode: String(row.paper_code || ""),
                title: String(row.title || ""),
                nature: String(row.nature || "objective") as any,
                category: String(row.category || ""),
                remarkTeacher: String(row.remark_teacher || ""),
                remarkStudents: String(row.remark_students || ""),
                description: String(row.description || ""),
                totalTime: Number(row.total_time || 0),
                courseId: String(row.course_id || ""),
                levelId: String(row.level_id || ""),
                subjectId: String(row.subject_id || ""),
                chapterId: String(row.chapter_id || ""),
                subChapterId: String(row.sub_chapter_id || ""),
                passingPercent: Number(row.passing_percent || 0),
                attemptsAllowed: Number(row.attempts_allowed || 0),
                thumbnailUrl: String(row.thumbnail_url || ""),
                price: Number(row.price || 0),
                originalPrice: row.original_price ? Number(row.original_price) : undefined,
                isVisible: row.is_visible !== false,
                questionIds: Array.isArray(row.question_ids) ? row.question_ids.map((id: unknown) => String(id)) : [],
                createdAt: String(row.created_at || ""),
          })) : prev.testPapers,
          curricula: ensureCourseScopedDemos(nextCurricula),
        };
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const value = useMemo<PlatformDataContextType>(() => {
    const upsertCourse = (course: ManagedCourse) => {
      const nextCourse = normalizeCourse(course, state.courses.length);
      setState((prev) => {
        const exists = prev.courses.some((item) => item.id === nextCourse.id);
        const nextCourses = exists
          ? prev.courses.map((item) => (item.id === nextCourse.id ? nextCourse : item))
          : [...prev.courses, nextCourse];

        const nextCurricula = { ...prev.curricula };
        if (!nextCurricula[nextCourse.id] || nextCurricula[nextCourse.id].length === 0) {
          nextCurricula[nextCourse.id] = createFallbackCurriculum(nextCourse.title);
        }

        return {
          ...prev,
          courses: nextCourses,
          curricula: ensureCourseScopedDemos(nextCurricula),
        };
      });
    };

    const updateCourseDemoVideo = (
      courseId: string,
      demoUpdates: Partial<
        Pick<
          ManagedCourse,
          | "demoVideoVisible"
          | "demoVideoTitle"
          | "demoVideoDescription"
          | "demoVideoSource"
          | "demoVideoUrl"
          | "demoVideoThumbnailUrl"
        >
      >,
    ) => {
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((course, index) =>
          course.id === courseId
            ? (() => {
                const hasDemoUrlUpdate = typeof demoUpdates.demoVideoUrl === "string";
                const nextDemoUrl = hasDemoUrlUpdate ? demoUpdates.demoVideoUrl : course.demoVideoUrl || "";
                const nextDemoVisible =
                  typeof demoUpdates.demoVideoVisible === "boolean"
                    ? demoUpdates.demoVideoVisible
                    : hasDemoUrlUpdate
                      ? Boolean(String(nextDemoUrl || "").trim())
                      : course.demoVideoVisible;

                return normalizeCourse(
                  {
                    ...course,
                    ...demoUpdates,
                    demoVideoVisible: nextDemoVisible,
                  },
                  index,
                );
              })()
            : course,
        ),
      }));
    };

    const deleteCourse = (courseId: string) => {
      setState((prev) => {
        const nextCurricula = { ...prev.curricula };
        delete nextCurricula[courseId];
        const nextCourses = prev.courses.filter((course) => course.id !== courseId);
        return {
          ...prev,
          courses: nextCourses,
          curricula: ensureCourseScopedDemos(nextCurricula),
        };
      });
    };

    const toggleCourseVisibility = (courseId: string) => {
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((course) =>
          course.id === courseId ? { ...course, isVisible: !course.isVisible } : course,
        ),
      }));
    };

    const upsertCategory = (category: ManagedCategory) => {
      const nextCategory = normalizeCategory(category, state.categories.length);
      setState((prev) => {
        const exists = prev.categories.some((item) => item.id === nextCategory.id);
        const nextCategories = exists
          ? prev.categories.map((item) => (item.id === nextCategory.id ? nextCategory : item))
          : [...prev.categories, nextCategory];
        return { ...prev, categories: nextCategories };
      });
    };

    const deleteCategory = (categoryId: string) => {
      setState((prev) => ({
        ...prev,
        categories: prev.categories.filter((category) => category.id !== categoryId),
      }));
    };

    const toggleCategoryVisibility = (categoryId: string) => {
      setState((prev) => ({
        ...prev,
        categories: prev.categories.map((category) =>
          category.id === categoryId
            ? { ...category, isVisible: !category.isVisible }
            : category,
        ),
      }));
    };

    const setBanners = (banners: ManagedBanner[]) => {
      setState((prev) => ({
        ...prev,
        banners: banners.map((banner, index) => normalizeBanner(banner, index)),
      }));
    };

    const setTestimonials = (testimonials: ManagedTestimonial[]) => {
      setState((prev) => ({
        ...prev,
        testimonials: testimonials.map((item, index) => normalizeTestimonial(item, index)),
      }));
    };

    const setAnnouncements = (announcements: ManagedAnnouncement[]) => {
      setState((prev) => ({
        ...prev,
        announcements: announcements.map((item, index) => normalizeAnnouncement(item, index)),
      }));
    };

    const setCoupons = (coupons: ManagedCoupon[]) => {
      setState((prev) => ({
        ...prev,
        coupons: Array.isArray(coupons)
          ? coupons.map((coupon, index) => normalizeCoupon(coupon, index))
          : prev.coupons,
      }));
    };

    const upsertCoupon = (coupon: ManagedCoupon) => {
      setState((prev) => {
        const normalized = normalizeCoupon(coupon, prev.coupons.length);
        const existing = prev.coupons.find((item) => item.id === normalized.id);
        const nextCoupon: ManagedCoupon = {
          ...normalized,
          createdAt: existing?.createdAt || normalized.createdAt || new Date().toISOString(),
          createdBy: existing?.createdBy || normalized.createdBy || "Admin",
          updatedAt: new Date().toISOString(),
          usageHistory: existing?.usageHistory || normalized.usageHistory || [],
        };

        const exists = prev.coupons.some((item) => item.id === nextCoupon.id);
        const nextCoupons = exists
          ? prev.coupons.map((item) => (item.id === nextCoupon.id ? nextCoupon : item))
          : [...prev.coupons, nextCoupon];
        return { ...prev, coupons: nextCoupons };
      });
    };

    const deleteCoupon = (couponId: string) => {
      setState((prev) => ({
        ...prev,
        coupons: prev.coupons.filter((coupon) => coupon.id !== couponId),
      }));
    };

    const toggleCouponActive = (couponId: string) => {
      setState((prev) => ({
        ...prev,
        coupons: prev.coupons.map((coupon) =>
          coupon.id === couponId ? { ...coupon, isActive: !coupon.isActive } : coupon,
        ),
      }));
    };

    const markCouponUsed = (couponCode: string, studentEmail?: string, orderId?: string) => {
      const normalizedCode = String(couponCode || "").trim().toUpperCase();
      const email = String(studentEmail || "").trim().toLowerCase();
      if (!normalizedCode) return;

      setState((prev) => ({
        ...prev,
        coupons: prev.coupons.map((coupon) => {
          if (coupon.code.toUpperCase() !== normalizedCode) return coupon;

          const nextUsedBy = { ...(coupon.usedBy || {}) };
          if (email) {
            nextUsedBy[email] = Math.max(0, Number(nextUsedBy[email] || 0)) + 1;
          }

          const nextHistory = Array.isArray(coupon.usageHistory) ? [...coupon.usageHistory] : [];
          if (email) {
            nextHistory.unshift({
              email,
              usedAt: new Date().toISOString(),
              orderId: String(orderId || "").trim() || undefined,
            });
          }

          return {
            ...coupon,
            totalUsed: Math.max(0, Number(coupon.totalUsed || 0)) + 1,
            usedBy: nextUsedBy,
            usageHistory: nextHistory,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    };

    const getCurriculumForCourse = (courseId: string, courseTitle?: string): Chapter[] => {
      const existing = state.curricula[courseId];
      if (existing && existing.length > 0) {
        return existing;
      }
      return createFallbackCurriculum(courseTitle || "Course");
    };

    const setCurriculumForCourse = (courseId: string, curriculum: Chapter[]) => {
      setState((prev) => {
        const normalized = normalizeCurriculum(curriculum);
        const withDemo = withCourseDemoSelection(normalized);
        return {
          ...prev,
          curricula: {
            ...prev.curricula,
            [courseId]: withDemo,
          },
        };
      });
    };

    const setCourseDemoLesson = (courseId: string, lessonId?: string) => {
      setState((prev) => {
        const existing = prev.curricula[courseId];
        if (!existing || existing.length === 0) {
          return prev;
        }

        return {
          ...prev,
          curricula: {
            ...prev.curricula,
            [courseId]: withCourseDemoSelection(existing, lessonId),
          },
        };
      });
    };

    const resetPlatformData = () => {
      setState(createDefaultState());
    };

    return {
      ...state,
      upsertCourse,
      updateCourseDemoVideo,
      deleteCourse,
      toggleCourseVisibility,
      upsertCategory,
      deleteCategory,
      toggleCategoryVisibility,
      setBanners,
      setTestimonials,
      setAnnouncements,
      setCoupons,
      upsertCoupon,
      deleteCoupon,
      toggleCouponActive,
      markCouponUsed,
      getCurriculumForCourse,
      setCurriculumForCourse,
      setCourseDemoLesson,
      refreshData,
      resetPlatformData,
    };
  }, [state]);

  return <PlatformDataContext.Provider value={value}>{children}</PlatformDataContext.Provider>;
};

export const usePlatformData = () => {
  const context = useContext(PlatformDataContext);
  if (!context) {
    throw new Error("usePlatformData must be used inside PlatformDataProvider");
  }
  return context;
};
