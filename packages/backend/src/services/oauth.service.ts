import axios, { AxiosInstance, AxiosError } from "axios";
import { env } from "@/config/env.js";

// ─── Constants ────────────────────────────────────────────────────────
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const OAUTH_SCOPES = ["email", "profile"];
const TOKEN_EXCHANGE_TIMEOUT_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  scope: string;
}

export interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: string;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

// ─── Error Types ──────────────────────────────────────────────────────

export type OAuthErrorCode =
  | "OAUTH_FAILED"
  | "OAUTH_CANCELLED"
  | "OAUTH_NETWORK_ERROR"
  | "OAUTH_INVALID_CODE"
  | "OAUTH_TOKEN_INVALID";

export class OAuthError extends Error {
  public readonly code: OAuthErrorCode;

  constructor(code: OAuthErrorCode, message: string) {
    super(message);
    this.name = "OAuthError";
    this.code = code;
  }
}

// ─── HTTP Client Interface (for testability) ──────────────────────────

export interface OAuthHttpClient {
  post<T>(url: string, data: Record<string, string>): Promise<T>;
  get<T>(url: string, headers?: Record<string, string>): Promise<T>;
}

/**
 * Default HTTP client using axios. Extracted for testability —
 * consumers can inject a mock client in tests.
 */
export function createDefaultHttpClient(
  instance?: AxiosInstance
): OAuthHttpClient {
  const http = instance ?? axios.create({ timeout: TOKEN_EXCHANGE_TIMEOUT_MS });

  return {
    async post<T>(url: string, data: Record<string, string>): Promise<T> {
      const response = await http.post<T>(url, new URLSearchParams(data), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return response.data;
    },
    async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
      const response = await http.get<T>(url, { headers });
      return response.data;
    },
  };
}

// ─── OAuth Service ────────────────────────────────────────────────────

export interface OAuthServiceConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export class OAuthService {
  private readonly config: OAuthServiceConfig;
  private readonly httpClient: OAuthHttpClient;

  constructor(
    config?: Partial<OAuthServiceConfig>,
    httpClient?: OAuthHttpClient
  ) {
    this.config = {
      clientId: config?.clientId ?? env.GOOGLE_CLIENT_ID,
      clientSecret: config?.clientSecret ?? env.GOOGLE_CLIENT_SECRET,
      callbackUrl: config?.callbackUrl ?? env.GOOGLE_CALLBACK_URL,
    };
    this.httpClient = httpClient ?? createDefaultHttpClient();
  }

  /**
   * Construct the Google OAuth consent URL with email+profile scopes.
   * The user is redirected to this URL to grant permissions.
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: "code",
      scope: OAUTH_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
    });

    if (state) {
      params.set("state", state);
    }

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens and extract the user profile.
   * Throws OAuthError on failure (cancelled consent, network issues, invalid code).
   */
  async exchangeCode(code: string): Promise<GoogleProfile> {
    if (!code || code.trim().length === 0) {
      throw new OAuthError(
        "OAUTH_INVALID_CODE",
        "Authorization code is missing or empty"
      );
    }

    let tokenResponse: GoogleTokenResponse;

    try {
      tokenResponse = await this.httpClient.post<GoogleTokenResponse>(
        GOOGLE_TOKEN_URL,
        {
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.callbackUrl,
          grant_type: "authorization_code",
        }
      );
    } catch (error) {
      throw this.handleTokenExchangeError(error);
    }

    // Fetch user profile from the userinfo endpoint using the access token
    try {
      const userInfo = await this.httpClient.get<GoogleUserInfo>(
        GOOGLE_USERINFO_URL,
        { Authorization: `Bearer ${tokenResponse.access_token}` }
      );

      return this.mapToGoogleProfile(userInfo);
    } catch (error) {
      throw this.handleUserInfoError(error);
    }
  }

