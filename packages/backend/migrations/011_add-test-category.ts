import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('tests', {
    category: {
      type: 'varchar(20)',
      notNull: true,
      default: 'full_mock',
    },
  });

  pgm.addConstraint('tests', 'chk_test_category', {
    check: "category IN ('full_mock', 'subject_wise', 'previous_year', 'daily_practice', 'topic_wise')",
  });

  pgm.createIndex('tests', 'category', { name: 'idx_tests_category' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('tests', 'category', { name: 'idx_tests_category' });
  pgm.dropConstraint('tests', 'chk_test_category');
  pgm.dropColumn('tests', 'category');
}
