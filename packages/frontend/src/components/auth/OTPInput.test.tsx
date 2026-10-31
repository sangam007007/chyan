import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OTPInput } from './OTPInput';

// Mock the i18n hook
vi.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'otp.inputLabel': 'Enter OTP',
        'otp.attemptsRemaining': `${params?.count} attempts remaining`,
      };
      return translations[key] ?? key;
    },
    language: 'en',
    setLanguage: vi.fn(),
  }),
}));

describe('OTPInput', () => {
  it('renders 6 input cells', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('each input has inputMode numeric and maxLength 1', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('maxlength', '1');
    });
  });

  it('has accessible aria-labels on each cell', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input, index) => {
      expect(input).toHaveAttribute('aria-label', `Enter OTP ${index + 1} of 6`);
    });
  });

  it('auto-advances to next cell on digit entry', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');

    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(inputs[1]).toHaveFocus();
  });

  it('calls onComplete when all 6 digits are entered', async () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');

    // Enter digits 1-5
    for (let i = 0; i < 5; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    // Enter the 6th digit
    fireEvent.change(inputs[5], { target: { value: '6' } });

    // onComplete is called via setTimeout, wait for it
    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('123456');
    });
  });

  it('handles backspace to clear current cell', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');

    // Enter a digit
    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect(inputs[1]).toHaveFocus();

    // Focus back to first input and press backspace
    fireEvent.focus(inputs[0]);
    fireEvent.keyDown(inputs[0], { key: 'Backspace' });

    expect(inputs[0]).toHaveValue('');
  });

  it('handles backspace to move to previous cell when current is empty', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');

    // Enter a digit in first cell, auto-advances to second
    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect(inputs[1]).toHaveFocus();

    // Press backspace on the second (empty) cell
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    // Focus moves to previous cell
    expect(inputs[0]).toHaveFocus();
  });

  it('handles paste of 6-digit code', async () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '987654' },
    });

    expect(onComplete).toHaveBeenCalledWith('987654');

    // All cells should be filled
    expect(inputs[0]).toHaveValue('9');
    expect(inputs[1]).toHaveValue('8');
    expect(inputs[2]).toHaveValue('7');
    expect(inputs[3]).toHaveValue('6');
    expect(inputs[4]).toHaveValue('5');
    expect(inputs[5]).toHaveValue('4');
  });

  it('ignores paste of non-6-digit content', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '123' },
    });

    expect(onComplete).not.toHaveBeenCalled();
    // Cells should remain empty
    expect(inputs[0]).toHaveValue('');
  });

  it('rejects non-numeric input', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');

    fireEvent.change(inputs[0], { target: { value: 'a' } });
    expect(inputs[0]).toHaveValue('');
  });

  it('disables all inputs when disabled prop is true', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} disabled />);

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it('displays error message when error prop is provided', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} error="Invalid OTP" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid OTP');
  });

  it('displays remaining attempts when provided and less than 5', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} remainingAttempts={3} />);

    expect(screen.getByText('3 attempts remaining')).toBeInTheDocument();
  });

  it('does not display remaining attempts when equal to 5 (full attempts)', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} remainingAttempts={5} />);

    expect(screen.queryByText(/attempts remaining/)).not.toBeInTheDocument();
  });

  it('has autocomplete one-time-code on first input', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(inputs[1]).toHaveAttribute('autocomplete', 'off');
  });

  it('applies error styling when error prop is set', () => {
    const onComplete = vi.fn();
    render(<OTPInput onComplete={onComplete} error="Invalid OTP" />);

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input.className).toContain('border-accent');
    });
  });
});
