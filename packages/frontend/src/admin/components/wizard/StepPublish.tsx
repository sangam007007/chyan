import type { WizardData } from '../../pages/TestWizard';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  saving: boolean;
  saveError: string | null;
}

export function StepPublish({ data, onChange, saving, saveError }: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Publish Settings</h2>

      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Status</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              checked={data.status === 'draft'}
              onChange={() => onChange({ status: 'draft' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Save as Draft</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              checked={data.status === 'published'}
              onChange={() => onChange({ status: 'published' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Publish Now</span>
          </label>
        </div>
      </div>

      {/* Availability */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Available From (optional)</label>
          <input
            type="date"
            value={data.availableFrom}
            onChange={(e) => onChange({ availableFrom: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Available Until (optional)</label>
          <input
            type="date"
            value={data.availableUntil}
            onChange={(e) => onChange({ availableUntil: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">
          Click the <strong>{saving ? 'Saving...' : 'Create Test / Update Test'}</strong> button below to finalize.
          {data.status === 'draft' && ' The test will be saved as a draft and won\'t be visible to students.'}
          {data.status === 'published' && ' The test will be published and visible to students immediately.'}
        </p>
      </div>

      {/* Error */}
      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700">{saveError}</p>
        </div>
      )}
    </div>
  );
}
