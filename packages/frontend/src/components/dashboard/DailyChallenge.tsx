import { useState } from 'react';

interface DailyChallengeProps {
  language: 'hi' | 'en';
}

interface QuestionOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

interface DailyQuestion {
  id: string;
  questionText: string;
  options: QuestionOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

// Mock data — will be replaced by API later
const MOCK_QUESTION_HI: DailyQuestion = {
  id: 'daily-1',
  questionText: 'पियाजे के अनुसार, संज्ञानात्मक विकास की कितनी अवस्थाएं होती हैं?',
  options: [
    { key: 'A', text: '3 अवस्थाएं' },
    { key: 'B', text: '4 अवस्थाएं' },
    { key: 'C', text: '5 अवस्थाएं' },
    { key: 'D', text: '6 अवस्थाएं' },
  ],
  correctAnswer: 'B',
};

const MOCK_QUESTION_EN: DailyQuestion = {
  id: 'daily-1',
  questionText: 'According to Piaget, how many stages of cognitive development are there?',
  options: [
    { key: 'A', text: '3 stages' },
    { key: 'B', text: '4 stages' },
    { key: 'C', text: '5 stages' },
    { key: 'D', text: '6 stages' },
  ],
  correctAnswer: 'B',
};

/**
 * DailyChallenge — Shows one daily practice question on the dashboard.
 * Users can select an answer and submit. Shows correct/incorrect feedback.
 */
export function DailyChallenge({ language }: DailyChallengeProps) {
  const question = language === 'hi' ? MOCK_QUESTION_HI : MOCK_QUESTION_EN;
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (selectedOption) {
      setSubmitted(true);
    }
  };

  const handleRetry = () => {
    setSelectedOption(null);
    setSubmitted(false);
  };

  const isCorrect = submitted && selectedOption === question.correctAnswer;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <span className="text-base">💡</span>
          {language === 'hi' ? 'आज की चुनौती' : "Today's Challenge"}
        </h3>
        <button
          onClick={handleRetry}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          {language === 'hi' ? 'पुनः प्रयास' : 'Retry'}
        </button>
      </div>

      {/* Question */}
      <p className="text-sm text-gray-700 mb-3 leading-relaxed">
        {question.questionText}
      </p>

      {/* Options */}
      <div className="space-y-2 mb-3">
        {question.options.map((opt) => {
          let optionStyle = 'border-gray-200 bg-gray-50 text-gray-700';

          if (submitted) {
            if (opt.key === question.correctAnswer) {
              optionStyle = 'border-emerald-400 bg-emerald-50 text-emerald-700';
            } else if (opt.key === selectedOption && opt.key !== question.correctAnswer) {
              optionStyle = 'border-red-400 bg-red-50 text-red-700';
            }
          } else if (selectedOption === opt.key) {
            optionStyle = 'border-indigo-400 bg-indigo-50 text-indigo-700';
          }

          return (
            <button
              key={opt.key}
              onClick={() => !submitted && setSelectedOption(opt.key)}
              disabled={submitted}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all ${optionStyle} ${
                !submitted ? 'hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer' : 'cursor-default'
              }`}
            >
              <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0">
                {opt.key}
              </span>
              <span>{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Submit / Feedback */}
      <div className="flex items-center justify-between">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedOption}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {language === 'hi' ? 'उत्तर दें' : 'Answer'}
          </button>
        ) : (
          <p className={`text-xs font-semibold ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
            {isCorrect
              ? (language === 'hi' ? '✅ सही उत्तर!' : '✅ Correct!')
              : (language === 'hi' ? '❌ गलत उत्तर' : '❌ Incorrect')}
          </p>
        )}
      </div>
    </div>
  );
}
