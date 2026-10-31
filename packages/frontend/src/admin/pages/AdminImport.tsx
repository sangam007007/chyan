import { useState, useRef } from 'react';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface ParsedRow {
  text_en: string;
  text_hi: string;
  option_a_en: string;
  option_a_hi: string;
  option_b_en: string;
  option_b_hi: string;
  option_c_en: string;
  option_c_hi: string;
  option_d_en: string;
  option_d_hi: string;
  correct_option: string;
  explanation_en: string;
  explanation_hi: string;
  subject: string;
  topic: string;
  difficulty: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const EXPECTED_COLUMNS = [
  'text_en', 'text_hi', 'option_a_en', 'option_a_hi', 'option_b_en', 'option_b_hi',
  'option_c_en', 'option_c_hi', 'option_d_en', 'option_d_hi', 'correct_option',
  'explanation_en', 'explanation_hi', 'subject', 'topic', 'difficulty',
];

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

// ─── CSV Parser ───────────────────────────────────────────────────────

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()));
  return { headers, rows };
}

// ─── Validator ────────────────────────────────────────────────────────

function validateRows(rows: ParsedRow[]): ValidationError[] {
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 for 1-indexed + header row

    if (!row.text_en) errors.push({ row: rowNum, field: 'text_en', message: 'Question text (EN) is required' });
    if (!row.option_a_en) errors.push({ row: rowNum, field: 'option_a_en', message: 'Option A (EN) is required' });
    if (!row.option_b_en) errors.push({ row: rowNum, field: 'option_b_en', message: 'Option B (EN) is required' });
    if (!row.option_c_en) errors.push({ row: rowNum, field: 'option_c_en', message: 'Option C (EN) is required' });
    if (!row.option_d_en) errors.push({ row: rowNum, field: 'option_d_en', message: 'Option D (EN) is required' });

    const correctOpt = parseInt(row.correct_option, 10);
    if (isNaN(correctOpt) || correctOpt < 0 || correctOpt > 3) {
      errors.push({ row: rowNum, field: 'correct_option', message: 'Must be 0-3' });
    }

    if (!row.subject) errors.push({ row: rowNum, field: 'subject', message: 'Subject is required' });

    if (row.difficulty && !VALID_DIFFICULTIES.includes(row.difficulty.toLowerCase())) {
      errors.push({ row: rowNum, field: 'difficulty', message: 'Must be easy, medium, or hard' });
    }
  });

  return errors;
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  // ─── File Handling ──────────────────────────────────────────────────

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setParseError('Please select a .csv file');
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setImportResult(null);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { headers, rows } = parseCSV(content);

      // Validate headers
      const missingCols = EXPECTED_COLUMNS.filter((col) => !headers.includes(col));
      if (missingCols.length > 0) {
        setParseError(`Missing columns: ${missingCols.join(', ')}`);
        setParsedRows([]);
        return;
      }

      // Map rows to objects
      const mapped: ParsedRow[] = rows.map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] || '';
        });
        return obj as unknown as ParsedRow;
      });

      setParsedRows(mapped);
      setValidationErrors(validateRows(mapped));
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // ─── Import Handler ─────────────────────────────────────────────────

  const handleImport = async () => {
    const validRows = parsedRows.filter((_, index) => {
      return !validationErrors.some((err) => err.row === index + 2);
    });

    if (validRows.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await api.post('/api/questions', {
          textEn: row.text_en,
          textHi: row.text_hi || null,
          options: [
            { textEn: row.option_a_en, textHi: row.option_a_hi || null },
            { textEn: row.option_b_en, textHi: row.option_b_hi || null },
            { textEn: row.option_c_en, textHi: row.option_c_hi || null },
            { textEn: row.option_d_en, textHi: row.option_d_hi || null },
          ],
          correctOption: parseInt(row.correct_option, 10),
          explanationEn: row.explanation_en || null,
          explanationHi: row.explanation_hi || null,
          subject: row.subject,
          topic: row.topic || null,
          difficulty: row.difficulty?.toLowerCase() || 'medium',
        });
        success++;
      } catch {
        failed++;
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImportResult({ total: validRows.length, success, failed });
    setImporting(false);
  };

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setValidationErrors([]);
    setParseError(null);
    setImportResult(null);
    setImportProgress(0);
  };

  // ─── Computed ───────────────────────────────────────────────────────

  const errorRowCount = new Set(validationErrors.map((e) => e.row)).size;
  const validCount = parsedRows.length - errorRowCount;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Bulk Import</h1>

      {/* Upload Area */}
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`bg-white rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <span className="text-4xl block mb-3">📥</span>
          <p className="text-sm text-gray-600 mb-2">Drag & drop a CSV file here, or click to select</p>
          <p className="text-xs text-gray-400 mb-4">Expected columns: text_en, text_hi, option_a_en, ..., subject, topic, difficulty</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Select CSV File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {/* Parse Error */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{parseError}</p>
          <button onClick={reset} className="text-sm text-red-600 underline mt-2">Try another file</button>
        </div>
      )}

      {/* Preview */}
      {file && parsedRows.length > 0 && !importResult && (
        <>
          {/* File info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{parsedRows.length} rows parsed • {validCount} valid • {errorRowCount} with errors</p>
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">Change file</button>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-700 mb-2">
                {validationErrors.length} error(s) in {errorRowCount} row(s)
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validationErrors.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-xs text-red-600">
                    Row {err.row}, {err.field}: {err.message}
                  </p>
                ))}
                {validationErrors.length > 20 && (
                  <p className="text-xs text-red-500 italic">...and {validationErrors.length - 20} more errors</p>
                )}
              </div>
            </div>
          )}

          {/* Preview Table (first 10 rows) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Preview (first 10 rows)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-2 pr-3 font-medium">#</th>
                    <th className="pb-2 pr-3 font-medium">Question (EN)</th>
                    <th className="pb-2 pr-3 font-medium">Subject</th>
                    <th className="pb-2 pr-3 font-medium">Difficulty</th>
                    <th className="pb-2 font-medium">Correct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parsedRows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 pr-3 text-gray-400">{i + 1}</td>
                      <td className="py-2 pr-3 text-gray-900 max-w-[200px] truncate">{row.text_en}</td>
                      <td className="py-2 pr-3 text-gray-700">{row.subject}</td>
                      <td className="py-2 pr-3 text-gray-700">{row.difficulty}</td>
                      <td className="py-2 text-gray-700">{row.correct_option}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : `Import ${validCount} Questions`}
            </button>
            {importing && (
              <div className="flex-1 max-w-xs">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all duration-300 rounded-full"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{importProgress}% complete</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <span className="text-4xl block mb-3">{importResult.failed === 0 ? '✅' : '⚠️'}</span>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Import Complete</h2>
          <p className="text-sm text-gray-600">
            Imported <strong className="text-green-700">{importResult.success}</strong> of{' '}
            <strong>{importResult.total}</strong> questions.
            {importResult.failed > 0 && (
              <span className="text-red-600"> {importResult.failed} failed.</span>
            )}
          </p>
          <button
            onClick={reset}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Import More
          </button>
        </div>
      )}
    </div>
  );
}
