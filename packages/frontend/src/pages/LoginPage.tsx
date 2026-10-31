import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { LanguageToggle } from '@/components/common/LanguageToggle';

/**
 * LoginPage — Entry point for authentication.
 *
 * Composes PhoneInput, GoogleLoginButton, and LanguageToggle.
 * Handles OTP send request with loading/error states and navigates
 * to the OTP verify page on success.
 *
 * Requirements: 1.1–1.7, 5.1, 14.2, 18.1
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle phone number submission.
   * Calls POST /api/auth/otp/send via the auth context's login method.
   * On success, navigates to /verify-otp with the phone number in state.
   */
  const handlePhoneSubmit = useCallback(
    async (phone: string) => {
      setError(null);
      setIsLoading(true);

      try {
        await login(phone);
        // Navigate to OTP verification page with phone in location state
        navigate('/verify-otp', { state: { phone } });
      } catch (err) {
        const axiosError = err as AxiosError<{
          success: boolean;
          error?: { code?: string; message?: string; retryAfter?: number };
        }>;

        if (axiosError.response) {
          const errorData = axiosError.response.data?.error;
          const status = axiosError.response.status;

          if (status === 429) {
            // Rate limited
            const retryAfter = errorData?.retryAfter;
            if (retryAfter) {
              const minutes = Math.ceil(retryAfter / 60);
              setError(t('errors.rateLimited', { time: `${minutes} min` }));
            } else {
              setError(t('errors.rateLimited', { time: '' }));
            }
          } else if (status === 400) {
            // Validation error from server
            setError(errorData?.message || t('errors.validationFailed'));
          } else if (status === 502) {
            // SMS delivery failure
            setError(t('errors.smsDeliveryFailed'));
          } else {
            // Other server errors
            setError(t('errors.serverError'));
          }
        } else if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ERR_CANCELED') {
          // Request timeout
          setError(t('errors.timeout'));
        } else {
          // Network error (no response received)
          setError(t('errors.network'));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [login, navigate, t]
  );

  /**
   * Handle Google OAuth login initiation.
   * Shows full-screen loading while redirecting to Google.
   */
  const handleGoogleLogin = useCallback(async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      await loginWithGoogle();
      // loginWithGoogle redirects to Google, so we won't reach here
      // unless there's an issue before the redirect
    } catch (err) {
      setIsGoogleLoading(false);
      const axiosError = err as AxiosError<{
        success: boolean;
        error?: { code?: string; message?: string };
      }>;

      if (axiosError.response) {
        setError(t('errors.oauthFailed'));
      } else if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ERR_CANCELED') {
        setError(t('errors.timeout'));
      } else {
        setError(t('errors.network'));
      }
    }
  }, [loginWithGoogle, t]);

  return (
    <div className="space-y-6">
      {/* Language toggle in top-right corner */}
      <div className="flex justify-end">
        <LanguageToggle />
      </div>

      {/* Title and subtitle */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">
          {t('login.title')}
        </h2>
        <p className="mt-1 text-sm text-primary-300">
          {t('login.subtitle')}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div
          className="p-3 rounded-md bg-accent-50 border border-accent-200 text-sm text-accent-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Phone input form */}
      <PhoneInput
        onSubmit={handlePhoneSubmit}
        disabled={isGoogleLoading}
        loading={isLoading}
      />

      {/* OR divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-primary-100" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-primary-300 font-medium">
            {t('login.orDivider')}
          </span>
        </div>
      </div>

      {/* Google login button */}
      <GoogleLoginButton
        onClick={handleGoogleLogin}
        disabled={isLoading}
        loading={isGoogleLoading}
      />
    </div>
  );
}
