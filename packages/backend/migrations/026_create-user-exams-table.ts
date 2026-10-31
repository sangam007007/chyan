import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('user_exams', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    exam_id: { type: 'uuid', notNull: true, references: 'exams(id)' },
    enrolled_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    is_active: { type: 'boolean', notNull: true, default: true },
  });
  pgm.addConstraint('user_exams', 'uq_user_exam', { unique: ['user_id', 'exam_id'] });
  pgm.createIndex('user_exams', 'user_id', { name: 'idx_user_exams_user' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('user_exams');
}
