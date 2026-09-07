import React from "react";
import { RefreshCw, Package, CheckCircle2, AlertTriangle } from "lucide-react";

export interface RmaExchangePreviewProps {
  exchangePreview?: Array<{
    product_id: string;
    item_name: string;
    original_variant: string;
    requested_variant: string;
    stock_available: boolean;
    current_inventory_count: number;
    price_difference: number;
  }>;
}

export const RmaExchangePreview: React.FC<RmaExchangePreviewProps> = ({ exchangePreview }) => {
  if (!exchangePreview || exchangePreview.length === 0) return null;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-purple-600" />
          Requested Exchange Stock Availability
        </h4>
        <span className="text-[10px] font-bold text-stone-500 uppercase bg-stone-200 px-2 py-0.5 rounded">
          Stock Preview
        </span>
      </div>

      <div className="space-y-2">
        {exchangePreview.map((item, idx) => (
          <div key={idx} className="bg-white p-3 rounded-lg border border-stone-200 space-y-1.5">
            <div className="font-semibold text-stone-900">{item.item_name}</div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
              <div>
                <span className="text-stone-400">Original:</span> {item.original_variant} →{" "}
                <span className="font-bold text-[#B85C38]">Requested: {item.requested_variant}</span>
              </div>
              <div className="flex items-center gap-1">
                {item.stock_available ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    In Stock ({item.current_inventory_count} available)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    Out of Stock
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
