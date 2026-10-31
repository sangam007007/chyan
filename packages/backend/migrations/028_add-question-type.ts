import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add question_type column — groups similar pattern questions together
  // e.g., "percentage_calculation", "synonym_direct", "analogy_pair"
  // All questions with same type are variations of each other (same concept, different values)
  pgm.addColumn('questions', {
    question_type: { type: 'varchar(100)', default: null },
  });

  // Index for fast lookup of similar questions by type
  pgm.createIndex('questions', 'question_type', {
    name: 'idx_questions_question_type',
    where: 'question_type IS NOT NULL',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('questions', 'question_type', { name: 'idx_questions_question_type' });
  pgm.dropColumn('questions', 'question_type');
}
