import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 027: Create daily_plan_progress table.
 * Stores daily plan completion percentage for each user (used in weekly strip).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('daily_plan_progress', {
    id: { type: 'uuid', notNull: true, default: pgm.func('gen_random_uuid()'), primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)' },
    date: { type: 'date', notNull: true },
    total_items: { type: 'smallint', notNull: true, default: 0 },
    completed_items: { type: 'smallint', notNull: true, default: 0 },
    completion_pct: { type: 'smallint', notNull: true, default: 0 },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('daily_plan_progress', 'uq_user_date_progress', {
    unique: ['user_id', 'date'],
  });

  pgm.createIndex('daily_plan_progress', ['user_id', 'date']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('daily_plan_progress');
}
