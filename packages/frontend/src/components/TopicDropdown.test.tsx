import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopicDropdown, type Topic } from './TopicDropdown';
import { I18nProvider } from '@/i18n';

const mockTopics: Topic[] = [
  { id: '1', subjectId: 's1', nameEn: 'Synonyms', nameHi: 'पर्यायवाची शब्द', displayOrder: 1 },
  { id: '2', subjectId: 's1', nameEn: 'Antonyms', nameHi: 'विलोम शब्द', displayOrder: 2 },
  { id: '3', subjectId: 's1', nameEn: 'Grammar', nameHi: 'व्याकरण', displayOrder: 3 },
];

function renderDropdown(
  options: {
    topics?: Topic[];
    language?: 'en' | 'hi';
    onSelect?: (topic: Topic) => void;
    onClose?: () => void;
  } = {}
) {
  const {
    topics = mockTopics,
    language = 'en',
    onSelect = vi.fn(),
    onClose = vi.fn(),
  } = options;

  return {
    onSelect,
    onClose,
    ...render(
      <I18nProvider initialLanguage={language}>
        <TopicDropdown
          topics={topics}
          language={language}
          onSelect={onSelect}
          onClose={onClose}
        />
      </I18nProvider>
    ),
  };
}

describe('TopicDropdown', () => {
  it('renders topic names in English when language is "en"', () => {
    renderDropdown({ language: 'en' });
    expect(screen.getByText('Synonyms')).toBeInTheDocument();
    expect(screen.getByText('Antonyms')).toBeInTheDocument();
    expect(screen.getByText('Grammar')).toBeInTheDocument();
  });

  it('renders topic names in Hindi when language is "hi"', () => {
    renderDropdown({ language: 'hi' });
    expect(screen.getByText('पर्यायवाची शब्द')).toBeInTheDocument();
    expect(screen.getByText('विलोम शब्द')).toBeInTheDocument();
    expect(screen.getByText('व्याकरण')).toBeInTheDocument();
  });

  it('renders topics ordered by displayOrder', () => {
    const unordered: Topic[] = [
      { id: '3', subjectId: 's1', nameEn: 'Grammar', nameHi: 'व्याकरण', displayOrder: 3 },
      { id: '1', subjectId: 's1', nameEn: 'Synonyms', nameHi: 'पर्यायवाची शब्द', displayOrder: 1 },
      { id: '2', subjectId: 's1', nameEn: 'Antonyms', nameHi: 'विलोम शब्द', displayOrder: 2 },
    ];
    renderDropdown({ topics: unordered });

    const buttons = screen.getAllByRole('option');
    expect(buttons[0]).toHaveTextContent('Synonyms');
    expect(buttons[1]).toHaveTextContent('Antonyms');
    expect(buttons[2]).toHaveTextContent('Grammar');
  });

  it('calls onSelect with the topic when a topic button is clicked', () => {
    const onSelect = vi.fn();
    renderDropdown({ onSelect });

    fireEvent.click(screen.getByText('Antonyms'));
    expect(onSelect).toHaveBeenCalledWith(mockTopics[1]);
  });

  it('calls onClose when clicking outside the dropdown', () => {
    const onClose = vi.fn();
    renderDropdown({ onClose });

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside the dropdown', () => {
    const onClose = vi.fn();
    renderDropdown({ onClose });

    fireEvent.mouseDown(screen.getByText('Synonyms'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has role="listbox" on the container', () => {
    renderDropdown();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    renderDropdown();
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', 'Select Topic');
  });

  it('each item has role="option"', () => {
    renderDropdown();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
  });

  it('renders an empty dropdown when no topics are provided', () => {
    renderDropdown({ topics: [] });
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
