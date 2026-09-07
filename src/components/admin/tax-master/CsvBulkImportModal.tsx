import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import { ProductTaxRecord } from './types';

interface CsvBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreview: (csvContent: string) => Promise<any>;
  onCommit: (records: any[]) => Promise<boolean>;
  loading: boolean;
}

const SAMPLE_CSV = `scope_type,scope_value,hsn_code,gst_rate,rate_mode,effective_from,notes
CATEGORY,dresses,6204,12,FIXED,2026-01-01,Category rule for dresses
PRODUCT,dr-1,6204,5,FIXED,2026-01-01,Product override for floral dress
SKU,SS-DR-PNK-M,6204,5,FIXED,2026-01-01,SKU override for pink medium dress
DEFAULT,DEFAULT,6204,12,FIXED,2026-01-01,Global default fallback rule`;

export const CsvBulkImportModal: React.FC<CsvBulkImportModalProps> = ({
  isOpen,
  onClose,
  onPreview,
  onCommit,
  loading
}) => {
  const [csvText, setCsvText] = useState('');
  const [copiedSample, setCopiedSample] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  if (!isOpen) return null;

  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_CSV);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        setPreviewResult(null);
        setPreviewError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleValidateAndPreview = async () => {
    if (!csvText.trim()) {
      setPreviewError('Please enter or upload CSV content to validate.');
      return;
    }
    setPreviewError(null);
    try {
      const res = await onPreview(csvText);
      setPreviewResult(res);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to parse and validate CSV.');
    }
  };

  const handleCommit = async () => {
    if (!previewResult || !previewResult.records || previewResult.records.length === 0) {
      setPreviewError('No valid records to commit.');
      return;
    }
    setIsCommitting(true);
    try {
      const success = await onCommit(previewResult.records);
      if (success) {
        onClose();
      }
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-stone-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Bulk Import Product Tax Master Rules</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Upload CSV containing Category, Product, SKU, or Default tax rules with date versioning.
            </p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions & Sample */}
        <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-900">Supported Columns Schema:</span>
            <button
              onClick={handleCopySample}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950"
            >
              {copiedSample ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSample ? 'Copied Template!' : 'Copy Sample Template'}
            </button>
          </div>
          <p className="font-mono text-[11px] bg-stone-100 p-2 rounded border border-stone-200 text-stone-800 overflow-x-auto">
            scope_type,scope_value,hsn_code,gst_rate,rate_mode,effective_from,notes
          </p>
          <p className="text-[11px] text-stone-500">
            Accepts both scope-based rules (<code>scope_type, scope_value</code>) and legacy SKU format (<code>sku, hsn_code, gst_rate</code>).
          </p>
        </div>

        {/* Input area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-stone-800 uppercase">
              CSV Content or File Upload
            </label>
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg border border-stone-300 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Upload .csv File
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setPreviewResult(null);
              setPreviewError(null);
            }}
            placeholder="Paste raw CSV content here..."
            rows={5}
            className="w-full p-3 font-mono text-xs bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:outline-none"
          />
        </div>

        {previewError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{previewError}</span>
          </div>
        )}

        {/* Preview Results Table */}
        {previewResult && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-stone-900">Validation Summary:</span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  {previewResult.valid_count ?? previewResult.valid_rows ?? 0} Valid
                </span>
                {(previewResult.error_count ?? previewResult.invalid_rows ?? 0) > 0 && (
                  <span className="text-xs font-semibold text-red-800 bg-red-100 px-2 py-0.5 rounded">
                    {previewResult.error_count ?? previewResult.invalid_rows} Invalid
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-[11px] uppercase font-semibold text-stone-500 sticky top-0">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">Scope</th>
                    <th className="p-2">Target</th>
                    <th className="p-2">HSN</th>
                    <th className="p-2">Rate / Mode</th>
                    <th className="p-2">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(previewResult.rows || []).map((row: any, i: number) => (
                    <tr key={i} className={row.valid ? 'hover:bg-stone-50' : 'bg-red-50/50'}>
                      <td className="p-2 font-mono text-stone-500">#{row.row_number || i + 1}</td>
                      <td className="p-2 font-bold text-stone-800">{row.data?.scope_type || 'SKU'}</td>
                      <td className="p-2 font-medium">{row.data?.scope_value || row.data?.sku || '—'}</td>
                      <td className="p-2 font-mono">{row.data?.hsn_code || '—'}</td>
                      <td className="p-2">
                        {row.data?.rate_mode === 'VALUE_BAND'
                          ? 'Value Band'
                          : `${row.data?.gst_rate}%`}
                      </td>
                      <td className="p-2">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Valid
                          </span>
                        ) : (
                          <div className="text-red-700 text-[11px] font-medium">
                            {row.errors?.join('; ') || 'Invalid row'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading || isCommitting}
            className="px-4 py-2 text-stone-600 hover:text-stone-900 text-xs font-semibold"
          >
            Cancel
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleValidateAndPreview}
              disabled={loading || !csvText.trim()}
              className="px-4 py-2 bg-stone-100 text-stone-800 border border-stone-300 rounded-lg text-xs font-bold hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Validate & Preview'}
            </button>

            {previewResult && (previewResult.valid_count ?? previewResult.valid_rows ?? 0) > 0 && (
              <button
                type="button"
                onClick={handleCommit}
                disabled={isCommitting}
                className="px-5 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 transition-colors disabled:opacity-50"
              >
                {isCommitting
                  ? 'Importing...'
                  : `Commit ${previewResult.valid_count ?? previewResult.valid_rows} Rules`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
