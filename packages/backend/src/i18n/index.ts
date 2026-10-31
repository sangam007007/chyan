/**
 * Backend i18n module for localized error messages.
 *
 * Provides a centralized message resolver that looks up error codes
 * in language-specific JSON files, falling back to English if the
 * requested language or key is unavailable.
 */

import enMessages from "./en.json";
import hiMessages from "./hi.json";
import type { SupportedLanguage } from "./get-language.js";

export { getLanguageFromRequest, getLanguageFromHeader } from "./get-language.js";
export type { SupportedLanguage } from "./get-language.js";

type MessageMap = Record<string, string>;

const messages: Record<SupportedLanguage, MessageMap> = {
  en: enMessages,
  hi: hiMessages,
};

/**
 * Get a localized error message by error code and language.
 *
 * Falls back to English if:
 * - The language is not supported
 * - The key is missing in the requested language
 *
 * Returns the error code itself as a last resort if no translation exists.
 */
export function getMessage(code: string, language: SupportedLanguage = "en"): string {
  const langMessages = messages[language];
  if (langMessages && langMessages[code]) {
    return langMessages[code];
  }

  // Fallback to English
  if (messages.en[code]) {
    return messages.en[code];
  }

  // Last resort: return the code itself
  return code;
}

/**
 * Get all available error codes.
 */
export function getErrorCodes(): string[] {
  return Object.keys(messages.en);
}
