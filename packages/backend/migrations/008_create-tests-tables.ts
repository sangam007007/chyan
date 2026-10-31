import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('tests', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    title_en: { type: 'varchar(200)', notNull: true },
    title_hi: { type: 'varchar(200)', notNull: true },
    description_en: { type: 'text' },
    description_hi: { type: 'text' },
    exam_id: {
      type: 'uuid',
      notNull: true,
      references: 'exams(id)',
    },
    duration_minutes: { type: 'integer', notNull: true },
    total_marks: { type: 'integer', notNull: true },
    marks_per_question: { type: 'numeric(4,2)', notNull: true, default: 1 },
    negative_marking_ratio: { type: 'numeric(3,2)', notNull: true, default: 0 },
    passing_marks: { type: 'integer', notNull: true },
    pricing_type: { type: 'varchar(10)', notNull: true, default: "'free'" },
    status: { type: 'varchar(10)', notNull: true, default: "'draft'" },
    available_from: { type: 'timestamptz' },
    available_until: { type: 'timestamptz' },
    attempt_count: { type: 'integer', notNull: true, default: 0 },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('tests', 'chk_duration_minutes', {
    check: 'duration_minutes > 0',
  });

  pgm.addConstraint('tests', 'chk_total_marks', {
    check: 'total_marks > 0',
  });

  pgm.addConstraint('tests', 'chk_negative_marking_ratio', {
    check: 'negative_marking_ratio >= 0 AND negative_marking_ratio <= 1',
  });

  pgm.addConstraint('tests', 'chk_passing_marks', {
    check: 'passing_marks >= 0',
  });

  pgm.addConstraint('tests', 'chk_pricing_type', {
    check: "pricing_type IN ('free', 'premium')",
  });

  pgm.addConstraint('tests', 'chk_status', {
    check: "status IN ('draft', 'published')",
  });

  pgm.createTable('test_questions', {
    test_id: {
      type: 'uuid',
      notNull: true,
      references: 'tests(id)',
      onDelete: 'CASCADE',
    },
    question_id: {
      type: 'uuid',
      notNull: true,
      references: 'questions(id)',
    },
    question_order: { type: 'smallint', notNull: true },
  });

  pgm.addConstraint('test_questions', 'pk_test_questions', {
    primaryKey: ['test_id', 'question_id'],
  });

  pgm.addConstraint('test_questions', 'uq_test_question_order', {
    unique: ['test_id', 'question_order'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('test_questions');
  pgm.dropTable('tests');
}
