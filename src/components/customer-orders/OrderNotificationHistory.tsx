import React from "react";
import { Bell, Mail, MessageSquare, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export interface OrderNotificationLog {
  id: string;
  channel: string;
  event_type: string;
  status: string;
  title: string;
  queued_at: string;
}

interface OrderNotificationHistoryProps {
  notifications: OrderNotificationLog[];
}

export const OrderNotificationHistory: React.FC<OrderNotificationHistoryProps> = ({
  notifications
}) => {
  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
      <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-800" />
        <span>Order Communications & Notifications ({notifications.length})</span>
      </h3>

      <div className="divide-y divide-stone-100">
        {notifications.map((notif) => {
          const isEmail = notif.channel === "EMAIL";
          const isDelivered = notif.status === "DELIVERED";

          return (
            <div key={notif.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-stone-100 text-stone-600 mt-0.5">
                  {isEmail ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-900 truncate">{notif.title}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Via {notif.channel} • Event: {notif.event_type}
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isDelivered
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {isDelivered ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Clock className="w-3 h-3 text-amber-600" />
                  )}
                  <span>{notif.status}</span>
                </span>
                <p className="text-[10px] text-stone-400 font-mono mt-1">
                  {new Date(notif.queued_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
