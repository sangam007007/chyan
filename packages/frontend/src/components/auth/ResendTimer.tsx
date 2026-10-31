import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';

interface ResendTimerProps {
  /** Cooldown duration in seconds before resend is allowed. Defaults to 30. */
  cooldownSeconds?: number;
  /** Callback invoked when the user clicks "Resend OTP". */
  onResend: () => void;
  /** Externally disable the resend button (e.g. during API call). */
  disabled?: boolean;
}

/**
 * Displays a countdown timer for OTP resend cooldown.
 * Shows "Resend in Xs" while counting down, then "Resend OTP" when ready.
 * Clicking the button calls onResend and restarts the timer.
 */
export function ResendTimer({
  cooldownSeconds = 30,
  onResend,
  disabled = false,
}: ResendTimerProps) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(cooldownSeconds);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleResend = useCallback(() => {
    onResend();
    setTimeLeft(cooldownSeconds);
  }, [onResend, cooldownSeconds]);

  const canResend = timeLeft === 0;

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={!canResend || disabled}
      className={`text-sm font-medium transition-colors ${
        canResend && !disabled
          ? 'text-primary hover:text-primary/80 cursor-pointer'
          : 'text-muted-foreground cursor-not-allowed'
      }`}
    >
      {canResend
        ? t('otp.resend')
        : t('otp.resendIn', { seconds: String(timeLeft) })}
    </button>
  );
}
