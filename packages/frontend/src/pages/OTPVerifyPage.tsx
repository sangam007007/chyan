import { useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n';
import { OTPInput } from '@/components/auth/OTPInput';
import { ResendTimer } from '@/components/auth/ResendTimer';
import { CaptchaWidget } from '@/components/auth/CaptchaWidget';
import { LoadingButton } from '@/components/common/LoadingButton';
import { type AxiosError } from 'axios';

interface LocationState {
  phone?: string;
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: {
      remainingAttempts?: number;
      lockoutDuration?: number;
      retryAfter?: number;
    };
  };
}

/**
 * OTP Verification Page.
 *
 * Composes OTPInput, ResendTimer, CaptchaWidget, and LoadingButton.
 * Handles OTP verification with error states including:
 * - Invalid OTP with remaining attempts
 * - Expired OTP with auto-clear and resend prompt
 * - Lockout after max attempts with duration display
 * - CAPTCHA requirement after 3 failures
 * - Network failure preservation of OTP input
 * - Navigation based on response.nextStep
 *
 * Requirements: 3.1–3.6, 4.1–4.6, 16.2, 17.3, 18.2
 */
export function OTPVerifyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOTP, login } = useAuth();

  const state = location.state as LocationState | null;
  const phone = state?.phone ?? '';

  // Core state
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>();
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // CAPTCHA state
  const [failureCount, setFailureCount] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | undefined>();

  // Resend state
  const [isResending, setIsResending] = useState(false);

  // Track current OTP value for network failure preservation
  const currentOtpRef = useRef<string>('');

  /**
   * Mask phone number for display: "9876543210" → "98765 XXXXX" pattern
   * Shows first 5 digits then masks the rest
   */
  const maskedPhone = phone
    ? `${phone.slice(0, 5)}${phone.slice(5).replace(/./g, 'X')}`
    : '';

  /**
   * Handle OTP verification submission.
   * Calls POST /api/auth/otp/verify via AuthContext.
   * Routes based on nextStep response.
   */
  const handleVerify = useCallback(
    async (otp: string) => {
      currentOtpRef.current = otp;

      // Require CAPTCHA if triggered (after 3 failures)
      if (showCaptcha && !captchaToken) {
        setCaptchaError(t('errors.captchaRequired'));
        return;
      }

      setIsVerifying(true);
      setError(undefined);
      setCaptchaError(undefined);

      try {
        const response = await verifyOTP(phone, otp, captchaToken);

        // Navigate based on nextStep
        switch (response.nextStep) {
          case 'exam_selection':
          case 'profile_setup':
            navigate('/onboarding', { replace: true });
            break;
          case 'account_link':
            navigate('/onboarding', {
              replace: true,
              state: { linkingInfo: response.linkingInfo },
            });
            break;
          case 'dashboard':
          default:
            navigate('/dashboard', { replace: true });
            break;
        }
      } catch (err) {
        const axiosError = err as AxiosError<ApiErrorResponse>;
        const errorCode = axiosError.response?.data?.error?.code;
        const details = axiosError.response?.data?.error?.details;

        // Check if it's a network error (no response received)
        if (!axiosError.response) {
          // Network failure — preserve OTP input (Req 16.2)
          setError(t('errors.network'));
          setIsVerifying(false);
          return;
        }

        // Track failure count for CAPTCHA logic
        const newFailureCount = failureCount + 1;
        setFailureCount(newFailureCount);

        // Show CAPTCHA after 3 failures (Req 17.3)
        if (newFailureCount >= 3) {
          setShowCaptcha(true);
          setCaptchaToken(null); // Reset captcha for next attempt
        }

        switch (errorCode) {
          case 'INVALID_OTP':
            setError(t('otp.invalid'));
            if (details?.remainingAttempts !== undefined) {
              setRemainingAttempts(details.remainingAttempts);
            }
            break;

          case 'OTP_EXPIRED':
            setError(t('otp.expired'));
            // Clear input on expiry — user needs to request a new OTP
            currentOtpRef.current = '';
            break;

          case 'OTP_MAX_ATTEMPTS': {
            setIsLocked(true);
            const lockoutDuration = details?.lockoutDuration ?? 900; // 15 min default
            const minutes = Math.floor(lockoutDuration / 60);
            const seconds = lockoutDuration % 60;
            setLockoutMinutes(minutes);
            setLockoutSeconds(seconds);
            setError(t('otp.locked', {
              minutes: String(minutes),
              seconds: String(seconds),
            }));
            break;
          }

          case 'CAPTCHA_REQUIRED':
            setShowCaptcha(true);
            setCaptchaToken(null);
            setCaptchaError(t('errors.captchaRequired'));
            break;

          case 'CAPTCHA_INVALID':
            setCaptchaToken(null);
            setCaptchaError(t('errors.captchaInvalid'));
            break;

          case 'RATE_LIMITED': {
            const retryAfter = details?.retryAfter ?? 60;
            const mins = Math.floor(retryAfter / 60);
            const secs = retryAfter % 60;
            const time = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            setError(t('errors.rateLimited', { time }));
            break;
          }

          default:
            setError(axiosError.response?.data?.error?.message ?? t('common.error'));
            break;
        }
      } finally {
        setIsVerifying(false);
      }
    },
    [phone, verifyOTP, navigate, t, showCaptcha, captchaToken, failureCount]
  );

  /**
   * Handle CAPTCHA verification completion.
   */
  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaError(undefined);
  }, []);

  /**
   * Handle OTP resend.
   * Calls POST /api/auth/otp/send via AuthContext.login
   */
  const handleResend = useCallback(async () => {
    setIsResending(true);
    setError(undefined);
    setIsLocked(false);
    setRemainingAttempts(undefined);

    try {
      await login(phone);
      // Reset failure count and captcha on successful resend
      setFailureCount(0);
      setShowCaptcha(false);
      setCaptchaToken(null);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorCode = axiosError.response?.data?.error?.code;

      if (errorCode === 'RATE_LIMITED') {
        const retryAfter = axiosError.response?.data?.error?.details?.retryAfter ?? 60;
        const mins = Math.floor(retryAfter / 60);
        const secs = retryAfter % 60;
        const time = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        setError(t('otp.rateLimited', { time }));
      } else if (!axiosError.response) {
        setError(t('errors.network'));
      } else {
        setError(t('otp.resendFailed'));
      }
    } finally {
      setIsResending(false);
    }
  }, [phone, login, t]);

  /**
   * Navigate back to login page to change phone number.
   */
  const handleChangeNumber = useCallback(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  // Redirect to login if no phone in state
  if (!phone) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Title */}
      <h2 className="text-2xl font-bold text-primary mb-2 text-center">
        {t('otp.title')}
      </h2>

      {/* Sent-to message */}
      <p className="text-sm text-primary-600 text-center mb-6">
        {t('otp.sentTo', { phone: maskedPhone })}
      </p>

      {/* Change number link */}
      <div className="text-center mb-6">
        <button
          type="button"
          onClick={handleChangeNumber}
          className="text-sm text-primary hover:text-primary/80 underline transition-colors"
        >
          {t('otp.changeNumber')}
        </button>
      </div>

      {/* OTP Input */}
      <OTPInput
        onComplete={handleVerify}
        disabled={isVerifying || isLocked}
        error={error}
        remainingAttempts={remainingAttempts}
      />

      {/* CAPTCHA Widget — shown after 3 failures */}
      {showCaptcha && (
        <CaptchaWidget
          onVerify={handleCaptchaVerify}
          error={captchaError}
        />
      )}

      {/* Verify button */}
      <div className="mt-6">
        <LoadingButton
          type="button"
          loading={isVerifying}
          disabled={isLocked}
          onClick={() => {
            if (currentOtpRef.current.length === 6) {
              handleVerify(currentOtpRef.current);
            }
          }}
        >
          {t('otp.verify')}
        </LoadingButton>
      </div>

      {/* Resend timer */}
      <div className="mt-4 text-center">
        <ResendTimer
          cooldownSeconds={30}
          onResend={handleResend}
          disabled={isResending || isLocked}
        />
      </div>
    </div>
  );
}
