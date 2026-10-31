import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    refresh_token_hash: { type: 'varchar(64)', notNull: true },
    token_family: { type: 'uuid', notNull: true },
    device_type: { type: 'varchar(20)' },
    device_info: { type: 'jsonb' },
    ip_address: { type: 'inet' },
    city: { type: 'varchar(100)' },
    is_active: { type: 'boolean', notNull: true, default: true },
    last_active_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    expires_at: { type: 'timestamptz', notNull: true },
  });

  // Partial index for active sessions per user (most common query)
  pgm.createIndex('sessions', ['user_id', 'is_active'], {
    name: 'idx_sessions_user_active',
    where: 'is_active = true',
  });

  // Index for token family lookups (rotation detection)
  pgm.createIndex('sessions', 'token_family', {
    name: 'idx_sessions_token_family',
  });

  // Index for expiry-based cleanup
  pgm.createIndex('sessions', 'expires_at', {
    name: 'idx_sessions_expires',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('sessions', 'expires_at', { name: 'idx_sessions_expires' });
  pgm.dropIndex('sessions', 'token_family', { name: 'idx_sessions_token_family' });
  pgm.dropIndex('sessions', ['user_id', 'is_active'], { name: 'idx_sessions_user_active' });
  pgm.dropTable('sessions');
}
