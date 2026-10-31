import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface LoadingButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Show spinner and disable the button */
  loading?: boolean;
  /** Button click handler */
  onClick?: () => void;
  /** Disable the button externally */
  disabled?: boolean;
  /** Button content */
  children: ReactNode;
  /** HTML button type */
  type?: 'button' | 'submit';
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'danger';
}

const variantClasses: Record<string, string> = {
  primary: [
    'bg-primary text-white',
    'hover:bg-primary-600',
    'focus:ring-primary-300',
    'disabled:bg-primary-300 disabled:text-white/70',
  ].join(' '),
  secondary: [
    'border border-primary-300 text-primary bg-white',
    'hover:bg-primary-50',
    'focus:ring-primary-200',
    'disabled:border-primary-200 disabled:text-primary-300 disabled:bg-white',
  ].join(' '),
  danger: [
    'bg-accent text-white',
    'hover:bg-accent-600',
    'focus:ring-accent-200',
    'disabled:bg-accent-300 disabled:text-white/70',
  ].join(' '),
};

/**
 * Button component with built-in loading spinner and auto-disable.
 *
 * When `loading` is true, the button displays a spinning indicator,
 * reduces content opacity, and is automatically disabled to prevent
 * duplicate submissions.
 */
export function LoadingButton({
  loading = false,
  onClick,
  disabled = false,
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  ...rest
}: LoadingButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        relative inline-flex items-center justify-center
        w-full py-2.5 px-4 rounded-md text-sm font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${className}
      `.trim()}
      aria-busy={loading}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin h-5 w-5"
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
        </span>
      )}
      <span className={loading ? 'opacity-0' : 'opacity-100'}>
        {children}
      </span>
    </button>
  );
}
