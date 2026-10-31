import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Store selected topic IDs per plan item
  pgm.createTable('study_plan_item_topics', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    plan_item_id: { type: 'uuid', notNull: true, references: 'study_plan_items(id)', onDelete: 'CASCADE' },
    topic_id: { type: 'uuid', notNull: true, references: 'topics(id)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('study_plan_item_topics', 'uq_plan_item_topic', { unique: ['plan_item_id', 'topic_id'] });
  pgm.createIndex('study_plan_item_topics', 'plan_item_id', { name: 'idx_plan_item_topics_item' });

  // Store selected test IDs per plan item
  pgm.createTable('study_plan_item_tests', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    plan_item_id: { type: 'uuid', notNull: true, references: 'study_plan_items(id)', onDelete: 'CASCADE' },
    test_id: { type: 'uuid', notNull: true, references: 'tests(id)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('study_plan_item_tests', 'uq_plan_item_test', { unique: ['plan_item_id', 'test_id'] });
  pgm.createIndex('study_plan_item_tests', 'plan_item_id', { name: 'idx_plan_item_tests_item' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('study_plan_item_tests');
  pgm.dropTable('study_plan_item_topics');
}
