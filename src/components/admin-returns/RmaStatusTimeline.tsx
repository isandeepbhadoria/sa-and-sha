import React from "react";
import { Clock, CheckCircle2, AlertTriangle, ArrowRight, Play } from "lucide-react";

export interface RmaStatusTimelineProps {
  status: string;
  timeline: any[];
  statusHistory?: any[];
  onTransition: (targetStatus: string, reason?: string) => void;
  loading?: boolean;
}

const ALL_WORKFLOW_STEPS = [
  { key: "requested", label: "Requested" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "pickup_scheduled", label: "Pickup Scheduled" },
  { key: "picked_up", label: "Picked Up" },
  { key: "warehouse_received", label: "Warehouse Received" },
  { key: "completed", label: "Completed" }
];

export const RmaStatusTimeline: React.FC<RmaStatusTimelineProps> = ({
  status,
  timeline,
  statusHistory,
  onTransition,
  loading
}) => {
  const currentKey = status.toLowerCase();

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#B85C38]" />
          RMA Status Machine Timeline
        </h4>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[#B85C38] text-white">
          {status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Workflow Stepper Bar */}
      <div className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-200 overflow-x-auto gap-2">
        {ALL_WORKFLOW_STEPS.map((step, idx) => {
          const isPassed = timeline.some((t: any) => (t.status || "").toLowerCase() === step.key);
          const isCurrent = currentKey === step.key;

          return (
            <div key={step.key} className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isCurrent
                      ? "bg-[#B85C38] text-white ring-2 ring-[#B85C38]/30"
                      : isPassed
                      ? "bg-emerald-600 text-white"
                      : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {isPassed ? "✓" : idx + 1}
                </div>
                <span
                  className={`font-semibold text-[11px] whitespace-nowrap ${
                    isCurrent ? "text-stone-900 font-bold" : isPassed ? "text-stone-700" : "text-stone-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < ALL_WORKFLOW_STEPS.length - 1 && <span className="text-stone-300">→</span>}
            </div>
          );
        })}
      </div>

      {/* Detailed Timeline Events */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {timeline && timeline.length > 0 ? (
          timeline.map((item: any, idx: number) => (
            <div key={idx} className="bg-white p-3 rounded-lg border border-stone-200 flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[#B85C38] mt-1.5 shrink-0" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">{item.title || item.status}</span>
                  <span className="text-[10px] text-stone-400">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString("en-IN") : ""}
                  </span>
                </div>
                <p className="text-stone-600">{item.description}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-stone-400 italic py-2 text-center">No timeline records found.</p>
        )}
      </div>
    </div>
  );
};
