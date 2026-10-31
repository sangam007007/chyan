import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    phone: { type: 'varchar(10)', unique: true },
    email: { type: 'varchar(255)', unique: true },
    full_name: { type: 'varchar(50)' },
    avatar_url: { type: 'text' },
    preferred_language: {
      type: 'varchar(2)',
      notNull: true,
      default: "'hi'",
    },
    selected_exam_id: {
      type: 'uuid',
      references: 'exams(id)',
    },
    google_id: { type: 'varchar(255)', unique: true },
    google_avatar_url: { type: 'text' },
    onboarding_completed: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    exam_change_count_this_month: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    exam_change_month: { type: 'integer' },
    deletion_scheduled_at: { type: 'timestamptz' },
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
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('users');
}
