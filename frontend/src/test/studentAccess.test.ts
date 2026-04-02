import { describe, expect, it } from "vitest";
import {
  computeRemainingViews,
  getCourseAccessIssue,
  getCourseAccessIssueLabel,
  isAccessExpired,
  isCourseAccessActive,
  progressFromViews,
} from "@/lib/studentAccess";

describe("studentAccess utils", () => {
  it("computes remaining views from explicit value", () => {
    expect(computeRemainingViews({ remainingViews: 3, totalViews: 10, usedViews: 9 })).toBe(3);
  });

  it("computes remaining views from total-used when remaining not given", () => {
    expect(computeRemainingViews({ totalViews: 8, usedViews: 3 })).toBe(5);
    expect(computeRemainingViews({ totalViews: 4, usedViews: 9 })).toBe(0);
  });

  it("detects expired access", () => {
    const now = new Date("2026-03-21T10:00:00Z").getTime();
    expect(isAccessExpired({ expiresAt: "2026-03-20T10:00:00Z" }, now)).toBe(true);
    expect(isAccessExpired({ expiresAt: "2026-03-25T10:00:00Z" }, now)).toBe(false);
    expect(isAccessExpired({ expiresAt: undefined }, now)).toBe(false);
  });

  it("marks access active only when enabled, not expired, and views remain", () => {
    const now = new Date("2026-03-21T10:00:00Z").getTime();

    expect(
      isCourseAccessActive(
        { isEnabled: true, expiresAt: "2026-03-25T10:00:00Z", totalViews: 2, usedViews: 1 },
        now,
      ),
    ).toBe(true);

    expect(
      isCourseAccessActive(
        { isEnabled: false, expiresAt: "2026-03-25T10:00:00Z", totalViews: 2, usedViews: 1 },
        now,
      ),
    ).toBe(false);

    expect(
      isCourseAccessActive(
        { isEnabled: true, expiresAt: "2026-03-20T10:00:00Z", totalViews: 2, usedViews: 1 },
        now,
      ),
    ).toBe(false);

    expect(
      isCourseAccessActive(
        { isEnabled: true, expiresAt: "2026-03-25T10:00:00Z", totalViews: 2, usedViews: 2 },
        now,
      ),
    ).toBe(false);
  });

  it("calculates progress from views safely", () => {
    expect(progressFromViews({ totalViews: 10, usedViews: 6 })).toBe(60);
    expect(progressFromViews({ totalViews: 0, usedViews: 6 })).toBe(0);
    expect(progressFromViews({ totalViews: 2, usedViews: 7 })).toBe(100);
  });

  it("classifies disabled and watchtime-over states", () => {
    const now = new Date("2026-03-21T10:00:00Z").getTime();

    expect(getCourseAccessIssue({ isEnabled: false, expiresAt: "2026-03-25T10:00:00Z", totalViews: 2, usedViews: 1 }, now)).toBe("disabled");
    expect(getCourseAccessIssue({ isEnabled: true, remainingWatchSeconds: 0, totalViews: 2, usedViews: 2 }, now)).toBe("watchtime_over");
    expect(getCourseAccessIssueLabel({ isEnabled: true, remainingWatchSeconds: 0, totalViews: 2, usedViews: 2 }, now)).toBe("Watchtime Over");
  });
});
