# Implementation Plan: Subject Category Restructuring

## Overview

This plan restructures the test category system by removing "Topic-wise" as a standalone category and merging it into "Subject-wise" with a hierarchical dropdown flow. Implementation covers database migrations (schema + seed), new backend API endpoints for subjects/topics, updated test listing filters, and frontend components for the dropdown interaction flow.

## Tasks

- [x] 1. Database schema migration and backend types
  - [x] 1.1 Create migration `012_add-subjects-topics-tables.ts`
    - Create `subjects` table with columns: `id` (UUID PK), `exam_id` (FK to exams), `name_en`, `name_hi`, `display_order`, `created_at`
    - Create `topics` table with columns: `id` (UUID PK), `subject_id` (FK to subjects ON DELETE CASCADE), `name_en`, `name_hi`, `display_order`, `created_at`
    - Add UNIQUE constraint `uq_topic_name_per_subject` on `topics(subject_id, name_en)`
    - Add `subject_id` (UUID, nullable, FK → subjects) column to `tests`
    - Add `topic_id` (UUID, nullable, FK → topics) column to `tests`
    - Add CHECK constraint `chk_topic_requires_subject`: `topic_id IS NULL OR subject_id IS NOT NULL`
    - Create indexes: `idx_subjects_exam_id`, `idx_topics_subject_id`, `idx_tests_subject_id`, `idx_tests_topic_id`
    - Update existing tests with `category = 'topic_wise'` to `category = 'subject_wise'`
    - Drop old `chk_test_category` constraint, add new one without `topic_wise`
    - Implement complete `down()` function to reverse all changes
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 1.2 Update `test.schema.ts` to remove `topic_wise` and add subject/topic fields
    - Remove `'topic_wise'` from `VALID_CATEGORIES` array
    - Add `subjectId: z.string().uuid().optional()` to `createTestSchema`
    - Add `topicId: z.string().uuid().optional()` to `createTestSchema`
    - Add Zod `.refine()`: if `topicId` is provided, `subjectId` must also be provided
    - _Requirements: 1.2, 2.6_

- [x] 2. Seed data migration
  - [x] 2.1 Create migration `013_seed-subjects-topics-data.ts`
    - Seed 4 subjects for UP Police Constable exam: Hindi, General Knowledge, Numerical Ability, Mental Ability/Reasoning (with `name_en`, `name_hi`, `display_order`)
    - Seed 16 topics across all subjects: Hindi (3), GK (5), Numerical Ability (4), Mental Ability/Reasoning (4)
    - Seed 80 tests (5 per topic: 3 premium + 2 free) with bilingual titles (`"{TopicName} Test {N}"` / `"{TopicNameHi} टेस्ट {N}"`)
    - All seeded tests: `category = 'subject_wise'`, `status = 'published'`, correct `subject_id` and `topic_id`, 15 min duration, 10 questions placeholder, 10 marks, 0.25 negative marking
    - Implement complete `down()` function to delete all seeded tests, topics, and subjects
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 3. Subjects and topics backend service and API
  - [x] 3.1 Create `subjects.service.ts`
    - Implement `getSubjectsByExam(examId: string): Promise<Subject[]>` — query subjects ordered by `display_order`
    - Implement `getTopicsBySubject(subjectId: string): Promise<Topic[]>` — query topics ordered by `display_order`
    - Implement `subjectExists(subjectId: string): Promise<boolean>` — check existence
    - Export `Subject` and `Topic` interfaces
    - _Requirements: 5.1, 5.3_

  - [x] 3.2 Create `subjects.controller.ts` with routes
    - `GET /api/subjects` — fetch user's selected exam, call `getSubjectsByExam`, return `{ success: true, data: Subject[] }`
    - `GET /api/subjects/:subjectId/topics` — validate subjectId exists (404 if not), call `getTopicsBySubject`, return `{ success: true, data: Topic[] }`
    - Both routes require JWT auth
    - Register routes in the main Express app
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.3 Write property tests for subjects service (Properties 1, 2, 3, 5)
    - **Property 1: Topic Requires Subject Constraint** — verify constraint logic for all combinations of subject_id/topic_id
    - **Property 2: Bilingual Name Resolution** — for any name_en/name_hi + language, display returns correct field as non-empty string
    - **Property 3: Display Order Sorting Invariant** — verify sorted output for random display_order arrays
    - **Property 5: Hierarchical Data Scoping** — verify subjects scoped to exam, topics scoped to subject
    - **Validates: Requirements 2.6, 3.2, 3.3, 4.3, 4.4, 5.1, 5.3, 8.1, 8.2**

