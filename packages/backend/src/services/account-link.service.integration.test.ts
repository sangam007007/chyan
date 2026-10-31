/**
 * Integration tests for AccountLinkService.
 *
 * Tests real database interactions using a PostgreSQL testcontainer.
 * Validates:
 * - Google login → detect existing phone account → prompt → confirm merge
 * - Phone login → detect existing Google account → prompt → confirm merge
 * - Decline linking → create separate account
 * - 120-second timeout → auto-decline (constant validation)
 *
 * Requirements: 6.1–6.6
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { runMigrations } from "@/db/migrate.js";
import {
  AccountLinkService,
  LINKING_TIMEOUT_MS,
  type UserRecord,
} from "./account-link.service.js";
import type { GoogleProfile } from "./oauth.service.js";

const { Pool } = pg;

// ─── Test Setup ───────────────────────────────────────────────────────

describe("AccountLinkService Integration", () => {
  let container: StartedPostgreSqlContainer;
  let databaseUrl: string;
  let testPool: InstanceType<typeof Pool>;
  let service: AccountLinkService;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withStartupTimeout(120_000)
      .start();
    databaseUrl = container.getConnectionUri();

    // Run all migrations
    await runMigrations({ databaseUrl, direction: "up", verbose: false });

    // Create a pool for the integration tests
    testPool = new Pool({ connectionString: databaseUrl, max: 5 });

    // Monkey-patch the pool import so the service queries go to our test DB.
    // We do this by mocking the pool module at runtime.
    const dbPoolModule = await import("@/db/pool.js");
    // Replace the pool's query method by making the pool point to our test pool
    // Since pool is exported as const, we override methods on the imported object.
    // A cleaner approach: override the pool module export via vi.mock won't work
    // in integration tests since we want real SQL. Instead, we'll use a direct approach.
    // We replace the underlying pool reference by reassigning internal properties.
    (dbPoolModule as any).pool.options = testPool.options;
    // Actually, the cleanest way is to end the original pool and re-create it pointing to our DB.
    // Let's just set the env variable and re-import.
    // The simplest approach for integration tests: set DB_URL env before pool is used.
    // Since pool.ts reads env.DB_URL at import time, we need to directly replace the pool.
    // Let's replace pool's connect behavior:
    const originalConnect = (dbPoolModule as any).pool.connect.bind((dbPoolModule as any).pool);
    (dbPoolModule as any).pool.connect = () => testPool.connect();
    (dbPoolModule as any).pool.query = (...args: any[]) => testPool.query(...args);

    service = new AccountLinkService();
  }, 120_000);

  afterAll(async () => {
    await testPool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    // Clean up test data between tests (preserve exams seed data)
    await testPool.query("DELETE FROM account_links");
    await testPool.query("DELETE FROM sessions");
    await testPool.query("DELETE FROM auth_audit_log");
    await testPool.query("DELETE FROM users");
  });

  // ─── Helper Functions ─────────────────────────────────────────────────

  async function createPhoneUser(overrides: Partial<{
    phone: string;
    full_name: string;
    avatar_url: string;
    email: string;
    preferred_language: string;
    onboarding_completed: boolean;
  }> = {}): Promise<UserRecord> {
    const result = await testPool.query<UserRecord>(
      `INSERT INTO users (phone, full_name, avatar_url, email, preferred_language, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed`,
      [
        overrides.phone ?? "9876543210",
        overrides.full_name ?? "राम कुमार",
        overrides.avatar_url ?? null,
        overrides.email ?? null,
        overrides.preferred_language ?? "hi",
        overrides.onboarding_completed ?? true,
      ]
    );
    return result.rows[0];
  }

  async function createGoogleUser(overrides: Partial<{
    email: string;
    full_name: string;
    google_id: string;
    google_avatar_url: string;
    avatar_url: string;
    phone: string;
    preferred_language: string;
    onboarding_completed: boolean;
  }> = {}): Promise<UserRecord> {
    const result = await testPool.query<UserRecord>(
      `INSERT INTO users (email, full_name, google_id, google_avatar_url, avatar_url, phone, preferred_language, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed`,
      [
        overrides.email ?? "ram@gmail.com",
        overrides.full_name ?? "Ram Kumar",
        overrides.google_id ?? "google-123",
        overrides.google_avatar_url ?? "https://lh3.googleusercontent.com/photo.jpg",
        overrides.avatar_url ?? null,
        overrides.phone ?? null,
        overrides.preferred_language ?? "en",
        overrides.onboarding_completed ?? true,
      ]
    );
    return result.rows[0];
  }

  async function getUserById(id: string): Promise<UserRecord | null> {
    const result = await testPool.query<UserRecord>(
      `SELECT id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ─── checkExisting() Tests ────────────────────────────────────────────

  describe("checkExisting() — real DB queries", () => {
    it("should detect existing phone account when Google login provides matching email", async () => {
      // Scenario: User has phone account with email set, logs in with Google using same email
      const phoneUser = await createPhoneUser({ email: "ram@gmail.com" });

      const result = await service.checkExisting("ram@gmail.com", null);

      expect(result).not.toBeNull();
      expect(result!.user.id).toBe(phoneUser.id);
      expect(result!.matchedBy).toBe("email");
    });

    it("should detect existing Google account when phone login provides matching phone", async () => {
      // Scenario: User has Google account with phone set, logs in with OTP using same phone
      const googleUser = await createGoogleUser({ phone: "9876543210" });

      const result = await service.checkExisting(null, "9876543210");

      expect(result).not.toBeNull();
      expect(result!.user.id).toBe(googleUser.id);
      expect(result!.matchedBy).toBe("phone");
    });

    it("should return null when no existing account matches", async () => {
      await createPhoneUser({ phone: "9876543210" });
      await createGoogleUser({ email: "other@gmail.com" });

      const result = await service.checkExisting("nonexistent@gmail.com", "1111111111");

      expect(result).toBeNull();
    });

    it("should return null when both email and phone are null", async () => {
      const result = await service.checkExisting(null, null);
      expect(result).toBeNull();
    });

    it("should prioritize email match over phone match", async () => {
      const emailUser = await createPhoneUser({ email: "match@gmail.com", phone: "1111111111" });
      await createGoogleUser({ phone: "9876543210", email: "other@gmail.com" });

      const result = await service.checkExisting("match@gmail.com", "9876543210");

      expect(result).not.toBeNull();
      expect(result!.user.id).toBe(emailUser.id);
      expect(result!.matchedBy).toBe("email");
    });
  });

  // ─── linkAccounts() Tests ─────────────────────────────────────────────

  describe("linkAccounts() — Google login merges into phone account", () => {
    it("should merge Google credentials into existing phone account", async () => {
      const phoneUser = await createPhoneUser();
      const googleUser = await createGoogleUser();

      await service.linkAccounts(phoneUser.id, googleUser.id);

      // Verify primary account now has Google credentials
      const merged = await getUserById(phoneUser.id);
      expect(merged).not.toBeNull();
      expect(merged!.google_id).toBe("google-123");
      expect(merged!.google_avatar_url).toBe("https://lh3.googleusercontent.com/photo.jpg");
      expect(merged!.email).toBe("ram@gmail.com");
      // Original phone and name preserved
      expect(merged!.phone).toBe("9876543210");
      expect(merged!.full_name).toBe("राम कुमार");
      expect(merged!.preferred_language).toBe("hi");
    });

    it("should apply Google avatar only when primary has no existing avatar", async () => {
      const phoneUserNoAvatar = await createPhoneUser({ avatar_url: null });
      const googleUser = await createGoogleUser();

      await service.linkAccounts(phoneUserNoAvatar.id, googleUser.id);

      const merged = await getUserById(phoneUserNoAvatar.id);
      expect(merged!.avatar_url).toBe("https://lh3.googleusercontent.com/photo.jpg");
    });

    it("should NOT overwrite existing avatar when primary already has one", async () => {
      const phoneUserWithAvatar = await createPhoneUser({
        avatar_url: "https://cdn.example.com/my-avatar.jpg",
      });
      const googleUser = await createGoogleUser();

      await service.linkAccounts(phoneUserWithAvatar.id, googleUser.id);

      const merged = await getUserById(phoneUserWithAvatar.id);
      expect(merged!.avatar_url).toBe("https://cdn.example.com/my-avatar.jpg");
      // Google avatar reference still stored
      expect(merged!.google_avatar_url).toBe("https://lh3.googleusercontent.com/photo.jpg");
    });

    it("should deactivate secondary account after merge", async () => {
      const phoneUser = await createPhoneUser();
      const googleUser = await createGoogleUser();

      await service.linkAccounts(phoneUser.id, googleUser.id);

      // Secondary account should have identifiers cleared
      const deactivated = await getUserById(googleUser.id);
      expect(deactivated).not.toBeNull();
      expect(deactivated!.phone).toBeNull();
      expect(deactivated!.email).toBeNull();
      expect(deactivated!.google_id).toBeNull();
    });

    it("should log linking event to account_links table", async () => {
      const phoneUser = await createPhoneUser();
      const googleUser = await createGoogleUser();

      await service.linkAccounts(phoneUser.id, googleUser.id);

      const linkResult = await testPool.query(
        `SELECT primary_user_id, linked_provider, linked_identifier
         FROM account_links
         WHERE primary_user_id = $1`,
        [phoneUser.id]
      );

      expect(linkResult.rows.length).toBe(1);
      expect(linkResult.rows[0].linked_provider).toBe("google");
      expect(linkResult.rows[0].linked_identifier).toBe("ram@gmail.com");
    });

    it("should preserve primary profile data (name, language, onboarding status)", async () => {
      const phoneUser = await createPhoneUser({
        full_name: "विकास शर्मा",
        preferred_language: "hi",
        onboarding_completed: true,
      });
      const googleUser = await createGoogleUser({
        full_name: "Vikas Sharma",
        preferred_language: "en",
      });

      await service.linkAccounts(phoneUser.id, googleUser.id);

      const merged = await getUserById(phoneUser.id);
      expect(merged!.full_name).toBe("विकास शर्मा");
      expect(merged!.preferred_language).toBe("hi");
      expect(merged!.onboarding_completed).toBe(true);
    });
  });

  describe("linkAccounts() — Phone login merges into Google account", () => {
    it("should merge phone credentials into existing Google account", async () => {
      const googleUser = await createGoogleUser();
      const phoneUser = await createPhoneUser();

      // Google account is primary, phone account is secondary
      await service.linkAccounts(googleUser.id, phoneUser.id);

      const merged = await getUserById(googleUser.id);
      expect(merged).not.toBeNull();
      // Google account keeps its Google credentials
      expect(merged!.google_id).toBe("google-123");
      expect(merged!.email).toBe("ram@gmail.com");
      // Gains phone from secondary
      expect(merged!.phone).toBe("9876543210");
      // Preserves original name and language
      expect(merged!.full_name).toBe("Ram Kumar");
      expect(merged!.preferred_language).toBe("en");
    });

    it("should deactivate phone account after merge into Google account", async () => {
      const googleUser = await createGoogleUser();
      const phoneUser = await createPhoneUser();

      await service.linkAccounts(googleUser.id, phoneUser.id);

      const deactivated = await getUserById(phoneUser.id);
      expect(deactivated!.phone).toBeNull();
      expect(deactivated!.email).toBeNull();
      expect(deactivated!.google_id).toBeNull();
    });

    it("should log linking event with phone provider", async () => {
      const googleUser = await createGoogleUser();
      const phoneUser = await createPhoneUser();

      await service.linkAccounts(googleUser.id, phoneUser.id);

      const linkResult = await testPool.query(
        `SELECT primary_user_id, linked_provider, linked_identifier
         FROM account_links
         WHERE primary_user_id = $1`,
        [googleUser.id]
      );

      expect(linkResult.rows.length).toBe(1);
      expect(linkResult.rows[0].linked_provider).toBe("phone");
      expect(linkResult.rows[0].linked_identifier).toBe("9876543210");
    });
  });

  // ─── createSeparate() Tests ───────────────────────────────────────────

  describe("createSeparate() — Decline linking creates new account", () => {
    it("should create a new separate account from Google profile", async () => {
      const profile: GoogleProfile = {
        googleId: "google-new-456",
        email: "newuser@gmail.com",
        name: "New User",
        picture: "https://lh3.googleusercontent.com/newphoto.jpg",
      };

      const newUser = await service.createSeparate(profile);

      expect(newUser).not.toBeNull();
      expect(newUser.email).toBe("newuser@gmail.com");
      expect(newUser.full_name).toBe("New User");
      expect(newUser.avatar_url).toBe("https://lh3.googleusercontent.com/newphoto.jpg");
      expect(newUser.google_id).toBe("google-new-456");
      expect(newUser.google_avatar_url).toBe("https://lh3.googleusercontent.com/newphoto.jpg");
    });

    it("should mark new account with onboarding_completed=false", async () => {
      const profile: GoogleProfile = {
        googleId: "google-decline-789",
        email: "decline@gmail.com",
        name: "Decline User",
      };

      const newUser = await service.createSeparate(profile);

      expect(newUser.onboarding_completed).toBe(false);

      // Verify in database directly
      const dbUser = await getUserById(newUser.id);
      expect(dbUser!.onboarding_completed).toBe(false);
    });

    it("should handle Google profile with missing optional fields", async () => {
      const profile: GoogleProfile = {
        googleId: "google-minimal-101",
        email: "minimal@gmail.com",
      };

      const newUser = await service.createSeparate(profile);

      expect(newUser.email).toBe("minimal@gmail.com");
      expect(newUser.full_name).toBeNull();
      expect(newUser.avatar_url).toBeNull();
      expect(newUser.google_id).toBe("google-minimal-101");
      expect(newUser.google_avatar_url).toBeNull();
      expect(newUser.onboarding_completed).toBe(false);
    });

    it("should not interfere with existing accounts", async () => {
      // Create existing phone user
      const existingPhoneUser = await createPhoneUser({ phone: "9999999999" });

      const profile: GoogleProfile = {
        googleId: "google-separate-202",
        email: "separate@gmail.com",
        name: "Separate User",
      };

      const newUser = await service.createSeparate(profile);

      // Both users should exist independently
      const existing = await getUserById(existingPhoneUser.id);
      expect(existing).not.toBeNull();
      expect(existing!.phone).toBe("9999999999");

      const created = await getUserById(newUser.id);
      expect(created).not.toBeNull();
      expect(created!.email).toBe("separate@gmail.com");
    });

    it("should persist the user in the database", async () => {
      const profile: GoogleProfile = {
        googleId: "google-persist-303",
        email: "persist@gmail.com",
        name: "Persisted User",
        picture: "https://lh3.googleusercontent.com/persist.jpg",
      };

      const newUser = await service.createSeparate(profile);

      // Verify we can find the user in the DB
      const dbUser = await getUserById(newUser.id);
      expect(dbUser).not.toBeNull();
      expect(dbUser!.id).toBe(newUser.id);
      expect(dbUser!.email).toBe("persist@gmail.com");
      expect(dbUser!.google_id).toBe("google-persist-303");
    });
  });

  // ─── 120-second Timeout Tests ─────────────────────────────────────────

  describe("120-second timeout — auto-decline", () => {
    it("should export LINKING_TIMEOUT_MS as 120000 ms (120 seconds)", () => {
      expect(LINKING_TIMEOUT_MS).toBe(120_000);
    });

    it("timeout scenario: after 120s, createSeparate is called (simulated decline)", async () => {
      // This tests the concept: when the timeout fires, the system treats it
      // as a decline and calls createSeparate to create a new account.
      // We simulate this flow here.

      // 1. User logs in via Google, existing phone account detected
      const phoneUser = await createPhoneUser({ email: "timeout@gmail.com" });
      const match = await service.checkExisting("timeout@gmail.com", null);
      expect(match).not.toBeNull();
      expect(match!.user.id).toBe(phoneUser.id);

      // 2. User does not respond within 120 seconds — system auto-declines
      // In production, a setTimeout(LINKING_TIMEOUT_MS) would call createSeparate.
      // Here we directly call it as the auto-decline behavior.
      const profile: GoogleProfile = {
        googleId: "google-timeout-404",
        email: "timeout-new@gmail.com",
        name: "Timeout User",
      };

      const separateUser = await service.createSeparate(profile);

      // 3. Verify a separate account was created (not linked)
      expect(separateUser.onboarding_completed).toBe(false);
      expect(separateUser.google_id).toBe("google-timeout-404");

      // 4. Verify original phone account is unchanged
      const originalUser = await getUserById(phoneUser.id);
      expect(originalUser!.phone).toBe("9876543210");
      expect(originalUser!.google_id).toBeNull();
    });
  });

  // ─── Full Flow Integration Tests ─────────────────────────────────────

  describe("Full linking flow scenarios", () => {
    it("Google login → detect existing phone account → confirm merge", async () => {
      // Step 1: Phone user exists
      const phoneUser = await createPhoneUser({
        phone: "8888888888",
        full_name: "सीता देवी",
        email: "sita@gmail.com",
      });

      // Step 2: Google login detects existing account by email
      const match = await service.checkExisting("sita@gmail.com", null);
      expect(match).not.toBeNull();
      expect(match!.matchedBy).toBe("email");

      // Step 3: Create temporary Google account (would be created during OAuth)
      const googleUser = await createGoogleUser({
        email: "sita-google@gmail.com",
        google_id: "google-sita-001",
        google_avatar_url: "https://lh3.googleusercontent.com/sita.jpg",
      });

      // Step 4: User confirms linking → merge
      await service.linkAccounts(phoneUser.id, googleUser.id);

      // Step 5: Verify merged state
      const merged = await getUserById(phoneUser.id);
      expect(merged!.phone).toBe("8888888888");
      expect(merged!.full_name).toBe("सीता देवी");
      expect(merged!.google_id).toBe("google-sita-001");
      expect(merged!.email).toBe("sita@gmail.com"); // preserved from primary

      // Secondary deactivated
      const deactivated = await getUserById(googleUser.id);
      expect(deactivated!.google_id).toBeNull();
    });

    it("Phone login → detect existing Google account → confirm merge", async () => {
      // Step 1: Google user exists
      const googleUser = await createGoogleUser({
        email: "mohan@gmail.com",
        google_id: "google-mohan-001",
        full_name: "Mohan Lal",
        phone: "7777777777", // Google account already has this phone linked from profile
      });

      // Step 2: Phone login detects existing account by phone
      const match = await service.checkExisting(null, "7777777777");
      expect(match).not.toBeNull();
      expect(match!.matchedBy).toBe("phone");

      // Step 3: New phone user account (would be created during OTP verify)
      const phoneUser = await createPhoneUser({
        phone: "6666666666",
        full_name: "मोहन लाल",
      });

      // Step 4: User confirms linking → Google account is primary
      await service.linkAccounts(googleUser.id, phoneUser.id);

      // Step 5: Verify merged state
      const merged = await getUserById(googleUser.id);
      expect(merged!.google_id).toBe("google-mohan-001");
      expect(merged!.full_name).toBe("Mohan Lal");
      expect(merged!.phone).toBe("7777777777"); // kept from primary
      expect(merged!.email).toBe("mohan@gmail.com");

      // Secondary deactivated
      const deactivated = await getUserById(phoneUser.id);
      expect(deactivated!.phone).toBeNull();
    });

    it("Decline linking → create separate account", async () => {
      // Step 1: Phone user exists
      const phoneUser = await createPhoneUser({
        phone: "5555555555",
        email: "existing@gmail.com",
      });

      // Step 2: Google login detects existing account
      const match = await service.checkExisting("existing@gmail.com", null);
      expect(match).not.toBeNull();

      // Step 3: User declines → create separate account
      const profile: GoogleProfile = {
        googleId: "google-decline-505",
        email: "decline-new@gmail.com",
        name: "Decline User",
        picture: "https://lh3.googleusercontent.com/decline.jpg",
      };

      const separateUser = await service.createSeparate(profile);

      // Step 4: Verify separate account
      expect(separateUser.onboarding_completed).toBe(false);
      expect(separateUser.google_id).toBe("google-decline-505");
      expect(separateUser.email).toBe("decline-new@gmail.com");

      // Step 5: Original account unchanged
      const original = await getUserById(phoneUser.id);
      expect(original!.phone).toBe("5555555555");
      expect(original!.google_id).toBeNull();
    });
  });
});
