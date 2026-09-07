import React from "react";
import { CreditCard, Tag, Award, Wallet, ShieldCheck } from "lucide-react";

interface OrderPaymentSummaryProps {
  subtotal: number;
  discount: number;
  promoCode?: string | null;
  loyaltyPointsRedeemed?: number;
  storeCreditRedeemedRupees?: number;
  shippingCost: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  refundStatus?: string | null;
  refundAmount?: number;
  pointsRestored?: number;
  creditRestoredRupees?: number;
}

export const OrderPaymentSummary: React.FC<OrderPaymentSummaryProps> = ({
  subtotal,
  discount,
  promoCode,
  loyaltyPointsRedeemed = 0,
  storeCreditRedeemedRupees = 0,
  shippingCost,
  grandTotal,
  paymentMethod,
  paymentStatus,
  refundStatus,
  refundAmount = 0,
  pointsRestored = 0,
  creditRestoredRupees = 0
}) => {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
      <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-amber-800" />
        <span>Payment & Order Summary</span>
      </h3>

      <div className="space-y-2.5 text-xs text-stone-600 border-b border-stone-100 pb-4">
        <div className="flex justify-between">
          <span>Items Subtotal</span>
          <span className="font-mono text-stone-900">₹{subtotal.toLocaleString("en-IN")}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              <span>Promo Discount {promoCode ? `(${promoCode})` : ""}</span>
            </span>
            <span className="font-mono">-₹{discount.toLocaleString("en-IN")}</span>
          </div>
        )}

        {loyaltyPointsRedeemed > 0 && (
          <div className="flex justify-between text-amber-800">
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              <span>Loyalty Points Discount ({loyaltyPointsRedeemed} pts)</span>
            </span>
            <span className="font-mono">-₹{loyaltyPointsRedeemed.toLocaleString("en-IN")}</span>
          </div>
        )}

        {storeCreditRedeemedRupees > 0 && (
          <div className="flex justify-between text-stone-800">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              <span>Store Credit Applied</span>
            </span>
            <span className="font-mono">-₹{storeCreditRedeemedRupees.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Shipping Fee</span>
          <span className="font-mono text-stone-900">
            {shippingCost > 0 ? `₹${shippingCost.toLocaleString("en-IN")}` : "FREE"}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center text-sm font-bold text-stone-900 pt-1">
        <span>Grand Total Paid</span>
        <span className="text-base font-serif font-bold text-stone-900">
          ₹{grandTotal.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="bg-stone-50 rounded-lg p-3 border border-stone-200 text-xs text-stone-700 flex items-center justify-between">
        <div>
          <span className="font-semibold block">Method: {paymentMethod}</span>
          <span className="text-stone-500">Status: {paymentStatus}</span>
        </div>
        <ShieldCheck className="w-5 h-5 text-emerald-700" />
      </div>

      {/* Refunds Section if applicable */}
      {(refundStatus || refundAmount > 0 || pointsRestored > 0 || creditRestoredRupees > 0) && (
        <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-200 text-xs space-y-2">
          <p className="font-bold text-purple-900 text-sm">Refund & Restoration Breakdown</p>
          {refundAmount > 0 && (
            <div className="flex justify-between text-purple-800">
              <span>Payment Refunded</span>
              <span className="font-mono font-bold">₹{refundAmount.toLocaleString("en-IN")}</span>
            </div>
          )}
          {pointsRestored > 0 && (
            <div className="flex justify-between text-purple-800">
              <span>Points Restored</span>
              <span className="font-mono font-bold">+{pointsRestored} pts</span>
            </div>
          )}
          {creditRestoredRupees > 0 && (
            <div className="flex justify-between text-purple-800">
              <span>Store Credit Restored</span>
              <span className="font-mono font-bold">₹{creditRestoredRupees.toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
