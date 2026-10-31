import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SubFilter } from './SubFilter';
import { I18nProvider } from '@/i18n';

function renderWithI18n(
  activeFilter: 'full_subject' | 'topic_wise' | null,
  onFilterChange = vi.fn(),
  language: 'hi' | 'en' = 'en'
) {
  return {
    onFilterChange,
    ...render(
      <I18nProvider initialLanguage={language}>
        <SubFilter activeFilter={activeFilter} onFilterChange={onFilterChange} />
      </I18nProvider>
    ),
  };
}

describe('SubFilter', () => {
  it('renders two buttons with English labels', () => {
    renderWithI18n(null);
    expect(screen.getByText('Full Subject Test')).toBeInTheDocument();
    expect(screen.getByText('Topic-wise')).toBeInTheDocument();
  });

  it('renders two buttons with Hindi labels', () => {
    renderWithI18n(null, vi.fn(), 'hi');
    expect(screen.getByText('पूर्ण विषय टेस्ट')).toBeInTheDocument();
    expect(screen.getByText('टॉपिक वार')).toBeInTheDocument();
  });

  it('highlights the active "Full Subject Test" button', () => {
    renderWithI18n('full_subject');
    const fullSubjectBtn = screen.getByText('Full Subject Test');
    expect(fullSubjectBtn.className).toContain('bg-primary');
    expect(fullSubjectBtn.className).toContain('font-semibold');
  });

  it('highlights the active "Topic-wise" button', () => {
    renderWithI18n('topic_wise');
    const topicBtn = screen.getByText('Topic-wise');
    expect(topicBtn.className).toContain('bg-primary');
    expect(topicBtn.className).toContain('font-semibold');
  });

  it('inactive button has border styling', () => {
    renderWithI18n('full_subject');
    const topicBtn = screen.getByText('Topic-wise');
    expect(topicBtn.className).toContain('bg-white');
    expect(topicBtn.className).toContain('border');
  });

  it('calls onFilterChange with "full_subject" when clicked', () => {
    const onFilterChange = vi.fn();
    renderWithI18n(null, onFilterChange);
    fireEvent.click(screen.getByText('Full Subject Test'));
    expect(onFilterChange).toHaveBeenCalledWith('full_subject');
  });

  it('calls onFilterChange with "topic_wise" when clicked', () => {
    const onFilterChange = vi.fn();
    renderWithI18n(null, onFilterChange);
    fireEvent.click(screen.getByText('Topic-wise'));
    expect(onFilterChange).toHaveBeenCalledWith('topic_wise');
  });

  it('has role="tablist" on the container', () => {
    renderWithI18n(null);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('buttons have role="tab" and correct aria-selected', () => {
    renderWithI18n('full_subject');
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });
});
