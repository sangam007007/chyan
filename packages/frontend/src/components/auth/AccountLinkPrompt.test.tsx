import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccountLinkPrompt } from './AccountLinkPrompt';
import { I18nProvider } from '@/i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider initialLanguage="en">{ui}</I18nProvider>);
}

describe('AccountLinkPrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title, description with identifier, and both buttons', () => {
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={() => {}}
        onDecline={() => {}}
      />
    );
    expect(screen.getByText('Account Found')).toBeInTheDocument();
    expect(
      screen.getByText('We found an existing account linked to 98****3210.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create New Account' })).toBeInTheDocument();
  });

  it('displays initial countdown of 120 seconds', () => {
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={() => {}}
        onDecline={() => {}}
      />
    );
    expect(screen.getByText('Linking will be skipped in 120s')).toBeInTheDocument();
  });

  it('decrements countdown each second', () => {
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={() => {}}
        onDecline={() => {}}
      />
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Linking will be skipped in 115s')).toBeInTheDocument();
  });

  it('calls onConfirm when Confirm button is clicked', () => {
    const handleConfirm = vi.fn();
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={handleConfirm}
        onDecline={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link Accounts' }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onDecline when Decline button is clicked', () => {
    const handleDecline = vi.fn();
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={() => {}}
        onDecline={handleDecline}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create New Account' }));
    expect(handleDecline).toHaveBeenCalledTimes(1);
  });

  it('auto-calls onDecline after 120 seconds', () => {
    const handleDecline = vi.fn();
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={() => {}}
        onDecline={handleDecline}
      />
    );
    expect(handleDecline).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(120000);
    });
    expect(handleDecline).toHaveBeenCalledTimes(1);
  });

  it('does not call onDecline before timeout expires', () => {
    const handleDecline = vi.fn();
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={() => {}}
        onDecline={handleDecline}
      />
    );
    act(() => {
      vi.advanceTimersByTime(119000);
    });
    expect(handleDecline).not.toHaveBeenCalled();
  });

  it('displays in Hindi when language is hi', () => {
    render(
      <I18nProvider initialLanguage="hi">
        <AccountLinkPrompt
          identifier="98****3210"
          onConfirm={() => {}}
          onDecline={() => {}}
        />
      </I18nProvider>
    );
    expect(screen.getByText('खाता मिला')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'खाते जोड़ें' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'नया खाता बनाएँ' })).toBeInTheDocument();
  });

  it('has role alertdialog for accessibility', () => {
    renderWithI18n(
      <AccountLinkPrompt
        identifier="98****3210"
        onConfirm={() => {}}
        onDecline={() => {}}
      />
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
