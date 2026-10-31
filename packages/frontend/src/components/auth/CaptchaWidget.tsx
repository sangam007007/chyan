import { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n';

export interface CaptchaWidgetProps {
  /** Called with the CAPTCHA verification token when the user completes the challenge */
  onVerify: (token: string) => void;
  /** Error message to display below the widget (e.g. verification failed) */
  error?: string;
}

/**
 * Mock CAPTCHA widget for "I'm not a robot" verification.
 *
 * Renders a checkbox-style challenge that calls `onVerify` with a mock token
 * when the user checks the box. The actual reCAPTCHA/hCaptcha provider will
 * be integrated later — this placeholder ensures the UI flow is functional.
 */
export function CaptchaWidget({ onVerify, error }: CaptchaWidgetProps) {
  const { t } = useTranslation();
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleCheck = useCallback(() => {
    if (verified || verifying) return;

    setVerifying(true);

    // Simulate a short verification delay (mimics real CAPTCHA behavior)
    setTimeout(() => {
      const mockToken = `captcha_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      setVerified(true);
      setVerifying(false);
      onVerify(mockToken);
    }, 600);
  }, [verified, verifying, onVerify]);

  return (
    <div className="mt-4">
      <div
        className={`
          flex items-center gap-3 p-3 border rounded-md bg-primary-50
          ${error ? 'border-accent-400' : 'border-primary-200'}
        `}
        role="group"
        aria-label={t('errors.captchaRequired')}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={verified}
          onClick={handleCheck}
          disabled={verified}
          className={`
            flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center
            transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1
            ${verified
              ? 'bg-success border-success'
              : 'border-primary-300 bg-white hover:border-primary-400'
            }
            ${verifying ? 'cursor-wait' : verified ? 'cursor-default' : 'cursor-pointer'}
          `}
        >
          {verifying && (
            <svg
              className="animate-spin h-4 w-4 text-primary-400"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {verified && (
            <svg
              className="h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        <span className="text-sm text-primary-700 select-none">
          {verifying
            ? t('common.loading')
            : verified
              ? t('common.success')
              : "I'm not a robot"}
        </span>
      </div>

      {error && (
        <p className="mt-1 text-sm text-accent-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
