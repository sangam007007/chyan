# Implementation Plan: Test Categories

## Overview

This plan implements the test categories feature across the database, backend, and frontend layers. It starts with the database migration and schema validation, then updates the backend service and controller, and finally adds the category filter UI and badges to the frontend. Property-based tests validate correctness properties defined in the design.

## Tasks

- [x] 1. Database migration and schema validation
  - [x] 1.1 Create database migration `011_add-test-category.ts`
    - Add `category` column (`varchar(20) NOT NULL DEFAULT 'full_mock'`) to the `tests` table
    - Add CHECK constraint `chk_test_category` limiting values to `full_mock`, `subject_wise`, `previous_year`, `daily_practice`, `topic_wise`
    - Create index `idx_tests_category` on the `category` column
    - Implement `down` function to remove index, constraint, and column
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3_

  - [x] 1.2 Add `category` field to Zod schemas in `test.schema.ts`
    - Define `VALID_CATEGORIES` constant array and `TestCategory` type
    - Add required `category: z.enum(VALID_CATEGORIES)` to `createTestSchema`
    - Add optional `category: z.enum(VALID_CATEGORIES).optional()` to `updateTestSchema`
    - _Requirements: 1.2, 1.4, 5.3, 5.4_

  - [x] 1.3 Write property test for category validation (Property 1)
    - **Property 1: Category Validation Accepts Only Valid Values**
    - Generate arbitrary strings with `fc.string()` and verify only the five valid values pass validation
    - Generate valid categories with `fc.constantFrom(...VALID_CATEGORIES)` and verify they all pass
    - **Validates: Requirements 1.2, 5.3, 5.4**

- [x] 2. Backend service and controller updates
  - [x] 2.1 Update `TestListItem` interface and `getTestsForUser` in `test-listing.service.ts`
    - Add `category: TestCategory` to `TestListItem` interface
    - Add optional `category?: TestCategory` parameter to `getTestsForUser`
    - Append `AND t.category = $N` to WHERE clause when category is provided
    - Include `t.category` in the SELECT column list
    - Update count query to include category filter condition
    - Map `category` field in row-to-item mapping
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [x] 2.2 Write property tests for category filtering (Properties 2, 3, 4, 5)
    - **Property 2: Category Filtering Returns Only Matching Tests**
    - **Property 3: "All" Filter Returns All Categories**
    - **Property 4: Invalid Category Defaults to All**
    - **Property 5: Pagination Total Reflects Filtered Count**
    - Use `fc.array()` of test records with random categories and verify filter invariants
    - **Validates: Requirements 2.5, 2.6, 3.2, 3.3, 3.4, 3.5, 3.6**

  - [x] 2.3 Update `listTests` handler in `tests.controller.ts`
    - Parse `category` from `req.query.category`
    - Validate against `VALID_CATEGORIES`; if invalid or missing, pass `undefined` (all categories)
    - Pass validated category to `getTestsForUser`
    - _Requirements: 3.1, 3.4_

  - [x] 2.4 Update `createTest` handler in `tests.controller.ts`
    - Destructure `category` from validated `req.body`
    - Include `category` in the INSERT SQL query and parameter list
    - _Requirements: 5.1, 5.3_

  - [x] 2.5 Update `updateTest` handler in `tests.controller.ts`
    - Add `category` to the dynamic SET clause builder when `body.category` is provided
    - _Requirements: 5.2, 5.4_

  - [x] 2.6 Update `getTest` handler and `formatTest` helper in `tests.controller.ts`
    - Add `category` to `TestRow` interface
    - Include `category` in `formatTest` output
    - _Requirements: 5.5_

- [x] 3. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend category filter and badge components
  - [x] 4.1 Add category translation keys to i18n files
    - Add `testList.categories.all`, `testList.categories.full_mock`, `testList.categories.subject_wise`, `testList.categories.previous_year`, `testList.categories.daily_practice`, `testList.categories.topic_wise` to `packages/frontend/src/i18n/en.json`
    - Add corresponding Hindi translations to `packages/frontend/src/i18n/hi.json`
    - _Requirements: 2.3, 2.4_

  - [x] 4.2 Write property test for bilingual category labels (Property 6)
    - **Property 6: Bilingual Category Label Correctness**
    - For every valid category × language combination, verify lookup returns a non-empty string
    - **Validates: Requirements 2.3, 4.2**

  - [x] 4.3 Create `CategoryFilter` component
    - Create `packages/frontend/src/components/CategoryFilter.tsx`
    - Implement `CategoryFilterProps` interface with `activeCategory` and `onCategoryChange`
    - Render six tab-style buttons (All + 5 categories) using translation keys
    - Apply distinct styling to the active filter button
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 4.4 Create `CategoryBadge` component
    - Create `packages/frontend/src/components/CategoryBadge.tsx`
    - Implement `CategoryBadgeProps` interface with `category: TestCategory`
    - Render a small pill/badge with the translated category label
    - _Requirements: 4.1, 4.2_

  - [x] 4.5 Update `TestListPage` to integrate category filter
    - Add `category` state (default: `'all'`)
    - Pass `category` query param to `GET /api/tests` API call
    - Render `<CategoryFilter>` above the test grid
    - Update `TestListItem` type to include `category` field
    - Pass `category` to each `<TestCard>`
    - _Requirements: 2.2, 2.5, 2.6_

  - [x] 4.6 Update `TestCard` to display `CategoryBadge`
    - Accept `category` in `TestListItem` type
    - Render `<CategoryBadge>` on each test card
    - Ensure badge is visible when "All" filter is active
    - _Requirements: 4.1, 4.3_

- [x] 5. Checkpoint - Ensure all frontend and backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integration wiring and final verification
  - [x] 6.1 Verify end-to-end data flow
    - Confirm migration runs successfully and existing tests get `full_mock` default
    - Confirm `GET /api/tests?category=subject_wise` returns only matching tests
    - Confirm `GET /api/tests` without category returns all tests
    - Confirm `POST /api/tests` with category creates test correctly
    - Confirm `PUT /api/tests/:id` with category updates correctly
    - _Requirements: 1.1, 3.2, 3.3, 5.1, 5.2, 6.2_

  - [x] 6.2 Write integration tests for migration and API
    - Test migration adds column with correct type and default
    - Test existing rows get `full_mock` value
    - Test migration rollback removes column, index, and constraint
    - Test invalid category in create request returns 422
    - _Requirements: 1.1, 1.4, 6.1, 6.2, 6.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest + fast-check for property-based testing
- TypeScript is used throughout backend and frontend

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "4.1"] },
    { "id": 1, "tasks": ["1.3", "2.1", "4.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "4.3", "4.4"] },
    { "id": 3, "tasks": ["4.5"] },
    { "id": 4, "tasks": ["4.6"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
