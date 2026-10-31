import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';

export interface Subject {
  id: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
}

export interface SubjectDropdownProps {
  subjects: Subject[];
  language: 'en' | 'hi';
  onSelect: (subject: Subject) => void;
  onClose: () => void;
}

/**
 * SubjectDropdown — A positioned dropdown listing subjects for the user's exam.
 *
 * Displays subjects ordered by `displayOrder`, showing bilingual names based on
 * the current language setting. Closes when the user clicks outside the dropdown.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 8.1
 */
export function SubjectDropdown({ subjects, language, onSelect, onClose }: SubjectDropdownProps) {
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

  const sortedSubjects = [...subjects].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label={t('testList.selectSubject')}
      className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1"
    >
      {sortedSubjects.map((subject) => (
        <button
          key={subject.id}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onSelect(subject)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          {language === 'hi' ? subject.nameHi : subject.nameEn}
        </button>
      ))}
    </div>
  );
}
