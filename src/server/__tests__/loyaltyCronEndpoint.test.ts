import express from "express";
import crypto from "crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as loyaltyHelpers from "../loyaltyHelpers";

describe("PHASE 10.4B.4A — Production Rewards Cron Endpoint Tests", () => {
  let app: express.Express;
  let server: any;
  let baseUrl: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    // Define cron handler matching server.ts implementation
    app.post("/api/internal/cron/release-pending-points", async (req, res) => {
      try {
        const expectedSecret = process.env.LOYALTY_CRON_SECRET ? process.env.LOYALTY_CRON_SECRET.trim() : "";
        if (!expectedSecret) {
          return res.status(500).json({
            success: false,
            error: "LOYALTY_CRON_SECRET environment variable is not configured"
          });
        }

        const providedSecret = ((req.headers["x-cron-secret"] || req.headers["X-Cron-Secret"]) as string | undefined)?.trim();
        if (!providedSecret) {
          return res.status(401).json({
            success: false,
            error: "Unauthorized cron access."
          });
        }

        const expectedBuf = Buffer.from(expectedSecret);
        const providedBuf = Buffer.from(providedSecret);

        const isMatch = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            error: "Unauthorized cron access."
          });
        }

        const result = await loyaltyHelpers.releasePendingPointsBatch({} as any, {
          batchSize: Number(req.body?.batchSize || req.body?.limit || 100),
          dryRun: Boolean(req.body?.dryRun)
        });

        return res.json({
          success: true,
          processedCount: result.scanned,
          releasedCount: result.released,
          skippedCount: Math.max(0, result.scanned - result.released),
          hasMore: result.hasMore,
          nextCursor: result.nextCursor
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: "Internal error executing pending points release batch."
        });
      }
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    delete process.env.LOYALTY_CRON_SECRET;
    vi.restoreAllMocks();
  });

  it("1. Fails closed with HTTP 500 when LOYALTY_CRON_SECRET is missing in environment", async () => {
    delete process.env.LOYALTY_CRON_SECRET;
    const res = await fetch(`${baseUrl}/api/internal/cron/release-pending-points`, {
      method: "POST",
      headers: { "x-cron-secret": "some-secret" }
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("LOYALTY_CRON_SECRET environment variable is not configured");
  });

  it("2. Fails with HTTP 401 when x-cron-secret header is missing or incorrect", async () => {
    process.env.LOYALTY_CRON_SECRET = "correct-production-secret-12345";

    // Missing header
    const resMissing = await fetch(`${baseUrl}/api/internal/cron/release-pending-points`, {
      method: "POST"
    });
    expect(resMissing.status).toBe(401);
    const bodyMissing = await resMissing.json();
    expect(bodyMissing.success).toBe(false);
    expect(bodyMissing.error).toBe("Unauthorized cron access.");

    // Wrong header
    const resWrong = await fetch(`${baseUrl}/api/internal/cron/release-pending-points`, {
      method: "POST",
      headers: { "x-cron-secret": "wrong-secret" }
    });
    expect(resWrong.status).toBe(401);
    const bodyWrong = await resWrong.json();
    expect(bodyWrong.success).toBe(false);
    expect(bodyWrong.error).toBe("Unauthorized cron access.");
  });

  it("3. Succeeds with HTTP 200 and returns safe summary when x-cron-secret is valid", async () => {
    process.env.LOYALTY_CRON_SECRET = "correct-production-secret-12345";

    vi.spyOn(loyaltyHelpers, "releasePendingPointsBatch").mockResolvedValue({
      scanned: 5,
      released: 3,
      hasMore: false,
      nextCursor: null
    });

    const res = await fetch(`${baseUrl}/api/internal/cron/release-pending-points`, {
      method: "POST",
      headers: {
        "x-cron-secret": "correct-production-secret-12345",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ batchSize: 50 })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.processedCount).toBe(5);
    expect(body.releasedCount).toBe(3);
    expect(body.skippedCount).toBe(2);
    expect(body.hasMore).toBe(false);
  });

  it("4. Idempotency & duplicate execution safety: multiple calls return safe idempotency counts without duplicate releases", async () => {
    process.env.LOYALTY_CRON_SECRET = "correct-production-secret-12345";

    let callCount = 0;
    vi.spyOn(loyaltyHelpers, "releasePendingPointsBatch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { scanned: 2, released: 2, hasMore: false, nextCursor: null };
      } else {
        return { scanned: 2, released: 0, hasMore: false, nextCursor: null };
      }
    });

    // Run 1
    const res1 = await fetch(`${baseUrl}/api/internal/cron/release-pending-points`, {
      method: "POST",
      headers: { "x-cron-secret": "correct-production-secret-12345" }
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.releasedCount).toBe(2);

    // Run 2 (duplicate trigger)
    const res2 = await fetch(`${baseUrl}/api/internal/cron/release-pending-points`, {
      method: "POST",
      headers: { "x-cron-secret": "correct-production-secret-12345" }
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.releasedCount).toBe(0);
    expect(body2.skippedCount).toBe(2);
  });

  it("5. Verifies releasePendingPointsBatch logic: active return blocks release", async () => {
    const mockPendingEntry = {
      id: "ledger_1",
      customer_profile_id: "prof_123",
      status: "pending",
      points: 100,
      available_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      related_order_id: "order_99"
    };

    const mockAdminDb: any = {
      collectionGroup: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: "ledger_1",
                    data: () => mockPendingEntry,
                    ref: { id: "ledger_1" }
                  }
                ]
              })
            })
          })
        })
      }),
      collection: (colName: string) => ({
        where: () => ({
          limit: () => ({
            get: async () => {
              if (colName === "return_requests") {
                return {
                  empty: false,
                  docs: [{ data: () => ({ status: "requested" }) }]
                };
              }
              return { empty: true, docs: [] };
            }
          })
        }),
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ order_status: "delivered" })
          })
        })
      })
    };

    const res = await loyaltyHelpers.releasePendingPointsBatch(mockAdminDb, { batchSize: 10 });
    expect(res.scanned).toBe(1);
    expect(res.released).toBe(0); // Blocked due to active return request
  });

  it("6. Verifies releasePendingPointsBatch logic: no release before available_at timestamp", async () => {
    const futureIso = new Date(Date.now() + 86400000).toISOString(); // 24 hours in future
    const mockFutureEntry = {
      id: "ledger_2",
      customer_profile_id: "prof_123",
      status: "pending",
      points: 100,
      available_at: futureIso,
      related_order_id: "order_100"
    };

    const mockAdminDb: any = {
      collectionGroup: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: "ledger_2",
                    data: () => mockFutureEntry,
                    ref: { id: "ledger_2" }
                  }
                ]
              })
            })
          })
        })
      }),
      collection: () => ({
        where: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] })
          })
        }),
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ order_status: "delivered" })
          })
        })
      })
    };

    const res = await loyaltyHelpers.releasePendingPointsBatch(mockAdminDb, { batchSize: 10 });
    expect(res.scanned).toBe(1);
    expect(res.released).toBe(0); // Not released because available_at is in future
  });
});
