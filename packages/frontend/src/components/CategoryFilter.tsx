import { useTranslation } from '@/i18n';
import { SubjectDropdown, type Subject } from './SubjectDropdown';
import { SubFilter } from './SubFilter';
import { TopicDropdown, type Topic } from './TopicDropdown';

const CATEGORY_OPTIONS = [
  'all',
  'full_mock',
  'subject_wise',
  'previous_year',
  'daily_practice',
] as const;

export interface CategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  selectedSubject: Subject | null;
  onSubjectSelect: (subject: Subject | null) => void;
  subFilter: 'full_subject' | 'topic_wise' | null;
  onSubFilterChange: (filter: 'full_subject' | 'topic_wise' | null) => void;
  selectedTopic: Topic | null;
  onTopicSelect: (topic: Topic | null) => void;
  subjects: Subject[];
  topics: Topic[];
}

/**
 * CategoryFilter — A horizontal row of tab-style buttons for filtering tests by category.
 *
 * Displays five options: "All" plus the four test categories.
 * Uses i18n translation keys for bilingual labels (Hindi/English).
 * The active filter button gets distinct styling (highlighted background, bold text).
 *
 * When "Subject-wise" is active, conditionally renders:
 * - SubjectDropdown (when no subject selected yet)
 * - SubFilter (after subject is selected)
 * - TopicDropdown (when "Topic-wise" sub-filter is active and no topic selected)
 */
export function CategoryFilter({
  activeCategory,
  onCategoryChange,
  selectedSubject,
  onSubjectSelect,
  subFilter,
  onSubFilterChange,
  selectedTopic,
  onTopicSelect,
  subjects,
  topics,
}: CategoryFilterProps) {
  const { t, language } = useTranslation();

  const showSubjectDropdown = activeCategory === 'subject_wise' && selectedSubject === null;
  const showSubFilter = activeCategory === 'subject_wise' && selectedSubject !== null;
  const showTopicDropdown = subFilter === 'topic_wise' && selectedTopic === null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('testList.categories.all')}>
        {CATEGORY_OPTIONS.map((category) => {
          // "Subject-wise" tab maintains active styling while dropdown is open (Req 9.5)
          const isActive = category === 'subject_wise'
            ? activeCategory === 'subject_wise'
            : activeCategory === category;

          if (category === 'subject_wise') {
            return (
              <div key={category} className="relative">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onCategoryChange(category)}
                  className={`
                    px-4 py-2 text-sm rounded-md transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
                    ${isActive
                      ? 'bg-primary text-white font-semibold shadow-sm'
                      : 'bg-white text-primary-600 border border-primary-200 hover:bg-primary-50'
                    }
                  `.trim()}
                >
                  {t(`testList.categories.${category}`)}
                </button>
                {showSubjectDropdown && (
                  <SubjectDropdown
                    subjects={subjects}
                    language={language}
                    onSelect={onSubjectSelect}
                    onClose={() => {
                      onSubjectSelect(null);
                      onCategoryChange('all');
                    }}
                  />
                )}
              </div>
            );
          }

          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onCategoryChange(category)}
              className={`
                px-4 py-2 text-sm rounded-md transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
                ${isActive
                  ? 'bg-primary text-white font-semibold shadow-sm'
                  : 'bg-white text-primary-600 border border-primary-200 hover:bg-primary-50'
                }
              `.trim()}
            >
              {t(`testList.categories.${category}`)}
            </button>
          );
        })}
      </div>

      {showSubFilter && (
        <div className="relative">
          <SubFilter
            activeFilter={subFilter}
            onFilterChange={onSubFilterChange}
          />
          {showTopicDropdown && (
            <TopicDropdown
              topics={topics}
              language={language}
              onSelect={onTopicSelect}
              onClose={() => onTopicSelect(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
