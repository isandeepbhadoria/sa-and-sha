import { GstInvoice, InvoiceType } from './invoiceTypes';
import { getSellerTaxConfigFromFirestore, validateSellerTaxConfig, calculateFinancialYear } from './sellerTaxConfig';
import { loadProductTaxMasterFromFirestore } from './productTaxMaster';
import { getShippingTaxConfigFromFirestore } from './shippingTaxConfig';
import { getInvoiceNumberingConfigFromFirestore } from './invoiceNumberingConfig';
import { buildGstInvoiceData } from './invoiceCalculation';
import { generateInvoiceNumberInTransaction } from './invoiceEngine';

export interface FinalizeStoreSaleInvoiceResult {
  success: boolean;
  invoice?: GstInvoice;
  code?: string;
  error?: string;
  reused?: boolean;
}

/**
 * Finalizes a GST invoice for a store (walk-in) sale.
 *
 * Unlike online orders, a store sale is only ever created once payment has been
 * collected in full and the goods have physically left the store - there's no
 * COD-dispatch / prepaid-fulfillment state machine to evaluate, so unlike
 * `createOrFetchGstInvoice` this has no eligibility gate: it's always immediately
 * eligible at creation time.
 *
 * Reuses the exact same seller/shipping/product tax configuration, the same
 * calculation logic (buildGstInvoiceData), and critically the SAME sequential
 * invoice number counter (via generateInvoiceNumberInTransaction) as online
 * orders, so invoice numbering stays one continuous series across both sales
 * channels - required for GST return filing.
 */
export async function finalizeGstInvoiceForStoreSale(
  adminDb: any,
  saleId: string,
  saleData: any,
  options?: { createdBy?: string }
): Promise<FinalizeStoreSaleInvoiceResult> {
  const cleanSaleId = String(saleId).trim();
  const createdBy = options?.createdBy || 'system';
  const invoiceType: InvoiceType = 'TAX_INVOICE';

  try {
    // Idempotency: an invoice for this store sale may already exist.
    const existingSnap = await adminDb
      .collection('gst_invoices')
      .where('order_id', '==', cleanSaleId)
      .where('invoice_type', '==', invoiceType)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      return {
        success: true,
        invoice: { ...(existingDoc.data() as GstInvoice), invoice_id: existingDoc.id },
        reused: true
      };
    }

    const [seller, shippingTaxConfig, numberingConfig] = await Promise.all([
      getSellerTaxConfigFromFirestore(adminDb),
      getShippingTaxConfigFromFirestore(adminDb),
      getInvoiceNumberingConfigFromFirestore(adminDb)
    ]);

    await loadProductTaxMasterFromFirestore(adminDb);

    const sellerValidation = validateSellerTaxConfig(seller);
    if (!sellerValidation.valid) {
      return {
        success: false,
        code: sellerValidation.code || 'SELLER_TAX_CONFIGURATION_REQUIRED',
        error: sellerValidation.error || 'Seller tax configuration required before invoice finalization.'
      };
    }

    const calcResult = buildGstInvoiceData(saleData, {
      sellerConfig: seller,
      shippingTaxConfig,
      invoiceType,
      createdBy
    });

    if (calcResult.success === false) {
      return { success: false, code: calcResult.code, error: calcResult.error };
    }

    const saleDate = saleData.created_at || new Date().toISOString();
    const financialYear = calculateFinancialYear(saleDate);
    const invoiceDocId = `inv_${cleanSaleId}_${invoiceType.toLowerCase()}`;

    let createdInvoice: GstInvoice | null = null;

    await adminDb.runTransaction(async (transaction: any) => {
      const doubleCheckSnap = await transaction.get(adminDb.collection('gst_invoices').doc(invoiceDocId));
      if (doubleCheckSnap.exists) {
        createdInvoice = doubleCheckSnap.data() as GstInvoice;
        return;
      }

      const invoiceNumber = await generateInvoiceNumberInTransaction(transaction, adminDb, financialYear, numberingConfig);

      const nowIso = new Date().toISOString();
      const invoicePayload = {
        ...calcResult.invoice,
        invoice_id: invoiceDocId,
        invoice_number: invoiceNumber,
        status: 'FINALIZED',
        finalized_at: nowIso,
        finalized_trigger: 'STORE_SALE',
        finalized_by: createdBy
      } as GstInvoice;

      transaction.set(adminDb.collection('gst_invoices').doc(invoiceDocId), invoicePayload);

      transaction.update(adminDb.collection('store_sales').doc(cleanSaleId), {
        invoice_id: invoiceDocId,
        invoice_number: invoiceNumber,
        invoice_status: 'FINALIZED',
        invoiced_at: nowIso
      });

      const auditRef = adminDb.collection('admin_audit_logs').doc();
      transaction.set(auditRef, {
        event_type: 'invoice_created',
        action: 'INVOICE_FINALIZED',
        invoice_id: invoiceDocId,
        invoice_number: invoiceNumber,
        order_id: cleanSaleId,
        sale_channel: 'store',
        trigger: 'STORE_SALE',
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

    return { success: true, invoice: createdInvoice, reused: false };
  } catch (err: any) {
    console.error(`[STORE SALE INVOICE ENGINE] Error generating invoice for sale ${cleanSaleId}:`, err);
    return {
      success: false,
      error: `Failed to generate GST invoice: ${err.message || String(err)}`
    };
  }
}
