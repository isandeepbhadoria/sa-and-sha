import React, { useState } from "react";
import { CheckCircle2, X, AlertCircle } from "lucide-react";

export interface RmaApprovalModalProps {
  rmaNumber: string;
  items: any[];
  resolution: string;
  onConfirm: (payload: { approved_items: any[]; resolution: string; pickup_fee_policy: string; note: string }) => void;
  onClose: () => void;
  loading?: boolean;
}

export const RmaApprovalModal: React.FC<RmaApprovalModalProps> = ({
  rmaNumber,
  items,
  resolution,
  onConfirm,
  onClose,
  loading
}) => {
  const [selectedResolution, setSelectedResolution] = useState(resolution || "refund_source");
  const [pickupFeePolicy, setPickupFeePolicy] = useState("standard_100");
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      approved_items: items,
      resolution: selectedResolution,
      pickup_fee_policy: pickupFeePolicy,
      note: note.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 p-6 border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Approve Return Request ({rmaNumber})</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">Approved Resolution Type</label>
            <select
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B08D57]"
            >
              <option value="refund_source">Refund to Original Payment Source</option>
              <option value="store_credit">Issue Store Credit / Gift Voucher</option>
              <option value="exchange">Exchange Item Variant</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Return Pickup Fee Policy</label>
            <select
              value={pickupFeePolicy}
              onChange={(e) => setPickupFeePolicy(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B08D57]"
            >
              <option value="standard_100">Deduct Standard ₹100 Reverse Pickup Fee</option>
              <option value="waived">Waive Pickup Fee (Defective / Wrong Item Sent)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Approval Note / Conditions (Optional)</label>
            <textarea
              rows={3}
              placeholder="Provide internal instructions or notes for approval..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B08D57]"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Workflow Notice
            </div>
            <p>
              Approval moves status to 'Approved' and unlocks Reverse Pickup Scheduling. Financial refund execution or inventory adjustment will take place in subsequent inspection phases.
            </p>
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
              className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Processing..." : "Confirm Approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
