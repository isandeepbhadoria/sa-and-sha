import React from "react";
import { AlertCircle, XCircle, ArrowRight, X } from "lucide-react";

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  onConfirmCancel: (reason: string) => Promise<void>;
  loading: boolean;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onConfirmCancel,
  loading
}) => {
  const [reason, setReason] = React.useState("Ordered by mistake");
  const [customReason, setCustomReason] = React.useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === "Other" ? customReason : reason;
    if (!finalReason.trim()) return;
    await onConfirmCancel(finalReason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl p-6 relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">Cancel Order #{orderNumber}</h3>
            <p className="text-xs text-stone-500">Confirm cancellation request</p>
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 my-4">
          <p className="font-bold text-amber-900 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>Automatic Restorations</span>
          </p>
          <p className="text-amber-800">
            Cancelling this order will automatically restore any redeemed loyalty points, store credit, and inventory stock instantly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5">
              Reason for Cancellation <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 focus:outline-hidden focus:border-stone-400 font-medium text-stone-900"
            >
              <option value="Ordered by mistake">Ordered by mistake</option>
              <option value="Need to change shipping address">Need to change shipping address</option>
              <option value="Need to change size or variant">Need to change size or variant</option>
              <option value="Found a better price elsewhere">Found a better price elsewhere</option>
              <option value="Delivery date is too late">Delivery date is too late</option>
              <option value="Other">Other reason</option>
            </select>
          </div>

          {reason === "Other" && (
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                Specify Reason
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please describe why you wish to cancel..."
                rows={3}
                required
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 focus:outline-hidden focus:border-stone-400 font-medium text-stone-900 resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-xl transition-colors"
            >
              Keep Order
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-xl transition-colors inline-flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <span>Confirm Cancellation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
