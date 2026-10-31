import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * The funny comment shown next to a score on the result page is picked once per attempt and then
 * kept, so reopening the result always shows the same line. `comment_band` is the group it came
 * from (e.g. "fail-1", "pass-80") and `comment_index` its position in that group.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('test_attempts', {
    comment_band: { type: 'varchar(16)' },
    comment_index: { type: 'smallint' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('test_attempts', ['comment_band', 'comment_index']);
}
