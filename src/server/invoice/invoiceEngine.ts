import { GstInvoice, InvoiceType } from './invoiceTypes';
import { getSellerTaxConfigFromFirestore, validateSellerTaxConfig, calculateFinancialYear } from './sellerTaxConfig';
import { loadProductTaxMasterFromFirestore } from './productTaxMaster';
import { getShippingTaxConfigFromFirestore } from './shippingTaxConfig';
import { getInvoiceNumberingConfigFromFirestore, InvoiceNumberingConfig } from './invoiceNumberingConfig';
import { buildGstInvoiceData } from './invoiceCalculation';
import {
  evaluateInvoiceFinalizationEligibility,
  canFinalizeGstInvoiceForOrder,
  InvoiceFinalizationEligibilityResult
} from './invoiceEligibility';

export {
  evaluateInvoiceFinalizationEligibility,
  canFinalizeGstInvoiceForOrder
};
export type { InvoiceFinalizationEligibilityResult };

/**
 * Atomically generates sequential financial-year-aware invoice number inside Firestore transaction.
 */
export async function generateInvoiceNumberInTransaction(
  transaction: any,
  adminDb: any,
  financialYear: string,
  numConfig?: InvoiceNumberingConfig
): Promise<string> {
  const counterRef = adminDb.collection('counters').doc('gst_invoice_counter');
  const counterSnap = await transaction.get(counterRef);

  let seq = 1;
  if (counterSnap.exists) {
    const data = counterSnap.data() || {};
    if (data.financial_year === financialYear && typeof data.current_sequence === 'number') {
      seq = data.current_sequence + 1;
    }
  }

  const prefix = numConfig?.prefix || 'SS';
  const sep = numConfig?.separator || '/';
  const padding = numConfig?.sequence_padding || 6;

  const paddedSeq = seq.toString().padStart(padding, '0');
  const invoiceNumber = `${prefix}${sep}${financialYear}${sep}${paddedSeq}`;

  transaction.set(counterRef, {
    financial_year: financialYear,
    current_sequence: seq,
    last_invoice_number: invoiceNumber,
    updated_at: new Date().toISOString()
  });

  return invoiceNumber;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice?: GstInvoice;
  code?: string;
  error?: string;
  details?: any;
  reused?: boolean;
}

/**
 * Idempotently creates or fetches GST invoice snapshot for an order.
 * FAILS CLOSED if seller configuration or product tax metadata is missing or invalid.
 * Enforces central finalization policy (Prepaid vs COD eligibility).
 */
