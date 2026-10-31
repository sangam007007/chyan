import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('topic_progress', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    subject_id: { type: 'uuid', notNull: true, references: 'subjects(id)' },
    topic_id: { type: 'uuid', notNull: true, references: 'topics(id)' },
    status: { type: 'varchar(20)', notNull: true, default: "'locked'" },
    best_accuracy: { type: 'integer' },
    attempts_count: { type: 'integer', notNull: true, default: 0 },
    completed_at: { type: 'timestamptz' },
    unlocked_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('topic_progress', 'chk_topic_progress_status', {
    check: "status IN ('locked', 'unlocked', 'in_progress', 'completed')",
  });

  pgm.addConstraint('topic_progress', 'uq_user_topic_progress', {
    unique: ['user_id', 'topic_id'],
  });

  pgm.createIndex('topic_progress', ['user_id', 'subject_id'], {
    name: 'idx_topic_progress_user_subject',
  });

  pgm.createIndex('topic_progress', ['user_id', 'status'], {
    name: 'idx_topic_progress_user_status',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('topic_progress');
}
