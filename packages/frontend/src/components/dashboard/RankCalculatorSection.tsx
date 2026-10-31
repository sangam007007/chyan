import { useState } from 'react';
import { useRankEstimate, validateMarks } from '@/hooks/useRankEstimate';
import type { Language } from '@/i18n';

interface RankCalculatorSectionProps {
  language: Language;
}

/**
 * RankCalculatorSection - Accepts marks input, validates client-side,
 * calls the rank estimate API, and displays the result.
 *
 * Requirements: 4.1–4.7
 */
export function RankCalculatorSection({ language }: RankCalculatorSectionProps) {
  const [marks, setMarks] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { data, isLoading, error, calculate } = useRankEstimate();

  const handleCalculate = () => {
    const validation = validateMarks(marks);
    if (!validation.valid) {
      setValidationError(validation.error ?? 'Invalid input');
      return;
    }
    setValidationError(null);
    calculate(Number(marks.trim()));
  };

  const handleRetry = () => {
    setValidationError(null);
    calculate(Number(marks.trim()));
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-5">
      <h3 className="text-sm font-bold text-indigo-700 flex items-center gap-2 mb-3">
        🧮 {language === 'hi' ? 'रैंक कैलकुलेटर' : 'Rank Calculator'}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-600 block mb-1">
            {language === 'hi' ? 'आपके अंक (150 में से)' : 'Your Marks (out of 150)'}
          </label>
          <input
            type="number"
            min="0"
            max="150"
            value={marks}
            onChange={(e) => {
              setMarks(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="e.g. 85"
            aria-label={language === 'hi' ? 'अंक दर्ज करें' : 'Enter marks'}
            aria-invalid={!!validationError}
            className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {validationError && (
            <p className="text-xs text-red-500 mt-1" role="alert">
              {validationError}
            </p>
          )}
        </div>
        <button
          onClick={handleCalculate}
          disabled={isLoading}
          className="w-full px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading
            ? (language === 'hi' ? 'गणना हो रही है...' : 'Calculating...')
            : (language === 'hi' ? 'रैंक देखें' : 'Check Rank')}
        </button>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center p-3 bg-white rounded-lg border border-indigo-200">
            <div className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-indigo-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-500">
                {language === 'hi' ? 'रैंक की गणना हो रही है...' : 'Calculating rank...'}
              </span>
            </div>
          </div>
        )}

        {/* Success State */}
        {data && !isLoading && (
          <div className="text-center p-3 bg-white rounded-lg border border-indigo-200 space-y-2">
            <p className="text-xs text-gray-500">
              {language === 'hi' ? 'अनुमानित रैंक' : 'Estimated Rank'}
            </p>
            <p className="text-2xl font-bold text-indigo-600" data-testid="estimated-rank">
              #{data.estimatedRank.toLocaleString('en-IN')}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              <div>
                <p className="text-[10px] text-gray-400">
                  {language === 'hi' ? 'कुल आवेदक' : 'Total Applicants'}
                </p>
                <p className="text-xs font-semibold text-gray-700" data-testid="total-applicants">
                  {data.totalApplicants.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">
                  {language === 'hi' ? 'अंक' : 'Marks'}
                </p>
                <p className="text-xs font-semibold text-gray-700" data-testid="marks-display">
                  {data.marks}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">
                  {language === 'hi' ? 'पर्सेंटाइल' : 'Percentile'}
                </p>
                <p className="text-xs font-semibold text-gray-700" data-testid="percentile">
                  {data.percentile.toFixed(2)}%
                </p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400">
              {language === 'hi'
                ? '(अनुमान पिछले कटऑफ पर आधारित)'
                : '(Based on previous cutoffs)'}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs text-red-600" role="alert">
              {error.message}
            </p>
            {!error.isValidationError && (
              <button
                onClick={handleRetry}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
              >
                {language === 'hi' ? 'पुनः प्रयास करें' : 'Try Again'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
