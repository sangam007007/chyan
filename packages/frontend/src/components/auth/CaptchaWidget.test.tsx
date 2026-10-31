import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CaptchaWidget } from './CaptchaWidget';
import { I18nProvider } from '@/i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider initialLanguage="en">{ui}</I18nProvider>);
}

describe('CaptchaWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the "I\'m not a robot" checkbox', () => {
    renderWithI18n(<CaptchaWidget onVerify={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText("I'm not a robot")).toBeInTheDocument();
  });

  it('checkbox is unchecked initially', () => {
    renderWithI18n(<CaptchaWidget onVerify={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onVerify with a token after clicking the checkbox', async () => {
    const handleVerify = vi.fn();
    renderWithI18n(<CaptchaWidget onVerify={handleVerify} />);

    fireEvent.click(screen.getByRole('checkbox'));

    // Show loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Advance past the simulated delay
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(handleVerify).toHaveBeenCalledOnce();
    expect(handleVerify.mock.calls[0][0]).toMatch(/^captcha_/);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows success state after verification', () => {
    renderWithI18n(<CaptchaWidget onVerify={() => {}} />);

    fireEvent.click(screen.getByRole('checkbox'));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('disables checkbox after verification', () => {
    renderWithI18n(<CaptchaWidget onVerify={() => {}} />);

    fireEvent.click(screen.getByRole('checkbox'));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('does not call onVerify multiple times on rapid clicks', () => {
    const handleVerify = vi.fn();
    renderWithI18n(<CaptchaWidget onVerify={handleVerify} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(handleVerify).toHaveBeenCalledOnce();
  });

  it('displays error message when error prop is provided', () => {
    renderWithI18n(
      <CaptchaWidget onVerify={() => {}} error="CAPTCHA verification failed" />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('CAPTCHA verification failed');
  });

  it('does not display error message when error prop is undefined', () => {
    renderWithI18n(<CaptchaWidget onVerify={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('applies error border styling when error is present', () => {
    const { container } = renderWithI18n(
      <CaptchaWidget onVerify={() => {}} error="Failed" />
    );
    const wrapper = container.querySelector('[role="group"]');
    expect(wrapper?.className).toContain('border-accent-400');
  });
});
