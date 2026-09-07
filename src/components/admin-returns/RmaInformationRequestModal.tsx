import React, { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export interface RmaInformationRequestModalProps {
  rmaNumber: string;
  onConfirm: (payload: { details: string; due_days: number }) => void;
  onClose: () => void;
  loading?: boolean;
}

export const RmaInformationRequestModal: React.FC<RmaInformationRequestModalProps> = ({
  rmaNumber,
  onConfirm,
  onClose,
  loading
}) => {
  const [details, setDetails] = useState("");
  const [dueDays, setDueDays] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) return;
    onConfirm({
      details: details.trim(),
      due_days: dueDays
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 p-6 border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
            <HelpCircle className="w-5 h-5" />
            <span>Request Additional Information ({rmaNumber})</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">Information Required from Customer</label>
            <textarea
              rows={4}
              placeholder="e.g. Please upload clear photos of the brand barcode tag and close-up of defect..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Response Due Window (Days)</label>
            <select
              value={dueDays}
              onChange={(e) => setDueDays(Number(e.target.value))}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-amber-500"
            >
              <option value={2}>2 Days</option>
              <option value={3}>3 Days</option>
              <option value={5}>5 Days</option>
              <option value={7}>7 Days</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-stone-600 hover:text-stone-900 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!details.trim() || loading}
              className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Sending..." : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
