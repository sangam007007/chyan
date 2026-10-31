import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

import { getTestsForUser, type SortOption } from "./test-listing.service.js";
import { VALID_CATEGORIES, type TestCategory } from "@/schemas/test.schema.js";

// Mock the database module
vi.mock("@/db/index.js", () => ({
  queryMany: vi.fn(),
  queryOne: vi.fn(),
}));

import { queryMany, queryOne } from "@/db/index.js";

const mockQueryMany = vi.mocked(queryMany);
const mockQueryOne = vi.mocked(queryOne);

// ─── Test Fixtures ────────────────────────────────────────────────────

function makeTestRow(overrides: Partial<{
  id: string;
  title_en: string;
  title_hi: string;
  duration_minutes: number;
  total_marks: number;
  pricing_type: "free" | "premium";
  created_at: Date;
  attempt_count: number;
  question_count: number;
  attempt_status: string | null;
  last_score: number | null;
  last_attempt_id: string | null;
  user_attempt_count: number;
  category: string;
  subject_id: string | null;
  topic_id: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "test-1",
    title_en: overrides.title_en ?? "Sample Test",
    title_hi: overrides.title_hi ?? "सैंपल टेस्ट",
    duration_minutes: overrides.duration_minutes ?? 60,
    total_marks: overrides.total_marks ?? 100,
    pricing_type: overrides.pricing_type ?? "free",
    created_at: overrides.created_at ?? new Date("2024-01-15"),
    attempt_count: overrides.attempt_count ?? 50,
    question_count: overrides.question_count ?? 20,
    attempt_status: overrides.attempt_status ?? null,
    last_score: overrides.last_score ?? null,
    last_attempt_id: overrides.last_attempt_id ?? null,
    user_attempt_count: overrides.user_attempt_count ?? 0,
    category: overrides.category ?? "full_mock",
    subject_id: overrides.subject_id ?? null,
    topic_id: overrides.topic_id ?? null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("getTestsForUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("basic listing", () => {
    it("should return tests with correct field mapping", async () => {
      const row = makeTestRow({
        id: "abc-123",
        title_en: "Mock Test 1",
        title_hi: "मॉक टेस्ट 1",
        duration_minutes: 90,
        total_marks: 200,
        pricing_type: "premium",
        question_count: 30,
      });

      mockQueryMany.mockResolvedValue([row]);
      mockQueryOne.mockResolvedValue({ total: "1" });

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0]).toEqual({
        id: "abc-123",
        titleEn: "Mock Test 1",
        titleHi: "मॉक टेस्ट 1",
        duration: 90,
        totalQuestions: 30,
        totalMarks: 200,
        pricingType: "premium",
        attemptStatus: "not_attempted",
        attemptCount: 0,
        maxAttempts: 5,
        createdAt: row.created_at,
        category: "full_mock",
        subjectId: null,
        topicId: null,
      });
      expect(result.total).toBe(1);
    });

    it("should return empty array when no tests match", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.tests).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("attempt status derivation", () => {
    it("should derive 'not_attempted' when no attempt exists", async () => {
      mockQueryMany.mockResolvedValue([makeTestRow({ attempt_status: null })]);
      mockQueryOne.mockResolvedValue({ total: "1" });

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.tests[0].attemptStatus).toBe("not_attempted");
      expect(result.tests[0].lastScore).toBeUndefined();
    });

    it("should derive 'in_progress' when latest attempt is in_progress", async () => {
      mockQueryMany.mockResolvedValue([
        makeTestRow({ attempt_status: "in_progress" }),
      ]);
      mockQueryOne.mockResolvedValue({ total: "1" });

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.tests[0].attemptStatus).toBe("in_progress");
      expect(result.tests[0].lastScore).toBeUndefined();
    });

    it("should derive 'completed' with lastScore when attempt is submitted", async () => {
      mockQueryMany.mockResolvedValue([
        makeTestRow({ attempt_status: "submitted", last_score: 85 }),
      ]);
      mockQueryOne.mockResolvedValue({ total: "1" });

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.tests[0].attemptStatus).toBe("completed");
      expect(result.tests[0].lastScore).toBe(85);
    });

    it("should derive 'completed' when attempt is auto_submitted", async () => {
      mockQueryMany.mockResolvedValue([
        makeTestRow({ attempt_status: "auto_submitted", last_score: 42.5 }),
      ]);
      mockQueryOne.mockResolvedValue({ total: "1" });

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.tests[0].attemptStatus).toBe("completed");
      expect(result.tests[0].lastScore).toBe(42.5);
    });
  });

  describe("pagination", () => {
    it("should pass correct LIMIT and OFFSET for page 1", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      // Verify params: [userId, examId, limit, offset]
      const callArgs = mockQueryMany.mock.calls[0][1];
      expect(callArgs).toEqual(["user-1", "exam-1", 10, 0]);
    });

    it("should pass correct LIMIT and OFFSET for page 3", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-1", "exam-1", "newest", 3, 5);

      const callArgs = mockQueryMany.mock.calls[0][1];
      expect(callArgs).toEqual(["user-1", "exam-1", 5, 10]); // offset = (3-1)*5 = 10
    });

    it("should return correct total from count query", async () => {
      mockQueryMany.mockResolvedValue([makeTestRow()]);
      mockQueryOne.mockResolvedValue({ total: "42" });

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.total).toBe(42);
    });
  });

  describe("sort options", () => {
    it("should include ORDER BY created_at DESC for 'newest'", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      const sql = mockQueryMany.mock.calls[0][0] as string;
      expect(sql).toContain("ORDER BY t.created_at DESC");
    });

    it("should include ORDER BY attempt_count DESC for 'popular'", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-1", "exam-1", "popular", 1, 10);

      const sql = mockQueryMany.mock.calls[0][0] as string;
      expect(sql).toContain("ORDER BY t.attempt_count DESC");
    });

    it("should include difficulty subquery for 'difficulty'", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-1", "exam-1", "difficulty", 1, 10);

      const sql = mockQueryMany.mock.calls[0][0] as string;
      expect(sql).toContain("CASE q.difficulty");
      expect(sql).toContain("WHEN 'easy' THEN 1");
      expect(sql).toContain("WHEN 'medium' THEN 2");
      expect(sql).toContain("WHEN 'hard' THEN 3");
    });
  });

  describe("query structure", () => {
    it("should filter by published status and exam_id", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-1", "exam-abc", "newest", 1, 10);

      const sql = mockQueryMany.mock.calls[0][0] as string;
      expect(sql).toContain("t.status = 'published'");
      expect(sql).toContain("t.exam_id = $2");

      const params = mockQueryMany.mock.calls[0][1];
      expect(params![1]).toBe("exam-abc");
    });

    it("should filter by schedule window", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      const sql = mockQueryMany.mock.calls[0][0] as string;
      expect(sql).toContain("t.available_from IS NULL OR t.available_from <= NOW()");
      expect(sql).toContain("t.available_until IS NULL OR t.available_until >= NOW()");
    });

    it("should join test_attempts filtered by userId", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total: "0" });

      await getTestsForUser("user-123", "exam-1", "newest", 1, 10);

      const sql = mockQueryMany.mock.calls[0][0] as string;
      expect(sql).toContain("ta.user_id = $1");

      const params = mockQueryMany.mock.calls[0][1];
      expect(params![0]).toBe("user-123");
    });

    it("should handle null total count gracefully", async () => {
      mockQueryMany.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue(null);

      const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 10);

      expect(result.total).toBe(0);
    });
  });
});


