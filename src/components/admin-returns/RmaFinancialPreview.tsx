import React from "react";
import { DollarSign, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";

export interface RmaFinancialPreviewProps {
  financialPreview?: {
    eligible_item_value: number;
    return_pickup_fee: number;
    original_payment_method: string;
    estimated_refund_source: number;
    estimated_store_credit: number;
    points_restoration_estimate: number;
    earned_points_clawback_estimate: number;
  };
  resolution: string;
}

export const RmaFinancialPreview: React.FC<RmaFinancialPreviewProps> = ({
  financialPreview,
  resolution
}) => {
  if (!financialPreview) return null;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          Financial Allocation Preview (Read-Only)
        </h4>
        <span className="text-[10px] font-bold text-stone-500 uppercase bg-stone-200 px-2 py-0.5 rounded">
          No Auto-Execution
        </span>
      </div>

      <div className="space-y-1.5 text-stone-600">
        <div className="flex justify-between">
          <span>Eligible Items Gross Value:</span>
          <span className="font-semibold text-stone-900">₹{financialPreview.eligible_item_value.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-rose-600">
          <span>Return Pickup Fee Deducted:</span>
          <span className="font-semibold">-₹{financialPreview.return_pickup_fee.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between">
          <span>Original Payment Method:</span>
          <span className="font-semibold text-stone-800">{financialPreview.original_payment_method}</span>
        </div>
      </div>

      <div className="border-t border-stone-200 pt-2 space-y-1.5 font-medium">
        {resolution === "refund_source" ? (
          <div className="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
            <span>Estimated Refund to Source:</span>
            <span>₹{financialPreview.estimated_refund_source.toLocaleString("en-IN")}</span>
          </div>
        ) : (
          <div className="flex justify-between text-sm font-bold text-purple-700 bg-purple-50 p-2.5 rounded-lg border border-purple-200">
            <span>Estimated Store Credit Issuance:</span>
            <span>₹{financialPreview.estimated_store_credit.toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      <div className="text-[11px] text-stone-500 pt-1 space-y-0.5 italic">
        <div>• Loyalty Points Restoration Estimate: +{financialPreview.points_restoration_estimate} pts</div>
        <div>• Earned Points Clawback Estimate: -{financialPreview.earned_points_clawback_estimate} pts</div>
      </div>
    </div>
  );
};