export async function createOrFetchGstInvoice(
  adminDb: any,
  orderId: string,
  options?: {
    invoiceType?: InvoiceType;
    createdBy?: string;
    triggerType?: string;
    allowAdminOverride?: boolean;
  }
): Promise<CreateInvoiceResponse> {
  const cleanOrderId = String(orderId).trim();
  const invoiceType: InvoiceType = options?.invoiceType || 'TAX_INVOICE';
  const createdBy = options?.createdBy || 'system';

  try {
    // 1. Idempotency Check: search existing active invoice for this order
    const existingSnap = await adminDb
      .collection('gst_invoices')
      .where('order_id', '==', cleanOrderId)
      .where('invoice_type', '==', invoiceType)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      const invData = existingDoc.data() as GstInvoice;
      return {
        success: true,
        invoice: { ...invData, invoice_id: existingDoc.id },
        reused: true
      };
    }

    // 2. Fetch Order details FIRST
    const orderQuery = await adminDb
      .collection('orders')
      .where('order_id', '==', cleanOrderId)
      .limit(1)
      .get();

    if (orderQuery.empty) {
      return { success: false, error: `Order #${cleanOrderId} not found.` };
    }

    const orderDoc = orderQuery.docs[0];
    const orderData = orderDoc.data();

    // 3. Central Policy Check: evaluate invoice finalization eligibility
    const eligibility = evaluateInvoiceFinalizationEligibility(orderData);
    const triggerType = options?.triggerType || eligibility.triggerType || 'SYSTEM_FINALIZATION';

    if (!eligibility.eligible && !options?.allowAdminOverride) {
      // Record audit log for skipped finalization attempt
      await adminDb.collection('admin_audit_logs').add({
        event_type: 'invoice_finalization_skipped',
        action: 'INVOICE_FINALIZATION_SKIPPED',
        order_id: cleanOrderId,
        reason_code: eligibility.reasonCode,
        reason_description: eligibility.reasonDescription,
        created_by: createdBy,
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return {
        success: false,
        code: eligibility.reasonCode,
        error: `Order #${cleanOrderId} is not eligible for GST invoice finalization: ${eligibility.reasonDescription}`,
        details: eligibility
      };
    }

    // 4. Fetch configurations from Firestore
    const [seller, shippingTaxConfig, numberingConfig] = await Promise.all([
      getSellerTaxConfigFromFirestore(adminDb),
      getShippingTaxConfigFromFirestore(adminDb),
      getInvoiceNumberingConfigFromFirestore(adminDb)
    ]);

    // Load Product Tax Master entries into memory store
    await loadProductTaxMasterFromFirestore(adminDb);

    // Validate Seller Tax Config
    const sellerValidation = validateSellerTaxConfig(seller);
    if (!sellerValidation.valid) {
      await adminDb.collection('admin_audit_logs').add({
        event_type: 'invoice_finalization_failed',
        action: 'INVOICE_FINALIZATION_FAILED',
        order_id: cleanOrderId,
        reason_code: sellerValidation.code || 'SELLER_TAX_CONFIGURATION_REQUIRED',
        created_by: createdBy,
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return {
        success: false,
        code: sellerValidation.code || 'SELLER_TAX_CONFIGURATION_REQUIRED',
        error: sellerValidation.error || 'Seller tax configuration required before invoice finalization.'
      };
    }

    // 5. Pre-validate tax calculation & product tax master lookup
    const calcResult = buildGstInvoiceData(orderData, {
      sellerConfig: seller,
      shippingTaxConfig,
      invoiceType,
      createdBy
    });

    if (calcResult.success === false) {
      await adminDb.collection('admin_audit_logs').add({
        event_type: 'invoice_finalization_failed',
        action: 'INVOICE_FINALIZATION_FAILED',
        order_id: cleanOrderId,
        reason_code: calcResult.code || 'CALCULATION_FAILED',
        created_by: createdBy,
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return {
        success: false,
        code: calcResult.code,
        error: calcResult.error,
        details: calcResult.details
      };
    }

    // 6. Perform atomic creation in transaction
    const orderDate = orderData.created_at || new Date().toISOString();
    const financialYear = calculateFinancialYear(orderDate);

    let createdInvoice: GstInvoice | null = null;
    let invoiceDocId = `inv_${cleanOrderId}_${invoiceType.toLowerCase()}`;

    await adminDb.runTransaction(async (transaction: any) => {
      // Re-check inside transaction for concurrency protection
      const doubleCheckSnap = await transaction.get(adminDb.collection('gst_invoices').doc(invoiceDocId));
      if (doubleCheckSnap.exists) {
        createdInvoice = doubleCheckSnap.data() as GstInvoice;
        return;
      }

      // Re-verify order document inside transaction
      const orderRefTx = orderDoc.ref;
      const txOrderSnap = await transaction.get(orderRefTx);
      if (txOrderSnap.exists) {
        const txOrderData = txOrderSnap.data();
        if (txOrderData?.invoice_status === 'FINALIZED' || txOrderData?.invoice_id) {
          // Linked invoice exists
          const existingInvSnap = await transaction.get(
            adminDb.collection('gst_invoices').doc(txOrderData.invoice_id || invoiceDocId)
          );
          if (existingInvSnap.exists) {
            createdInvoice = existingInvSnap.data() as GstInvoice;
            return;
          }
        }
      }

      // Generate transaction-safe sequential number
      const invoiceNumber = await generateInvoiceNumberInTransaction(
        transaction,
        adminDb,
        financialYear,
        numberingConfig
      );

      const nowIso = new Date().toISOString();
      const invoicePayload: GstInvoice = {
        ...calcResult.invoice,
        invoice_id: invoiceDocId,
        invoice_number: invoiceNumber,
        status: 'FINALIZED',
        finalized_at: nowIso,
        finalized_trigger: triggerType,
        finalized_by: createdBy
      };

      // Set invoice snapshot document in `gst_invoices`
      const invoiceDocRef = adminDb.collection('gst_invoices').doc(invoiceDocId);
      transaction.set(invoiceDocRef, invoicePayload);

      // Update Order document linkage
      transaction.update(orderDoc.ref, {
        invoice_id: invoiceDocId,
        invoice_number: invoiceNumber,
        invoice_status: 'FINALIZED',
        invoiced_at: nowIso,
        invoice_trigger: triggerType
      });

      // Write Audit log entry inside transaction
      const auditRef = adminDb.collection('admin_audit_logs').doc();
      transaction.set(auditRef, {
        event_type: 'invoice_created',
        action: 'INVOICE_FINALIZED',
        invoice_id: invoiceDocId,
        invoice_number: invoiceNumber,
        order_id: cleanOrderId,
        trigger: triggerType,
        created_by: createdBy,
        customer_type: invoicePayload.gst_customer_type,
        grand_total: invoicePayload.grand_total,
        timestamp: nowIso
      });

      createdInvoice = invoicePayload;
    });

    if (!createdInvoice) {
      return { success: false, error: 'Transaction failed to generate invoice.' };
    }

    return {
      success: true,
      invoice: createdInvoice,
      reused: false
    };
  } catch (err: any) {
    console.error(`[GST INVOICE ENGINE] Error generating invoice for order ${cleanOrderId}:`, err);
    return {
      success: false,
      error: `Failed to generate GST invoice: ${err.message || String(err)}`
    };
  }
}

/**
 * Retrieves invoice by invoice_id, invoice_number, or order_id.
 */
export async function getGstInvoiceByIdOrOrder(
  adminDb: any,
  queryId: string
): Promise<{ success: boolean; invoice?: GstInvoice; error?: string }> {
  const cleanId = String(queryId).trim();
  try {
    // 1. Direct doc lookup by invoice_id
    const docSnap = await adminDb.collection('gst_invoices').doc(cleanId).get();
    if (docSnap.exists) {
      return { success: true, invoice: { ...(docSnap.data() as GstInvoice), invoice_id: docSnap.id } };
    }

    // 2. Query by order_id
    const byOrderQuery = await adminDb
      .collection('gst_invoices')
      .where('order_id', '==', cleanId)
      .limit(1)
      .get();
    if (!byOrderQuery.empty) {
      const doc = byOrderQuery.docs[0];
      return { success: true, invoice: { ...(doc.data() as GstInvoice), invoice_id: doc.id } };
    }

    // 3. Query by invoice_number
    const byNumberQuery = await adminDb
      .collection('gst_invoices')
      .where('invoice_number', '==', cleanId)
      .limit(1)
      .get();
    if (!byNumberQuery.empty) {
      const doc = byNumberQuery.docs[0];
      return { success: true, invoice: { ...(doc.data() as GstInvoice), invoice_id: doc.id } };
    }

    return { success: false, error: `Invoice '${cleanId}' not found.` };
  } catch (err: any) {
    console.error(`Error in getGstInvoiceByIdOrOrder for '${cleanId}':`, err);
    return { success: false, error: err.message || 'Failed to fetch invoice.' };
  }
}

/**
 * Lists invoices for admin reporting.
 */
export async function listGstInvoices(
  adminDb: any,
  filters?: {
    customerType?: string;
    financialYear?: string;
    status?: string;
    limit?: number;
  }
): Promise<{ success: boolean; invoices: GstInvoice[]; error?: string }> {
  try {
    let query: any = adminDb.collection('gst_invoices');

    if (filters?.customerType) {
      query = query.where('gst_customer_type', '==', filters.customerType.toUpperCase());
    }
    if (filters?.financialYear) {
      query = query.where('financial_year', '==', filters.financialYear);
    }

    const snap = await query.limit(filters?.limit || 50).get();
    const invoices: GstInvoice[] = [];

    snap.forEach((doc: any) => {
      invoices.push({ ...(doc.data() as GstInvoice), invoice_id: doc.id });
    });

    return { success: true, invoices };
  } catch (err: any) {
    console.error('Error in listGstInvoices:', err);
    return { success: false, invoices: [], error: err.message || 'Failed to list invoices.' };
  }
}

/**
 * Service function alias for explicit GST Invoice finalization.
 */
export const finalizeGstInvoiceForOrder = createOrFetchGstInvoice;

