import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('study_plan_items', {
    topic_count: { type: 'integer', notNull: true, default: 0 },
    test_count: { type: 'integer', notNull: true, default: 0 },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('study_plan_items', ['topic_count', 'test_count']);
}
