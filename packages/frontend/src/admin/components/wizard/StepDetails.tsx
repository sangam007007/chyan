import type { WizardData, Exam } from '../../pages/TestWizard';

const CATEGORIES = [
  { value: 'full_mock', label: 'Full Mock' },
  { value: 'subject_wise', label: 'Subject Wise' },
  { value: 'previous_year', label: 'Previous Year' },
  { value: 'daily_practice', label: 'Daily Practice' },
];

interface Props {
  data: WizardData;
  exams: Exam[];
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepDetails({ data, exams, onChange }: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Basic Details</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title (English) *</label>
          <input
            type="text"
            value={data.titleEn}
            onChange={(e) => onChange({ titleEn: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Test title in English"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title (Hindi) *</label>
          <input
            type="text"
            value={data.titleHi}
            onChange={(e) => onChange({ titleHi: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="टेस्ट शीर्षक हिंदी में"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description (English)</label>
          <textarea
            value={data.descriptionEn}
            onChange={(e) => onChange({ descriptionEn: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            placeholder="Optional description..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description (Hindi)</label>
          <textarea
            value={data.descriptionHi}
            onChange={(e) => onChange({ descriptionHi: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            placeholder="वैकल्पिक विवरण..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Exam *</label>
          <select
            value={data.examId}
            onChange={(e) => onChange({ examId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select exam...</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>{exam.name_en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
          <select
            value={data.category}
            onChange={(e) => onChange({ category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select category...</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
