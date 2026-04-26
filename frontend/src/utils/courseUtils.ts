/**
 * Utility functions for course and package management
 */

/**
 * Parse lesson duration from various formats to seconds
 */
export const parseLessonDurationToSeconds = (value: unknown): number => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return 0;
  if (raw.includes(":")) {
    const parts = raw.split(":").map(Number);
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.floor(Number(raw) * 60);
  const h = Number((raw.match(/(\d+(?:\.\d+)?)\s*h/) || [])[1] || 0);
  const m = Number((raw.match(/(\d+(?:\.\d+)?)\s*m/) || [])[1] || 0);
  const s = Number((raw.match(/(\d+(?:\.\d+)?)\s*s/) || [])[1] || 0);
  return Math.max(0, Math.floor(h * 3600 + m * 60 + s));
};

/**
 * Compute curriculum metadata from chapters
 */
export const computeCurriculumMeta = (chapters: any[]) => {
  const lessons = Array.isArray(chapters) ? chapters.flatMap((ch) => Array.isArray(ch?.lessons) ? ch.lessons : []) : [];
  const videoLessons = lessons.filter((l) => l?.type === "video");
  const totalSeconds = videoLessons.reduce((sum, l) => sum + parseLessonDurationToSeconds(l?.duration), 0);
  return { lectures: videoLessons.length, totalSeconds, hours: Number((totalSeconds / 3600).toFixed(1)) };
};

/**
 * Format seconds to HH:MM:SS
 */
export const formatSecondsToClock = (s: number): string => {
  const t = Math.max(0, Math.floor(Number(s) || 0));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};

/**
 * Parse comma-separated positive numbers
 */
export const parsePositiveNumberList = (value: string, fallback: number[]): number[] => {
  const parsed = value.split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x >= 1);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback;
};

/**
 * Extract first positive integer from text
 */
export const parseFirstPositiveInt = (value: unknown): number => {
  const text = String(value || "");
  const match = text.match(/(\d+)/);
  if (!match) return 0;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) && numeric >= 1 ? numeric : 0;
};

/**
 * Parse custom modes from text input
 */
export const parseCustomModes = (value: string) =>
  value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [lp, pp] = line.split(":");
      const label = String(lp || "").trim();
      const price = Number(String(pp || "").trim());
      if (!label || !Number.isFinite(price) || price <= 0) return null;
      return { 
        id: `custom-${i + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, 
        label, 
        price 
      };
    })
    .filter((x): x is { id: string; label: string; price: number } => Boolean(x));

/**
 * Parse reviews from text input
 */
export const parseReviewsText = (value: string) =>
  value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [np, rp, cp, dp] = line.split("|");
      const name = String(np || "").trim();
      const rating = Math.max(1, Math.min(5, Number(String(rp || "").trim() || 5)));
      const comment = String(cp || "").trim();
      const date = String(dp || "").trim();
      if (!name || !comment) return null;
      return { name, rating, comment, date };
    })
    .filter((x): x is { name: string; rating: number; comment: string; date: string } => Boolean(x));

/**
 * Decode demo video URL
 */
export const decodeDemoVideoValue = (value: unknown): string => {
  // Import would be needed for decodeVideoUrl, but we'll keep it simple
  return String(value || "").trim();
};

/**
 * Generate a unique key for a pricing combination
 */
export const combinationTupleKey = (item: {
  viewModeId?: string | null;
  validityOptionId?: string | null;
  attemptOptionId?: string | null;
  deliveryModeId?: string | null;
  languageId?: string | null;
}): string => [
  String(item.viewModeId || "").trim() || "any",
  String(item.validityOptionId || "").trim() || "any",
  String(item.attemptOptionId || "").trim() || "any",
  String(item.deliveryModeId || "").trim() || "any",
  String(item.languageId || "").trim() || "any",
].join("|");

/**
 * Check for duplicate combinations
 */
export const hasDuplicateCombinationTuple = (
  items: Array<{
    viewModeId?: string | null;
    validityOptionId?: string | null;
    attemptOptionId?: string | null;
    deliveryModeId?: string | null;
    languageId?: string | null;
  }>
): boolean => {
  const seen = new Set<string>();
  for (const item of items) {
    const key = combinationTupleKey(item);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};

/**
 * Types
 */
export type AdminCoursesMode = "courses" | "packages";

export interface VideoUploadState {
  scope: "course" | "package";
  status: "idle" | "uploading" | "error" | "cancelled" | "success";
  progress: number;
  fileName: string;
  message?: string;
}

export interface CourseForm {
  // Basic info
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  categoryId: string;
  subcategory: string;
  level: string;
  subject: string;
  professor: string;
  language: string;
  tags: string;
  code: string;
  // Pricing
  price: number;
  originalPrice: number;
  taxPct: number;
  masterCombinationsEnabled: boolean;
  defaultSelectedCombinationId: string;
  masterCombinationRows: Array<{
    id: string;
    viewModeId?: string | null;
    validityOptionId?: string | null;
    attemptOptionId?: string | null;
    deliveryModeId?: string | null;
    languageId?: string | null;
    price: number;
    originalPrice: number;
    taxPct: number;
    label?: string;
    isActive?: boolean;
  }>;
  // View options
  viewPricingEnabled: boolean;
  unlimitedViews: boolean;
  viewOptionsText: string;
  // Validity
  validityEnabled: boolean;
  validityDaysText: string;
  // Delivery modes
  deliveryEnabled: boolean;
  onlineMode: boolean;
  onlinePrice: number;
  driveMode: boolean;
  drivePrice: number;
  penMode: boolean;
  penPrice: number;
  // Book addons
  bookAddon: boolean;
  enotesEnabled: boolean;
  enotesPrice: number;
  physBookEnabled: boolean;
  physBookPrice: number;
  // Demo video
  demoVideoVisible: boolean;
  webPlayEnabled: boolean;
  demoVideoTitle: string;
  demoVideoDescription: string;
  demoVideoSource: "youtube" | "direct" | "upload";
  demoVideoUrl: string;
  demoVideoThumbnailUrl: string;
  // About + ratings/reviews
  aboutCourseEnabled: boolean;
  aboutCourseText: string;
  ratingsEnabled: boolean;
  reviewsEnabled: boolean;
  ratingValue: number;
  ratingCount: number;
  reviewsText: string;
  enrollmentCount: number;
  showEnrollmentCount: boolean;
  showMetaLectures: boolean;
  showMetaHours: boolean;
  showMetaValidity: boolean;
  showMetaResources: boolean;
  showMetaViews: boolean;
  showMetaPerHour: boolean;
  showMetaLanguage: boolean;
}