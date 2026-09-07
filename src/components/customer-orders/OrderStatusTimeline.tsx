import React from "react";
import { Check, Clock, AlertCircle, PackageCheck, Truck, MapPin } from "lucide-react";

export interface TimelineStep {
  key: string;
  title: string;
  description?: string;
  timestamp?: string | null;
  completed: boolean;
  isTerminal?: boolean;
}

interface OrderStatusTimelineProps {
  steps: TimelineStep[];
  currentStatus: string;
}

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({
  steps,
  currentStatus
}) => {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6">
      <h3 className="text-base font-bold text-stone-900 mb-6 flex items-center gap-2">
        <PackageCheck className="w-5 h-5 text-amber-800" />
        <span>Fulfillment & Order Journey</span>
      </h3>

      <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
        {steps.map((step, idx) => {
          const isCurrent = step.completed && (idx === steps.length - 1 || !steps[idx + 1]?.completed);

          return (
            <div key={step.key} className="relative flex items-start gap-4">
              {/* Step Icon Badge */}
              <div
                className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border text-xs transition-all ${
                  step.isTerminal
                    ? "bg-red-100 border-red-300 text-red-700"
                    : step.completed
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-stone-300 text-stone-400"
                }`}
              >
                {step.isTerminal ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : step.completed ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-stone-300" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      step.completed ? "text-stone-900" : "text-stone-400"
                    }`}
                  >
                    {step.title}
                  </p>
                  {step.timestamp && (
                    <span className="text-xs text-stone-500 font-mono">
                      {new Date(step.timestamp).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  )}
                </div>

                {step.description && (
                  <p
                    className={`text-xs mt-1 ${
                      step.completed ? "text-stone-600" : "text-stone-400"
                    }`}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
