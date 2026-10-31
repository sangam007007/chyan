import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('questions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    text_en: { type: 'text', notNull: true },
    text_hi: { type: 'text', notNull: true },
    option_a_en: { type: 'varchar(500)', notNull: true },
    option_a_hi: { type: 'varchar(500)', notNull: true },
    option_b_en: { type: 'varchar(500)', notNull: true },
    option_b_hi: { type: 'varchar(500)', notNull: true },
    option_c_en: { type: 'varchar(500)', notNull: true },
    option_c_hi: { type: 'varchar(500)', notNull: true },
    option_d_en: { type: 'varchar(500)', notNull: true },
    option_d_hi: { type: 'varchar(500)', notNull: true },
    correct_option: { type: 'smallint', notNull: true },
    explanation_en: { type: 'text' },
    explanation_hi: { type: 'text' },
    subject: { type: 'varchar(20)', notNull: true },
    topic: { type: 'varchar(100)' },
    difficulty: { type: 'varchar(10)', notNull: true },
    image_url: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
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

  pgm.addConstraint('questions', 'chk_correct_option', {
    check: 'correct_option BETWEEN 0 AND 3',
  });

  pgm.addConstraint('questions', 'chk_subject', {
    check: "subject IN ('gk', 'math', 'reasoning', 'hindi')",
  });

  pgm.addConstraint('questions', 'chk_difficulty', {
    check: "difficulty IN ('easy', 'medium', 'hard')",
  });

  pgm.createTable('question_exams', {
    question_id: {
      type: 'uuid',
      notNull: true,
      references: 'questions(id)',
      onDelete: 'CASCADE',
    },
    exam_id: {
      type: 'uuid',
      notNull: true,
      references: 'exams(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.addConstraint('question_exams', 'pk_question_exams', {
    primaryKey: ['question_id', 'exam_id'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('question_exams');
  pgm.dropTable('questions');
}
