import { useTranslation } from '@/i18n';
import type { Language } from '@/i18n';

/**
 * LanguageToggle — A compact toggle for switching between Hindi and English.
 *
 * Designed to sit in the top-right corner of auth screens (before login).
 * Persists selection via the i18n context's `setLanguage`, which handles:
 * - localStorage for unauthenticated users
 * - User profile update for authenticated users
 *
 * Switching language triggers a full UI re-render via React context (no page reload).
 */
export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation();

  const handleLanguageChange = (lang: Language) => {
    if (lang !== language) {
      setLanguage(lang);
    }
  };

  return (
    <div className="inline-flex items-center rounded-full border border-primary-200 bg-white p-0.5 shadow-sm" role="radiogroup" aria-label={t('common.language')}>
      <button
        type="button"
        role="radio"
        aria-checked={language === 'hi'}
        aria-label={t('common.hindi')}
        onClick={() => handleLanguageChange('hi')}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
          ${language === 'hi'
            ? 'bg-primary text-white shadow-sm'
            : 'text-primary-600 hover:bg-primary-50'
          }`}
      >
        {t('common.hindi')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={language === 'en'}
        aria-label={t('common.english')}
        onClick={() => handleLanguageChange('en')}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
          ${language === 'en'
            ? 'bg-primary text-white shadow-sm'
            : 'text-primary-600 hover:bg-primary-50'
          }`}
      >
        {t('common.english')}
      </button>
    </div>
  );
}
