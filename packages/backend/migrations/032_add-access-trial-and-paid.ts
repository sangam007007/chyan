import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Access control: every new user gets a 3-day free trial, then needs a paid plan.
 *
 * - users.trial_ends_at: set when the account is created (now + 3 days). Accounts that already exist
 *   when this runs get 3 days from the moment of migration, so nobody is locked out the second it ships.
 * - users.paid_until: end of the paid plan; null = never paid.
 * - subscription_grants: audit log of every manual grant by staff (e.g. a UPI payment confirmed by hand).
 * Staff (admin / super_admin) are never blocked.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
      ADD COLUMN paid_until timestamptz;

    CREATE TABLE subscription_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
      months integer NOT NULL CHECK (months BETWEEN 1 AND 24),
      paid_until_after timestamptz NOT NULL,
      note varchar(200),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_subscription_grants_user ON subscription_grants (user_id, created_at DESC);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS subscription_grants; ALTER TABLE users DROP COLUMN IF EXISTS paid_until, DROP COLUMN IF EXISTS trial_ends_at;`);
}
