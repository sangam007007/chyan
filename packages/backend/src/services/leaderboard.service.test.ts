// Feature: dashboard-backend, Property 5: Score aggregation correctness

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";

// Mock @/db/query.js and @/redis/index.js
vi.mock("@/db/query.js", () => ({
  query: vi.fn(),
}));

vi.mock("@/redis/index.js", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { getLeaderboard } from "./leaderboard.service.js";
import { query } from "@/db/query.js";
import { redis } from "@/redis/index.js";

const mockedQuery = vi.mocked(query);
const mockedRedis = vi.mocked(redis);

// ─── Helpers ──────────────────────────────────────────────────────────

type AttemptStatus = "in_progress" | "submitted" | "auto_submitted";

interface TestAttempt {
  status: AttemptStatus;
  totalScore: number;
}

/**
 * Given a set of test attempts with mixed statuses, compute the expected
 * aggregated total score (only submitted/auto_submitted attempts count).
 */
function computeExpectedTotalScore(attempts: TestAttempt[]): number {
  return attempts
    .filter((a) => a.status === "submitted" || a.status === "auto_submitted")
    .reduce((sum, a) => sum + a.totalScore, 0);
}

// ─── Property Tests ───────────────────────────────────────────────────

describe("Property 5: Score aggregation correctness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Ensure Redis cache miss so we hit the DB path
    mockedRedis.get.mockResolvedValue(null);
    mockedRedis.set.mockResolvedValue("OK");
  });

  /**
   * **Validates: Requirements 1.7**
   *
   * For any user with a mix of test attempts in statuses
   * (in_progress, submitted, auto_submitted), the computed total score
   * SHALL equal the sum of total_score values only from attempts with
   * status 'submitted' or 'auto_submitted'.
   *
   * The SQL query filters by status IN ('submitted', 'auto_submitted').
   * We simulate what the DB would return given correct filtering, then
   * verify the service returns that total correctly.
   */
  it("total score equals sum of only submitted/auto_submitted attempts", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a non-empty array of test attempts with mixed statuses
        fc.array(
          fc.record({
            status: fc.constantFrom(
              "in_progress" as AttemptStatus,
              "submitted" as AttemptStatus,
              "auto_submitted" as AttemptStatus,
            ),
            totalScore: fc.integer({ min: 1, max: 500 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        fc.uuid(),
        fc.uuid(),
        async (attempts: TestAttempt[], userId: string, examId: string) => {
          // Compute the expected aggregated score from eligible attempts only
          const expectedTotal = computeExpectedTotalScore(attempts);

          // If no eligible attempts, the user wouldn't appear in results
          // (HAVING COALESCE(SUM(ta.total_score), 0) > 0 filters them out)
          if (expectedTotal <= 0) {
            // Mock the leaderboard query to return empty (user excluded)
            mockedQuery.mockResolvedValueOnce([]);
            // Mock the user rank query to return empty
            mockedQuery.mockResolvedValueOnce([]);

            const result = await getLeaderboard(userId, "national", null);

            expect(result.entries).toEqual([]);
            expect(result.userRank).toBeNull();
            return;
          }

          // The DB would return a row with the correctly aggregated total
          // (the SQL SUM only includes submitted/auto_submitted attempts)
          const dbRow = {
            user_id: userId,
            full_name: "Test User",
            avatar_url: null,
            total_score: String(expectedTotal),
            rank: "1",
          };

          // Mock the leaderboard query to return this user
          mockedQuery.mockResolvedValueOnce([dbRow]);

          const result = await getLeaderboard(userId, "national", null);

          // Verify: the entry's totalScore matches the expected aggregation
          expect(result.entries.length).toBe(1);
          expect(result.entries[0].totalScore).toBe(expectedTotal);
          expect(result.entries[0].userId).toBe(userId);

          // User is in top 50 so userRank should match
          expect(result.userRank).not.toBeNull();
          expect(result.userRank!.totalScore).toBe(expectedTotal);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("in_progress attempts do not contribute to total score", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate attempts that are ALL in_progress
        fc.array(
          fc.record({
            status: fc.constant("in_progress" as AttemptStatus),
            totalScore: fc.integer({ min: 1, max: 500 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.uuid(),
        async (attempts: TestAttempt[], userId: string) => {
          // All in_progress → expected total is 0 → user excluded from leaderboard
          const expectedTotal = computeExpectedTotalScore(attempts);
          expect(expectedTotal).toBe(0);

          // Mock: leaderboard query returns empty, user rank query returns empty
          mockedQuery.mockResolvedValueOnce([]);
          mockedQuery.mockResolvedValueOnce([]);

          const result = await getLeaderboard(userId, "national", null);

          // User should not appear in leaderboard entries
          expect(result.entries).toEqual([]);
          expect(result.userRank).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("only eligible statuses contribute to aggregated score for state leaderboard", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate attempts with at least one eligible status
        fc.array(
          fc.record({
            status: fc.constantFrom(
              "in_progress" as AttemptStatus,
              "submitted" as AttemptStatus,
              "auto_submitted" as AttemptStatus,
            ),
            totalScore: fc.integer({ min: 1, max: 500 }),
          }),
          { minLength: 1, maxLength: 20 },
        ).filter((attempts) =>
          attempts.some(
            (a) => a.status === "submitted" || a.status === "auto_submitted",
          ),
        ),
        fc.uuid(),
        fc.uuid(),
        async (attempts: TestAttempt[], userId: string, examId: string) => {
          const expectedTotal = computeExpectedTotalScore(attempts);

          // DB returns the correctly aggregated row for state leaderboard
          const dbRow = {
            user_id: userId,
            full_name: "State User",
            avatar_url: "https://example.com/avatar.png",
            total_score: String(expectedTotal),
            rank: "1",
          };

          // Mock the state leaderboard query
          mockedQuery.mockResolvedValueOnce([dbRow]);

          const result = await getLeaderboard(userId, "state", examId);

          // Verify the service correctly passes through the aggregated score
          expect(result.entries.length).toBe(1);
          expect(result.entries[0].totalScore).toBe(expectedTotal);
          expect(result.type).toBe("state");

          // User is in top 50, so userRank matches
          expect(result.userRank).not.toBeNull();
          expect(result.userRank!.totalScore).toBe(expectedTotal);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// Feature: dashboard-backend, Property 2: National leaderboard includes all eligible users
describe("Property 2: National leaderboard includes all eligible users", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Redis cache miss by default
    mockedRedis.get.mockResolvedValue(null);
    mockedRedis.set.mockResolvedValue("OK" as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * For any set of users with completed test attempts across different exams,
   * the national leaderboard SHALL include all users regardless of their
   * selected_exam_id, and entries SHALL be sorted in descending order by total score.
   */
  it("national leaderboard includes all eligible users regardless of exam and entries are sorted descending by total score", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate between 1 and 80 users with different exam IDs and positive scores
        fc.array(
          fc.record({
            userId: fc.uuid(),
            fullName: fc.string({ minLength: 1, maxLength: 20 }),
            avatarUrl: fc.option(fc.constant("https://example.com/avatar.png"), { nil: null }),
            totalScore: fc.integer({ min: 1, max: 10000 }),
            examId: fc.oneof(
              fc.constant("exam-aaaa"),
              fc.constant("exam-bbbb"),
              fc.constant("exam-cccc"),
              fc.constant("exam-dddd")
            ),
          }),
          { minLength: 1, maxLength: 80 }
        ),
        async (users) => {
          const requestingUserId = users[0].userId;

          // For national leaderboard, DB returns ALL eligible users sorted by score desc, limited to 50
          // This mimics the NATIONAL_LEADERBOARD_SQL behavior
          const eligible = users.filter((u) => u.totalScore > 0);
          const sorted = [...eligible].sort((a, b) => b.totalScore - a.totalScore);
          const limited = sorted.slice(0, 50);

          // Compute ranks using DENSE_RANK logic
          let currentRank = 1;
          const rows = limited.map((u, idx) => {
            if (idx > 0 && limited[idx - 1].totalScore !== u.totalScore) {
              currentRank = idx + 1;
            }
            return {
              user_id: u.userId,
              full_name: u.fullName,
              avatar_url: u.avatarUrl,
              total_score: String(u.totalScore),
              rank: String(currentRank),
            };
          });

          // First mock: national leaderboard query
          mockedQuery.mockResolvedValueOnce(rows);

          // Second mock: user rank query if user not in top 50
          const userInRows = rows.some((r) => r.user_id === requestingUserId);
          if (!userInRows) {
            const userEntry = users.find((u) => u.userId === requestingUserId);
            if (userEntry && userEntry.totalScore > 0) {
              mockedQuery.mockResolvedValueOnce([
                {
                  user_id: userEntry.userId,
                  full_name: userEntry.fullName,
                  avatar_url: userEntry.avatarUrl,
                  total_score: String(userEntry.totalScore),
                  rank: "51",
                },
              ]);
            } else {
              mockedQuery.mockResolvedValueOnce([]);
            }
          }

          const result = await getLeaderboard(requestingUserId, "national", null);

          // Verify: entries are sorted by totalScore descending
          for (let i = 1; i < result.entries.length; i++) {
            expect(result.entries[i].totalScore).toBeLessThanOrEqual(
              result.entries[i - 1].totalScore
            );
          }

          // Verify: entries include users from multiple exams (when present in eligible set)
          const uniqueExamsInEligible = new Set(eligible.map((u) => u.examId));
          if (uniqueExamsInEligible.size > 1 && eligible.length > 1) {
            // The national leaderboard should not filter by exam.
            // Verify the result count matches what we provided (all eligible up to 50)
            const expectedCount = Math.min(eligible.length, 50);
            expect(result.entries.length).toBe(expectedCount);
          }

          // Verify: entries.length <= 50
          expect(result.entries.length).toBeLessThanOrEqual(50);

          // Verify: type is national
          expect(result.type).toBe("national");
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: dashboard-backend, Property 3: Leaderboard max size invariant
describe("Property 3: Leaderboard max size invariant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Redis cache miss by default
    mockedRedis.get.mockResolvedValue(null);
    mockedRedis.set.mockResolvedValue("OK" as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * **Validates: Requirements 1.5**
   *
   * For any dataset containing N eligible users (where N may be greater than 50),
   * the leaderboard entries array SHALL contain at most 50 items.
   *
   * The SQL already has LIMIT 50, so the mock simulates what the DB returns
   * (at most 50 rows). The property verifies the service correctly passes
   * through this limit.
   */
  it("entries array never exceeds 50 items for any dataset size 0–200", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 200 }),
        fc.constantFrom("state" as const, "national" as const),
        async (datasetSize: number, type: "state" | "national") => {
          // The SQL query has LIMIT 50, so the DB returns at most 50 rows
          const dbReturnCount = Math.min(datasetSize, 50);

          // Generate the rows that the DB would return
          const rows = Array.from({ length: dbReturnCount }, (_, i) => ({
            user_id: `user-${i}`,
            full_name: `User ${i}`,
            avatar_url: null,
            total_score: String((dbReturnCount - i) * 100),
            rank: String(i + 1),
          }));

          // First call: leaderboard query returns rows (limited to 50 by SQL)
          mockedQuery.mockResolvedValueOnce(rows);
          // Second call: user rank query returns empty (user not in results)
          mockedQuery.mockResolvedValueOnce([]);

          const examId = type === "state" ? "exam-test-123" : null;
          const result = await getLeaderboard("requesting-user-id", type, examId);

          // Verify: entries array never exceeds 50
          expect(result.entries.length).toBeLessThanOrEqual(50);
          // Verify: entries length matches what DB returned
          expect(result.entries.length).toBe(dbReturnCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// Feature: dashboard-backend, Property 7: Zero-attempt users excluded
describe("Property 7: Zero-attempt users excluded", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Redis cache miss by default so we hit the DB path
    mockedRedis.get.mockResolvedValue(null);
    mockedRedis.set.mockResolvedValue("OK" as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * **Validates: Requirements 1.10**
   *
   * For any leaderboard result (state or national), no entry SHALL have a
   * total score of zero, and no user without at least one submitted/auto_submitted
   * attempt SHALL appear.
   *
   * The SQL HAVING clause `HAVING COALESCE(SUM(ta.total_score), 0) > 0` filters
   * zero-score users at the DB level. The mock simulates this filtering by only
   * returning users with totalScore > 0. The property verifies that the service
   * never surfaces zero-score entries.
   */
  it("no entry in the result has totalScore of 0 and all entries have totalScore > 0", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a mixed dataset: some users with score > 0, some with score === 0
        fc.array(
          fc.record({
            userId: fc.uuid(),
            fullName: fc.string({ minLength: 1, maxLength: 30 }),
            avatarUrl: fc.option(fc.constant("https://example.com/avatar.png"), { nil: null }),
            totalScore: fc.oneof(
              fc.constant(0), // zero-score users (should be excluded)
              fc.integer({ min: 1, max: 10000 }) // eligible users
            ),
          }),
          { minLength: 1, maxLength: 60 },
        ),
        fc.constantFrom("state" as const, "national" as const),
        fc.uuid(),
        async (users, type, requestingUserId) => {
          // The SQL HAVING clause filters out zero-score users at the DB level
          // Mock returns ONLY users with totalScore > 0 (simulating the HAVING clause)
          const eligible = users.filter((u) => u.totalScore > 0);
          const sorted = [...eligible].sort((a, b) => b.totalScore - a.totalScore);
          const limited = sorted.slice(0, 50);

          // Compute DENSE_RANK
          let currentRank = 1;
          const rows = limited.map((u, idx) => {
            if (idx > 0 && limited[idx - 1].totalScore !== u.totalScore) {
              currentRank = idx + 1;
            }
            return {
              user_id: u.userId,
              full_name: u.fullName,
              avatar_url: u.avatarUrl,
              total_score: String(u.totalScore),
              rank: String(currentRank),
            };
          });

          // Mock the leaderboard query (returns only eligible rows, no zero-score)
          mockedQuery.mockResolvedValueOnce(rows);

          // Check if requesting user is in the top 50 results
          const userInRows = rows.some((r) => r.user_id === requestingUserId);
          if (!userInRows) {
            // Mock the user rank query - user might have score > 0 outside top 50 or be zero-score
            const requestingUser = users.find((u) => u.userId === requestingUserId);
            if (requestingUser && requestingUser.totalScore > 0) {
              mockedQuery.mockResolvedValueOnce([
                {
                  user_id: requestingUser.userId,
                  full_name: requestingUser.fullName,
                  avatar_url: requestingUser.avatarUrl,
                  total_score: String(requestingUser.totalScore),
                  rank: "51",
                },
              ]);
            } else {
              // Zero-score user or user not in dataset → no rank row
              mockedQuery.mockResolvedValueOnce([]);
            }
          }

          const examId = type === "state" ? "exam-test-xyz" : null;
          const result = await getLeaderboard(requestingUserId, type, examId);

          // Verify: no entry in the result has totalScore of 0
          for (const entry of result.entries) {
            expect(entry.totalScore).not.toBe(0);
          }

          // Verify: all entries have totalScore > 0
          for (const entry of result.entries) {
            expect(entry.totalScore).toBeGreaterThan(0);
          }

          // Verify: if userRank is present, it also has totalScore > 0
          if (result.userRank) {
            expect(result.userRank.totalScore).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