  /**
   * Verify a Google ID token's signature and claims using the tokeninfo endpoint.
   * Returns the validated claims if the token is valid.
   */
  async validateToken(idToken: string): Promise<GoogleTokenInfo> {
    if (!idToken || idToken.trim().length === 0) {
      throw new OAuthError(
        "OAUTH_TOKEN_INVALID",
        "ID token is missing or empty"
      );
    }

    try {
      const tokenInfo = await this.httpClient.get<GoogleTokenInfo>(
        `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`
      );

      // Verify the audience matches our client ID
      if (tokenInfo.aud !== this.config.clientId) {
        throw new OAuthError(
          "OAUTH_TOKEN_INVALID",
          "Token audience does not match application client ID"
        );
      }

      // Verify the issuer is Google
      const validIssuers = [
        "accounts.google.com",
        "https://accounts.google.com",
      ];
      if (!validIssuers.includes(tokenInfo.iss)) {
        throw new OAuthError(
          "OAUTH_TOKEN_INVALID",
          "Token issuer is not a valid Google issuer"
        );
      }

      // Verify the token is not expired
      const expiry = parseInt(tokenInfo.exp, 10);
      if (isNaN(expiry) || expiry * 1000 < Date.now()) {
        throw new OAuthError("OAUTH_TOKEN_INVALID", "Token has expired");
      }

      return tokenInfo;
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      throw this.handleValidateTokenError(error);
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private mapToGoogleProfile(userInfo: GoogleUserInfo): GoogleProfile {
    return {
      googleId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name || undefined,
      picture: userInfo.picture || undefined,
    };
  }

  private handleTokenExchangeError(error: unknown): OAuthError {
    if (this.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as Record<string, string> | undefined;
      const errorType = data?.error;

      // User cancelled consent or denied access
      if (
        errorType === "access_denied" ||
        errorType === "user_denied" ||
        status === 403
      ) {
        return new OAuthError(
          "OAUTH_CANCELLED",
          "User cancelled the OAuth consent"
        );
      }

      // Invalid or expired authorization code
      if (errorType === "invalid_grant" || status === 400) {
        return new OAuthError(
          "OAUTH_INVALID_CODE",
          "The authorization code is invalid or has expired"
        );
      }

      // Network timeout or connectivity issue
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return new OAuthError(
          "OAUTH_NETWORK_ERROR",
          "Network timeout while exchanging authorization code"
        );
      }

      // Server error from Google
      if (status && status >= 500) {
        return new OAuthError(
          "OAUTH_NETWORK_ERROR",
          "Google OAuth server returned an error"
        );
      }
    }

    // General network error (no response received)
    if (this.isNetworkError(error)) {
      return new OAuthError(
        "OAUTH_NETWORK_ERROR",
        "Network error while exchanging authorization code"
      );
    }

    return new OAuthError(
      "OAUTH_FAILED",
      "Failed to exchange authorization code"
    );
  }

  private handleUserInfoError(error: unknown): OAuthError {
    if (this.isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return new OAuthError(
          "OAUTH_NETWORK_ERROR",
          "Network timeout while fetching user profile"
        );
      }
    }

    if (this.isNetworkError(error)) {
      return new OAuthError(
        "OAUTH_NETWORK_ERROR",
        "Network error while fetching user profile"
      );
    }

    return new OAuthError("OAUTH_FAILED", "Failed to fetch user profile");
  }

  private handleValidateTokenError(error: unknown): OAuthError {
    if (this.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 400 || status === 401) {
        return new OAuthError(
          "OAUTH_TOKEN_INVALID",
          "The ID token is invalid or malformed"
        );
      }

      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return new OAuthError(
          "OAUTH_NETWORK_ERROR",
          "Network timeout while validating token"
        );
      }
    }

    if (this.isNetworkError(error)) {
      return new OAuthError(
        "OAUTH_NETWORK_ERROR",
        "Network error while validating token"
      );
    }

    return new OAuthError("OAUTH_FAILED", "Failed to validate ID token");
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === "object" &&
      error !== null &&
      "isAxiosError" in error &&
      (error as AxiosError).isAxiosError === true
    );
  }

  private isNetworkError(error: unknown): boolean {
    if (this.isAxiosError(error)) {
      return !error.response && Boolean(error.request);
    }
    return (
      error instanceof Error &&
      ("code" in error
        ? ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ENETUNREACH"].includes(
            (error as NodeJS.ErrnoException).code ?? ""
          )
        : false)
    );
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────

export const oauthService = new OAuthService();
