export interface CourseAccessLike {
  isEnabled?: boolean;
  isUnlimitedViews?: boolean;
  expiresAt?: string | null;
  remainingViews?: number;
  totalViews?: number;
  usedViews?: number;
  remainingWatchSeconds?: number;
  allowedWatchSeconds?: number;
  usedWatchSeconds?: number;
}

export type CourseAccessIssue = "disabled" | "expired" | "watchtime_over" | null;

export const computeRemainingViews = (entry: CourseAccessLike) => {
  const remaining = Number(entry.remainingViews);
  if (Number.isFinite(remaining)) {
    return Math.max(0, remaining);
  }
  const total = Number(entry.totalViews || 0);
  const used = Number(entry.usedViews || 0);
  return Math.max(0, total - used);
};

export const isAccessExpired = (entry: CourseAccessLike, nowMs = Date.now()) => {
  if (!entry.expiresAt) return false;
  const expiresMs = new Date(entry.expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return false;
  return expiresMs <= nowMs;
};

export const isCourseAccessActive = (entry?: CourseAccessLike | null, nowMs = Date.now()) => {
  if (!entry) return false;
  if (entry.isEnabled === false) return false;
  if (isAccessExpired(entry, nowMs)) return false;
  if (entry.isUnlimitedViews === true) return true;
  const remainingWatchSeconds = Number(entry.remainingWatchSeconds);
  if (Number.isFinite(remainingWatchSeconds)) {
    return Math.max(0, remainingWatchSeconds) > 0;
  }

  const allowedWatchSeconds = Number(entry.allowedWatchSeconds);
  const usedWatchSeconds = Number(entry.usedWatchSeconds || 0);
  if (Number.isFinite(allowedWatchSeconds) && allowedWatchSeconds > 0) {
    return Math.max(0, allowedWatchSeconds - usedWatchSeconds) > 0;
  }

  return computeRemainingViews(entry) > 0;
};

export const getCourseAccessIssue = (entry?: CourseAccessLike | null, nowMs = Date.now()): CourseAccessIssue => {
  if (!entry) return null;
  if (entry.isEnabled === false) return "disabled";
  if (isAccessExpired(entry, nowMs)) return "expired";
  if (entry.isUnlimitedViews === true) return null;

  const remainingWatchSeconds = Number(entry.remainingWatchSeconds);
  if (Number.isFinite(remainingWatchSeconds)) {
    return Math.max(0, remainingWatchSeconds) > 0 ? null : "watchtime_over";
  }

  const allowedWatchSeconds = Number(entry.allowedWatchSeconds);
  const usedWatchSeconds = Number(entry.usedWatchSeconds || 0);
  if (Number.isFinite(allowedWatchSeconds) && allowedWatchSeconds > 0) {
    return Math.max(0, allowedWatchSeconds - usedWatchSeconds) > 0 ? null : "watchtime_over";
  }

  return computeRemainingViews(entry) > 0 ? null : "watchtime_over";
};

export const getCourseAccessIssueLabel = (entry?: CourseAccessLike | null, nowMs = Date.now()) => {
  const issue = getCourseAccessIssue(entry, nowMs);
  if (issue === "disabled") return "Disabled";
  if (issue === "expired") return "Expired";
  if (issue === "watchtime_over") return "Watchtime Over";
  return "Access Active";
};

export const getCourseAccessIssueMessage = (entry?: CourseAccessLike | null, nowMs = Date.now()) => {
  const issue = getCourseAccessIssue(entry, nowMs);
  if (issue === "disabled") return "Course disabled by admin.";
  if (issue === "expired") return "Course validity expired.";
  if (issue === "watchtime_over") return "Watchtime over.";
  return "Access active.";
};

export const progressFromViews = (entry: CourseAccessLike) => {
  const total = Math.max(0, Number(entry.totalViews || 0));
  const used = Math.max(0, Number(entry.usedViews || 0));
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
};
