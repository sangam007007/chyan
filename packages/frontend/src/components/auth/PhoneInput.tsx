import { useState, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useTranslation } from '@/i18n';

export interface PhoneInputProps {
  /** Called with the validated 10-digit phone number on form submit */
  onSubmit: (phone: string) => void;
  /** Disables the input and button */
  disabled?: boolean;
  /** Shows loading state on the submit button */
  loading?: boolean;
}

/**
 * Validates a 10-digit Indian mobile number.
 * Returns a translation key for the error, or null if valid.
 */
function validatePhone(phone: string): string | null {
  if (phone.length === 0) {
    return 'login.phoneRequired';
  }
  if (phone.length !== 10) {
    return 'login.phoneInvalidLength';
  }
  if (!/^[6-9]/.test(phone)) {
    return 'login.phoneInvalidStart';
  }
  if (!/^\d{10}$/.test(phone)) {
    return 'login.phoneInvalidFormat';
  }
  return null;
}

/**
 * PhoneInput component for Indian mobile number entry.
 *
 * Displays a non-editable +91 prefix, restricts input to numeric characters,
 * limits to 10 digits, and shows inline validation errors in the selected language.
 */
export function PhoneInput({ onSubmit, disabled = false, loading = false }: PhoneInputProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numeric characters, limit to 10 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 10);
    setPhone(numericValue);
    // Clear error on input change
    if (error) {
      setError(null);
    }
  }, [error]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const validationError = validatePhone(phone);
      if (validationError) {
        setError(validationError);
        return;
      }
      onSubmit(phone);
    },
    [phone, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label
        htmlFor="phone-input"
        className="block text-sm font-medium text-primary-700 mb-1"
      >
        {t('login.phoneLabel')}
      </label>
      <div className="flex items-center">
        <span
          className="inline-flex items-center px-3 py-2 border border-r-0 border-primary-200 rounded-l-md bg-primary-50 text-primary-600 text-sm font-medium select-none"
          aria-hidden="true"
        >
          +91
        </span>
        <input
          id="phone-input"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={t('login.phonePlaceholder')}
          value={phone}
          onChange={handleChange}
          disabled={disabled || loading}
          maxLength={10}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'phone-error' : undefined}
          className={`flex-1 px-3 py-2 border rounded-r-md text-sm outline-none transition-colors
            ${error
              ? 'border-accent-500 focus:ring-2 focus:ring-accent-200'
              : 'border-primary-200 focus:ring-2 focus:ring-primary-200 focus:border-primary-400'
            }
            ${disabled || loading ? 'bg-primary-50 text-primary-400 cursor-not-allowed' : 'bg-white text-primary-800'}
          `}
        />
      </div>
      {error && (
        <p
          id="phone-error"
          className="mt-1 text-sm text-accent-500"
          role="alert"
        >
          {t(error)}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || loading}
        className="mt-4 w-full py-2.5 px-4 bg-primary text-white font-medium rounded-md text-sm
          hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2
          disabled:bg-primary-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? t('login.sendingOtp') : t('login.sendOtp')}
      </button>
    </form>
  );
}
