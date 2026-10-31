import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Create subjects table
  pgm.createTable('subjects', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    exam_id: {
      type: 'uuid',
      notNull: true,
      references: 'exams(id)',
    },
    name_en: { type: 'varchar(100)', notNull: true },
    name_hi: { type: 'varchar(100)', notNull: true },
    display_order: { type: 'integer', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('subjects', 'exam_id', { name: 'idx_subjects_exam_id' });

  // 2. Create topics table
  pgm.createTable('topics', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    subject_id: {
      type: 'uuid',
      notNull: true,
      references: 'subjects(id)',
      onDelete: 'CASCADE',
    },
    name_en: { type: 'varchar(100)', notNull: true },
    name_hi: { type: 'varchar(100)', notNull: true },
    display_order: { type: 'integer', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('topics', 'uq_topic_name_per_subject', {
    unique: ['subject_id', 'name_en'],
  });

  pgm.createIndex('topics', 'subject_id', { name: 'idx_topics_subject_id' });

  // 3. Add subject_id and topic_id columns to tests
  pgm.addColumn('tests', {
    subject_id: {
      type: 'uuid',
      references: 'subjects(id)',
    },
  });

  pgm.addColumn('tests', {
    topic_id: {
      type: 'uuid',
      references: 'topics(id)',
    },
  });

  // 4. Add CHECK constraint: topic_id requires subject_id
  pgm.addConstraint('tests', 'chk_topic_requires_subject', {
    check: 'topic_id IS NULL OR subject_id IS NOT NULL',
  });

  // 5. Create indexes on tests.subject_id and tests.topic_id
  pgm.createIndex('tests', 'subject_id', { name: 'idx_tests_subject_id' });
  pgm.createIndex('tests', 'topic_id', { name: 'idx_tests_topic_id' });

  // 6. Update existing tests with category='topic_wise' to 'subject_wise'
  pgm.sql("UPDATE tests SET category = 'subject_wise' WHERE category = 'topic_wise'");

  // 7. Drop old CHECK constraint and add new one without 'topic_wise'
  pgm.dropConstraint('tests', 'chk_test_category');
  pgm.addConstraint('tests', 'chk_test_category', {
    check: "category IN ('full_mock', 'subject_wise', 'previous_year', 'daily_practice')",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Reverse step 7: Restore old CHECK constraint with 'topic_wise'
  pgm.dropConstraint('tests', 'chk_test_category');
  pgm.addConstraint('tests', 'chk_test_category', {
    check: "category IN ('full_mock', 'subject_wise', 'previous_year', 'daily_practice', 'topic_wise')",
  });

  // Reverse step 6: Revert category='subject_wise' back to 'topic_wise' for rows that were updated
  // Only revert tests that have no subject_id (they were the original topic_wise tests migrated up)
  // Actually, we can't perfectly identify them, but the safest approach is to revert
  // tests that still have category='subject_wise' and no subject_id assigned by the seed migration.
  // Since this migration doesn't seed data, we revert all rows that were changed.
  // The most correct approach: revert rows that have category='subject_wise' and subject_id IS NULL
  // (because the up migration only changed category, not subject_id)
  pgm.sql("UPDATE tests SET category = 'topic_wise' WHERE category = 'subject_wise' AND subject_id IS NULL AND topic_id IS NULL");

  // Reverse step 5: Drop indexes on tests.subject_id and tests.topic_id
  pgm.dropIndex('tests', 'topic_id', { name: 'idx_tests_topic_id' });
  pgm.dropIndex('tests', 'subject_id', { name: 'idx_tests_subject_id' });

  // Reverse step 4: Drop CHECK constraint
  pgm.dropConstraint('tests', 'chk_topic_requires_subject');

  // Reverse step 3: Drop columns from tests
  pgm.dropColumn('tests', 'topic_id');
  pgm.dropColumn('tests', 'subject_id');

  // Reverse step 2: Drop topics table (indexes and constraints drop with it)
  pgm.dropTable('topics');

  // Reverse step 1: Drop subjects table (indexes drop with it)
  pgm.dropTable('subjects');
}