- [x] 4. Update test listing service and controller for subject/topic filtering
  - [x] 4.1 Update `test-listing.service.ts` with subject/topic filter support
    - Extend `getTestsForUser` signature to accept optional `subjectId?: string` and `topicId?: string | null`
    - When `subjectId` provided: add `AND t.subject_id = $N` to WHERE clause
    - When `topicId` is a UUID string: add `AND t.topic_id = $N`
    - When `topicId` is explicitly `null`: add `AND t.topic_id IS NULL`
    - Apply same filters to count query
    - Add `subjectId` and `topicId` to `TestListItem` interface
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 4.2 Update `tests.controller.ts` `listTests` handler
    - Parse `subject_id` and `topic_id` from `req.query`
    - Validate UUID format via regex; set to `undefined` if invalid
    - Handle `topic_id=null` string value for explicit NULL filtering
    - Pass `subjectId` and `topicId` to `getTestsForUser`
    - _Requirements: 6.1, 6.2, 6.7_

  - [x] 4.3 Write property tests for test listing filtering (Properties 4, 6, 7)
    - **Property 4: Subject and Topic Filter Correctness** — generate random tests, apply filters, verify exact match
    - **Property 6: Filter Composition** — verify result = intersection of individual filters; adding filter never increases count
    - **Property 7: Invalid UUID Graceful Degradation** — verify non-UUID strings are silently ignored
    - **Validates: Requirements 4.1, 4.5, 6.3, 6.4, 6.5, 6.6, 6.7**

- [x] 5. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend i18n updates
  - [x] 6.1 Update `en.json` and `hi.json` translation files
    - Remove `testList.categories.topic_wise` key from both files
    - Add `testList.subFilter.fullSubject`: "Full Subject Test" / "पूर्ण विषय टेस्ट"
    - Add `testList.subFilter.topicWise`: "Topic-wise" / "टॉपिक वार"
    - Add `testList.selectSubject`: "Select Subject" / "विषय चुनें"
    - Add `testList.selectTopic`: "Select Topic" / "टॉपिक चुनें"
    - Update `testList.categories.subject_wise`: "Subject-wise" / "विषयवार"
    - _Requirements: 8.3, 8.4_

- [x] 7. New frontend dropdown components
  - [x] 7.1 Create `SubjectDropdown.tsx` component
    - Accept props: `subjects`, `language`, `onSelect`, `onClose`
    - Render positioned dropdown listing subjects (show `nameHi` or `nameEn` based on language)
    - Order by `displayOrder`
    - Close on outside click (useEffect with document click listener)
    - Accessible: role="listbox", aria-label
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1_

  - [x] 7.2 Create `SubFilter.tsx` component
    - Accept props: `activeFilter`, `onFilterChange`
    - Render two buttons: "Full Subject Test" and "Topic-wise" using i18n keys
    - Active button gets highlighted styling (similar to category tab pattern)
    - _Requirements: 3.5, 4.6, 8.3_

  - [x] 7.3 Create `TopicDropdown.tsx` component
    - Accept props: `topics`, `language`, `onSelect`, `onClose`
    - Render positioned dropdown listing topics (show `nameHi` or `nameEn` based on language)
    - Order by `displayOrder`
    - Close on outside click
    - Accessible: role="listbox", aria-label
    - _Requirements: 4.2, 4.3, 4.4, 8.2_

- [x] 8. Update CategoryFilter and TestListPage
  - [x] 8.1 Update `CategoryFilter.tsx`
    - Remove `'topic_wise'` from `CATEGORY_OPTIONS` array (now 5 options)
    - Extend props interface to include: `selectedSubject`, `onSubjectSelect`, `subFilter`, `onSubFilterChange`, `selectedTopic`, `onTopicSelect`, `subjects`, `topics`
    - Conditionally render `SubjectDropdown` when "Subject-wise" tab is active and dropdown should show
    - Conditionally render `SubFilter` after a subject is selected
    - Conditionally render `TopicDropdown` when "Topic-wise" sub-filter is active
    - Maintain "Subject-wise" tab active styling while dropdown is open
    - _Requirements: 1.1, 1.2, 3.1, 3.5, 4.2, 9.4, 9.5_

  - [x] 8.2 Update `TestListPage.tsx` with new state and effects
    - Add state: `selectedSubject`, `subFilter`, `selectedTopic`, `subjects`, `topics`
    - Fetch subjects from `GET /api/subjects` when category becomes `'subject_wise'`
    - Fetch topics from `GET /api/subjects/:id/topics` when subject selected and subFilter is `'topic_wise'`
    - Pass `subject_id` and `topic_id` query params to `GET /api/tests` based on state
    - When `subFilter === 'full_subject'`: pass `topic_id=null` to get full subject tests only
    - Reset subject/topic/subFilter state when switching away from "Subject-wise" category
    - Reset subFilter and topic when a different subject is selected
    - Pass all new props to `CategoryFilter`
    - _Requirements: 4.1, 4.5, 9.1, 9.2, 9.3_

  - [x] 8.3 Write property test for state reset behavior (Property 8)
    - **Property 8: State Reset on Navigation** — for any valid filter state, switching tab resets all subject state; selecting different subject resets subFilter and topic
    - **Validates: Requirements 9.1, 9.2**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design doc
- Unit tests validate specific examples and edge cases
- All code uses TypeScript (backend: Node.js/Express, frontend: React/Vite)
- Testing uses Vitest + fast-check for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "6.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "7.1", "7.2", "7.3"] },
    { "id": 4, "tasks": ["8.1", "8.2"] },
    { "id": 5, "tasks": ["8.3"] }
  ]
}
```
