# Requirements Document

## Introduction

This feature restructures the test categories system for the UP Police Test Series platform. The "Topic-wise" tab is removed as a standalone category and merged into "Subject-wise". The "Subject-wise" tab becomes a dropdown that, upon subject selection, reveals two sub-filter options: "Full Subject Test" and "Topic-wise" (individual topic tests). New database tables (`subjects` and `topics`) are introduced to support hierarchical subject→topic organization. A seed migration populates subjects, topics, and 5 sample tests per topic (3 premium + 2 free) for the UP Police Constable exam across four subjects: Hindi, General Knowledge, Numerical Ability, and Mental Ability/Reasoning.

## Glossary

- **Category_Filter**: The UI component on the Test_Listing_Page displaying category tabs/buttons for filtering tests by category.
- **Subject_Dropdown**: A dropdown menu triggered by clicking the "Subject-wise" tab in the Category_Filter, displaying available subjects for the user's selected exam.
- **Sub_Filter**: A secondary filter UI appearing after a subject is selected, offering "Full Subject Test" and "Topic-wise" options.
- **Topic_Dropdown**: A dropdown appearing when "Topic-wise" sub-filter is selected, listing topics belonging to the currently selected subject.
- **Subjects_Table**: A PostgreSQL table storing exam subjects with bilingual names (English and Hindi).
- **Topics_Table**: A PostgreSQL table storing topics that belong to a subject, with bilingual names.
- **Tests_Table**: The existing `tests` table, extended with `subject_id` and `topic_id` foreign key columns.
- **Test_Listing_Service**: The backend service responsible for querying published tests with filtering, sorting, and pagination.
- **Tests_API**: The Express route handlers at `/api/tests`, `/api/subjects`, and `/api/topics` that serve data to the frontend.
- **Test_Listing_Page**: The React page component at `/tests` that displays the test list with filters.
- **Full_Subject_Test**: A test covering all topics within a subject (has `subject_id` set, `topic_id` is NULL).
- **Topic_Test**: A test targeting a specific topic within a subject (has both `subject_id` and `topic_id` set).

## Requirements

### Requirement 1: Remove Topic-wise as a Standalone Category

**User Story:** As a student, I want topic-wise tests to be accessible within subject-wise filtering instead of a separate tab, so that the category navigation is simpler and more intuitive.

#### Acceptance Criteria

1. THE Category_Filter SHALL display five filter options: "All", "Full Mock Test", "Subject-wise", "Previous Year", and "Daily Practice".
2. THE Category_Filter SHALL NOT display "Topic-wise" as a standalone tab.
3. THE database migration SHALL remove `topic_wise` from the `tests` table CHECK constraint on the `category` column.
4. THE database migration SHALL update existing tests with `category = 'topic_wise'` to `category = 'subject_wise'`.
5. WHEN the migration is rolled back, THE migration down function SHALL restore `topic_wise` in the CHECK constraint and revert affected rows.

### Requirement 2: Subjects and Topics Data Model

**User Story:** As a developer, I want a normalized data model for subjects and topics, so that tests can be associated with specific subjects and topics for hierarchical filtering.

#### Acceptance Criteria

1. THE Subjects_Table SHALL have columns: `id` (UUID primary key), `exam_id` (foreign key to exams), `name_en` (VARCHAR NOT NULL), `name_hi` (VARCHAR NOT NULL), `display_order` (INTEGER NOT NULL), `created_at` (TIMESTAMP).
2. THE Topics_Table SHALL have columns: `id` (UUID primary key), `subject_id` (foreign key to subjects), `name_en` (VARCHAR NOT NULL), `name_hi` (VARCHAR NOT NULL), `display_order` (INTEGER NOT NULL), `created_at` (TIMESTAMP).
3. THE Tests_Table SHALL have a nullable `subject_id` column referencing the Subjects_Table.
4. THE Tests_Table SHALL have a nullable `topic_id` column referencing the Topics_Table.
5. THE Tests_Table SHALL have a database index on `subject_id` and a database index on `topic_id`.
6. WHEN a test has `topic_id` set, THE Tests_Table SHALL require that `subject_id` is also set (enforced via CHECK constraint).
7. THE Topics_Table SHALL enforce a UNIQUE constraint on `(subject_id, name_en)` to prevent duplicate topic names within a subject.

### Requirement 3: Subject-wise Dropdown Interaction

**User Story:** As a student, I want the "Subject-wise" tab to open a dropdown showing available subjects, so that I can quickly navigate to tests for a specific subject.

#### Acceptance Criteria

1. WHEN the user clicks the "Subject-wise" tab, THE Category_Filter SHALL display the Subject_Dropdown listing all subjects for the user's selected exam.
2. THE Subject_Dropdown SHALL display each subject name in the user's selected language (Hindi or English).
3. THE Subject_Dropdown SHALL order subjects by their `display_order` value.
4. WHEN the user clicks outside the Subject_Dropdown without selecting a subject, THE Subject_Dropdown SHALL close.
5. WHEN the user selects a subject from the Subject_Dropdown, THE Sub_Filter SHALL appear showing two options: "Full Subject Test" and "Topic-wise".

### Requirement 4: Sub-Filter for Full Subject Test and Topic-wise

**User Story:** As a student, I want to choose between full subject tests and topic-wise tests after selecting a subject, so that I can practice at the level of detail I prefer.

#### Acceptance Criteria

