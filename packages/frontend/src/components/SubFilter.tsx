import { useTranslation } from '@/i18n';

export interface SubFilterProps {
  activeFilter: 'full_subject' | 'topic_wise' | null;
  onFilterChange: (filter: 'full_subject' | 'topic_wise') => void;
}

const SUB_FILTER_OPTIONS = [
  { value: 'full_subject' as const, i18nKey: 'testList.subFilter.fullSubject' },
  { value: 'topic_wise' as const, i18nKey: 'testList.subFilter.topicWise' },
];

/**
 * SubFilter — A pair of tab-style buttons for choosing between
 * "Full Subject Test" and "Topic-wise" after a subject is selected.
 *
 * Appears as a secondary filter row below the subject dropdown.
 * Uses the same active/inactive styling pattern as CategoryFilter.
 */
export function SubFilter({ activeFilter, onFilterChange }: SubFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('testList.subFilter.fullSubject')}>
      {SUB_FILTER_OPTIONS.map((option) => {
        const isActive = activeFilter === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(option.value)}
            className={`
              px-4 py-2 text-sm rounded-md transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
              ${isActive
                ? 'bg-primary text-white font-semibold shadow-sm'
                : 'bg-white text-primary-600 border border-primary-200 hover:bg-primary-50'
              }
            `.trim()}
          >
            {t(option.i18nKey)}
          </button>
        );
      })}
    </div>
  );
}
