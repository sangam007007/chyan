import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './I18nProvider';

/**
 * Hook to access the i18n translation context.
 *
 * Returns:
 * - `t(key, params?)` — translate a key with optional interpolation
 * - `language` — current language ('hi' | 'en')
 * - `setLanguage(lang)` — switch language (persists to localStorage / profile)
 *
 * @example
 * ```tsx
 * const { t, language, setLanguage } = useTranslation();
 * return <h1>{t('login.title')}</h1>;
 * ```
 *
 * @example Interpolation
 * ```tsx
 * const { t } = useTranslation();
 * return <p>{t('otp.sentTo', { phone: '98****3210' })}</p>;
 * // → "OTP sent to +91 98****3210" (English)
 * // → "+91 98****3210 पर OTP भेजा गया" (Hindi)
 * ```
 */
export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }

  return context;
}