1. WHEN "Full Subject Test" sub-filter is selected, THE Test_Listing_Page SHALL display only tests with `category = 'subject_wise'` AND the selected `subject_id` AND `topic_id` IS NULL.
2. WHEN "Topic-wise" sub-filter is selected, THE Topic_Dropdown SHALL appear listing all topics for the selected subject.
3. THE Topic_Dropdown SHALL display each topic name in the user's selected language (Hindi or English).
4. THE Topic_Dropdown SHALL order topics by their `display_order` value.
5. WHEN the user selects a topic from the Topic_Dropdown, THE Test_Listing_Page SHALL display only tests with `category = 'subject_wise'` AND the selected `subject_id` AND the selected `topic_id`.
6. THE Sub_Filter SHALL visually indicate the currently active option ("Full Subject Test" or "Topic-wise").

### Requirement 5: Backend API for Subjects and Topics

**User Story:** As a developer, I want API endpoints to fetch subjects and topics, so that the frontend can populate dropdowns dynamically.

#### Acceptance Criteria

1. THE Tests_API SHALL provide a `GET /api/subjects` endpoint that returns subjects filtered by the user's selected exam.
2. THE `GET /api/subjects` response SHALL include `id`, `nameEn`, `nameHi`, and `displayOrder` for each subject.
3. THE Tests_API SHALL provide a `GET /api/subjects/:subjectId/topics` endpoint that returns topics for a given subject.
4. THE `GET /api/subjects/:subjectId/topics` response SHALL include `id`, `nameEn`, `nameHi`, and `displayOrder` for each topic.
5. IF a non-existent `subjectId` is provided, THEN THE Tests_API SHALL return a 404 error with code `SUBJECT_NOT_FOUND`.

### Requirement 6: Backend Filtering by Subject and Topic

**User Story:** As a developer, I want the test listing API to support subject_id and topic_id query parameters, so that the frontend can request tests filtered by subject and topic.

#### Acceptance Criteria

1. THE Tests_API `GET /api/tests` endpoint SHALL accept optional `subject_id` query parameter.
2. THE Tests_API `GET /api/tests` endpoint SHALL accept optional `topic_id` query parameter.
3. WHEN `subject_id` is provided without `topic_id`, THE Test_Listing_Service SHALL return only tests matching that `subject_id` (both full-subject and topic tests for that subject).
4. WHEN both `subject_id` and `topic_id` are provided, THE Test_Listing_Service SHALL return only tests matching both the `subject_id` AND `topic_id`.
5. WHEN `subject_id` is provided with `topic_id` set to `null` explicitly, THE Test_Listing_Service SHALL return only tests matching the `subject_id` where `topic_id` IS NULL (full subject tests only).
6. THE subject and topic filters SHALL compose with existing filters (category, exam_id, schedule window, published status, sort, pagination).
7. IF an invalid UUID format is provided for `subject_id` or `topic_id`, THEN THE Tests_API SHALL ignore the invalid value and return all tests.

### Requirement 7: Seed Data Migration

**User Story:** As a product owner, I want pre-populated subjects, topics, and sample tests for the UP Police Constable exam, so that students have content available immediately after the restructuring.

#### Acceptance Criteria

1. THE seed migration SHALL create 4 subjects for the UP Police Constable exam: Hindi, General Knowledge, Numerical Ability, and Mental Ability/Reasoning with both English and Hindi names.
2. THE seed migration SHALL create topics for each subject: Hindi (3 topics), General Knowledge (5 topics), Numerical Ability (4 topics), Mental Ability/Reasoning (4 topics) — 16 topics total.
3. THE seed migration SHALL create 5 tests per topic: 3 with `pricing_type = 'premium'` and 2 with `pricing_type = 'free'` — 80 tests total.
4. THE seed migration SHALL assign `category = 'subject_wise'`, the appropriate `subject_id`, and the appropriate `topic_id` to each seeded topic test.
5. THE seed migration SHALL create bilingual titles for each test (English and Hindi) that include the topic name and a sequential number.
6. WHEN the seed migration is rolled back, THE migration down function SHALL remove all seeded tests, topics, and subjects.

### Requirement 8: Bilingual Display for Subjects and Topics

**User Story:** As a student, I want to see subject and topic names in my preferred language (Hindi or English), so that I can navigate the test categories comfortably.

#### Acceptance Criteria

1. THE Subject_Dropdown SHALL display subject names using `name_hi` when the user's language is Hindi and `name_en` when English.
2. THE Topic_Dropdown SHALL display topic names using `name_hi` when the user's language is Hindi and `name_en` when English.
3. THE Sub_Filter labels "Full Subject Test" and "Topic-wise" SHALL be translated: "पूर्ण विषय टेस्ट" / "Full Subject Test" and "टॉपिक वार" / "Topic-wise".
4. THE updated Category_Filter tab labels SHALL be: "All" / "सभी", "Full Mock Test" / "पूर्ण मॉक टेस्ट", "Subject-wise" / "विषयवार", "Previous Year" / "पिछले वर्ष के प्रश्न", "Daily Practice" / "दैनिक अभ्यास".

### Requirement 9: Updated Category Filter UI Behavior

**User Story:** As a student, I want the category filter to reset sub-filters when I switch to a different top-level category, so that I do not see stale filter state.

#### Acceptance Criteria

1. WHEN the user switches from "Subject-wise" to another category tab, THE Category_Filter SHALL close the Subject_Dropdown and clear the selected subject and topic state.
2. WHEN the user selects a different subject from the Subject_Dropdown, THE Sub_Filter SHALL reset to default (no sub-filter selected) and the Topic_Dropdown SHALL close.
3. WHEN the "All" filter is selected, THE Test_Listing_Page SHALL display tests from all categories without subject or topic filtering.
4. THE Category_Filter SHALL visually indicate the active top-level category tab with distinct styling.
5. WHILE the Subject_Dropdown is open, THE "Subject-wise" tab SHALL maintain its active styling.
