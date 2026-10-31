/**
 * Account Linking Service — Handles detection of existing accounts,
 * merging accounts across providers, and creating separate accounts.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { queryOne, queryMany, withTransaction } from "@/db/index.js";
import type { QueryOptions } from "@/db/index.js";
import type { GoogleProfile } from "./oauth.service.js";

// ─── Constants ────────────────────────────────────────────────────────

/** Timeout for account linking prompt — 120 seconds */
export const LINKING_TIMEOUT_MS = 120_000;

// ─── Types ────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  google_id: string | null;
  google_avatar_url: string | null;
  preferred_language: string;
  onboarding_completed: boolean;
}

export interface AccountLinkRecord {
  id: string;
  primary_user_id: string;
  linked_provider: string;
  linked_identifier: string;
  linked_at: Date;
}

export interface ExistingAccountMatch {
  user: UserRecord;
  matchedBy: "email" | "phone";
}

// ─── Account Link Service ─────────────────────────────────────────────

export class AccountLinkService {
  /**
   * Check if an existing account matches the given email or phone.
   * Used during login to detect potential account linking scenarios.
   *
   * Returns the matched user and how it was matched (by email or phone),
   * or null if no existing account is found.
   *
   * @param email - Email to check (from Google OAuth)
   * @param phone - Phone number to check (from OTP login)
   */
  async checkExisting(
    email: string | null,
    phone: string | null
  ): Promise<ExistingAccountMatch | null> {
    if (!email && !phone) {
      return null;
    }

    // Check by email first (higher specificity)
    if (email) {
      const userByEmail = await queryOne<UserRecord>(
        `SELECT id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed
         FROM users
         WHERE email = $1`,
        [email]
      );

      if (userByEmail) {
        return { user: userByEmail, matchedBy: "email" };
      }
    }

    // Then check by phone
    if (phone) {
      const userByPhone = await queryOne<UserRecord>(
        `SELECT id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed
         FROM users
         WHERE phone = $1`,
        [phone]
      );

      if (userByPhone) {
        return { user: userByPhone, matchedBy: "phone" };
      }
    }

    return null;
  }

  /**
   * Link (merge) two accounts together.
   *
   * Merges the secondary user's Google credentials into the primary account.
   * Preserves the primary account's profile data (name, exam selection, test history).
   * Applies Google avatar only if the primary account has no existing avatar.
   *
   * After merging, the secondary account is deactivated (soft-deleted) to prevent
   * duplicate logins.
   *
   * @param primaryId - The account to keep (preserves profile data)
   * @param secondaryId - The account to merge from (provides OAuth credentials)
   */
  async linkAccounts(primaryId: string, secondaryId: string): Promise<void> {
    await withTransaction(async (client) => {
      // Fetch both accounts
      const primary = await queryOne<UserRecord>(
        `SELECT id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed
         FROM users WHERE id = $1`,
        [primaryId],
        { client }
      );

      const secondary = await queryOne<UserRecord>(
        `SELECT id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed
         FROM users WHERE id = $1`,
        [secondaryId],
        { client }
      );

      if (!primary || !secondary) {
        throw new Error("One or both accounts not found for linking");
      }

      // Determine what to merge from secondary into primary
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      // Merge Google credentials from secondary if primary doesn't have them
      if (!primary.google_id && secondary.google_id) {
        updates.push(`google_id = $${paramIndex++}`);
        params.push(secondary.google_id);

        // Apply Google avatar only if primary has no existing avatar
        if (!primary.avatar_url && secondary.google_avatar_url) {
          updates.push(`avatar_url = $${paramIndex++}`);
          params.push(secondary.google_avatar_url);
        }

        // Store Google avatar URL reference regardless
        if (secondary.google_avatar_url) {
          updates.push(`google_avatar_url = $${paramIndex++}`);
          params.push(secondary.google_avatar_url);
        }
      }

      // Merge email from secondary if primary doesn't have one
      if (!primary.email && secondary.email) {
        updates.push(`email = $${paramIndex++}`);
        params.push(secondary.email);
      }

      // Merge phone from secondary if primary doesn't have one
      if (!primary.phone && secondary.phone) {
        updates.push(`phone = $${paramIndex++}`);
        params.push(secondary.phone);
      }

      // Apply updates to primary if any
      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        params.push(primaryId);
        await queryOne(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
          params,
          { client }
        );
      }

      // Deactivate secondary account to prevent duplicate logins
      // Clear unique identifiers so they don't conflict
      await queryOne(
        `UPDATE users
         SET phone = NULL, email = NULL, google_id = NULL, updated_at = NOW()
         WHERE id = $1`,
        [secondaryId],
        { client }
      );

      // Log the linking event
      const linkedProvider = secondary.google_id ? "google" : "phone";
      const linkedIdentifier = secondary.google_id
        ? secondary.email || secondary.google_id
        : secondary.phone || "";

      await queryOne(
        `INSERT INTO account_links (primary_user_id, linked_provider, linked_identifier)
         VALUES ($1, $2, $3)`,
        [primaryId, linkedProvider, linkedIdentifier],
        { client }
      );
    });
  }

  /**
   * Create a separate new account from Google profile data.
   * Used when a user declines account linking or the 120-second timeout expires.
   *
   * The new account is marked with onboarding_completed=false so the user
   * is routed through the onboarding flow.
   *
   * @param profile - Google profile data to create the account from
   * @returns The newly created user record
   */
  async createSeparate(profile: GoogleProfile): Promise<UserRecord> {
    const user = await queryOne<UserRecord>(
      `INSERT INTO users (email, full_name, avatar_url, google_id, google_avatar_url, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id, phone, email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed`,
      [
        profile.email,
        profile.name || null,
        profile.picture || null,
        profile.googleId,
        profile.picture || null,
      ]
    );

    if (!user) {
      throw new Error("Failed to create separate account");
    }

    return user;
  }
}

export const accountLinkService = new AccountLinkService();
