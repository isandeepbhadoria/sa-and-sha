import React from "react";
import { Package } from "lucide-react";

export interface OrderLineItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  total_price: number;
  image: string;
  size: string;
  color: string;
}

interface OrderItemsProps {
  items: OrderLineItem[];
  onReviewClick?: (productId: string, productName: string) => void;
  isDelivered?: boolean;
}

export const OrderItems: React.FC<OrderItemsProps> = ({
  items,
  onReviewClick,
  isDelivered = false
}) => {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6">
      <h3 className="text-base font-bold text-stone-900 mb-4 flex items-center justify-between">
        <span>Order Items ({items.length})</span>
        <span className="text-xs font-normal text-stone-500">Immutable Snapshot</span>
      </h3>

      <div className="divide-y divide-stone-100">
        {items.map((item, index) => (
          <div key={`${item.product_id}-${index}`} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-20 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-6 h-6 text-stone-400" />
                )}
              </div>

              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-stone-900 truncate">{item.name}</h4>
                <p className="text-xs text-stone-500 mt-1 space-x-2">
                  {item.size && <span>Size: <strong className="text-stone-700">{item.size}</strong></span>}
                  {item.color && <span>• Color: <strong className="text-stone-700">{item.color}</strong></span>}
                  <span>• Qty: <strong className="text-stone-700">{item.quantity}</strong></span>
                </p>
                <p className="text-xs font-medium text-stone-600 mt-1">
                  ₹{item.price.toLocaleString("en-IN")} each
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold font-serif text-stone-900">
                ₹{item.total_price.toLocaleString("en-IN")}
              </p>

              {isDelivered && onReviewClick && (
                <button
                  onClick={() => onReviewClick(item.product_id, item.name)}
                  className="mt-2 text-xs font-medium text-amber-800 hover:text-amber-900 underline block"
                >
                  Write Review
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
