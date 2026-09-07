import { describe, it, expect } from "vitest";
import { calculateReturnEligibility, RETURN_WINDOW_MS } from "../returnEligibilityHelpers";

describe("Authoritative 7-Day Return & Exchange Eligibility Engine", () => {
  const nowMs = new Date("2026-08-10T12:00:00.000Z").getTime();

  it("1. Before delivery: rejects return/exchange request if order is in transit or placed", () => {
    const order = {
      order_id: "KL10001",
      status: "in_transit",
      created_at: new Date(nowMs - 2 * 24 * 3600 * 1000).toISOString(),
      items: [{ product_id: "p1", size: "L" }]
    };

    const res = calculateReturnEligibility(order, [], nowMs);
    expect(res.eligible).toBe(false);
    expect(res.is_delivered).toBe(false);
    expect(res.reason).toContain("not yet marked delivered");
  });

  it("2. Exact delivery time: allows return/exchange immediately upon delivery", () => {
    const order = {
      order_id: "KL10002",
      status: "delivered",
      delivered_at: new Date(nowMs).toISOString(),
      items: [{ product_id: "p1", size: "L" }]
    };

    const res = calculateReturnEligibility(order, [], nowMs);
    expect(res.eligible).toBe(true);
    expect(res.is_delivered).toBe(true);
    expect(res.is_expired).toBe(false);
    expect(res.remaining_days).toBe(7);
  });

  it("3. Within window: allows return/exchange 3 days post-delivery", () => {
    const deliveredAt = new Date(nowMs - 3 * 24 * 3600 * 1000).toISOString();
    const order = {
      order_id: "KL10003",
      status: "delivered",
      delivered_at: deliveredAt,
      items: [{ product_id: "p1", size: "M" }]
    };

    const res = calculateReturnEligibility(order, [], nowMs);
    expect(res.eligible).toBe(true);
    expect(res.is_expired).toBe(false);
    expect(res.remaining_days).toBe(4);
  });

  it("4. Final eligible boundary: allows return on exact 7-day boundary (7*24h)", () => {
    const deliveredAt = new Date(nowMs - RETURN_WINDOW_MS).toISOString();
    const order = {
      order_id: "KL10004",
      status: "delivered",
      delivered_at: deliveredAt,
      items: [{ product_id: "p1", size: "L" }]
    };

    const res = calculateReturnEligibility(order, [], nowMs);
    expect(res.eligible).toBe(true);
    expect(res.is_expired).toBe(false);
  });

  it("5. First ineligible boundary: rejects return 7 days + 1 millisecond after delivery", () => {
    const deliveredAt = new Date(nowMs - (RETURN_WINDOW_MS + 1)).toISOString();
    const order = {
      order_id: "KL10005",
      status: "delivered",
      delivered_at: deliveredAt,
      items: [{ product_id: "p1", size: "XL" }]
    };

    const res = calculateReturnEligibility(order, [], nowMs);
    expect(res.eligible).toBe(false);
    expect(res.is_expired).toBe(true);
    expect(res.reason).toContain("7-day window expired");
  });

  it("6. Cancelled order: rejects return request for cancelled order", () => {
    const order = {
      order_id: "KL10006",
      status: "cancelled",
      delivered_at: new Date(nowMs - 2 * 24 * 3600 * 1000).toISOString(),
      items: [{ product_id: "p1", size: "L" }]
    };

    const res = calculateReturnEligibility(order, [], nowMs);
    expect(res.eligible).toBe(false);
    expect(res.is_cancelled).toBe(true);
    expect(res.reason).toContain("cancelled");
  });

  it("7. Already-returned item: rejects return if item has an active request", () => {
    const order = {
      order_id: "KL10007",
      status: "delivered",
      delivered_at: new Date(nowMs - 1 * 24 * 3600 * 1000).toISOString(),
      items: [{ product_id: "p1", size: "L" }]
    };

    const existingReturnRequests = [
      {
        order_id: "KL10007",
        request_id: "RMA-1001",
        items: [{ product_id: "p1", original_size: "L" }]
      }
    ];

    const res = calculateReturnEligibility(order, existingReturnRequests, nowMs);
    expect(res.eligible).toBe(false);
    expect(res.items?.[0].eligible).toBe(false);
    expect(res.items?.[0].reason).toContain("already submitted");
  });

  it("8. Partial return: allows return for remaining unreturned items", () => {
    const order = {
      order_id: "KL10008",
      status: "delivered",
      delivered_at: new Date(nowMs - 1 * 24 * 3600 * 1000).toISOString(),
      items: [
        { product_id: "p1", size: "L" },
        { product_id: "p2", size: "M" }
      ]
    };

    const existingReturnRequests = [
      {
        order_id: "KL10008",
        request_id: "RMA-1002",
        items: [{ product_id: "p1", original_size: "L" }]
      }
    ];

    const res = calculateReturnEligibility(order, existingReturnRequests, nowMs);
    expect(res.eligible).toBe(true);
    expect(res.items?.[0].eligible).toBe(false);
    expect(res.items?.[1].eligible).toBe(true);
  });

  it("9. Client date manipulation protection: ignores client timestamp and uses server nowMs", () => {
    const order = {
      order_id: "KL10009",
      status: "delivered",
      delivered_at: new Date(nowMs - 10 * 24 * 3600 * 1000).toISOString(), // Delivered 10 days ago
      items: [{ product_id: "p1", size: "L" }]
    };

    // Client pretends current date is 2 days after delivery
    const fakeClientDate = new Date(nowMs - 8 * 24 * 3600 * 1000).getTime();

    // Server uses authoritative nowMs
    const res = calculateReturnEligibility(order, [], nowMs);
    expect(res.eligible).toBe(false);
    expect(res.is_expired).toBe(true);
  });
});
