import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('users', {
    role: {
      type: 'varchar(20)',
      notNull: true,
      default: "'student'",
    },
  });

  pgm.addConstraint('users', 'chk_user_role', {
    check: "role IN ('student', 'admin', 'super_admin')",
  });

  pgm.createIndex('users', ['role'], {
    name: 'idx_users_role',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('users', ['role'], { name: 'idx_users_role' });
  pgm.dropConstraint('users', 'chk_user_role');
  pgm.dropColumn('users', 'role');
}
