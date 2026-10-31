import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';

export interface Topic {
  id: string;
  subjectId: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
}

export interface TopicDropdownProps {
  topics: Topic[];
  language: 'en' | 'hi';
  onSelect: (topic: Topic) => void;
  onClose: () => void;
}

/**
 * TopicDropdown — A positioned dropdown listing topics for the selected subject.
 *
 * Displays topics ordered by `displayOrder`, showing bilingual names based on
 * the current language setting. Closes when the user clicks outside the dropdown.
 *
 * Requirements: 4.2, 4.3, 4.4, 8.2
 */
export function TopicDropdown({ topics, language, onSelect, onClose }: TopicDropdownProps) {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const sortedTopics = [...topics].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label={t('testList.selectTopic')}
      className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1"
    >
      {sortedTopics.map((topic) => (
        <button
          key={topic.id}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onSelect(topic)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          {language === 'hi' ? topic.nameHi : topic.nameEn}
        </button>
      ))}
    </div>
  );
}
