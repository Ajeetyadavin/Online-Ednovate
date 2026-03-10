import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  bannerSlides as seedBannerSlides,
  categories as seedCategories,
  courses as seedCourses,
  testimonials as seedTestimonials,
  type Course,
} from "@/data/courses";
import {
  decodeVideoUrl,
  detectVideoSource,
  encodeVideoUrl,
  type LessonVideoSource,
} from "@/lib/video-utils";

export interface ManagedCourse extends Course {
  isVisible: boolean;
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
}

export interface ManagedAnnouncement {
  id: string;
  title: string;
  content: string;
  link: string;
  isVisible: boolean;
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
}

export interface Chapter {
  id: string;
  title: string;
  description?: string;
  lessons: Lesson[];
}

interface PlatformDataState {
  courses: ManagedCourse[];
  categories: ManagedCategory[];
  banners: ManagedBanner[];
  testimonials: ManagedTestimonial[];
  announcements: ManagedAnnouncement[];
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
  getCurriculumForCourse: (courseId: string, courseTitle?: string) => Chapter[];
  setCurriculumForCourse: (courseId: string, curriculum: Chapter[]) => void;
  setCourseDemoLesson: (courseId: string, lessonId?: string) => void;
  resetPlatformData: () => void;
}

const STORAGE_KEY = "ednovate_platform_data";

const defaultCategoryColor = (id: string) => {
  if (id.startsWith("ca")) return "#1E40AF";
  if (id.startsWith("cs")) return "#7C3AED";
  if (id.startsWith("cma")) return "#D97706";
  if (id.startsWith("cfa")) return "#0D9488";
  if (id.startsWith("acca")) return "#DC2626";
  if (id.startsWith("fyjc")) return "#059669";
  if (id.startsWith("syjc")) return "#EA580C";
  return "#475569";
};

const defaultAnnouncements: ManagedAnnouncement[] = [
  {
    id: "1",
    title: "CA Foundation Nov 2025 batch",
    content: "Early bird 20% off",
    link: "/packages?category=ca",
    isVisible: true,
  },
  {
    id: "2",
    title: "Free Demo Classes",
    content: "Live for all courses",
    link: "/packages",
    isVisible: true,
  },
  {
    id: "3",
    title: "CS Executive new batch starts 1 April",
    content: "Limited seats",
    link: "/packages?category=cs",
    isVisible: true,
  },
];

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
  // Keep demo URL obfuscated in local storage while rendering decodes it.
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
  language: course.language || "English",
  lectures: Number(course.lectures || 0),
  hours: Number(course.hours || 0),
  price: Number(course.price || 0),
  originalPrice: Number(course.originalPrice || course.price || 0),
  discount: Number(course.discount || 0),
  image: course.image || "/placeholder.svg",
  professor: course.professor || "Ednovate Faculty",
  isCombo: Boolean(course.isCombo),
  isMaterial: Boolean(course.isMaterial),
  isVisible: course.isVisible !== false,
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
        lessons,
      } satisfies Chapter;
    })
    .filter((chapter) => chapter.lessons.length > 0);
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
  const courses = seedCourses.map((course, index) => normalizeCourse(course, index));

  const categories = seedCategories
    .filter((category) => category.id !== "all")
    .map((category, index) => {
      const parentId = category.id.includes("-") ? category.id.split("-")[0] : null;
      return normalizeCategory(
        {
          id: category.id,
          name: category.label,
          slug: category.id,
          color: defaultCategoryColor(category.id),
          isVisible: true,
          parentId,
          sortOrder: index + 1,
        },
        index,
      );
    });

  const banners = seedBannerSlides.map((slide, index) =>
    normalizeBanner(
      {
        id: String(slide.id),
        title: `Banner ${index + 1}`,
        imageUrl: slide.image,
        isVisible: true,
        sortOrder: index + 1,
      },
      index,
    ),
  );

  const testimonials = seedTestimonials.map((item, index) =>
    normalizeTestimonial(
      {
        id: item.id,
        authorName: item.name,
        authorRole: `${item.course} Student`,
        content: item.feedback,
        rating: item.rating,
        isVisible: true,
      },
      index,
    ),
  );

  const curricula = Object.fromEntries(
    courses.map((course) => [course.id, createFallbackCurriculum(course.title)]),
  );

  return {
    courses,
    categories,
    banners,
    testimonials,
    announcements: defaultAnnouncements,
    curricula: ensureCourseScopedDemos(curricula),
  };
};

const loadInitialState = (): PlatformDataState => {
  const fallback = createDefaultState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlatformDataState>;

    const courses = Array.isArray(parsed.courses)
      ? parsed.courses.map((course, index) => normalizeCourse(course, index))
      : fallback.courses;

    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.map((category, index) => normalizeCategory(category, index))
      : fallback.categories;

    const banners = Array.isArray(parsed.banners)
      ? parsed.banners.map((banner, index) => normalizeBanner(banner, index))
      : fallback.banners;

    const testimonials = Array.isArray(parsed.testimonials)
      ? parsed.testimonials.map((testimonial, index) => normalizeTestimonial(testimonial, index))
      : fallback.testimonials;

    const announcements = Array.isArray(parsed.announcements)
      ? parsed.announcements.map((announcement, index) => normalizeAnnouncement(announcement, index))
      : fallback.announcements;

    const parsedCurricula = parsed.curricula || {};
    const curricula: Record<string, Chapter[]> = {};
    courses.forEach((course) => {
      const normalized = normalizeCurriculum(parsedCurricula[course.id]);
      curricula[course.id] = normalized.length > 0 ? normalized : createFallbackCurriculum(course.title);
    });

    return {
      courses,
      categories,
      banners,
      testimonials,
      announcements,
      curricula: ensureCourseScopedDemos(curricula),
    };
  } catch {
    return fallback;
  }
};

const PlatformDataContext = createContext<PlatformDataContextType | null>(null);

export const PlatformDataProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PlatformDataState>(() => loadInitialState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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

    const getCurriculumForCourse = (courseId: string, courseTitle?: string): Chapter[] => {
      const existing = state.curricula[courseId];
      if (existing && existing.length > 0) {
        return existing;
      }
      return createFallbackCurriculum(courseTitle || "Course");
    };

    const setCurriculumForCourse = (courseId: string, curriculum: Chapter[]) => {
      setState((prev) => ({
        ...prev,
        curricula: {
          ...prev.curricula,
          [courseId]: withCourseDemoSelection(normalizeCurriculum(curriculum)),
        },
      }));
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
      localStorage.removeItem(STORAGE_KEY);
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
      getCurriculumForCourse,
      setCurriculumForCourse,
      setCourseDemoLesson,
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
