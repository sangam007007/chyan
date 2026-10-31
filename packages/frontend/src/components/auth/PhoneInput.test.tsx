import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhoneInput } from './PhoneInput';
import { I18nProvider } from '@/i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider initialLanguage="en">{ui}</I18nProvider>);
}

describe('PhoneInput', () => {
  it('renders with +91 prefix label and input field', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    expect(screen.getByText('+91')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile Number')).toBeInTheDocument();
  });

  it('restricts input to numeric characters only', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    const input = screen.getByLabelText('Mobile Number');
    fireEvent.change(input, { target: { value: '98abc76def' } });
    expect(input).toHaveValue('9876');
  });

  it('limits input to 10 characters', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    const input = screen.getByLabelText('Mobile Number');
    fireEvent.change(input, { target: { value: '12345678901234' } });
    expect(input).toHaveValue('1234567890');
  });

  it('shows error when submitted empty', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Phone number is required');
  });

  it('shows error for wrong digit count', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    const input = screen.getByLabelText('Mobile Number');
    fireEvent.change(input, { target: { value: '98765' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Phone number must be exactly 10 digits'
    );
  });

  it('shows error for invalid starting digit', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    const input = screen.getByLabelText('Mobile Number');
    fireEvent.change(input, { target: { value: '1234567890' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Phone number must start with 6, 7, 8, or 9'
    );
  });

  it('calls onSubmit with valid 10-digit number', () => {
    const handleSubmit = vi.fn();
    renderWithI18n(<PhoneInput onSubmit={handleSubmit} />);
    const input = screen.getByLabelText('Mobile Number');
    fireEvent.change(input, { target: { value: '9876543210' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send OTP' }));
    expect(handleSubmit).toHaveBeenCalledWith('9876543210');
  });

  it('does not call onSubmit when validation fails', () => {
    const handleSubmit = vi.fn();
    renderWithI18n(<PhoneInput onSubmit={handleSubmit} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Send OTP' }));
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('disables input and button when disabled prop is true', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} disabled />);
    expect(screen.getByLabelText('Mobile Number')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
  });

  it('shows loading text and disables when loading', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} loading />);
    expect(screen.getByRole('button', { name: 'Sending OTP...' })).toBeDisabled();
    expect(screen.getByLabelText('Mobile Number')).toBeDisabled();
  });

  it('clears error when user types after validation failure', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const input = screen.getByLabelText('Mobile Number');
    fireEvent.change(input, { target: { value: '9' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sets aria-invalid when there is an error', () => {
    renderWithI18n(<PhoneInput onSubmit={() => {}} />);
    const input = screen.getByLabelText('Mobile Number');
    fireEvent.submit(screen.getByRole('button', { name: 'Send OTP' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('displays errors in Hindi when language is hi', () => {
    render(
      <I18nProvider initialLanguage="hi">
        <PhoneInput onSubmit={() => {}} />
      </I18nProvider>
    );
    fireEvent.submit(screen.getByRole('button', { name: 'OTP भेजें' }));
    expect(screen.getByRole('alert')).toHaveTextContent('फ़ोन नंबर आवश्यक है');
  });
});
