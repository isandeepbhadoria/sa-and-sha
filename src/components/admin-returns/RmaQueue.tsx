import React from "react";
import { Eye, Clock, ShieldAlert, CheckCircle2, UserCheck, Tag, ArrowUpRight, Camera } from "lucide-react";

export interface RmaQueueItem {
  id: string;
  rma_number: string;
  order_id: string;
  customer_profile_id: string;
  customer_name: string;
  customer_email_masked: string;
  customer_phone_masked: string;
  request_type: string;
  resolution: string;
  items_count: number;
  status: string;
  status_label: string;
  priority: string;
  sla_due_at: string;
  sla_state: "on_time" | "due_soon" | "overdue";
  pickup_status: string;
  courier: string;
  assigned_to_email: string;
  assigned_to_name: string;
  has_photos: boolean;
  estimated_refund_total: number;
  created_at: string;
}

export interface RmaQueueProps {
  items: RmaQueueItem[];
  onViewDetail: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRequestInfo: (id: string) => void;
  onSchedulePickup: (id: string) => void;
  onAssignStaff: (id: string) => void;
  loading?: boolean;
}

export const getStatusBadgeStyle = (status: string) => {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "requested":
    case "under_review":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "information_required":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "approved":
    case "pickup_scheduling":
      return "bg-blue-100 text-blue-900 border-blue-200";
    case "pickup_scheduled":
    case "picked_up":
      return "bg-purple-100 text-purple-900 border-purple-200";
    case "warehouse_received":
    case "inspection_in_progress":
      return "bg-indigo-100 text-indigo-900 border-indigo-200";
    case "refund_completed":
    case "exchange_shipped":
    case "completed":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "rejected":
    case "cancelled":
      return "bg-rose-100 text-rose-900 border-rose-200";
    default:
      return "bg-stone-100 text-stone-800 border-stone-200";
  }
};

export const RmaQueue: React.FC<RmaQueueProps> = ({
  items,
  onViewDetail,
  onApprove,
  onReject,
  onRequestInfo,
  onSchedulePickup,
  onAssignStaff,
  loading
}) => {
  if (loading && items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500 text-xs">
        Loading RMA queue records...
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500 text-xs space-y-2">
        <div className="font-bold text-stone-800 text-sm">No return or exchange requests found</div>
        <p>Try adjusting your search query or filter selection.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">RMA & Order #</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Type & Resolution</th>
              <th className="py-3 px-4">Status & SLA</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Logistics / Staff</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-800">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-stone-50/80 transition">
                {/* RMA & Order # */}
                <td className="py-3 px-4 align-top">
                  <div className="font-bold text-stone-900 flex items-center gap-1">
                    <span>{item.rma_number}</span>
                    {item.has_photos && (
                      <span title="Evidence photos uploaded">
                        <Camera className="w-3.5 h-3.5 text-[#B08D57]" />
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 font-medium mt-0.5">Order #{item.order_id}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN") : ""}
                  </div>
                </td>

                {/* Customer */}
                <td className="py-3 px-4 align-top">
                  <div className="font-semibold text-stone-900">{item.customer_name}</div>
                  <div className="text-[11px] text-stone-500 font-mono mt-0.5">{item.customer_profile_id}</div>
                  <div className="text-[10px] text-stone-400">{item.customer_email_masked}</div>
                </td>

                {/* Type & Resolution */}
                <td className="py-3 px-4 align-top">
                  <div className="font-bold uppercase text-[11px] text-stone-800">{item.request_type}</div>
                  <div className="text-[10px] font-medium text-stone-500 mt-0.5">
                    {item.resolution?.replace("_", " ") || "refund"} ({item.items_count} items)
                  </div>
                  {item.estimated_refund_total > 0 && (
                    <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                      Est. ₹{item.estimated_refund_total.toLocaleString("en-IN")}
                    </div>
                  )}
                </td>

                {/* Status & SLA */}
                <td className="py-3 px-4 align-top space-y-1">
                  <span
                    className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase ${getStatusBadgeStyle(
                      item.status
                    )}`}
                  >
                    {item.status_label || item.status}
                  </span>

                  {/* SLA Badge */}
                  <div>
                    {item.sla_state === "overdue" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        <Clock className="w-3 h-3" /> Overdue SLA
                      </span>
                    )}
                    {item.sla_state === "due_soon" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        <Clock className="w-3 h-3" /> SLA Due Soon
                      </span>
                    )}
                    {item.sla_state === "on_time" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500">
                        <Clock className="w-3 h-3 text-stone-400" /> On Time
                      </span>
                    )}
                  </div>
                </td>

                {/* Priority */}
                <td className="py-3 px-4 align-top">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                      item.priority === "urgent"
                        ? "bg-rose-100 text-rose-900 font-extrabold"
                        : item.priority === "high"
                        ? "bg-amber-100 text-amber-900 font-bold"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {item.priority || "normal"}
                  </span>
                </td>

                {/* Logistics / Staff */}
                <td className="py-3 px-4 align-top text-[11px]">
                  <div className="text-stone-700 font-medium">Courier: {item.courier || "Unassigned"}</div>
                  <div className="text-stone-500 text-[10px] mt-0.5">
                    Staff: {item.assigned_to_email ? item.assigned_to_email.split("@")[0] : "Unassigned"}
                  </div>
                </td>

                {/* Quick Actions */}
                <td className="py-3 px-4 align-top text-right">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    <button
                      onClick={() => onViewDetail(item.id)}
                      className="px-2.5 py-1 text-xs font-bold bg-[#2A211C] text-white rounded-lg hover:bg-black transition cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>

                    {["requested", "under_review", "information_required"].includes(item.status) && (
                      <>
                        <button
                          onClick={() => onApprove(item.id)}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200 transition cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onReject(item.id)}
                          className="px-2 py-1 text-[11px] font-semibold bg-rose-100 text-rose-800 rounded hover:bg-rose-200 transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {item.status === "approved" && (
                      <button
                        onClick={() => onSchedulePickup(item.id)}
                        className="px-2 py-1 text-[11px] font-semibold bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition cursor-pointer"
                      >
                        Schedule Pickup
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
