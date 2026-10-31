import type { WizardData, Exam, QuestionItem } from '../../pages/TestWizard';

interface Props {
  data: WizardData;
  exams: Exam[];
  allQuestions: QuestionItem[];
  onGoToStep: (step: number) => void;
}

export function StepPreview({ data, exams, allQuestions, onGoToStep }: Props) {
  const exam = exams.find((e) => e.id === data.examId);
  const categoryLabel = data.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const totalMarksCalc = data.questionIds.length * data.marksPerQuestion;

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Preview</h2>

      {/* Details */}
      <section className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Details</h3>
          <button onClick={() => onGoToStep(0)} className="text-xs text-blue-600 hover:underline">Edit</button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500 text-xs">Title (EN)</dt>
            <dd className="text-gray-900">{data.titleEn || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Title (HI)</dt>
            <dd className="text-gray-900">{data.titleHi || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Exam</dt>
            <dd className="text-gray-900">{exam?.name_en || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Category</dt>
            <dd className="text-gray-900">{categoryLabel}</dd>
          </div>
          {data.descriptionEn && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500 text-xs">Description (EN)</dt>
              <dd className="text-gray-900 text-xs">{data.descriptionEn}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Configuration */}
      <section className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Configuration</h3>
          <button onClick={() => onGoToStep(1)} className="text-xs text-blue-600 hover:underline">Edit</button>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500 text-xs">Duration</dt>
            <dd className="text-gray-900">{data.durationMinutes} min</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Total Marks</dt>
            <dd className="text-gray-900">{data.totalMarks}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Marks/Question</dt>
            <dd className="text-gray-900">{data.marksPerQuestion}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Negative Marking</dt>
            <dd className="text-gray-900">{data.negativeMarkingRatio}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Passing Marks</dt>
            <dd className="text-gray-900">{data.passingMarks}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Pricing</dt>
            <dd className="text-gray-900 capitalize">{data.pricingType}</dd>
          </div>
        </dl>
      </section>

      {/* Questions */}
      <section className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">
            Questions ({data.questionIds.length}) — {totalMarksCalc} marks
          </h3>
          <button onClick={() => onGoToStep(2)} className="text-xs text-blue-600 hover:underline">Edit</button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {data.questionIds.map((qId, idx) => {
            const q = allQuestions.find((x) => x.id === qId);
            return (
              <div key={qId} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="text-gray-400 font-mono w-5">{idx + 1}.</span>
                <span className="truncate">{q?.textEn || qId.substring(0, 12) + '...'}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
