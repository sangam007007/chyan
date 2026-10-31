import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────

const mockQueryOne = vi.fn();
const mockQueryMany = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock("@/db/index.js", () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryMany: (...args: unknown[]) => mockQueryMany(...args),
  withTransaction: (fn: (client: unknown) => Promise<unknown>) =>
    mockWithTransaction(fn),
}));

import {
  AccountLinkService,
  LINKING_TIMEOUT_MS,
  type UserRecord,
  type ExistingAccountMatch,
} from "./account-link.service.js";
import type { GoogleProfile } from "./oauth.service.js";

// ─── Test Fixtures ────────────────────────────────────────────────────

const PHONE_USER: UserRecord = {
  id: "user-phone-001",
  phone: "9876543210",
  email: null,
  full_name: "राम कुमार",
  avatar_url: "https://cdn.example.com/avatars/ram.jpg",
  google_id: null,
  google_avatar_url: null,
  preferred_language: "hi",
  onboarding_completed: true,
};

const GOOGLE_USER: UserRecord = {
  id: "user-google-001",
  phone: null,
  email: "ram@gmail.com",
  full_name: "Ram Kumar",
  avatar_url: null,
  google_id: "google-123",
  google_avatar_url: "https://lh3.googleusercontent.com/photo.jpg",
  preferred_language: "en",
  onboarding_completed: true,
};

const PHONE_USER_NO_AVATAR: UserRecord = {
  ...PHONE_USER,
  id: "user-phone-002",
  avatar_url: null,
};

const GOOGLE_PROFILE: GoogleProfile = {
  googleId: "google-new-456",
  email: "newuser@gmail.com",
  name: "New User",
  picture: "https://lh3.googleusercontent.com/newphoto.jpg",
};

const GOOGLE_PROFILE_MINIMAL: GoogleProfile = {
  googleId: "google-minimal-789",
  email: "minimal@gmail.com",
};

// ─── Tests ────────────────────────────────────────────────────────────

