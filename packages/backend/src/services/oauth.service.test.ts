import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the env module before importing the service
vi.mock("@/config/env.js", () => ({
  env: {
    GOOGLE_CLIENT_ID: "mock-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "mock-client-secret",
    GOOGLE_CALLBACK_URL: "http://localhost:4000/api/auth/google/callback",
  },
}));

import {
  OAuthService,
  OAuthHttpClient,
  OAuthError,
  GoogleProfile,
  GoogleTokenResponse,
  GoogleUserInfo,
  GoogleTokenInfo,
} from "./oauth.service.js";

// ─── Mock HTTP Client ─────────────────────────────────────────────────

function createMockHttpClient(overrides?: {
  post?: <T>(url: string, data: Record<string, string>) => Promise<T>;
  get?: <T>(url: string, headers?: Record<string, string>) => Promise<T>;
}): OAuthHttpClient {
  return {
    post: overrides?.post ?? (async <T>() => ({}) as T),
    get: overrides?.get ?? (async <T>() => ({}) as T),
  };
}

// ─── Test Fixtures ────────────────────────────────────────────────────

const TEST_CONFIG = {
  clientId: "test-client-id.apps.googleusercontent.com",
  clientSecret: "test-client-secret",
  callbackUrl: "http://localhost:4000/api/auth/google/callback",
};

const MOCK_TOKEN_RESPONSE: GoogleTokenResponse = {
  access_token: "ya29.mock-access-token",
  id_token: "eyJhbGciOiJSUzI1NiJ9.mock-id-token",
  expires_in: 3600,
  token_type: "Bearer",
  scope: "email profile",
};

const MOCK_USERINFO: GoogleUserInfo = {
  sub: "google-user-123456",
  email: "testuser@gmail.com",
  email_verified: true,
  name: "Test User",
  picture: "https://lh3.googleusercontent.com/photo.jpg",
};

const MOCK_TOKEN_INFO: GoogleTokenInfo = {
  sub: "google-user-123456",
  email: "testuser@gmail.com",
  email_verified: "true",
  name: "Test User",
  picture: "https://lh3.googleusercontent.com/photo.jpg",
  aud: TEST_CONFIG.clientId,
  iss: "accounts.google.com",
  exp: String(Math.floor(Date.now() / 1000) + 3600),
};

// ─── Tests ────────────────────────────────────────────────────────────

