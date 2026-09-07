import React, { useState } from "react";
import { Truck, X } from "lucide-react";

export interface RmaPickupModalProps {
  rmaNumber: string;
  onConfirm: (payload: {
    courier: string;
    pickup_date: string;
    time_window?: string;
    awb_number?: string;
    tracking_url?: string;
    instructions?: string;
  }) => void;
  onClose: () => void;
  loading?: boolean;
}

const COURIER_PARTNERS = [
  "BlueDart Express",
  "Delhivery",
  "Shiprocket Reverse",
  "Xpressbees",
  "Shadowfax",
  "DTDC Courier"
];

export const RmaPickupModal: React.FC<RmaPickupModalProps> = ({
  rmaNumber,
  onConfirm,
  onClose,
  loading
}) => {
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [courier, setCourier] = useState(COURIER_PARTNERS[0]);
  const [pickupDate, setPickupDate] = useState(tomorrowStr);
  const [timeWindow, setTimeWindow] = useState("10:00 AM - 02:00 PM");
  const [awbNumber, setAwbNumber] = useState(`RAWB-${Date.now().toString().slice(-8)}`);
  const [instructions, setInstructions] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupDate) return;
    onConfirm({
      courier,
      pickup_date: pickupDate,
      time_window: timeWindow,
      awb_number: awbNumber.trim(),
      instructions: instructions.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 p-6 border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2 text-[#B85C38] font-bold text-sm">
            <Truck className="w-5 h-5" />
            <span>Schedule Reverse Pickup ({rmaNumber})</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">Reverse Logistics Partner</label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B85C38]"
            >
              {COURIER_PARTNERS.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1">Pickup Scheduled Date</label>
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B85C38]"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">Time Window</label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B85C38]"
              >
                <option value="09:00 AM - 01:00 PM">Morning (09 AM - 01 PM)</option>
                <option value="01:00 PM - 06:00 PM">Afternoon (01 PM - 06 PM)</option>
                <option value="10:00 AM - 06:00 PM">Full Day (10 AM - 06 PM)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Reverse AWB / Airway Bill Number</label>
            <input
              type="text"
              placeholder="e.g. RAWB-982132"
              value={awbNumber}
              onChange={(e) => setAwbNumber(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B85C38]"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Driver / Pickup Instructions (Optional)</label>
            <textarea
              rows={2}
              placeholder="Instructions for courier driver..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:border-[#B85C38]"
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
              className="px-5 py-2 font-bold text-white bg-[#B85C38] hover:bg-[#a04e2e] rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Scheduling..." : "Schedule Pickup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
