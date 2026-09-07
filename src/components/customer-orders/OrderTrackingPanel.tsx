import React from "react";
import { Truck, ExternalLink, Calendar, MapPin, Copy, Check } from "lucide-react";

interface OrderTrackingPanelProps {
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDelivery?: string | null;
  city?: string;
  state?: string;
}

export const OrderTrackingPanel: React.FC<OrderTrackingPanelProps> = ({
  courierName,
  trackingNumber,
  trackingUrl,
  estimatedDelivery,
  city,
  state
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (trackingNumber) {
      navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!trackingNumber && !courierName) {
    return (
      <div className="bg-stone-50 rounded-xl border border-stone-200 p-6 text-center">
        <Truck className="w-8 h-8 text-stone-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-stone-800">Tracking Information Pending</p>
        <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
          Tracking details and AWB numbers are generated automatically as soon as your garment is packed and dispatched.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-amber-800" />
          <span>Shipment & Courier Tracking</span>
        </h3>

        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
          >
            <span>Live Carrier Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="bg-stone-50 rounded-lg p-3.5 border border-stone-200">
          <span className="text-xs text-stone-500 block">Logistics Partner</span>
          <span className="text-sm font-bold text-stone-900 block mt-0.5">
            {courierName || "Standard Express Courier"}
          </span>
        </div>

        <div className="bg-stone-50 rounded-lg p-3.5 border border-stone-200">
          <span className="text-xs text-stone-500 block">AWB / Tracking Number</span>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm font-mono font-bold text-stone-900">
              {trackingNumber || "N/A"}
            </span>
            {trackingNumber && (
              <button
                onClick={handleCopy}
                className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1"
                title="Copy AWB Number"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {estimatedDelivery && (
        <div className="flex items-center gap-2 text-xs text-stone-700 bg-sky-50 px-3 py-2 rounded-lg border border-sky-200">
          <Calendar className="w-4 h-4 text-sky-700" />
          <span>Estimated Delivery Date: <strong className="text-sky-900">{estimatedDelivery}</strong></span>
        </div>
      )}

      {city && (
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <MapPin className="w-4 h-4 text-stone-400" />
          <span>Destined for {city}, {state}</span>
        </div>
      )}
    </div>
  );
};
