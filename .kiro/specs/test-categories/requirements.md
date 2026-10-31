# Requirements Document

## Introduction

This feature adds test categories to the UP Police Test Series platform, enabling students to browse and filter tests by category on the test listing page. Tests are organized into five predefined categories (Full Mock Test, Subject-wise, Previous Year, Daily Practice, Topic-wise) with bilingual labels in Hindi and English. An "All" filter option shows all tests regardless of category.

## Glossary

- **Test_Listing_Page**: The React page component at `/tests` route that displays available tests as a card grid for the authenticated user.
- **Category**: A classification label assigned to each test, representing the type of practice content (e.g., Full Mock Test, Subject-wise, Previous Year, Daily Practice, Topic-wise).
- **Category_Filter**: A set of tab-style filter buttons displayed at the top of the Test_Listing_Page that allow users to filter displayed tests by their assigned category.
- **Test_Listing_Service**: The backend service responsible for querying published tests with filtering, sorting, and pagination.
- **Tests_API**: The Express route handler at `GET /api/tests` that serves test listing data to the frontend.

## Requirements

### Requirement 1: Category Data Storage

**User Story:** As an admin, I want each test to have a category field in the database, so that tests can be classified and filtered by type.

#### Acceptance Criteria

1. THE Tests table SHALL include a `category` column of type `varchar(20)` with a NOT NULL constraint.
2. THE Tests table SHALL enforce a CHECK constraint limiting `category` values to exactly: `full_mock`, `subject_wise`, `previous_year`, `daily_practice`, `topic_wise`.
3. THE Tests table SHALL have a database index on the `category` column to support efficient filtering queries.
4. WHEN a new test is created without specifying a category, THE Tests_API SHALL reject the request with a validation error.

### Requirement 2: Category Filter on Test Listing Page

**User Story:** As a student, I want to see category filter tabs at the top of the test listing page, so that I can quickly find the type of test I want to practice.

#### Acceptance Criteria

1. WHEN the Test_Listing_Page loads, THE Category_Filter SHALL display six filter options: "All", "Full Mock Test", "Subject-wise", "Previous Year", "Daily Practice", and "Topic-wise".
2. WHEN the page loads initially, THE Category_Filter SHALL have "All" selected as the default active filter.
3. THE Category_Filter SHALL display each category label in the user's selected language (Hindi or English).
4. THE Category_Filter labels SHALL be: "All" / "सभी", "Full Mock Test" / "पूर्ण मॉक टेस्ट", "Subject-wise" / "विषयवार टेस्ट", "Previous Year" / "पिछले वर्ष के प्रश्न", "Daily Practice" / "दैनिक अभ्यास", "Topic-wise" / "टॉपिक वार टेस्ट".
5. WHEN a user selects a category filter, THE Test_Listing_Page SHALL display only tests belonging to the selected category.
6. WHEN the "All" filter is selected, THE Test_Listing_Page SHALL display tests from all categories.
7. WHEN a category filter is selected, THE Category_Filter SHALL visually indicate the active filter with distinct styling (e.g., highlighted background, bold text).

### Requirement 3: Backend Category Filtering

**User Story:** As a developer, I want the test listing API to support category filtering, so that the frontend can request tests by category efficiently.

#### Acceptance Criteria

1. THE Tests_API SHALL accept an optional `category` query parameter on `GET /api/tests`.
2. WHEN a valid `category` parameter is provided, THE Test_Listing_Service SHALL return only tests matching that category value.
3. WHEN the `category` parameter is omitted or set to `all`, THE Test_Listing_Service SHALL return tests from all categories.
4. IF an invalid `category` value is provided, THEN THE Tests_API SHALL ignore the invalid value and return all tests (equivalent to "all" filter).
5. THE Test_Listing_Service SHALL apply the category filter in combination with existing filters (exam_id, schedule window, published status) and sort options.
6. THE Tests_API pagination total count SHALL reflect the filtered result set when a category filter is active.

### Requirement 4: Category Display on Test Cards

**User Story:** As a student, I want to see which category a test belongs to on its card, so that I can identify the test type at a glance even when browsing "All" tests.

#### Acceptance Criteria

1. THE Test card component SHALL display the category name as a small badge on each test card.
2. THE category badge SHALL display the category label in the user's selected language (Hindi or English).
3. WHEN the "All" filter is active, THE category badge SHALL be visible on every test card to help differentiate test types.

### Requirement 5: Category Field in Test Creation and Update

**User Story:** As an admin, I want to assign a category when creating or updating a test, so that tests are properly categorized for students.

#### Acceptance Criteria

1. THE Tests_API create endpoint (`POST /api/tests`) SHALL accept a `category` field in the request body.
2. THE Tests_API update endpoint (`PUT /api/tests/:id`) SHALL accept a `category` field in the request body for updating a test's category.
3. WHEN a test is created, THE Tests_API SHALL validate that the `category` value is one of the five allowed values.
4. WHEN a test is updated with a new category value, THE Tests_API SHALL validate that the new value is one of the five allowed values.
5. THE Tests_API response for test details SHALL include the `category` field.

### Requirement 6: Database Migration for Existing Tests

**User Story:** As a developer, I want a migration strategy for existing tests that do not have a category, so that the system remains consistent after the schema change.

#### Acceptance Criteria

1. THE database migration SHALL add the `category` column to the existing `tests` table.
2. THE migration SHALL set a default value of `full_mock` for existing rows that do not have a category assigned.
3. WHEN the migration is rolled back, THE migration down function SHALL remove the `category` column and its associated index and constraint.
