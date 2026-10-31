import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// Mock the query module
vi.mock("@/db/query.js", () => ({
  query: vi.fn(),
}));

import { getStreak } from "./streak.service.js";
import { query } from "@/db/query.js";

const mockedQuery = vi.mocked(query);

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Given a "today" date string (YYYY-MM-DD), compute the expected streak
 * from a set of day offsets (0 = today, 1 = yesterday, etc.).
 */
function computeExpectedStreak(
  offsets: number[],
  todayStr: string
): { currentStreak: number; streakDates: string[] } {
  const offsetSet = new Set(offsets);

  if (!offsetSet.has(0)) {
    return { currentStreak: 0, streakDates: [] };
  }

  let streak = 0;
  const streakDates: string[] = [];
  let dayOffset = 0;

  while (offsetSet.has(dayOffset)) {
    streak++;
    streakDates.push(offsetToDateStr(todayStr, dayOffset));
    dayOffset++;
  }

  return { currentStreak: streak, streakDates };
}

/**
 * Convert a day offset (0 = today, 1 = yesterday, ...) to a YYYY-MM-DD string.
 */
function offsetToDateStr(todayStr: string, offset: number): string {
  const date = new Date(todayStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - offset);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Property Tests ───────────────────────────────────────────────────

// Feature: dashboard-backend, Property 9: Streak computation correctness
describe("Streak Service - Property 9: Streak computation correctness", () => {
  const FIXED_TODAY = "2025-01-15";

  beforeEach(() => {
    vi.useFakeTimers();
    // Set fake time to midday IST on the fixed date
    // IST is UTC+5:30, so midday IST = 06:30 UTC
    const fakeNow = new Date(`${FIXED_TODAY}T06:30:00.000Z`);
    vi.setSystemTime(fakeNow);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  // **Validates: Requirements 2.3, 2.4, 2.6**
  it("streak count equals length of longest unbroken consecutive day sequence backward from today", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a unique set of day offsets (0 = today, 1 = yesterday, etc.)
        fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { minLength: 0, maxLength: 30 }),
        async (offsets: number[]) => {
          // Convert offsets to activity date strings
          const activityDates = offsets
            .map((offset) => offsetToDateStr(FIXED_TODAY, offset))
            .sort()
            .reverse(); // sorted descending as the DB would return

          // Mock the DB to return these dates
          mockedQuery.mockResolvedValueOnce(
            activityDates.map((d) => ({ activity_date: d }))
          );

          const result = await getStreak("test-user-id");

          const expected = computeExpectedStreak(offsets, FIXED_TODAY);

          // Verify streak count
          expect(result.currentStreak).toBe(expected.currentStreak);

          // Verify streakDates contains only the consecutive dates
          expect(result.streakDates).toEqual(expected.streakDates);

          // Verify milestoneReached
          expect(result.milestoneReached).toBe(expected.currentStreak === 7);

          // Verify todayRecorded
          expect(result.todayRecorded).toBe(offsets.includes(0));
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Validates: Requirements 2.3, 2.4, 2.6**
  it("if today has no record, streak is 0", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate offsets that do NOT include 0 (today)
        fc.uniqueArray(fc.integer({ min: 1, max: 60 }), { minLength: 0, maxLength: 20 }),
        async (offsets: number[]) => {
          const activityDates = offsets
            .map((offset) => offsetToDateStr(FIXED_TODAY, offset))
            .sort()
            .reverse();

          mockedQuery.mockResolvedValueOnce(
            activityDates.map((d) => ({ activity_date: d }))
          );

          const result = await getStreak("test-user-id");

          // If today is not in the set, streak must be 0
          expect(result.currentStreak).toBe(0);
          expect(result.streakDates).toEqual([]);
          expect(result.todayRecorded).toBe(false);
          expect(result.milestoneReached).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Validates: Requirements 2.3, 2.4, 2.6**
  it("if today is in the set, streak equals length of consecutive sequence from today backward", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate offsets that always include 0 (today) plus random others
        fc.uniqueArray(fc.integer({ min: 1, max: 60 }), { minLength: 0, maxLength: 20 }),
        async (additionalOffsets: number[]) => {
          const offsets = [0, ...additionalOffsets];

          const activityDates = offsets
            .map((offset) => offsetToDateStr(FIXED_TODAY, offset))
            .sort()
            .reverse();

          mockedQuery.mockResolvedValueOnce(
            activityDates.map((d) => ({ activity_date: d }))
          );

          const result = await getStreak("test-user-id");

          // Compute expected consecutive count from today
          const offsetSet = new Set(offsets);
          let expectedStreak = 0;
          let day = 0;
          while (offsetSet.has(day)) {
            expectedStreak++;
            day++;
          }

          expect(result.currentStreak).toBe(expectedStreak);
          expect(result.todayRecorded).toBe(true);
          expect(result.streakDates.length).toBe(expectedStreak);
          expect(result.milestoneReached).toBe(expectedStreak === 7);
        }
      ),
      { numRuns: 100 }
    );
  });
});
