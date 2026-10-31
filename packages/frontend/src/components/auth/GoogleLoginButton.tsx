import { useTranslation } from '@/i18n';

export interface GoogleLoginButtonProps {
  /** Called when the user clicks the Google sign-in button */
  onClick: () => void;
  /** Disables the button */
  disabled?: boolean;
  /** Shows full-screen loading state during OAuth redirect */
  loading?: boolean;
}

/**
 * Google OAuth sign-in button with bilingual text and loading state.
 *
 * When `loading` is true, renders a full-width loading indicator
 * informing the user they are being redirected to Google.
 * Otherwise renders a styled Google sign-in button with the "G" logo.
 */
export function GoogleLoginButton({
  onClick,
  disabled = false,
  loading = false,
}: GoogleLoginButtonProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95"
        role="status"
        aria-live="polite"
      >
        <svg
          className="animate-spin h-8 w-8 text-primary-600 mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-primary-700 font-medium">
          {t('login.googleLoading')}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-primary-200 rounded-md bg-white text-sm font-medium text-primary-700
        hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2
        disabled:bg-primary-50 disabled:text-primary-400 disabled:cursor-not-allowed transition-colors"
    >
      <GoogleLogo />
      <span>{t('login.googleLogin')}</span>
    </button>
  );
}

/** Inline Google "G" logo SVG */
function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a23.99 23.99 0 000 21.56l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
