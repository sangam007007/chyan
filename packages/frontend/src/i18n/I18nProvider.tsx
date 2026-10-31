import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { AuthContext } from '@/context/AuthContext';
import en from './en.json';
import hi from './hi.json';

export type Language = 'hi' | 'en';

const STORAGE_KEY = 'preferred_language';
const DEFAULT_LANGUAGE: Language = 'hi';

type TranslationData = Record<string, unknown>;

const translations: Record<Language, TranslationData> = { en, hi };

/**
 * Resolve a dot-notation key (e.g. "login.title") into a nested object value.
 * Returns undefined if any segment is missing.
 */
function resolveKey(data: TranslationData, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Replace {{param}} placeholders with values from the params object.
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_match, paramKey: string) => {
    const value = params[paramKey];
    return value !== undefined ? String(value) : `{{${paramKey}}}`;
  });
}

export interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  /** Override initial language for testing purposes */
  initialLanguage?: Language;
}

/**
 * I18nProvider manages the application's language state and provides
 * translation utilities to all child components.
 *
 * Language resolution order:
 * 1. User profile preferredLanguage (if authenticated)
 * 2. localStorage value
 * 3. Default: 'hi' (Hindi)
 *
 * Fallback strategy:
 * - If a key is missing in the selected language → use English value
 * - If also missing in English → return the key itself
 */
export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  const authContext = useContext(AuthContext);

  const resolveInitialLanguage = (): Language => {
    if (initialLanguage) return initialLanguage;

    // Priority 1: User profile preference (if authenticated)
    if (authContext?.user?.preferredLanguage) {
      return authContext.user.preferredLanguage;
    }

    // Priority 2: localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'hi') {
      return stored;
    }

    // Priority 3: Default to Hindi
    return DEFAULT_LANGUAGE;
  };

  const [language, setLanguageState] = useState<Language>(resolveInitialLanguage);

  // Sync language with user profile when auth state changes
  useEffect(() => {
    if (authContext?.user?.preferredLanguage) {
      setLanguageState(authContext.user.preferredLanguage);
    }
  }, [authContext?.user?.preferredLanguage]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);

      // Always persist to localStorage (for unauthenticated state and pre-login)
      localStorage.setItem(STORAGE_KEY, lang);

      // If authenticated, also persist to user profile
      if (authContext?.isAuthenticated && authContext.updateProfile) {
        Promise.resolve(authContext.updateProfile({ preferredLanguage: lang })).catch(() => {
          // Offline / server error: keep the UI language; it is already saved locally.
        });
      }
    },
    [authContext]
  );

  /**
   * Translate a key with optional parameter interpolation.
   *
   * Fallback chain:
   * 1. Selected language translation
   * 2. English translation (if selected language is not English)
   * 3. The key itself
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      // Try selected language first
      let value = resolveKey(translations[language], key);

      // Fallback to English if selected language is not English
      if (value === undefined && language !== 'en') {
        value = resolveKey(translations.en, key);
      }

      // Fallback to key itself
      if (value === undefined) {
        return key;
      }

      return interpolate(value, params);
    },
    [language]
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}
