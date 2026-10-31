import { useRef, useEffect, useCallback, useState, type KeyboardEvent, type ClipboardEvent, type ChangeEvent } from 'react';
import { useTranslation } from '@/i18n/useTranslation';

interface OTPInputProps {
  /** Called when all 6 digits have been entered */
  onComplete: (otp: string) => void;
  /** Disables all input cells */
  disabled?: boolean;
  /** Error message to display below the input */
  error?: string;
  /** Number of remaining verification attempts */
  remainingAttempts?: number;
}

const OTP_LENGTH = 6;

/**
 * OTPInput renders 6 individual input cells for OTP entry.
 *
 * Features:
 * - Auto-advance: when a digit is entered, focus moves to the next cell
 * - Backspace: clears current cell and moves focus to previous cell
 * - Paste: if user pastes 6 digits, fills all cells and triggers onComplete
 * - Web OTP API: auto-reads OTP from SMS where supported
 * - Accessible: aria-labels on each input cell
 *
 * Requirements: 3.1, 3.2, 3.6
 */
export function OTPInput({ onComplete, disabled = false, error, remainingAttempts }: OTPInputProps) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null));

  /**
   * Web OTP API integration.
   * Listens for incoming SMS OTP on supported browsers.
   * Requirement 3.6
   */
  useEffect(() => {
    if (disabled) return;

    const abortController = new AbortController();

    async function listenForWebOTP() {
      try {
        if (!('OTPCredential' in window)) return;

        const credential = await (navigator.credentials as any).get({
          otp: { transport: ['sms'] },
          signal: abortController.signal,
        });

        if (credential?.code) {
          const code = credential.code;
          if (/^\d{6}$/.test(code)) {
            const newDigits = code.split('');
            setDigits(newDigits);
            onComplete(code);
          }
        }
      } catch {
        // Web OTP not supported or aborted — silently ignore
      }
    }

    listenForWebOTP();

    return () => {
      abortController.abort();
    };
  }, [disabled, onComplete]);

  /**
   * Focus the first empty cell on mount (or first cell if all empty).
   */
  useEffect(() => {
    if (!disabled) {
      const firstEmptyIndex = digits.findIndex((d) => d === '');
      const focusIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
      inputRefs.current[focusIndex]?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle input change — only accept single numeric digit.
   * Auto-advances to next cell on digit entry.
   */
  const handleChange = useCallback(
    (index: number, e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Only accept a single digit
      const digit = value.replace(/\D/g, '').slice(-1);

      setDigits((prev) => {
        const newDigits = [...prev];
        newDigits[index] = digit;

        // If all digits filled, trigger onComplete
        if (digit && newDigits.every((d) => d !== '')) {
          // Use setTimeout to let state update complete
          setTimeout(() => onComplete(newDigits.join('')), 0);
        }

        return newDigits;
      });

      // Auto-advance to next cell
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [onComplete]
  );

  /**
   * Handle keyboard events — primarily backspace navigation.
   * On backspace: clears current cell (if filled) or moves to previous cell (if empty).
   */
  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      setDigits((prev) => {
        const newDigits = [...prev];

        if (newDigits[index] !== '') {
          // Clear current cell
          newDigits[index] = '';
        } else if (index > 0) {
          // Move to previous cell and clear it
          newDigits[index - 1] = '';
          inputRefs.current[index - 1]?.focus();
        }

        return newDigits;
      });

      e.preventDefault();
    }

    // Arrow key navigation
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  /**
   * Handle paste — fill all cells if 6 digits are pasted.
   */
  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text/plain').trim();
      const digitsOnly = pastedData.replace(/\D/g, '');

      if (digitsOnly.length === OTP_LENGTH) {
        const newDigits = digitsOnly.split('');
        setDigits(newDigits);

        // Focus the last cell
        inputRefs.current[OTP_LENGTH - 1]?.focus();

        // Trigger onComplete
        onComplete(digitsOnly);
      }
    },
    [onComplete]
  );

  return (
    <div className="w-full">
      {/* OTP Input Cells */}
      <div
        className="flex justify-center gap-2 sm:gap-3"
        role="group"
        aria-label={t('otp.inputLabel')}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            aria-label={`${t('otp.inputLabel')} ${index + 1} of ${OTP_LENGTH}`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            className={`
              w-10 h-12 sm:w-12 sm:h-14
              text-center text-xl font-semibold
              border-2 rounded-lg
              outline-none transition-colors duration-150
              ${error
                ? 'border-accent bg-accent-50 text-accent-800'
                : 'border-primary-200 bg-white text-primary-800'
              }
              ${!disabled && !error
                ? 'focus:border-primary focus:ring-2 focus:ring-primary-100'
                : ''
              }
              ${disabled
                ? 'opacity-50 cursor-not-allowed bg-gray-100'
                : ''
              }
            `}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-3 text-sm text-accent text-center" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      {/* Remaining attempts */}
      {remainingAttempts !== undefined && remainingAttempts < 5 && !error && (
        <p className="mt-2 text-xs text-primary-400 text-center">
          {t('otp.attemptsRemaining', { count: String(remainingAttempts) })}
        </p>
      )}

      {/* Show remaining attempts alongside error */}
      {remainingAttempts !== undefined && remainingAttempts < 5 && error && (
        <p className="mt-1 text-xs text-accent-600 text-center">
          {t('otp.attemptsRemaining', { count: String(remainingAttempts) })}
        </p>
      )}
    </div>
  );
}
