import type { WizardData } from '../../pages/TestWizard';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

// Topic / subject tests never have negative marking; only Test-section tests (mock, PYQ, daily) can.
const NO_NEGATIVE = ['subject_wise', 'topic_wise'];

export function StepConfig({ data, onChange }: Props) {
  const negativeLocked = NO_NEGATIVE.includes(data.category);
  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Configuration</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Duration (minutes) *</label>
          <input
            type="number"
            min={1}
            value={data.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Total Marks *</label>
          <input
            type="number"
            min={1}
            value={data.totalMarks}
            onChange={(e) => onChange({ totalMarks: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Marks Per Question</label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={data.marksPerQuestion}
            onChange={(e) => onChange({ marksPerQuestion: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Negative Marking (0-1)</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={negativeLocked ? 0 : data.negativeMarkingRatio}
            disabled={negativeLocked}
            onChange={(e) => onChange({ negativeMarkingRatio: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
          />
          {negativeLocked && (
            <p className="mt-1 text-[11px] text-gray-500">Subject and topic tests never have negative marking.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Passing Marks *</label>
          <input
            type="number"
            min={1}
            value={data.passingMarks}
            onChange={(e) => onChange({ passingMarks: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Pricing Type */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Pricing Type</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pricingType"
              checked={data.pricingType === 'free'}
              onChange={() => onChange({ pricingType: 'free' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Free</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pricingType"
              checked={data.pricingType === 'premium'}
              onChange={() => onChange({ pricingType: 'premium' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Premium</span>
          </label>
        </div>
      </div>
    </div>
  );
}