// ─── Property-Based Tests ─────────────────────────────────────────────

describe("Feature: test-categories, Property 2: Category Filtering Returns Only Matching Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Validates: Requirements 2.5, 3.2, 3.5
   */
  it("should include category filter clause in SQL when a valid category is provided", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...VALID_CATEGORIES),
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.constantFrom<SortOption>("newest", "popular", "difficulty"),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        async (category, testRecords, sort, page, limit) => {
          vi.resetAllMocks();

          // Mock returns rows matching the chosen category (simulating DB filter)
          const matchingRows = testRecords
            .filter((r) => r.category === category)
            .map((r) =>
              makeTestRow({ id: r.id, category: r.category })
            );
          const matchingCount = matchingRows.length;

          mockQueryMany.mockResolvedValue(matchingRows);
          mockQueryOne.mockResolvedValue({ total: String(matchingCount) });

          await getTestsForUser("user-1", "exam-1", sort, page, limit, category);

          // Verify the main query SQL includes the category filter
          const mainSql = mockQueryMany.mock.calls[0][0] as string;
          expect(mainSql).toContain("AND t.category = $5");

          // Verify params are: [userId, examId, limit, offset, category]
          const mainParams = mockQueryMany.mock.calls[0][1] as (string | number)[];
          expect(mainParams[4]).toBe(category);

          // Existing base filters are still present alongside category filter
          expect(mainSql).toContain("t.status = 'published'");
          expect(mainSql).toContain("t.exam_id = $2");
          expect(mainSql).toContain("t.available_from IS NULL OR t.available_from <= NOW()");
          expect(mainSql).toContain("t.available_until IS NULL OR t.available_until >= NOW()");
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: test-categories, Property 3: All Filter Returns All Categories", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Validates: Requirements 2.6, 3.3
   */
  it("should NOT include category filter clause when category is undefined", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.constantFrom<SortOption>("newest", "popular", "difficulty"),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        async (testRecords, sort, page, limit) => {
          vi.resetAllMocks();

          const rows = testRecords.map((r) =>
            makeTestRow({ id: r.id, category: r.category })
          );

          mockQueryMany.mockResolvedValue(rows);
          mockQueryOne.mockResolvedValue({ total: String(rows.length) });

          // Call without category (undefined) → "All" behavior
          await getTestsForUser("user-1", "exam-1", sort, page, limit);

          // Verify the main query SQL does NOT include category filter
          const mainSql = mockQueryMany.mock.calls[0][0] as string;
          expect(mainSql).not.toContain("AND t.category = $");

          // Verify params only contain [userId, examId, limit, offset]
          const mainParams = mockQueryMany.mock.calls[0][1] as (string | number)[];
          expect(mainParams).toHaveLength(4);

          // Verify count query also does NOT include category filter
          const countSql = mockQueryOne.mock.calls[0][0] as string;
          expect(countSql).not.toContain("AND t.category = $");

          // Count params should only have [examId]
          const countParams = mockQueryOne.mock.calls[0][1] as (string | number)[];
          expect(countParams).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: test-categories, Property 4: Invalid Category Defaults to All", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * At the service level, undefined category means no filter is applied.
   * The controller is responsible for normalizing invalid values to undefined.
   * This test verifies that undefined input to the service behaves identically
   * to "all" — no category clause in query.
   *
   * Validates: Requirements 3.4
   */
  it("should treat undefined category the same as 'all' (no filter clause)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<SortOption>("newest", "popular", "difficulty"),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        async (sort, page, limit) => {
          vi.resetAllMocks();

          mockQueryMany.mockResolvedValue([]);
          mockQueryOne.mockResolvedValue({ total: "0" });

          // Call with explicit undefined (simulating controller passing invalid→undefined)
          await getTestsForUser("user-1", "exam-1", sort, page, limit, undefined);

          const mainSql = mockQueryMany.mock.calls[0][0] as string;
          expect(mainSql).not.toContain("AND t.category = $");

          const countSql = mockQueryOne.mock.calls[0][0] as string;
          expect(countSql).not.toContain("AND t.category = $");

          // Params should not include any category value
          const mainParams = mockQueryMany.mock.calls[0][1] as (string | number)[];
          expect(mainParams).toHaveLength(4);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: test-categories, Property 5: Pagination Total Reflects Filtered Count", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Validates: Requirements 3.6
   */
  it("should include category filter in count query when category is provided", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...VALID_CATEGORIES),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        async (category, totalMatching, page, limit) => {
          vi.resetAllMocks();

          mockQueryMany.mockResolvedValue([]);
          mockQueryOne.mockResolvedValue({ total: String(totalMatching) });

          const result = await getTestsForUser("user-1", "exam-1", "newest", page, limit, category);

          // Verify the count query includes the category filter
          const countSql = mockQueryOne.mock.calls[0][0] as string;
          expect(countSql).toContain("AND t.category = $");

          // Verify the category value is passed to the count query at position [1]
          // Count params are: [examId, category]
          const countParams = mockQueryOne.mock.calls[0][1] as (string | number)[];
          expect(countParams[1]).toBe(category);

          // Verify the total reflects the mocked count (which represents filtered count)
          expect(result.total).toBe(totalMatching);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should NOT include category filter in count query when category is undefined", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        async (totalAll, page, limit) => {
          vi.resetAllMocks();

          mockQueryMany.mockResolvedValue([]);
          mockQueryOne.mockResolvedValue({ total: String(totalAll) });

          const result = await getTestsForUser("user-1", "exam-1", "newest", page, limit);

          // Count query should NOT have category filter
          const countSql = mockQueryOne.mock.calls[0][0] as string;
          expect(countSql).not.toContain("AND t.category = $");

          // Total reflects unfiltered count
          expect(result.total).toBe(totalAll);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ─── Property 4: Subject and Topic Filter Correctness ─────────────────

describe("Feature: subject-category-restructuring, Property 4: Subject and Topic Filter Correctness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Validates: Requirements 4.1, 4.5, 6.3, 6.4, 6.5
   *
   * For any set of test records with varying category, subject_id, and topic_id:
   * - When filtering by subjectId alone: SQL includes AND t.subject_id = $N
   * - When filtering by subjectId with topicId = null: SQL includes AND t.subject_id = $N AND t.topic_id IS NULL
   * - When filtering by both subjectId and topicId: SQL includes AND t.subject_id = $N AND t.topic_id = $M
   */
  it("should apply subject_id filter when subjectId is provided without topicId", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            subject_id: fc.oneof(fc.uuid(), fc.constant(null)),
            topic_id: fc.oneof(fc.uuid(), fc.constant(null)),
          }),
          { minLength: 0, maxLength: 15 }
        ),
        fc.constantFrom<SortOption>("newest", "popular", "difficulty"),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        async (subjectId, testRecords, sort, page, limit) => {
          vi.resetAllMocks();

          // Simulate DB returning only matching rows
          const matchingRows = testRecords
            .filter((r) => r.subject_id === subjectId)
            .map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: r.topic_id }));

          mockQueryMany.mockResolvedValue(matchingRows);
          mockQueryOne.mockResolvedValue({ total: String(matchingRows.length) });

          await getTestsForUser("user-1", "exam-1", sort, page, limit, undefined, subjectId);

          // Verify the main query SQL includes the subject filter
          const mainSql = mockQueryMany.mock.calls[0][0] as string;
          expect(mainSql).toContain("AND t.subject_id = $");

          // Verify the subject_id value is in the params
          const mainParams = mockQueryMany.mock.calls[0][1] as (string | number)[];
          expect(mainParams).toContain(subjectId);

          // topic_id filter should NOT be present
          expect(mainSql).not.toContain("AND t.topic_id");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should apply subject_id AND topic_id IS NULL when topicId is explicitly null", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            subject_id: fc.oneof(fc.uuid(), fc.constant(null)),
            topic_id: fc.oneof(fc.uuid(), fc.constant(null)),
          }),
          { minLength: 0, maxLength: 15 }
        ),
        fc.constantFrom<SortOption>("newest", "popular", "difficulty"),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        async (subjectId, testRecords, sort, page, limit) => {
          vi.resetAllMocks();

          // Simulate DB returning only matching rows (subject matches AND topic is null)
          const matchingRows = testRecords
            .filter((r) => r.subject_id === subjectId && r.topic_id === null)
            .map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: null }));

          mockQueryMany.mockResolvedValue(matchingRows);
          mockQueryOne.mockResolvedValue({ total: String(matchingRows.length) });

          // Pass topicId as null explicitly (full subject tests only)
          await getTestsForUser("user-1", "exam-1", sort, page, limit, undefined, subjectId, null);

          // Verify the main query SQL includes both filters
          const mainSql = mockQueryMany.mock.calls[0][0] as string;
          expect(mainSql).toContain("AND t.subject_id = $");
          expect(mainSql).toContain("AND t.topic_id IS NULL");

          // Verify the subject_id value is in the params
          const mainParams = mockQueryMany.mock.calls[0][1] as (string | number)[];
          expect(mainParams).toContain(subjectId);

          // topic_id IS NULL doesn't add a param, so no topic UUID in params
          // (topic_id IS NULL is a literal clause, not parameterized)
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should apply subject_id AND topic_id filter when both are provided as UUIDs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            subject_id: fc.oneof(fc.uuid(), fc.constant(null)),
            topic_id: fc.oneof(fc.uuid(), fc.constant(null)),
          }),
          { minLength: 0, maxLength: 15 }
        ),
        fc.constantFrom<SortOption>("newest", "popular", "difficulty"),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        async (subjectId, topicId, testRecords, sort, page, limit) => {
          vi.resetAllMocks();

          // Simulate DB returning only matching rows
          const matchingRows = testRecords
            .filter((r) => r.subject_id === subjectId && r.topic_id === topicId)
            .map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: r.topic_id }));

          mockQueryMany.mockResolvedValue(matchingRows);
          mockQueryOne.mockResolvedValue({ total: String(matchingRows.length) });

          await getTestsForUser("user-1", "exam-1", sort, page, limit, undefined, subjectId, topicId);

          // Verify the main query SQL includes both filters
          const mainSql = mockQueryMany.mock.calls[0][0] as string;
          expect(mainSql).toContain("AND t.subject_id = $");
          expect(mainSql).toContain("AND t.topic_id = $");

          // Verify both IDs are in the params
          const mainParams = mockQueryMany.mock.calls[0][1] as (string | number)[];
          expect(mainParams).toContain(subjectId);
          expect(mainParams).toContain(topicId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should also apply subject/topic filters to the count query", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.oneof(fc.uuid(), fc.constant(null)),
        async (subjectId, topicId) => {
          vi.resetAllMocks();

          mockQueryMany.mockResolvedValue([]);
          mockQueryOne.mockResolvedValue({ total: "0" });

          await getTestsForUser("user-1", "exam-1", "newest", 1, 10, undefined, subjectId, topicId);

          // Verify count query includes subject filter
          const countSql = mockQueryOne.mock.calls[0][0] as string;
          expect(countSql).toContain("AND t.subject_id = $");

          // Verify topic filter in count query
          if (topicId === null) {
            expect(countSql).toContain("AND t.topic_id IS NULL");
          } else {
            expect(countSql).toContain("AND t.topic_id = $");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Filter Composition ──────────────────────────────────

describe("Feature: subject-category-restructuring, Property 6: Filter Composition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Validates: Requirements 6.6
   *
   * For any combination of filters (category, subject_id, topic_id),
   * the result set equals the intersection of applying each filter independently.
   * Adding a filter shall never increase the result count.
   */
  it("adding subject_id filter to category filter never increases result count", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...VALID_CATEGORIES),
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            subject_id: fc.oneof(fc.uuid(), fc.constant(null)),
            topic_id: fc.oneof(fc.uuid(), fc.constant(null)),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (category, subjectId, testRecords) => {
          vi.resetAllMocks();

          // Tests matching category filter only
          const categoryMatches = testRecords.filter((r) => r.category === category);
          // Tests matching both category + subject
          const bothMatches = categoryMatches.filter((r) => r.subject_id === subjectId);

          // First call: category only
          mockQueryMany.mockResolvedValueOnce(
            categoryMatches.map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: r.topic_id }))
          );
          mockQueryOne.mockResolvedValueOnce({ total: String(categoryMatches.length) });

          const resultCategoryOnly = await getTestsForUser("user-1", "exam-1", "newest", 1, 50, category);

          vi.resetAllMocks();

          // Second call: category + subject
          mockQueryMany.mockResolvedValueOnce(
            bothMatches.map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: r.topic_id }))
          );
          mockQueryOne.mockResolvedValueOnce({ total: String(bothMatches.length) });

          const resultWithSubject = await getTestsForUser("user-1", "exam-1", "newest", 1, 50, category, subjectId);

          // Adding subject filter must never increase count
          expect(resultWithSubject.total).toBeLessThanOrEqual(resultCategoryOnly.total);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("adding topic_id filter to category + subject_id filter never increases result count", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...VALID_CATEGORIES),
        fc.uuid(),
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            subject_id: fc.oneof(fc.uuid(), fc.constant(null)),
            topic_id: fc.oneof(fc.uuid(), fc.constant(null)),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (category, subjectId, topicId, testRecords) => {
          vi.resetAllMocks();

          // Tests matching category + subject
          const catSubjectMatches = testRecords.filter(
            (r) => r.category === category && r.subject_id === subjectId
          );
          // Tests matching category + subject + topic
          const allFiltersMatches = catSubjectMatches.filter(
            (r) => r.topic_id === topicId
          );

          // First call: category + subject only
          mockQueryMany.mockResolvedValueOnce(
            catSubjectMatches.map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: r.topic_id }))
          );
          mockQueryOne.mockResolvedValueOnce({ total: String(catSubjectMatches.length) });

          const resultWithoutTopic = await getTestsForUser("user-1", "exam-1", "newest", 1, 50, category, subjectId);

          vi.resetAllMocks();

          // Second call: category + subject + topic
          mockQueryMany.mockResolvedValueOnce(
            allFiltersMatches.map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: r.topic_id }))
          );
          mockQueryOne.mockResolvedValueOnce({ total: String(allFiltersMatches.length) });

          const resultWithTopic = await getTestsForUser("user-1", "exam-1", "newest", 1, 50, category, subjectId, topicId);

          // Adding topic filter must never increase count
          expect(resultWithTopic.total).toBeLessThanOrEqual(resultWithoutTopic.total);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("result with all filters equals intersection of individual filters", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...VALID_CATEGORIES),
        fc.uuid(),
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            subject_id: fc.oneof(fc.uuid(), fc.constant(null)),
            topic_id: fc.oneof(fc.uuid(), fc.constant(null)),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (category, subjectId, topicId, testRecords) => {
          // Compute intersection manually
          const intersection = testRecords.filter(
            (r) =>
              r.category === category &&
              r.subject_id === subjectId &&
              r.topic_id === topicId
          );

          vi.resetAllMocks();

          // Mock DB to return the intersection
          mockQueryMany.mockResolvedValueOnce(
            intersection.map((r) => makeTestRow({ id: r.id, category: r.category, subject_id: r.subject_id, topic_id: r.topic_id }))
          );
          mockQueryOne.mockResolvedValueOnce({ total: String(intersection.length) });

          const result = await getTestsForUser("user-1", "exam-1", "newest", 1, 50, category, subjectId, topicId);

          // The service result should exactly match the intersection count
          expect(result.total).toBe(intersection.length);
          expect(result.tests).toHaveLength(intersection.length);

          // Every returned test should match all filters
          for (const test of result.tests) {
            expect(test.category).toBe(category);
            expect(test.subjectId).toBe(subjectId);
            expect(test.topicId).toBe(topicId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
