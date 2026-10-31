import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LanguageToggle } from './LanguageToggle';
import { I18nProvider } from '@/i18n';

function renderWithI18n(initialLanguage: 'hi' | 'en' = 'en') {
  return render(
    <I18nProvider initialLanguage={initialLanguage}>
      <LanguageToggle />
    </I18nProvider>
  );
}

describe('LanguageToggle', () => {
  it('renders both Hindi and English buttons', () => {
    renderWithI18n();
    expect(screen.getByRole('radio', { name: 'हिन्दी' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeInTheDocument();
  });

  it('highlights English button when language is en', () => {
    renderWithI18n('en');
    const enButton = screen.getByRole('radio', { name: 'English' });
    const hiButton = screen.getByRole('radio', { name: 'हिन्दी' });
    expect(enButton).toHaveAttribute('aria-checked', 'true');
    expect(hiButton).toHaveAttribute('aria-checked', 'false');
  });

  it('highlights Hindi button when language is hi', () => {
    renderWithI18n('hi');
    const hiButton = screen.getByRole('radio', { name: 'हिन्दी' });
    const enButton = screen.getByRole('radio', { name: 'English' });
    expect(hiButton).toHaveAttribute('aria-checked', 'true');
    expect(enButton).toHaveAttribute('aria-checked', 'false');
  });

  it('switches to Hindi when Hindi button is clicked', () => {
    renderWithI18n('en');
    const hiButton = screen.getByRole('radio', { name: 'हिन्दी' });
    fireEvent.click(hiButton);
    // After switching, Hindi should be active
    expect(hiButton).toHaveAttribute('aria-checked', 'true');
  });

  it('switches to English when English button is clicked', () => {
    renderWithI18n('hi');
    const enButton = screen.getByRole('radio', { name: 'English' });
    fireEvent.click(enButton);
    // After switching, English should be active
    expect(enButton).toHaveAttribute('aria-checked', 'true');
  });

  it('persists language to localStorage on switch', () => {
    renderWithI18n('en');
    const hiButton = screen.getByRole('radio', { name: 'हिन्दी' });
    fireEvent.click(hiButton);
    expect(localStorage.getItem('preferred_language')).toBe('hi');
  });

  it('has radiogroup role with accessible label', () => {
    renderWithI18n('en');
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument();
  });
});
