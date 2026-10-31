/**
 * Property-based test for state reset behavior (Property 8).
 *
 * Feature: subject-category-restructuring, Property 8: State Reset on Navigation
 *
 * Tests the state machine logic from TestListPage.tsx:
 * 1. When switching from 'subject_wise' to another category: selectedSubject,
 *    subFilter, selectedTopic all reset to null.
 * 2. When selecting a different subject: subFilter and selectedTopic reset to null.
 *
 * Validates: Requirements 9.1, 9.2
 *
 * Uses Vitest + fast-check. Tests the pure state transition logic without React rendering.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Subject } from './SubjectDropdown';
import type { Topic } from './TopicDropdown';

// ─── State Shape ─────────────────────────────────────────────────────

interface FilterState {
  category: string;
  selectedSubject: Subject | null;
  subFilter: 'full_subject' | 'topic_wise' | null;
  selectedTopic: Topic | null;
}

// ─── State Transition Functions ──────────────────────────────────────
// These mirror the handlers in TestListPage.tsx

/**
 * Mirrors handleCategoryChange from TestListPage.tsx:
 * If switching away from 'subject_wise', reset all subject-related state.
 */
function handleCategoryChange(state: FilterState, newCategory: string): FilterState {
  const nextState = { ...state };

  if (state.category === 'subject_wise' && newCategory !== 'subject_wise') {
    nextState.selectedSubject = null;
    nextState.subFilter = null;
    nextState.selectedTopic = null;
  }

  nextState.category = newCategory;
  return nextState;
}

/**
 * Mirrors handleSubjectSelect from TestListPage.tsx:
 * When selecting a (new) subject, reset subFilter and selectedTopic.
 */
function handleSubjectSelect(state: FilterState, subject: Subject | null): FilterState {
  return {
    ...state,
    selectedSubject: subject,
    subFilter: null,
    selectedTopic: null,
  };
}

// ─── Generators ──────────────────────────────────────────────────────

const CATEGORIES = ['all', 'full_mock', 'subject_wise', 'previous_year', 'daily_practice'] as const;
const NON_SUBJECT_WISE_CATEGORIES = ['all', 'full_mock', 'previous_year', 'daily_practice'] as const;

const subjectArb: fc.Arbitrary<Subject> = fc.record({
  id: fc.uuid(),
  nameEn: fc.string({ minLength: 1, maxLength: 50 }),
  nameHi: fc.string({ minLength: 1, maxLength: 50 }),
  displayOrder: fc.integer({ min: 1, max: 100 }),
});

const topicArb: fc.Arbitrary<Topic> = fc.record({
  id: fc.uuid(),
  subjectId: fc.uuid(),
  nameEn: fc.string({ minLength: 1, maxLength: 50 }),
  nameHi: fc.string({ minLength: 1, maxLength: 50 }),
  displayOrder: fc.integer({ min: 1, max: 100 }),
});

const subFilterArb = fc.constantFrom('full_subject' as const, 'topic_wise' as const, null);

/**
 * Generator for a valid filter state that has subject_wise active with
 * populated subject-related fields (representing any "in-progress" subject filtering).
 */
const subjectWiseStateArb: fc.Arbitrary<FilterState> = fc.record({
  category: fc.constant('subject_wise' as string),
  selectedSubject: fc.oneof(subjectArb, fc.constant(null)),
  subFilter: subFilterArb,
  selectedTopic: fc.oneof(topicArb, fc.constant(null)),
});

/**
 * Generator for any valid filter state (any category with random subject state).
 */
const anyFilterStateArb: fc.Arbitrary<FilterState> = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  selectedSubject: fc.oneof(subjectArb, fc.constant(null)),
  subFilter: subFilterArb,
  selectedTopic: fc.oneof(topicArb, fc.constant(null)),
});

// ─── Property Tests ──────────────────────────────────────────────────

describe('Feature: subject-category-restructuring, Property 8: State Reset on Navigation', () => {
  /**
   * **Validates: Requirements 9.1, 9.2**
   */

  describe('Tab switching resets all subject state (Requirement 9.1)', () => {
    it('switching from subject_wise to any other category resets selectedSubject, subFilter, and selectedTopic to null', () => {
      fc.assert(
        fc.property(
          subjectWiseStateArb,
          fc.constantFrom(...NON_SUBJECT_WISE_CATEGORIES),
          (state, newCategory) => {
            const nextState = handleCategoryChange(state, newCategory);

            // All subject-related state must be reset
            expect(nextState.selectedSubject).toBeNull();
            expect(nextState.subFilter).toBeNull();
            expect(nextState.selectedTopic).toBeNull();

            // Category must be updated
            expect(nextState.category).toBe(newCategory);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('switching from subject_wise to subject_wise does NOT reset subject state', () => {
      fc.assert(
        fc.property(
          subjectWiseStateArb,
          (state) => {
            const nextState = handleCategoryChange(state, 'subject_wise');

            // Subject state should be preserved when staying on the same tab
            expect(nextState.selectedSubject).toEqual(state.selectedSubject);
            expect(nextState.subFilter).toEqual(state.subFilter);
            expect(nextState.selectedTopic).toEqual(state.selectedTopic);
            expect(nextState.category).toBe('subject_wise');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('switching from any non-subject_wise category to another does NOT affect subject state', () => {
      fc.assert(
        fc.property(
          anyFilterStateArb.filter(s => s.category !== 'subject_wise'),
          fc.constantFrom(...CATEGORIES),
          (state, newCategory) => {
            const nextState = handleCategoryChange(state, newCategory);

            // When NOT coming from subject_wise, state should be preserved
            expect(nextState.selectedSubject).toEqual(state.selectedSubject);
            expect(nextState.subFilter).toEqual(state.subFilter);
            expect(nextState.selectedTopic).toEqual(state.selectedTopic);

            // Category still updates
            expect(nextState.category).toBe(newCategory);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Subject selection resets subFilter and topic (Requirement 9.2)', () => {
    it('selecting any subject resets subFilter and selectedTopic to null', () => {
      fc.assert(
        fc.property(
          anyFilterStateArb,
          subjectArb,
          (state, newSubject) => {
            const nextState = handleSubjectSelect(state, newSubject);

            // subFilter and selectedTopic must be reset
            expect(nextState.subFilter).toBeNull();
            expect(nextState.selectedTopic).toBeNull();

            // The new subject should be set
            expect(nextState.selectedSubject).toEqual(newSubject);

            // Category should remain unchanged
            expect(nextState.category).toBe(state.category);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('selecting null subject also resets subFilter and selectedTopic to null', () => {
      fc.assert(
        fc.property(
          anyFilterStateArb,
          (state) => {
            const nextState = handleSubjectSelect(state, null);

            // All subject-related downstream state must be reset
            expect(nextState.subFilter).toBeNull();
            expect(nextState.selectedTopic).toBeNull();
            expect(nextState.selectedSubject).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('selecting a different subject from an existing one always clears subFilter and topic regardless of current state', () => {
      fc.assert(
        fc.property(
          fc.record({
            category: fc.constant('subject_wise' as string),
            selectedSubject: subjectArb,
            subFilter: fc.constantFrom('full_subject' as const, 'topic_wise' as const),
            selectedTopic: topicArb,
          }),
          subjectArb,
          (state, newSubject) => {
            const nextState = handleSubjectSelect(state, newSubject);

            // Even if subFilter and selectedTopic were populated, they reset
            expect(nextState.subFilter).toBeNull();
            expect(nextState.selectedTopic).toBeNull();
            expect(nextState.selectedSubject).toEqual(newSubject);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
