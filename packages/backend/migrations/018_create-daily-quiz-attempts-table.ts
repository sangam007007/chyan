import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('daily_quiz_attempts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
    quiz_date: {
      type: 'date',
      notNull: true,
    },
    question_ids: {
      type: 'uuid[]',
      notNull: true,
    },
    answers: {
      type: 'smallint[]',
    },
    score: {
      type: 'smallint',
    },
    time_taken_seconds: {
      type: 'integer',
    },
    status: {
      type: 'varchar(15)',
      notNull: true,
      default: "'in_progress'",
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    submitted_at: {
      type: 'timestamptz',
    },
  });

  pgm.addConstraint('daily_quiz_attempts', 'chk_quiz_status', {
    check: "status IN ('in_progress', 'submitted')",
  });

  pgm.addConstraint('daily_quiz_attempts', 'uq_user_quiz_date', {
    unique: ['user_id', 'quiz_date'],
  });

  pgm.createIndex('daily_quiz_attempts', ['user_id', { name: 'quiz_date', sort: 'DESC' }], {
    name: 'idx_daily_quiz_user_date',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('daily_quiz_attempts');
}
