import { useTranslation } from './useTranslation';
import type { Language } from './I18nProvider';

/**
 * Language rules for content that comes from the database as an English/Hindi pair.
 *
 * - Names, titles and descriptions follow the UI language and never come back empty:
 *   if the chosen language is missing the other one is used.
 * - Questions follow the UI language too, except the Hindi subject: its questions are
 *   about Hindi itself, so they are always shown in Hindi, even when the UI is English.
 */

export function pick(lang: Language, en?: string | null, hi?: string | null): string {
  const first = lang === 'hi' ? hi : en;
  const second = lang === 'hi' ? en : hi;
  return (first && first.trim() ? first : second) ?? '';
}

/** `questions.subject` is a slug (`hindi`, `gk`, `math`, `reasoning`). */
export function isHindiSubject(subject?: string | null): boolean {
  return (subject ?? '').trim().toLowerCase() === 'hindi';
}

/** Language a question (text and options) should be shown in. */
export function questionLanguage(lang: Language, subject?: string | null): Language {
  return isHindiSubject(subject) ? 'hi' : lang;
}

/** `const { lang, isHi, pick } = useLang()` — pick(en, hi) uses the current UI language. */
export function useLang() {
  const { language } = useTranslation();
  return {
    lang: language,
    isHi: language === 'hi',
    pick: (en?: string | null, hi?: string | null) => pick(language, en, hi),
  };
}
