/**
 * Language extraction utility for backend i18n.
 *
 * Determines the user's preferred language from the Accept-Language header.
 * Checks for 'hi' (Hindi), defaults to 'en' (English).
 */

import type { Request } from "express";

export type SupportedLanguage = "en" | "hi";

/**
 * Extract the preferred language from the request's Accept-Language header.
 * Returns 'hi' if the header contains 'hi', otherwise defaults to 'en'.
 */
export function getLanguageFromRequest(req: Request): SupportedLanguage {
  const acceptLanguage = req.headers["accept-language"] || "";
  return getLanguageFromHeader(acceptLanguage);
}

/**
 * Parse an Accept-Language header value and determine supported language.
 * Returns 'hi' if the header contains 'hi', otherwise defaults to 'en'.
 */
export function getLanguageFromHeader(
  acceptLanguage: string
): SupportedLanguage {
  if (acceptLanguage.includes("hi")) {
    return "hi";
  }
  return "en";
}
