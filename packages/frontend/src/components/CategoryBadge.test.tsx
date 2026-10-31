import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CategoryBadge, type TestCategory } from './CategoryBadge';
import { I18nProvider } from '@/i18n';

function renderWithI18n(category: TestCategory, language: 'hi' | 'en' = 'en') {
  return render(
    <I18nProvider initialLanguage={language}>
      <CategoryBadge category={category} />
    </I18nProvider>
  );
}

describe('CategoryBadge', () => {
  it('renders the translated label for full_mock in English', () => {
    renderWithI18n('full_mock', 'en');
    expect(screen.getByText('Full Mock Test')).toBeInTheDocument();
  });

  it('renders the translated label for subject_wise in English', () => {
    renderWithI18n('subject_wise', 'en');
    expect(screen.getByText('Subject-wise')).toBeInTheDocument();
  });

  it('renders the translated label for previous_year in English', () => {
    renderWithI18n('previous_year', 'en');
    expect(screen.getByText('Previous Year')).toBeInTheDocument();
  });

  it('renders the translated label for daily_practice in English', () => {
    renderWithI18n('daily_practice', 'en');
    expect(screen.getByText('Daily Practice')).toBeInTheDocument();
  });

  it('renders the translated label for full_mock in Hindi', () => {
    renderWithI18n('full_mock', 'hi');
    expect(screen.getByText('पूर्ण मॉक टेस्ट')).toBeInTheDocument();
  });

  it('renders as a compact pill/badge element', () => {
    renderWithI18n('full_mock', 'en');
    const badge = screen.getByText('Full Mock Test');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('text-xs');
  });
});