describe("OAuthService", () => {
  let service: OAuthService;

  describe("getAuthUrl()", () => {
    beforeEach(() => {
      service = new OAuthService(TEST_CONFIG, createMockHttpClient());
    });

    it("should construct a valid Google OAuth consent URL", () => {
      const url = service.getAuthUrl();
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );
      expect(parsed.searchParams.get("client_id")).toBe(TEST_CONFIG.clientId);
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        TEST_CONFIG.callbackUrl
      );
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("access_type")).toBe("offline");
      expect(parsed.searchParams.get("prompt")).toBe("consent");
    });

    it("should include email and profile scopes", () => {
      const url = service.getAuthUrl();
      const parsed = new URL(url);
      const scope = parsed.searchParams.get("scope");

      expect(scope).toContain("email");
      expect(scope).toContain("profile");
    });

    it("should include state parameter when provided", () => {
      const url = service.getAuthUrl("csrf-state-token-123");
      const parsed = new URL(url);

      expect(parsed.searchParams.get("state")).toBe("csrf-state-token-123");
    });

    it("should not include state parameter when not provided", () => {
      const url = service.getAuthUrl();
      const parsed = new URL(url);

      expect(parsed.searchParams.has("state")).toBe(false);
    });
  });

  describe("exchangeCode()", () => {
    it("should exchange code and return GoogleProfile with all fields", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => MOCK_TOKEN_RESPONSE as T,
        get: async <T>() => MOCK_USERINFO as T,
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      const profile = await service.exchangeCode("valid-auth-code");

      expect(profile).toEqual<GoogleProfile>({
        googleId: "google-user-123456",
        email: "testuser@gmail.com",
        name: "Test User",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
      });
    });

    it("should handle profile with missing optional fields", async () => {
      const minimalUserInfo: GoogleUserInfo = {
        sub: "google-user-789",
        email: "minimal@gmail.com",
        email_verified: true,
      };
      const httpClient = createMockHttpClient({
        post: async <T>() => MOCK_TOKEN_RESPONSE as T,
        get: async <T>() => minimalUserInfo as T,
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      const profile = await service.exchangeCode("valid-code");

      expect(profile.googleId).toBe("google-user-789");
      expect(profile.email).toBe("minimal@gmail.com");
      expect(profile.name).toBeUndefined();
      expect(profile.picture).toBeUndefined();
    });

    it("should throw OAUTH_INVALID_CODE for empty code", async () => {
      service = new OAuthService(TEST_CONFIG, createMockHttpClient());

      await expect(service.exchangeCode("")).rejects.toThrow(OAuthError);
      await expect(service.exchangeCode("")).rejects.toMatchObject({
        code: "OAUTH_INVALID_CODE",
      });
    });

    it("should throw OAUTH_INVALID_CODE for whitespace-only code", async () => {
      service = new OAuthService(TEST_CONFIG, createMockHttpClient());

      await expect(service.exchangeCode("   ")).rejects.toMatchObject({
        code: "OAUTH_INVALID_CODE",
      });
    });

    it("should throw OAUTH_CANCELLED when user denies consent", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => {
          const error = new Error("Request failed") as any;
          error.isAxiosError = true;
          error.response = {
            status: 403,
            data: { error: "access_denied" },
          };
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(service.exchangeCode("denied-code")).rejects.toMatchObject({
        code: "OAUTH_CANCELLED",
      });
    });

    it("should throw OAUTH_INVALID_CODE for invalid_grant error", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => {
          const error = new Error("Request failed") as any;
          error.isAxiosError = true;
          error.response = {
            status: 400,
            data: { error: "invalid_grant" },
          };
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.exchangeCode("expired-code")
      ).rejects.toMatchObject({
        code: "OAUTH_INVALID_CODE",
      });
    });

    it("should throw OAUTH_NETWORK_ERROR on timeout", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => {
          const error = new Error("timeout") as any;
          error.isAxiosError = true;
          error.code = "ECONNABORTED";
          error.response = undefined;
          error.request = {};
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.exchangeCode("timeout-code")
      ).rejects.toMatchObject({
        code: "OAUTH_NETWORK_ERROR",
      });
    });

    it("should throw OAUTH_NETWORK_ERROR when no response received", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => {
          const error = new Error("Network Error") as any;
          error.isAxiosError = true;
          error.response = undefined;
          error.request = {};
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.exchangeCode("network-error-code")
      ).rejects.toMatchObject({
        code: "OAUTH_NETWORK_ERROR",
      });
    });

    it("should throw OAUTH_NETWORK_ERROR on Google server error (5xx)", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => {
          const error = new Error("Server Error") as any;
          error.isAxiosError = true;
          error.response = { status: 500, data: {} };
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.exchangeCode("server-error-code")
      ).rejects.toMatchObject({
        code: "OAUTH_NETWORK_ERROR",
      });
    });

    it("should throw OAUTH_NETWORK_ERROR when userinfo fetch fails", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => MOCK_TOKEN_RESPONSE as T,
        get: async <T>() => {
          const error = new Error("timeout") as any;
          error.isAxiosError = true;
          error.code = "ECONNABORTED";
          error.response = undefined;
          error.request = {};
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.exchangeCode("valid-code-bad-userinfo")
      ).rejects.toMatchObject({
        code: "OAUTH_NETWORK_ERROR",
      });
    });

    it("should throw OAUTH_FAILED for unexpected errors", async () => {
      const httpClient = createMockHttpClient({
        post: async <T>() => {
          throw new TypeError("Something unexpected");
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.exchangeCode("unexpected-error")
      ).rejects.toMatchObject({
        code: "OAUTH_FAILED",
      });
    });
  });

  describe("validateToken()", () => {
    it("should validate a correct ID token and return claims", async () => {
      const httpClient = createMockHttpClient({
        get: async <T>() => MOCK_TOKEN_INFO as T,
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      const claims = await service.validateToken("valid-id-token");

      expect(claims.sub).toBe("google-user-123456");
      expect(claims.email).toBe("testuser@gmail.com");
      expect(claims.aud).toBe(TEST_CONFIG.clientId);
    });

    it("should throw OAUTH_TOKEN_INVALID for empty token", async () => {
      service = new OAuthService(TEST_CONFIG, createMockHttpClient());

      await expect(service.validateToken("")).rejects.toMatchObject({
        code: "OAUTH_TOKEN_INVALID",
      });
    });

    it("should throw OAUTH_TOKEN_INVALID when audience does not match", async () => {
      const wrongAudTokenInfo = { ...MOCK_TOKEN_INFO, aud: "wrong-client-id" };
      const httpClient = createMockHttpClient({
        get: async <T>() => wrongAudTokenInfo as T,
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.validateToken("wrong-aud-token")
      ).rejects.toMatchObject({
        code: "OAUTH_TOKEN_INVALID",
        message: expect.stringContaining("audience"),
      });
    });

    it("should throw OAUTH_TOKEN_INVALID when issuer is not Google", async () => {
      const wrongIssTokenInfo = {
        ...MOCK_TOKEN_INFO,
        iss: "https://malicious.example.com",
      };
      const httpClient = createMockHttpClient({
        get: async <T>() => wrongIssTokenInfo as T,
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.validateToken("wrong-iss-token")
      ).rejects.toMatchObject({
        code: "OAUTH_TOKEN_INVALID",
        message: expect.stringContaining("issuer"),
      });
    });

    it("should accept https://accounts.google.com as valid issuer", async () => {
      const httpsIssTokenInfo = {
        ...MOCK_TOKEN_INFO,
        iss: "https://accounts.google.com",
      };
      const httpClient = createMockHttpClient({
        get: async <T>() => httpsIssTokenInfo as T,
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      const claims = await service.validateToken("https-iss-token");
      expect(claims.iss).toBe("https://accounts.google.com");
    });

    it("should throw OAUTH_TOKEN_INVALID when token is expired", async () => {
      const expiredTokenInfo = {
        ...MOCK_TOKEN_INFO,
        exp: String(Math.floor(Date.now() / 1000) - 600), // 10 minutes ago
      };
      const httpClient = createMockHttpClient({
        get: async <T>() => expiredTokenInfo as T,
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.validateToken("expired-token")
      ).rejects.toMatchObject({
        code: "OAUTH_TOKEN_INVALID",
        message: expect.stringContaining("expired"),
      });
    });

    it("should throw OAUTH_TOKEN_INVALID when Google returns 400", async () => {
      const httpClient = createMockHttpClient({
        get: async <T>() => {
          const error = new Error("Bad Request") as any;
          error.isAxiosError = true;
          error.response = { status: 400, data: {} };
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.validateToken("malformed-token")
      ).rejects.toMatchObject({
        code: "OAUTH_TOKEN_INVALID",
      });
    });

    it("should throw OAUTH_NETWORK_ERROR on timeout during validation", async () => {
      const httpClient = createMockHttpClient({
        get: async <T>() => {
          const error = new Error("timeout") as any;
          error.isAxiosError = true;
          error.code = "ETIMEDOUT";
          error.response = undefined;
          error.request = {};
          throw error;
        },
      });
      service = new OAuthService(TEST_CONFIG, httpClient);

      await expect(
        service.validateToken("timeout-token")
      ).rejects.toMatchObject({
        code: "OAUTH_NETWORK_ERROR",
      });
    });
  });

  describe("OAuthError", () => {
    it("should be an instance of Error", () => {
      const err = new OAuthError("OAUTH_FAILED", "test");
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("OAuthError");
    });

    it("should expose code and message", () => {
      const err = new OAuthError("OAUTH_CANCELLED", "User cancelled");
      expect(err.code).toBe("OAUTH_CANCELLED");
      expect(err.message).toBe("User cancelled");
    });
  });
});
