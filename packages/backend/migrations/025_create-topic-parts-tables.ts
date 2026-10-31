import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Topic parts table — each topic can have multiple parts
  pgm.createTable('topic_parts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    topic_id: { type: 'uuid', notNull: true, references: 'topics(id)', onDelete: 'CASCADE' },
    part_number: { type: 'integer', notNull: true },
    title_en: { type: 'varchar(200)', notNull: true },
    title_hi: { type: 'varchar(200)', notNull: true, default: '' },
    content_en: { type: 'text', default: '' },
    content_hi: { type: 'text', default: '' },
    test_id: { type: 'uuid', references: 'tests(id)' },
    display_order: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('topic_parts', 'uq_topic_part_number', { unique: ['topic_id', 'part_number'] });
  pgm.createIndex('topic_parts', 'topic_id', { name: 'idx_topic_parts_topic' });

  // Topic part progress table — tracks user progress on each part
  pgm.createTable('topic_part_progress', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    part_id: { type: 'uuid', notNull: true, references: 'topic_parts(id)', onDelete: 'CASCADE' },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'not_started',
      check: "status IN ('not_started', 'completed')",
    },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('topic_part_progress', 'uq_user_part', { unique: ['user_id', 'part_id'] });
  pgm.createIndex('topic_part_progress', 'user_id', { name: 'idx_part_progress_user' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('topic_part_progress');
  pgm.dropTable('topic_parts');
}