describe("AccountLinkService", () => {
  let service: AccountLinkService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountLinkService();

    // Default withTransaction implementation: execute the fn with a mock client
    mockWithTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
      return fn({ query: vi.fn() });
    });
  });

  describe("checkExisting()", () => {
    it("should return null when both email and phone are null", async () => {
      const result = await service.checkExisting(null, null);
      expect(result).toBeNull();
      expect(mockQueryOne).not.toHaveBeenCalled();
    });

    it("should find existing user by email", async () => {
      mockQueryOne.mockResolvedValueOnce(PHONE_USER);

      const result = await service.checkExisting("test@gmail.com", null);

      expect(result).toEqual<ExistingAccountMatch>({
        user: PHONE_USER,
        matchedBy: "email",
      });
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("WHERE email = $1"),
        ["test@gmail.com"]
      );
    });

    it("should find existing user by phone when email has no match", async () => {
      mockQueryOne
        .mockResolvedValueOnce(null) // email lookup returns nothing
        .mockResolvedValueOnce(GOOGLE_USER); // phone lookup finds a user

      const result = await service.checkExisting("nope@gmail.com", "9876543210");

      expect(result).toEqual<ExistingAccountMatch>({
        user: GOOGLE_USER,
        matchedBy: "phone",
      });
    });

    it("should prioritize email match over phone match", async () => {
      mockQueryOne.mockResolvedValueOnce(PHONE_USER); // email lookup finds user

      const result = await service.checkExisting("test@gmail.com", "9876543210");

      // Only email query should be called, phone not checked
      expect(result?.matchedBy).toBe("email");
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });

    it("should return null when no match found for either email or phone", async () => {
      mockQueryOne
        .mockResolvedValueOnce(null) // email lookup
        .mockResolvedValueOnce(null); // phone lookup

      const result = await service.checkExisting("unknown@gmail.com", "1111111111");

      expect(result).toBeNull();
    });

    it("should check only phone when email is null", async () => {
      mockQueryOne.mockResolvedValueOnce(PHONE_USER);

      const result = await service.checkExisting(null, "9876543210");

      expect(result).toEqual<ExistingAccountMatch>({
        user: PHONE_USER,
        matchedBy: "phone",
      });
      // Only one query (phone), no email query
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("WHERE phone = $1"),
        ["9876543210"]
      );
    });
  });

  describe("linkAccounts()", () => {
    it("should merge Google credentials from secondary into primary", async () => {
      // First call: fetch primary (phone user without Google)
      // Second call: fetch secondary (Google user)
      // Third call: UPDATE primary
      // Fourth call: deactivate secondary
      // Fifth call: INSERT account_links
      mockQueryOne
        .mockResolvedValueOnce(PHONE_USER_NO_AVATAR) // primary
        .mockResolvedValueOnce(GOOGLE_USER) // secondary
        .mockResolvedValueOnce(null) // UPDATE primary
        .mockResolvedValueOnce(null) // deactivate secondary
        .mockResolvedValueOnce(null); // INSERT account_links

      await service.linkAccounts(PHONE_USER_NO_AVATAR.id, GOOGLE_USER.id);

      // Verify UPDATE on primary includes google_id, avatar_url (since primary has none), google_avatar_url
      const updateCall = mockQueryOne.mock.calls[2];
      const updateQuery = updateCall[0] as string;
      expect(updateQuery).toContain("google_id");
      expect(updateQuery).toContain("avatar_url");
      expect(updateQuery).toContain("google_avatar_url");

      // Verify secondary is deactivated
      const deactivateCall = mockQueryOne.mock.calls[3];
      expect(deactivateCall[0]).toContain("phone = NULL");
      expect(deactivateCall[0]).toContain("email = NULL");
      expect(deactivateCall[0]).toContain("google_id = NULL");
      expect(deactivateCall[1]).toEqual([GOOGLE_USER.id]);

      // Verify account_links log
      const linkCall = mockQueryOne.mock.calls[4];
      expect(linkCall[0]).toContain("INSERT INTO account_links");
      expect(linkCall[1]).toEqual([
        PHONE_USER_NO_AVATAR.id,
        "google",
        GOOGLE_USER.email,
      ]);
    });

    it("should NOT apply Google avatar when primary already has an avatar", async () => {
      // Primary has avatar, secondary has Google avatar
      mockQueryOne
        .mockResolvedValueOnce(PHONE_USER) // primary (has avatar_url)
        .mockResolvedValueOnce(GOOGLE_USER) // secondary
        .mockResolvedValueOnce(null) // UPDATE
        .mockResolvedValueOnce(null) // deactivate
        .mockResolvedValueOnce(null); // account_links

      await service.linkAccounts(PHONE_USER.id, GOOGLE_USER.id);

      // Check UPDATE query does NOT include a standalone avatar_url update
      const updateCall = mockQueryOne.mock.calls[2];
      const updateQuery = updateCall[0] as string;
      expect(updateQuery).toContain("google_id");
      expect(updateQuery).toContain("google_avatar_url"); // stores reference
      // Should NOT have a standalone "avatar_url = $N" (without google_ prefix)
      // google_avatar_url is fine, but avatar_url alone means avatar was overwritten
      expect(updateQuery).not.toMatch(/(?<!google_)avatar_url = \$\d/);
    });

    it("should merge email from secondary when primary has none", async () => {
      const primaryNoEmail: UserRecord = {
        ...PHONE_USER,
        email: null,
      };
      const secondaryWithEmail: UserRecord = {
        ...GOOGLE_USER,
      };

      mockQueryOne
        .mockResolvedValueOnce(primaryNoEmail)
        .mockResolvedValueOnce(secondaryWithEmail)
        .mockResolvedValueOnce(null) // UPDATE
        .mockResolvedValueOnce(null) // deactivate
        .mockResolvedValueOnce(null); // account_links

      await service.linkAccounts(primaryNoEmail.id, secondaryWithEmail.id);

      const updateCall = mockQueryOne.mock.calls[2];
      const updateQuery = updateCall[0] as string;
      expect(updateQuery).toContain("email");
    });

    it("should merge phone from secondary when primary has none", async () => {
      const primaryNoPhone: UserRecord = {
        ...GOOGLE_USER, // has email but no phone
        id: "primary-no-phone",
      };
      const secondaryWithPhone: UserRecord = {
        ...PHONE_USER,
        id: "secondary-with-phone",
        google_id: null,
      };

      mockQueryOne
        .mockResolvedValueOnce(primaryNoPhone)
        .mockResolvedValueOnce(secondaryWithPhone)
        .mockResolvedValueOnce(null) // UPDATE
        .mockResolvedValueOnce(null) // deactivate
        .mockResolvedValueOnce(null); // account_links

      await service.linkAccounts(primaryNoPhone.id, secondaryWithPhone.id);

      const updateCall = mockQueryOne.mock.calls[2];
      const updateQuery = updateCall[0] as string;
      expect(updateQuery).toContain("phone");
    });

    it("should throw when primary account not found", async () => {
      mockQueryOne
        .mockResolvedValueOnce(null) // primary not found
        .mockResolvedValueOnce(GOOGLE_USER);

      await expect(
        service.linkAccounts("nonexistent", GOOGLE_USER.id)
      ).rejects.toThrow("One or both accounts not found for linking");
    });

    it("should throw when secondary account not found", async () => {
      mockQueryOne
        .mockResolvedValueOnce(PHONE_USER)
        .mockResolvedValueOnce(null); // secondary not found

      await expect(
        service.linkAccounts(PHONE_USER.id, "nonexistent")
      ).rejects.toThrow("One or both accounts not found for linking");
    });

    it("should log linking event with phone provider when secondary is phone-based", async () => {
      const primaryGoogle: UserRecord = {
        ...GOOGLE_USER,
        id: "primary-google",
      };
      const secondaryPhone: UserRecord = {
        ...PHONE_USER,
        id: "secondary-phone",
        google_id: null,
      };

      mockQueryOne
        .mockResolvedValueOnce(primaryGoogle)
        .mockResolvedValueOnce(secondaryPhone)
        .mockResolvedValueOnce(null) // UPDATE (phone merge)
        .mockResolvedValueOnce(null) // deactivate
        .mockResolvedValueOnce(null); // account_links

      await service.linkAccounts(primaryGoogle.id, secondaryPhone.id);

      const linkCall = mockQueryOne.mock.calls[4];
      expect(linkCall[1]).toEqual([
        primaryGoogle.id,
        "phone",
        secondaryPhone.phone,
      ]);
    });

    it("should handle case where no fields need updating (both accounts already complete)", async () => {
      // Both accounts have Google credentials, email, and phone
      const primaryComplete: UserRecord = {
        id: "primary-complete",
        phone: "9876543210",
        email: "primary@gmail.com",
        full_name: "Primary User",
        avatar_url: "https://example.com/avatar.jpg",
        google_id: "google-primary",
        google_avatar_url: "https://lh3.googleusercontent.com/primary.jpg",
        preferred_language: "hi",
        onboarding_completed: true,
      };
      const secondaryComplete: UserRecord = {
        id: "secondary-complete",
        phone: "8765432109",
        email: "secondary@gmail.com",
        full_name: "Secondary User",
        avatar_url: null,
        google_id: "google-secondary",
        google_avatar_url: "https://lh3.googleusercontent.com/secondary.jpg",
        preferred_language: "en",
        onboarding_completed: true,
      };

      mockQueryOne
        .mockResolvedValueOnce(primaryComplete)
        .mockResolvedValueOnce(secondaryComplete)
        .mockResolvedValueOnce(null) // deactivate secondary
        .mockResolvedValueOnce(null); // account_links

      await service.linkAccounts(primaryComplete.id, secondaryComplete.id);

      // Should skip the UPDATE on primary (no new fields to merge)
      // After fetch primary + fetch secondary, next call should be deactivate
      const thirdCall = mockQueryOne.mock.calls[2];
      expect(thirdCall[0]).toContain("phone = NULL");
    });
  });

  describe("createSeparate()", () => {
    it("should create a new user from Google profile with all fields", async () => {
      const newUser: UserRecord = {
        id: "new-user-001",
        phone: null,
        email: GOOGLE_PROFILE.email,
        full_name: GOOGLE_PROFILE.name!,
        avatar_url: GOOGLE_PROFILE.picture!,
        google_id: GOOGLE_PROFILE.googleId,
        google_avatar_url: GOOGLE_PROFILE.picture!,
        preferred_language: "hi",
        onboarding_completed: false,
      };
      mockQueryOne.mockResolvedValueOnce(newUser);

      const result = await service.createSeparate(GOOGLE_PROFILE);

      expect(result).toEqual(newUser);
      expect(result.onboarding_completed).toBe(false);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        [
          GOOGLE_PROFILE.email,
          GOOGLE_PROFILE.name,
          GOOGLE_PROFILE.picture,
          GOOGLE_PROFILE.googleId,
          GOOGLE_PROFILE.picture,
        ]
      );
    });

    it("should handle Google profile with missing optional fields", async () => {
      const newUser: UserRecord = {
        id: "new-user-002",
        phone: null,
        email: GOOGLE_PROFILE_MINIMAL.email,
        full_name: null,
        avatar_url: null,
        google_id: GOOGLE_PROFILE_MINIMAL.googleId,
        google_avatar_url: null,
        preferred_language: "hi",
        onboarding_completed: false,
      };
      mockQueryOne.mockResolvedValueOnce(newUser);

      const result = await service.createSeparate(GOOGLE_PROFILE_MINIMAL);

      expect(result.full_name).toBeNull();
      expect(result.avatar_url).toBeNull();
      expect(result.onboarding_completed).toBe(false);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        [
          GOOGLE_PROFILE_MINIMAL.email,
          null, // name undefined → null
          null, // picture undefined → null
          GOOGLE_PROFILE_MINIMAL.googleId,
          null, // picture undefined → null
        ]
      );
    });

    it("should mark new account for onboarding (onboarding_completed=false)", async () => {
      const newUser: UserRecord = {
        id: "new-user-003",
        phone: null,
        email: GOOGLE_PROFILE.email,
        full_name: GOOGLE_PROFILE.name!,
        avatar_url: GOOGLE_PROFILE.picture!,
        google_id: GOOGLE_PROFILE.googleId,
        google_avatar_url: GOOGLE_PROFILE.picture!,
        preferred_language: "hi",
        onboarding_completed: false,
      };
      mockQueryOne.mockResolvedValueOnce(newUser);

      const result = await service.createSeparate(GOOGLE_PROFILE);

      expect(result.onboarding_completed).toBe(false);
      // Verify the SQL has `false` for onboarding_completed
      const insertQuery = mockQueryOne.mock.calls[0][0] as string;
      expect(insertQuery).toContain("onboarding_completed");
      expect(insertQuery).toContain("false");
    });

    it("should throw when database insert fails", async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        service.createSeparate(GOOGLE_PROFILE)
      ).rejects.toThrow("Failed to create separate account");
    });
  });

  describe("LINKING_TIMEOUT_MS constant", () => {
    it("should be 120 seconds (120000 ms)", () => {
      expect(LINKING_TIMEOUT_MS).toBe(120_000);
    });
  });
});
