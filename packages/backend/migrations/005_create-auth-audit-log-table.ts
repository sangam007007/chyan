import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('auth_audit_log', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    action: { type: 'varchar(50)', notNull: true },
    ip_address: { type: 'inet' },
    metadata: { type: 'jsonb' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Index for user-specific audit queries (most recent first)
  pgm.createIndex('auth_audit_log', ['user_id', 'created_at'], {
    name: 'idx_audit_user',
    where: undefined,
  });
  pgm.sql('DROP INDEX IF EXISTS idx_audit_user');
  pgm.sql('CREATE INDEX idx_audit_user ON auth_audit_log(user_id, created_at DESC)');

  // Index for action-based queries (most recent first)
  pgm.sql('CREATE INDEX idx_audit_action ON auth_audit_log(action, created_at DESC)');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP INDEX IF EXISTS idx_audit_action');
  pgm.sql('DROP INDEX IF EXISTS idx_audit_user');
  pgm.dropTable('auth_audit_log');
}
