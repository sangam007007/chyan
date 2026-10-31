import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Student discussions.
 *
 * A "room" is a text key: test:<testId> (a fixed test), subject:<subjectId> (the generated full tests
 * of a subject, which differ per student) or exam:<examId> (the common Study-tab community of an exam).
 * Messages are only ever soft-deleted / hidden so a report can be reviewed later.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE discussion_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room_key varchar(60) NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body varchar(600) NOT NULL DEFAULT '',
      image_path varchar(200),
      report_count integer NOT NULL DEFAULT 0,
      hidden_at timestamptz,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_discussion_message_not_empty CHECK (length(btrim(body)) > 0 OR image_path IS NOT NULL)
    );
    CREATE INDEX idx_discussion_messages_room ON discussion_messages (room_key, created_at DESC);
    CREATE INDEX idx_discussion_messages_user ON discussion_messages (user_id, created_at DESC);

    CREATE TABLE discussion_reports (
      message_id uuid NOT NULL REFERENCES discussion_messages(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (message_id, user_id)
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS discussion_reports; DROP TABLE IF EXISTS discussion_messages;`);
}
