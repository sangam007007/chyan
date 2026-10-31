import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n';

export interface AccountLinkPromptProps {
  /** Masked identifier for the existing account (e.g. "98****3210" or "u***@example.com") */
  identifier: string;
  /** Called when user confirms account linking */
  onConfirm: () => void;
  /** Called when user declines linking or timeout expires */
  onDecline: () => void;
}

const TIMEOUT_SECONDS = 120;

/**
 * AccountLinkPrompt displays a card prompting the user to confirm or decline
 * linking their current login to an existing account.
 *
 * Shows a warning icon, the masked existing account identifier, confirm/decline buttons,
 * and a 120-second countdown that auto-declines if the user doesn't respond.
 *
 * Requirements: 6.1, 6.3, 6.4, 6.5
 */
export function AccountLinkPrompt({
  identifier,
  onConfirm,
  onDecline,
}: AccountLinkPromptProps) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);
  const onDeclineRef = useRef(onDecline);

  // Keep the ref up to date so the timer always calls the latest callback
  useEffect(() => {
    onDeclineRef.current = onDecline;
  }, [onDecline]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onDeclineRef.current();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleDecline = useCallback(() => {
    onDecline();
  }, [onDecline]);

  return (
    <div
      className="w-full max-w-md mx-auto rounded-lg border border-primary-200 bg-white p-6 shadow-sm"
      role="alertdialog"
      aria-labelledby="account-link-title"
      aria-describedby="account-link-description"
    >
      {/* Warning icon */}
      <div className="flex justify-center mb-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gold-50">
          <svg
            className="w-6 h-6 text-gold-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h2
        id="account-link-title"
        className="text-lg font-semibold text-primary-800 text-center mb-2"
      >
        {t('accountLink.title')}
      </h2>

      {/* Description with identifier */}
      <p
        id="account-link-description"
        className="text-sm text-primary-600 text-center mb-6"
      >
        {t('accountLink.description', { identifier })}
      </p>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-2.5 px-4 bg-primary text-white font-medium rounded-md text-sm
            hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2
            transition-colors"
        >
          {t('accountLink.confirmLink')}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="w-full py-2.5 px-4 bg-white text-primary-700 font-medium rounded-md text-sm
            border border-primary-200 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2
            transition-colors"
        >
          {t('accountLink.declineLink')}
        </button>
      </div>

      {/* Countdown timeout text */}
      <p className="mt-4 text-xs text-primary-400 text-center" aria-live="polite">
        {t('accountLink.timeout', { seconds: String(timeLeft) })}
      </p>
    </div>
  );
}
