import React from "react";
import { Link } from "react-router-dom";
import { Package, Truck, ArrowRight, RotateCcw, XCircle, FileText, CheckCircle2, Clock } from "lucide-react";

export interface OrderSummaryItem {
  id: string;
  order_number: string;
  order_status: string;
  status_label: string;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  items_count: number;
  thumbnail: string;
  city: string;
  state: string;
  created_at: string;
  tracking_number: string | null;
  courier_name: string | null;
  can_cancel: boolean;
  can_return: boolean;
}

interface OrderCardProps {
  order: OrderSummaryItem;
  onCancelClick?: (orderId: string) => void;
  onReorderClick?: (orderId: string) => void;
  onInvoiceClick?: (orderId: string) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onCancelClick,
  onReorderClick,
  onInvoiceClick
}) => {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "delivered":
      case "completed":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "shipped":
      case "in_transit":
      case "out_for_delivery":
        return "bg-sky-50 text-sky-800 border-sky-200";
      case "processing":
      case "packed":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "cancelled":
        return "bg-stone-100 text-stone-600 border-stone-200";
      case "refunded":
      case "returned":
        return "bg-purple-50 text-purple-800 border-purple-200";
      default:
        return "bg-stone-100 text-stone-800 border-stone-200";
    }
  };

  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : "Recently";

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all p-5">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-stone-900 text-base">#{order.order_number}</span>
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadgeClass(
                order.order_status
              )}`}
            >
              {order.status_label}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Placing Date: {formattedDate}</p>
        </div>

        <div className="text-right">
          <p className="text-lg font-serif font-bold text-stone-900">
            ₹{order.total_amount.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-stone-500 font-medium">
            {order.payment_method} • {order.payment_status}
          </p>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-20 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {order.thumbnail ? (
              <img
                src={order.thumbnail}
                alt={`Order #${order.order_number}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-6 h-6 text-stone-400" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-900 truncate">
              {order.items_count} {order.items_count === 1 ? "Item" : "Items"} Ordered
            </p>
            {order.city && (
              <p className="text-xs text-stone-500 mt-0.5">
                Delivering to {order.city}, {order.state}
              </p>
            )}

            {order.tracking_number && (
              <div className="flex items-center gap-1.5 text-xs text-stone-600 mt-2 font-mono bg-stone-50 px-2 py-1 rounded-md border border-stone-200 w-fit">
                <Truck className="w-3.5 h-3.5 text-stone-500" />
                <span>
                  {order.courier_name || "Courier"}: {order.tracking_number}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onInvoiceClick && (
            <button
              onClick={() => onInvoiceClick(order.order_number)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              <span>Invoice</span>
            </button>
          )}

          {onReorderClick && (
            <button
              onClick={() => onReorderClick(order.order_number)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Buy Again</span>
            </button>
          )}

          {order.can_cancel && onCancelClick && (
            <button
              onClick={() => onCancelClick(order.order_number)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Cancel</span>
            </button>
          )}
        </div>

        <Link
          to={`/account/orders/${order.order_number}`}
          className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors ml-auto"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
