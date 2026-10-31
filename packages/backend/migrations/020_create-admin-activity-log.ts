import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('admin_activity_log', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    admin_id: { type: 'uuid', notNull: true, references: 'users(id)' },
    action: { type: 'varchar(50)', notNull: true },
    entity_type: { type: 'varchar(50)', notNull: true },
    entity_id: { type: 'uuid' },
    details: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('admin_activity_log', 'chk_admin_action', {
    check: "action IN ('create', 'update', 'delete', 'publish', 'unpublish', 'role_change', 'bulk_import')",
  });

  pgm.createIndex('admin_activity_log', ['admin_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_admin_activity_admin_date',
  });

  pgm.createIndex('admin_activity_log', ['entity_type', 'entity_id'], {
    name: 'idx_admin_activity_entity',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('admin_activity_log');
}
