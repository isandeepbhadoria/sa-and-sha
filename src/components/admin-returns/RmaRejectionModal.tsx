import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface RmaRejectionModalProps {
  rmaNumber: string;
  onConfirm: (payload: { rejection_reason: string; customer_explanation?: string; internal_note?: string }) => void;
  onClose: () => void;
  loading?: boolean;
}

const REJECTION_REASONS = [
  "Outside 7-day policy window",
  "Product shows clear signs of wear / usage",
  "Original brand tags or packaging missing",
  "Damage not covered under return warranty",
  "Incomplete or insufficient photo evidence",
  "Item not eligible for return (final sale / accessory)",
  "Duplicate return request",
  "Suspected fraudulent claim"
];

export const RmaRejectionModal: React.FC<RmaRejectionModalProps> = ({
  rmaNumber,
  onConfirm,
  onClose,
  loading
}) => {
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [explanation, setExplanation] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      rejection_reason: reason,
      customer_explanation: explanation.trim(),
      internal_note: internalNote.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 p-6 border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Reject Return Request ({rmaNumber})</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">Standard Rejection Reason (Mandatory)</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-rose-500"
            >
              {REJECTION_REASONS.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Customer-Facing Explanation</label>
            <textarea
              rows={3}
              placeholder="Detailed message that will be sent to customer via email & Notification Center..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Internal Note (Confidential)</label>
            <input
              type="text"
              placeholder="Staff internal notes..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:border-rose-500"
            />
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
              disabled={loading}
              className="px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
