import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('coin_transactions', {
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
    type: {
      type: 'varchar(20)',
      notNull: true,
    },
    amount: {
      type: 'integer',
      notNull: true,
    },
    reference_id: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('coin_transactions', 'chk_coin_type', {
    check: "type IN ('daily_login', 'streak_bonus_7', 'referral', 'quiz_complete', 'test_complete')",
  });

  pgm.addConstraint('coin_transactions', 'chk_coin_amount', {
    check: 'amount > 0',
  });

  // Unique partial indexes for idempotency (use raw SQL for expression-based indexes)
  // Use CAST(...) syntax instead of :: to avoid node-pg-migrate parameter interpolation
  pgm.sql(`
    CREATE UNIQUE INDEX uq_coin_daily_login
      ON coin_transactions (user_id, type, CAST(created_at AT TIME ZONE 'Asia/Kolkata' AS date))
      WHERE type = 'daily_login';
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX uq_coin_quiz_daily
      ON coin_transactions (user_id, type, CAST(created_at AT TIME ZONE 'Asia/Kolkata' AS date))
      WHERE type = 'quiz_complete';
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX uq_coin_test_attempt
      ON coin_transactions (user_id, type, reference_id)
      WHERE type = 'test_complete';
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX uq_coin_referral
      ON coin_transactions (user_id, type, reference_id)
      WHERE type = 'referral';
  `);

  pgm.createIndex('coin_transactions', ['user_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_coin_transactions_user',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('coin_transactions');
}
