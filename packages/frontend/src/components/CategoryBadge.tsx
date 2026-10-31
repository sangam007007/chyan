import { useTranslation } from '@/i18n';

/** Valid test category values matching the backend schema. */
export type TestCategory =
  | 'full_mock'
  | 'subject_wise'
  | 'previous_year'
  | 'daily_practice';

export interface CategoryBadgeProps {
  category: TestCategory;
}

/**
 * CategoryBadge — A compact pill displaying the translated category label.
 *
 * Used on TestCard to show the test's category at a glance.
 * Displays the label in the user's current language (Hindi or English)
 * using the translation key pattern: `testList.categories.${category}`.
 */
export function CategoryBadge({ category }: CategoryBadgeProps) {
  const { t } = useTranslation();

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
      {t(`testList.categories.${category}`)}
    </span>
  );
}
