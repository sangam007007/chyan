import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // study_plans
  pgm.createTable('study_plans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(100)', notNull: true },
    day_of_week: { type: 'varchar(10)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('study_plans', ['user_id', { name: 'created_at', sort: 'DESC' }], { name: 'idx_study_plans_user_created' });

  // study_plan_items
  pgm.createTable('study_plan_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    plan_id: { type: 'uuid', notNull: true, references: 'study_plans(id)', onDelete: 'CASCADE' },
    subject_id: { type: 'uuid', notNull: true, references: 'subjects(id)' },
    duration_minutes: { type: 'integer', notNull: true },
    display_order: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('study_plan_items', 'chk_duration_minutes', { check: 'duration_minutes BETWEEN 5 AND 480' });
  pgm.addConstraint('study_plan_items', 'chk_display_order', { check: 'display_order BETWEEN 0 AND 100' });
  pgm.createIndex('study_plan_items', 'plan_id', { name: 'idx_plan_items_plan_id' });

  // user_active_plans
  pgm.createTable('user_active_plans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    plan_id: { type: 'uuid', notNull: true, references: 'study_plans(id)', onDelete: 'CASCADE' },
    plan_date: { type: 'date', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('user_active_plans', 'uq_user_active_plan_date', { unique: ['user_id', 'plan_date'] });
  pgm.createIndex('user_active_plans', ['user_id', { name: 'plan_date', sort: 'DESC' }], { name: 'idx_active_plans_user_date' });

  // plan_item_completions
  pgm.createTable('plan_item_completions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    item_id: { type: 'uuid', notNull: true, references: 'study_plan_items(id)', onDelete: 'CASCADE' },
    completion_date: { type: 'date', notNull: true },
    completed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('plan_item_completions', 'uq_user_item_completion_date', { unique: ['user_id', 'item_id', 'completion_date'] });
  pgm.createIndex('plan_item_completions', ['user_id', 'completion_date'], { name: 'idx_completions_user_date' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('plan_item_completions');
  pgm.dropTable('user_active_plans');
  pgm.dropTable('study_plan_items');
  pgm.dropTable('study_plans');
}
