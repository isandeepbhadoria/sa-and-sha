import { readStockForItems } from './inventoryHelpers';
import { round2 } from './invoice/invoiceCalculation';

export interface StoreSaleItemInput {
  product_id: string;
  size?: string;
  quantity: number;
  unit_price?: number;
}

export interface RecordedBy {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'store_staff';
}

export interface CreateStoreSaleParams {
  items: StoreSaleItemInput[];
  payment_method: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  recordedBy: RecordedBy;
}

export interface StoreSaleValidatedItem {
  product_id: string;
  name: string;
  sku?: string;
  size: string;
  price: number;
  quantity: number;
}

export interface StoreSaleRecord {
  order_id: string;
  channel: 'store';
  items: StoreSaleValidatedItem[];
  subtotal: number;
  discount: number;
  shipping_cost: number;
  grand_total: number;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: 'completed';
  recorded_by: RecordedBy;
  created_at: string;
}

const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'upi', 'card']);

/**
 * Validates and prices store sale line items against the live product catalog
 * (never trusts client-supplied name/price). A staff-supplied unit_price is
 * treated as a discretionary discount and clamped to never exceed the listed
 * price, so the counter can never overcharge relative to what's published.
 */
async function buildValidatedItems(
  adminDb: FirebaseFirestore.Firestore,
  items: StoreSaleItemInput[]
): Promise<StoreSaleValidatedItem[]> {
  const productIds = Array.from(new Set(items.map(i => i.product_id)));
  const snaps = await Promise.all(productIds.map(id => adminDb.collection('products').doc(id).get()));
  const productById = new Map(productIds.map((id, i) => [id, snaps[i]]));

  return items.map((item) => {
    const qty = Math.max(1, Math.min(1000, Math.floor(Number(item.quantity) || 1)));
    const snap = productById.get(item.product_id);
    if (!snap || !snap.exists) {
      throw new Error(`Product '${item.product_id}' not found.`);
    }
    const p: any = snap.data() || {};
    if (p.status === 'archived' || p.status === 'draft' || p.isDecommissioned) {
      throw new Error(`"${p.name || item.product_id}" is not available for sale.`);
    }

    const size = item.size || 'Free Size';
    if (Array.isArray(p.sizes) && p.sizes.length > 0 && size !== 'Free Size' && !p.sizes.includes(size)) {
      throw new Error(`Size '${size}' is not valid for "${p.name}".`);
    }

    const listedPrice = Number(p.price);
    if (!Number.isFinite(listedPrice) || listedPrice <= 0) {
      throw new Error(`"${p.name || item.product_id}" has no valid price configured.`);
    }

    let unitPrice = listedPrice;
    if (item.unit_price !== undefined && item.unit_price !== null) {
      const requested = Number(item.unit_price);
      if (!Number.isFinite(requested) || requested < 0) {
        throw new Error(`Invalid price override for "${p.name}".`);
      }
      unitPrice = Math.min(requested, listedPrice);
    }

    return {
      product_id: item.product_id,
      name: p.name || 'Product',
      sku: p.sku || undefined,
      size,
      price: round2(unitPrice),
      quantity: qty
    };
  });
}

/**
 * Records a walk-in store sale: validates items against the live catalog,
 * atomically reserves/decrements the same per-size stock pool online orders
 * use (readStockForItems from Phase 1), and writes the store_sales record.
 * Hard-blocks on insufficient tracked stock, same policy as COD checkout -
 * money and goods are exchanging hands at the counter right now, so there's
 * no "oversold, flag for later" path like prepaid online orders have.
 */
export async function createStoreSale(
  adminDb: FirebaseFirestore.Firestore,
  params: CreateStoreSaleParams
): Promise<StoreSaleRecord> {
  if (!Array.isArray(params.items) || params.items.length === 0) {
    throw new Error('Sale must include at least one item.');
  }
  if (!ALLOWED_PAYMENT_METHODS.has(params.payment_method)) {
    throw new Error('Invalid payment method. Must be cash, upi, or card.');
  }

  const validatedItems = await buildValidatedItems(adminDb, params.items);
  const subtotal = round2(validatedItems.reduce((sum, it) => sum + it.price * it.quantity, 0));
  const saleId = `STORE-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();

  const record: StoreSaleRecord = {
    order_id: saleId,
    channel: 'store',
    items: validatedItems,
    subtotal,
    discount: 0,
    shipping_cost: 0,
    grand_total: subtotal,
    payment_method: params.payment_method,
    customer_name: (params.customer_name || 'Walk-in Customer').trim(),
    customer_phone: (params.customer_phone || '').trim(),
    customer_email: (params.customer_email || '').trim().toLowerCase(),
    status: 'completed',
    recorded_by: params.recordedBy,
    created_at: nowIso
  };

  await adminDb.runTransaction(async (transaction) => {
    const stockChecks = await readStockForItems(
      transaction,
      adminDb,
      validatedItems.map(it => ({ product_id: it.product_id, size: it.size, quantity: it.quantity, name: it.name }))
    );

    for (const check of stockChecks) {
      if (check.tracked && (check.currentAvailable as number) < check.qty) {
        throw new Error(`"${check.name}" (size ${check.size}) has only ${Math.max(check.currentAvailable as number, 0)} left in stock.`);
      }
    }

    for (const check of stockChecks) {
      if (check.tracked) {
        transaction.update(check.ref, {
          [`stock.${check.size}`]: (check.currentAvailable as number) - check.qty,
          updated_at: nowIso
        });
      }
    }

    transaction.set(adminDb.collection('store_sales').doc(saleId), record);
  });

  return record;
}

/**
 * Lists store sales, most recent first. Pass staffUid to scope results to a
 * single staff member's own sales (used on their dashboard); omit it for the
 * full list (admin use).
 */
export async function listStoreSales(
  adminDb: FirebaseFirestore.Firestore,
  options?: { staffUid?: string; limit?: number }
): Promise<any[]> {
  let query: FirebaseFirestore.Query = adminDb.collection('store_sales');
  if (options?.staffUid) {
    query = query.where('recorded_by.uid', '==', options.staffUid);
  }
  const snap = await query.orderBy('created_at', 'desc').limit(options?.limit || 50).get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}
