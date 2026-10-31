import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SubjectDropdown, type Subject } from './SubjectDropdown';
import { I18nProvider } from '@/i18n';

const mockSubjects: Subject[] = [
  { id: '1', nameEn: 'Hindi', nameHi: 'हिन्दी', displayOrder: 1 },
  { id: '2', nameEn: 'General Knowledge', nameHi: 'सामान्य ज्ञान', displayOrder: 2 },
  { id: '3', nameEn: 'Numerical Ability', nameHi: 'संख्यात्मक योग्यता', displayOrder: 3 },
  { id: '4', nameEn: 'Mental Ability/Reasoning', nameHi: 'मानसिक योग्यता/तर्कशक्ति', displayOrder: 4 },
];

function renderWithI18n(
  language: 'en' | 'hi' = 'en',
  onSelect = vi.fn(),
  onClose = vi.fn(),
  subjects = mockSubjects
) {
  return {
    onSelect,
    onClose,
    ...render(
      <I18nProvider initialLanguage={language}>
        <SubjectDropdown
          subjects={subjects}
          language={language}
          onSelect={onSelect}
          onClose={onClose}
        />
      </I18nProvider>
    ),
  };
}

describe('SubjectDropdown', () => {
  it('renders subject names in English when language is "en"', () => {
    renderWithI18n('en');
    expect(screen.getByText('Hindi')).toBeInTheDocument();
    expect(screen.getByText('General Knowledge')).toBeInTheDocument();
    expect(screen.getByText('Numerical Ability')).toBeInTheDocument();
    expect(screen.getByText('Mental Ability/Reasoning')).toBeInTheDocument();
  });

  it('renders subject names in Hindi when language is "hi"', () => {
    renderWithI18n('hi');
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('सामान्य ज्ञान')).toBeInTheDocument();
    expect(screen.getByText('संख्यात्मक योग्यता')).toBeInTheDocument();
    expect(screen.getByText('मानसिक योग्यता/तर्कशक्ति')).toBeInTheDocument();
  });

  it('orders subjects by displayOrder', () => {
    const unordered: Subject[] = [
      { id: '3', nameEn: 'Third', nameHi: 'तीसरा', displayOrder: 3 },
      { id: '1', nameEn: 'First', nameHi: 'पहला', displayOrder: 1 },
      { id: '2', nameEn: 'Second', nameHi: 'दूसरा', displayOrder: 2 },
    ];
    renderWithI18n('en', vi.fn(), vi.fn(), unordered);
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('First');
    expect(options[1]).toHaveTextContent('Second');
    expect(options[2]).toHaveTextContent('Third');
  });

  it('calls onSelect with the subject when a subject is clicked', () => {
    const onSelect = vi.fn();
    renderWithI18n('en', onSelect);
    fireEvent.click(screen.getByText('Hindi'));
    expect(onSelect).toHaveBeenCalledWith(mockSubjects[0]);
  });

  it('calls onClose when clicking outside the dropdown', () => {
    const onClose = vi.fn();
    renderWithI18n('en', vi.fn(), onClose);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the dropdown', () => {
    const onClose = vi.fn();
    renderWithI18n('en', vi.fn(), onClose);
    fireEvent.mouseDown(screen.getByRole('listbox'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has role="listbox" for accessibility', () => {
    renderWithI18n('en');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('has aria-label on the listbox', () => {
    renderWithI18n('en');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label');
  });

  it('each item has role="option"', () => {
    renderWithI18n('en');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
  });
});
