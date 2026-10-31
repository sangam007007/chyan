import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Policy: only tests in the Test section (full mock, previous year, daily practice) can have
 * negative marking, and only when an admin sets it. Topic tests and subject tests (the Study /
 * Subject content) never have negative marking.
 *
 * Existing attempts keep the scores they were given under the old rule.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE tests
    SET negative_marking_ratio = 0, updated_at = NOW()
    WHERE negative_marking_ratio <> 0
      AND (topic_id IS NOT NULL OR category IN ('subject_wise', 'topic_wise'))
  `);

  pgm.addConstraint('tests', 'chk_study_tests_no_negative_marking', {
    check: `negative_marking_ratio = 0 OR (topic_id IS NULL AND category NOT IN ('subject_wise', 'topic_wise'))`,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // The previous per-test values are not recoverable; only the guard is removed.
  pgm.dropConstraint('tests', 'chk_study_tests_no_negative_marking');
}
