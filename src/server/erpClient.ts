/**
 * Thin client for the REOPL ERP's external inventory API
 * (see backend/src/integrations/external-inventory.controller.ts in the
 * ERP repo). Every call is authenticated with ERP_API_KEY, scoped
 * server-side to this site's own brand + one stock location — this site
 * never sees or touches another brand's stock.
 *
 * ERP_API_URL / ERP_API_KEY are required for any of this to work; both are
 * env vars configured on this server, not committed anywhere. A missing
 * config throws immediately rather than silently no-op'ing, since a silent
 * no-op here would mean orders stop moving real stock without anyone
 * noticing.
 */

function erpBaseUrl(): string {
  const url = process.env.ERP_API_URL;
  if (!url) throw new Error("ERP_API_URL is not configured on this server.");
  return url.replace(/\/+$/, "");
}

function erpApiKey(): string {
  const key = process.env.ERP_API_KEY;
  if (!key) throw new Error("ERP_API_KEY is not configured on this server.");
  return key;
}

async function erpFetch<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${erpBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": erpApiKey()
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    let message = bodyText;
    try {
      const parsed = JSON.parse(bodyText);
      message = parsed.message || bodyText;
    } catch {
      // body wasn't JSON — use the raw text
    }
    throw new Error(`ERP ${options.method || "GET"} ${path} failed (${res.status}): ${message}`);
  }
  return res.json() as Promise<T>;
}

export interface ErpReservation {
  id: string;
  styleArticleId: string;
  locationId: string;
  channel: string;
  quantity: number;
  status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  orderRef: string | null;
  expiresAt: string;
}

export function erpCheckAvailability(sku: string): Promise<{ sku: string; available: number }> {
  return erpFetch(`/integrations/inventory/stock?sku=${encodeURIComponent(sku)}`);
}

export function erpReserve(params: { sku: string; quantity: number; orderRef?: string; ttlMinutes?: number }): Promise<ErpReservation> {
  return erpFetch("/integrations/inventory/reservations", { method: "POST", body: params });
}

export function erpConfirmReservation(id: string, referenceType?: string, referenceId?: string): Promise<ErpReservation> {
  return erpFetch(`/integrations/inventory/reservations/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
    body: { referenceType, referenceId }
  });
}

export function erpReleaseReservation(id: string): Promise<ErpReservation> {
  return erpFetch(`/integrations/inventory/reservations/${encodeURIComponent(id)}/release`, { method: "POST" });
}

// Restores stock the ERP already deducted for a confirmed reservation —
// used when an order is cancelled or refunded after checkout confirmed it
// (see erpSync.ts's restockErpForOrder).
export function erpReturnStock(params: { sku: string; quantity: number; orderRef?: string }): Promise<{ styleArticleId: string; locationId: string; quantity: number }> {
  return erpFetch("/integrations/inventory/return", { method: "POST", body: params });
}

export function erpRegisterStyleArticle(params: {
  styleNumber: string;
  size: string;
  name?: string;
  variantName?: string;
  mrp?: number;
  siteSku?: string;
}): Promise<{ sku: string; styleArticleId: string }> {
  return erpFetch("/integrations/inventory/style-articles", { method: "POST", body: params });
}

export interface ErpPatternVariant {
  fabricColor: string | null;
  printName: string | null;
  noPrints: boolean;
  baseSku: string;
  sizes: Array<{ size: string; sku: string; available: number }>;
}
export interface ErpPattern {
  styleNumber: string;
  productName: string;
  // Customer-facing name — set in the ERP's Create Barcode SKU page,
  // separate from productName (its own short internal name). Falls back to
  // productName when unset. Use this for what actually gets saved as the
  // product's name on this site — never productName.
  displayName: string;
  variants: ErpPatternVariant[];
}

// Lets the admin panel search barcode SKUs already minted in the ERP
// (Inventory → Create Barcode SKU) for this site's own brand, to pick from
// when creating a product instead of generating a SKU here — see the
// Barcode SKU picker in AdminPage.tsx.
export function erpListPatterns(search?: string): Promise<{ patterns: ErpPattern[] }> {
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return erpFetch(`/integrations/inventory/patterns${qs}`);
}
