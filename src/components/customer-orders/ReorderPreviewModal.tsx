import React from "react";
import { ShoppingBag, AlertTriangle, CheckCircle2, XCircle, ArrowRight, X } from "lucide-react";

export interface ReorderPreviewData {
  availableItems: any[];
  unavailableItems: any[];
  changedPriceItems: any[];
}

interface ReorderPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: ReorderPreviewData | null;
  loading: boolean;
  onConfirmAddToCart: (items: any[]) => void;
}

export const ReorderPreviewModal: React.FC<ReorderPreviewModalProps> = ({
  isOpen,
  onClose,
  previewData,
  loading,
  onConfirmAddToCart
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl p-6 relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">Buy Again / Reorder Preview</h3>
            <p className="text-xs text-stone-500">Prices and stock revalidated against current inventory</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-stone-500 font-medium">Revalidating product prices & stock availability...</p>
          </div>
        ) : !previewData ? (
          <div className="py-8 text-center text-xs text-stone-500">
            Failed to load reorder preview.
          </div>
        ) : (
          <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Price Changes Warning if any */}
            {previewData.changedPriceItems && previewData.changedPriceItems.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Price Adjustments Detected</span>
                </p>
                <p className="text-amber-800">
                  Some items have updated pricing since your original order date:
                </p>
                <ul className="list-disc pl-5 text-amber-900 space-y-0.5 mt-1">
                  {previewData.changedPriceItems.map((item, i) => (
                    <li key={i}>
                      <strong>{item.name}</strong>: Was ₹{item.oldPrice} → Now ₹{item.price}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Unavailable Items if any */}
            {previewData.unavailableItems && previewData.unavailableItems.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-red-900 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-700" />
                  <span>Unavailable Items ({previewData.unavailableItems.length})</span>
                </p>
                <p className="text-red-800">
                  The following items cannot be added to cart:
                </p>
                <ul className="list-disc pl-5 text-red-900 space-y-0.5 mt-1">
                  {previewData.unavailableItems.map((item, i) => (
                    <li key={i}>
                      <strong>{item.name || item.title}</strong> — {item.reason || "Out of stock"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Available Items List */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Available Items ({previewData.availableItems.length})
              </p>
              {previewData.availableItems.length === 0 ? (
                <p className="text-xs text-stone-500 py-4 text-center bg-stone-50 rounded-xl border border-stone-200">
                  None of the items from this order are currently available for purchase.
                </p>
              ) : (
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl p-3 bg-stone-50">
                  {previewData.availableItems.map((item, idx) => (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-10 h-12 object-cover rounded-md border" />
                        )}
                        <div>
                          <p className="font-semibold text-stone-900">{item.name}</p>
                          <p className="text-stone-500">
                            Qty: {item.quantity} • Size: {item.size}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-bold text-stone-900">
                        ₹{item.price.toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-xl transition-colors"
          >
            Close
          </button>

          {previewData && previewData.availableItems.length > 0 && (
            <button
              onClick={() => onConfirmAddToCart(previewData.availableItems)}
              className="px-5 py-2.5 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors inline-flex items-center gap-2 shadow-xs"
            >
              <span>Add Available Items to Cart</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
