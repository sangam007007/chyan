import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('exams', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name_en: { type: 'varchar(100)', notNull: true },
    name_hi: { type: 'varchar(100)', notNull: true },
    description_en: { type: 'varchar(100)' },
    description_hi: { type: 'varchar(100)' },
    category: { type: 'varchar(50)', notNull: true },
    state: { type: 'varchar(50)' },
    icon_url: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    display_order: { type: 'integer', notNull: true, default: 0 },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('exams');
}
