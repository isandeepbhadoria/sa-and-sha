export interface SlaPolicyConfig {
  requested: number; // hours to review new RMA (default 24h)
  under_review: number; // hours in under_review (default 24h)
  info_requested: number; // hours waiting for customer info (default 72h)
  approved: number; // hours to schedule pickup (default 24h)
  pickup_scheduled: number; // hours for courier pickup & warehouse receiving (default 48h)
  warehouse_received: number; // hours to start inspection (default 24h)
  inspection_in_progress: number; // hours to complete inspection (default 24h)
  inspection_passed: number; // hours to process financials (default 12h)
  manager_review: number; // hours for manager decision (default 24h)
  financial_processing: number; // hours for settlement (default 12h)
  financial_failed: number; // hours to retry settlement (default 12h)
  exchange_approved: number; // hours for exchange order generation (default 24h)
  exchange_processing: number; // hours to ship exchange (default 24h)
  exchange_shipped: number; // hours for exchange delivery (default 48h)
}

export const DEFAULT_SLA_POLICY: SlaPolicyConfig = {
  requested: 24,
  under_review: 24,
  info_requested: 72,
  approved: 24,
  pickup_scheduled: 48,
  warehouse_received: 24,
  inspection_in_progress: 24,
  inspection_passed: 12,
  manager_review: 24,
  financial_processing: 12,
  financial_failed: 12,
  exchange_approved: 24,
  exchange_processing: 24,
  exchange_shipped: 48
};

/**
 * Calculates due date based on status, policy, and VIP status
 */
export function calculateSlaDueAt(status: string, createdAtIso: string, isVip: boolean = false, customPolicy?: Partial<SlaPolicyConfig>): string {
  const policy = { ...DEFAULT_SLA_POLICY, ...(customPolicy || {}) };
  let hoursAllowed = (policy as any)[status] || 24;

  // VIP customers get 50% shorter SLA window
  if (isVip) {
    hoursAllowed = Math.max(6, Math.floor(hoursAllowed * 0.5));
  }

  const baseDate = new Date(createdAtIso || Date.now());
  const dueTimestamp = baseDate.getTime() + hoursAllowed * 60 * 60 * 1000;
  return new Date(dueTimestamp).toISOString();
}

/**
 * Calculates real-time SLA state for an RMA
 */
export function calculateDetailedSlaState(status: string, createdAtIso: string, dueAtIso?: string, isVip: boolean = false) {
  const terminalStatuses = ["completed", "refund_completed", "exchange_completed", "rejected", "cancelled"];
  if (terminalStatuses.includes(status)) {
    return {
      sla_state: "completed",
      is_overdue: false,
      hours_overdue: 0,
      hours_remaining: 0
    };
  }

  const now = Date.now();
  const dueAt = dueAtIso ? new Date(dueAtIso).getTime() : new Date(calculateSlaDueAt(status, createdAtIso, isVip)).getTime();
  const diffMs = dueAt - now;
  const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    const hoursOverdue = Math.abs(Math.round(diffMs / (1000 * 60 * 60)));
    let state = "overdue";
    if (hoursOverdue >= 72) state = "escalated_critical";
    else if (hoursOverdue >= 48) state = "escalated_manager";
    else if (hoursOverdue >= 24) state = "escalated_lead";

    return {
      sla_state: state,
      is_overdue: true,
      hours_overdue: hoursOverdue,
      hours_remaining: 0
    };
  }

  if (hoursRemaining <= 6) {
    return {
      sla_state: "due_soon",
      is_overdue: false,
      hours_overdue: 0,
      hours_remaining: hoursRemaining
    };
  }

  return {
    sla_state: "on_time",
    is_overdue: false,
    hours_overdue: 0,
    hours_remaining: hoursRemaining
  };
}
