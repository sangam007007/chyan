import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('user_activities', {
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
    activity_date: {
      type: 'date',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('user_activities', 'uq_user_activity_date', {
    unique: ['user_id', 'activity_date'],
  });

  pgm.createIndex('user_activities', ['user_id', { name: 'activity_date', sort: 'DESC' }], {
    name: 'idx_user_activities_user_date',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('user_activities');
}
