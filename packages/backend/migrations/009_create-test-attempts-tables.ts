import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('test_attempts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
    test_id: {
      type: 'uuid',
      notNull: true,
      references: 'tests(id)',
    },
    started_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    ends_at: { type: 'timestamptz', notNull: true },
    submitted_at: { type: 'timestamptz' },
    status: { type: 'varchar(15)', notNull: true, default: "'in_progress'" },
    total_score: { type: 'numeric(6,2)' },
    correct_count: { type: 'smallint' },
    wrong_count: { type: 'smallint' },
    skipped_count: { type: 'smallint' },
    percentage: { type: 'numeric(5,2)' },
    time_taken_seconds: { type: 'integer' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('test_attempts', 'chk_attempt_status', {
    check: "status IN ('in_progress', 'submitted', 'auto_submitted')",
  });

  pgm.createIndex('test_attempts', ['user_id', 'test_id'], {
    name: 'idx_test_attempts_user_test',
  });

  pgm.createTable('attempt_answers', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    attempt_id: {
      type: 'uuid',
      notNull: true,
      references: 'test_attempts(id)',
      onDelete: 'CASCADE',
    },
    question_id: {
      type: 'uuid',
      notNull: true,
      references: 'questions(id)',
    },
    question_order: { type: 'smallint', notNull: true },
    selected_option: { type: 'smallint' },
    marked_for_review: { type: 'boolean', notNull: true, default: false },
    answered_at: { type: 'timestamptz' },
  });

  pgm.addConstraint('attempt_answers', 'chk_selected_option', {
    check: 'selected_option BETWEEN 0 AND 3',
  });

  pgm.addConstraint('attempt_answers', 'uq_attempt_question_order', {
    unique: ['attempt_id', 'question_order'],
  });

  pgm.createTable('revision_marks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
    question_id: {
      type: 'uuid',
      notNull: true,
      references: 'questions(id)',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('revision_marks', 'uq_user_question_revision', {
    unique: ['user_id', 'question_id'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('revision_marks');
  pgm.dropTable('attempt_answers');
  pgm.dropTable('test_attempts');
}
