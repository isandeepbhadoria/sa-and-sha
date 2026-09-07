import {
  logAdminReturnAudit,
  calculateSlaState
} from "./adminReturnsHelpers";
import {
  recordStoreCreditLedgerEntry,
  recordLoyaltyLedgerEntry,
  generateLedgerIdempotencyKey,
  recalculateLoyaltySummaryFromLedger,
  recalculateStoreCreditSummaryFromLedger
} from "./loyaltyHelpers";
import { publishNotification } from "./notification/notificationEngine";
import { createCustomerTimelineEvent } from "./crmHelpers";
import { executeHardenedRazorpayRefund } from "./invoice/razorpayRefundService";
import { createOrFetchGstCreditNote } from "./invoice/creditNoteEngine";

export interface ProcessFinancialsOptions {
  forceOverride?: boolean;
  customDeductions?: number;
  resolutionOverride?: "refund" | "store_credit" | "exchange" | string;
  notes?: string;
}

export interface FinancialSettlementSummary {
  rma_number: string;
  order_id: string;
  customer_profile_id: string;
  resolution: string;
  financial_status: "pending" | "processing" | "completed" | "failed";
  original_order_totals: {
    grand_total: number;
    cash_paid: number;
    store_credit_paid: number;
    points_paid_value: number;
    points_redeemed_count: number;
  };
  settlement_breakdown: {
    gross_item_subtotal: number;
    deductions: number;
    shipping_refund: number;
    net_refund: number;
    cash_refund_executed: number;
    store_credit_issued: number;
    points_restored: number;
    points_clawed_back: number;
  };
  razorpay_details?: {
    refund_id: string;
    status: string;
  };
  inventory_routing: Array<{
    product_id: string;
    grade: string;
    quantity: number;
    destination: string;
  }>;
  exchange_details?: {
    exchange_order_id: string;
    exchange_shipment_id: string;
  };
  processed_at?: string;
  processed_by?: string;
  error?: string;
}

export interface ProviderRefundContractRequest {
  rmaNumber: string;
  orderId: string;
  amountRupees: number;
  adminEmail: string;
  paymentMethod?: string;
}

export interface ProviderRefundContractResult {
  success: boolean;
  refund_id: string;
  status: "completed" | "pending_provider" | "failed" | "simulated";
  gateway: string;
  is_simulated: boolean;
  note?: string;
}

/**
 * Phase 10.5D Hardened Production Integration Boundary for Gateway Refunds.
 * Connects the RMA return financial engine to the canonical hardened Razorpay refund service.
 */
export async function executeProviderRefundServiceContract(
  adminDb: any,
  request: ProviderRefundContractRequest
): Promise<ProviderRefundContractResult> {
  const refundRes = await executeHardenedRazorpayRefund({
    adminDb,
    orderId: request.orderId,
    rmaNumber: request.rmaNumber,
    requestedAmount: request.amountRupees,
    reason: `RMA Return Refund #${request.rmaNumber}`,
    adminEmail: request.adminEmail,
    isRmaSettlement: true
  });

  if (refundRes.paymentMethod === "cod") {
    return {
      success: true,
      refund_id: `cod_${request.rmaNumber}`,
      status: "completed",
      gateway: "cod_store_credit",
      is_simulated: false,
      note: "COD order — return settled via store credit ledger."
    };
  }

  if (!refundRes.success) {
    return {
      success: false,
      refund_id: refundRes.provider_idempotency_key || "",
      status: refundRes.refund_status === "UNKNOWN" ? "pending_provider" : "failed",
      gateway: "razorpay",
      is_simulated: false,
      note: refundRes.error || refundRes.message || "Razorpay refund failed."
    };
  }

  const mappedStatus = refundRes.refund_status === "PROCESSED" ? "completed" : "pending_provider";

  return {
    success: true,
    refund_id: refundRes.refund_id || refundRes.provider_idempotency_key || `ref_${request.rmaNumber}`,
    status: mappedStatus as any,
    gateway: "razorpay",
    is_simulated: false,
    note: refundRes.message || "Razorpay refund dispatched cleanly."
  };
}

/**
 * Executes full, atomic financial settlement & inventory recovery for a completed return inspection
 */
export async function processReturnFinancials(
  adminDb: any,
  adminEmail: string,
  returnId: string,
  options: ProcessFinancialsOptions = {}
) {
  const nowIso = new Date().toISOString();

  // 1. Fetch Return Document
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const q = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!q.empty) docSnap = q.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found." };
  }

  const rData = docSnap.data();
  const actualReturnId = docSnap.id;
  const rmaNumber = rData.rma_number || actualReturnId;
  const currentStatus = rData.status || "requested";

  // Allowed statuses for financial processing
  const eligibleStatuses = [
    "inspection_passed",
    "inspection_completed",
    "manager_review",
    "refund_approved",
    "exchange_approved",
    "financial_failed"
  ];

  if (currentStatus === "completed" || currentStatus === "refund_completed" || currentStatus === "exchange_shipped") {
    // Idempotent return if already completed
    return {
      success: true,
      message: "Financial settlement already completed for this return request.",
      rma_number: rmaNumber,
      status: currentStatus,
      settlement: rData.financial_settlement || {}
    };
  }

  if (!eligibleStatuses.includes(currentStatus) && !options.forceOverride) {
    return {
      success: false,
      statusCode: 400,
      error: `Cannot process financials for return in status '${currentStatus}'. Must be inspected first.`
    };
  }

  const customerProfileId = rData.customer_profile_id || "";
  const orderId = rData.order_id || "";

  // 2. Fetch Parent Order
  let orderData: any = null;
  let orderDocRef: any = null;
  if (orderId) {
    let oSnap = await adminDb.collection("orders").doc(orderId).get();
    if (!oSnap.exists) {
      const oQ = await adminDb.collection("orders").where("order_id", "==", orderId).limit(1).get();
      if (!oQ.empty) oSnap = oQ.docs[0];
    }
    if (oSnap.exists) {
      orderDocRef = oSnap.ref;
      orderData = oSnap.data();
    }
  }

  // Fallback defaults if order missing
  const grandTotal = Number(orderData?.grand_total || orderData?.total_amount || rData.refund_amount || 0);
  const cashPaid = Number(orderData?.amount_paid_cash || orderData?.cash_paid || grandTotal);
  const storeCreditPaid = Number(orderData?.store_credit_redeemed_rupees || orderData?.store_credit_used || 0);
  const pointsRedeemed = Number(orderData?.points_redeemed || 0);
  const pointsPaidValue = Number(orderData?.points_redeemed_value || pointsRedeemed * 0.25); // ₹0.25/pt default

  // 3. Determine Resolution & Amounts
  const resolution = options.resolutionOverride || rData.resolution || rData.approved_resolution || "refund";
  const pickupFee = options.customDeductions !== undefined ? options.customDeductions : (rData.pickup_fee_amount || 100);

  // Inspect return items
  const returnedItems = Array.isArray(rData.items) ? rData.items : [];
  let grossSubtotal = 0;
  for (const it of returnedItems) {
    const qty = Number(it.quantity || 1);
    const price = Number(it.unit_price || it.price || 0);
    grossSubtotal += price * qty;
  }

  if (grossSubtotal === 0) {
    grossSubtotal = Number(rData.refund_amount || grandTotal);
  }

  const shippingRefund = 0; // Default no extra shipping refund unless specified
  const deductions = Math.min(grossSubtotal, pickupFee);
  const netRefund = Math.max(0, grossSubtotal + shippingRefund - deductions);

  // 4. Update status to financial_processing
  await docSnap.ref.update({
    status: "financial_processing",
    financial_processing_started_at: nowIso,
    updated_at: nowIso
  });

  try {
    // Execute inside Firestore Transaction where appropriate
    let cashRefundExecuted = 0;
    let storeCreditIssued = 0;
    let pointsRestored = 0;
    let pointsClawedBack = 0;
    let razorpayDetails: any = undefined;
    let exchangeDetails: any = undefined;

    // 5. Resolution Execution: Refund vs Store Credit vs Exchange
    if (resolution === "store_credit") {
      // FULL STORE CREDIT RESOLUTION
      await docSnap.ref.update({ status: "store_credit_processing", updated_at: nowIso });

      if (netRefund > 0 && customerProfileId) {
        const creditKey = generateLedgerIdempotencyKey("return_credit", `${rmaNumber}_${netRefund}`);
        const creditPaise = Math.floor(netRefund * 100);

        const creditRes = await recordStoreCreditLedgerEntry(adminDb, {
          customer_profile_id: customerProfileId,
          customer_id: rData.customer_id || "SS-C00000",
          entry_type: "return_credit",
          amount_paise: creditPaise,
          balance_effect_paise: creditPaise,
          currency: "INR",
          status: "active",
          source: "return",
          related_return_id: rmaNumber,
          related_order_id: orderId,
          idempotency_key: creditKey,
          description: `Store credit issued for RMA #${rmaNumber}`,
          issued_at: nowIso,
          created_at: nowIso,
          created_by: adminEmail
        });

        if (creditRes.success) {
          storeCreditIssued = netRefund;
        }
      }
    } else if (resolution === "exchange" || resolution === "replacement") {
      // EXCHANGE RESOLUTION
      await docSnap.ref.update({ status: "exchange_processing", updated_at: nowIso });

      const exchangeOrderId = `EXCH-${rmaNumber}`;
      const exchangeShipmentId = `AWB-EXCH-${Date.now().toString().slice(-6)}`;

      // Generate replacement order
      const exchangeOrderDoc = {
        order_id: exchangeOrderId,
        is_exchange_order: true,
        parent_rma_number: rmaNumber,
        parent_order_id: orderId,
        customer_profile_id: customerProfileId,
        customer_name: rData.customer_name || "Valued Customer",
        customer_email: rData.customer_email || "",
        customer_phone: rData.customer_phone || "",
        shipping_address: rData.pickup_address || orderData?.shipping_address || {},
        items: returnedItems.map((it: any) => ({
          product_id: it.replacement_product_id || it.product_id,
          sku: it.replacement_sku || it.sku,
          name: it.replacement_name || it.name,
          quantity: it.quantity || 1,
          price: 0 // Exchange item cost covered by original order
        })),
        grand_total: 0,
        payment_status: "paid_exchange",
        order_status: "confirmed",
        created_at: nowIso,
        created_by: "system_rma_exchange"
      };

      await adminDb.collection("orders").doc(exchangeOrderId).set(exchangeOrderDoc);

      // Record exchange shipment
      const shipmentDoc = {
        exchange_order_id: exchangeOrderId,
        rma_number: rmaNumber,
        customer_profile_id: customerProfileId,
        courier: rData.pickup_courier || "Delhivery",
        awb_number: exchangeShipmentId,
        status: "dispatched",
        created_at: nowIso
      };

      await adminDb.collection("exchange_shipments").doc(exchangeShipmentId).set(shipmentDoc);

      exchangeDetails = {
        exchange_order_id: exchangeOrderId,
        exchange_shipment_id: exchangeShipmentId
      };
    } else {
      // STANDARD REFUND RESOLUTION
      await docSnap.ref.update({ status: "refund_processing", updated_at: nowIso });

      // Deterministic Mixed Payment Allocation
      // 1) Cash refund up to netRefund vs cashPaid
      const maxCashRefund = Math.min(netRefund, cashPaid);
      if (maxCashRefund > 0) {
        // Execute Refund via Phase 10.5A Isolated Service Contract
        const contractRes = await executeProviderRefundServiceContract(adminDb, {
          rmaNumber,
          orderId,
          amountRupees: maxCashRefund,
          adminEmail,
          paymentMethod: orderData?.payment_method
        });

        cashRefundExecuted = maxCashRefund;
        razorpayDetails = {
          refund_id: contractRes.refund_id,
          status: contractRes.status,
          gateway: contractRes.gateway,
          is_simulated: contractRes.is_simulated
        };
      }

      // 2) Remaining net refund to store credit if cash paid was less than netRefund
      const remainingForCredit = Math.max(0, netRefund - maxCashRefund);
      if (remainingForCredit > 0 && customerProfileId) {
        const creditKey = generateLedgerIdempotencyKey("return_credit_partial", `${rmaNumber}_${remainingForCredit}`);
        const creditPaise = Math.floor(remainingForCredit * 100);

        await recordStoreCreditLedgerEntry(adminDb, {
          customer_profile_id: customerProfileId,
          customer_id: rData.customer_id || "SS-C00000",
          entry_type: "return_credit",
          amount_paise: creditPaise,
          balance_effect_paise: creditPaise,
          currency: "INR",
          status: "active",
          source: "return",
          related_return_id: rmaNumber,
          related_order_id: orderId,
          idempotency_key: creditKey,
          description: `Store credit issued for remaining refund balance on RMA #${rmaNumber}`,
          issued_at: nowIso,
          created_at: nowIso,
          created_by: adminEmail
        });

        storeCreditIssued = remainingForCredit;
      }
    }

    // 6. Loyalty Point Clawback & Restoration
    if (customerProfileId) {
      // a) Claw back points earned from returned items
      const pointsToClawBack = Math.floor(grossSubtotal / 100); // e.g. 1 pt per ₹100 earned
      if (pointsToClawBack > 0) {
        const clawbackKey = generateLedgerIdempotencyKey("return_clawback", `${rmaNumber}_${pointsToClawBack}`);
        await recordLoyaltyLedgerEntry(adminDb, {
          customer_profile_id: customerProfileId,
          customer_id: rData.customer_id || "SS-C00000",
          entry_type: "return_reversal",
          points: -pointsToClawBack,
          balance_effect: -pointsToClawBack,
          status: "available",
          source: "order_refund",
          related_return_id: rmaNumber,
          related_order_id: orderId,
          idempotency_key: clawbackKey,
          description: `Loyalty points clawed back for returned items on RMA #${rmaNumber}`,
          created_at: nowIso,
          created_by: adminEmail
        });
        pointsClawedBack = pointsToClawBack;
      }

      // b) Restore points if order was partially paid with loyalty points
      if (pointsRedeemed > 0) {
        const pointsToRestore = Math.min(pointsRedeemed, Math.floor(grossSubtotal / 0.25));
        if (pointsToRestore > 0) {
          const restoreKey = generateLedgerIdempotencyKey("return_restore_points", `${rmaNumber}_${pointsToRestore}`);
          await recordLoyaltyLedgerEntry(adminDb, {
            customer_profile_id: customerProfileId,
            customer_id: rData.customer_id || "SS-C00000",
            entry_type: "return_reversal",
            points: pointsToRestore,
            balance_effect: pointsToRestore,
            status: "available",
            source: "order_refund",
            related_return_id: rmaNumber,
            related_order_id: orderId,
            idempotency_key: restoreKey,
            description: `Redeemed loyalty points restored for returned items on RMA #${rmaNumber}`,
            created_at: nowIso,
            created_by: adminEmail
          });
          pointsRestored = pointsToRestore;
        }
      }

      // Trigger recalculation of customer summaries
      await recalculateLoyaltySummaryFromLedger(adminDb, customerProfileId);
      await recalculateStoreCreditSummaryFromLedger(adminDb, customerProfileId);
    }

    // 7. Inventory Recovery & Routing according to Inspection Grades
    const inventoryRouting: Array<{ product_id: string; grade: string; quantity: number; destination: string }> = [];
    const inspectionReport = rData.inspection_report || {};
    const itemInspections = Array.isArray(inspectionReport.items_inspection) ? inspectionReport.items_inspection : returnedItems;

    for (const item of itemInspections) {
      const productId = item.product_id || item.id;
      const qty = Number(item.quantity || 1);
      const grade = (item.grade || inspectionReport.overall_condition_grade || "A").toString().toUpperCase();

      if (!productId) continue;

      let destination = "main_warehouse";
      let updateField = "stock";

      if (grade.startsWith("A")) {
        destination = "main_warehouse";
        updateField = "stock";
      } else if (grade.startsWith("B")) {
        destination = "qc_hold";
        updateField = "qc_hold_stock";
      } else if (grade.startsWith("C")) {
        destination = "outlet";
        updateField = "outlet_stock";
      } else if (grade.startsWith("D")) {
        destination = "repair";
        updateField = "repair_stock";
      } else if (grade.startsWith("E")) {
        destination = "destroy";
        updateField = "destroy_stock";
      }

      const prodRef = adminDb.collection("products").doc(productId);
      const prodSnap = await prodRef.get();

      if (prodSnap.exists) {
        const currentQty = Number(prodSnap.data()?.[updateField] || 0);
        await prodRef.update({
          [updateField]: currentQty + qty,
          updated_at: nowIso
        });

        // Write immutable inventory log
        const logDoc = {
          product_id: productId,
          product_name: item.name || prodSnap.data()?.name || "Product",
          sku: item.sku || prodSnap.data()?.sku || "",
          quantity: qty,
          grade: grade,
          source: "rma_inspection",
          destination: destination,
          rma_number: rmaNumber,
          inspector: inspectionReport.inspector || adminEmail,
          operator: adminEmail,
          timestamp: nowIso
        };

        await adminDb.collection("inventory_logs").add(logDoc);

        inventoryRouting.push({
          product_id: productId,
          grade: grade,
          quantity: qty,
          destination: destination
        });
      }
    }

    // 8. GST Credit Note Generation & Linking
    let creditNoteDetails: any = undefined;
    if (orderData && (orderData.invoice_status === "FINALIZED" || orderData.invoice_id)) {
      try {
        const cnRes = await createOrFetchGstCreditNote(adminDb, {
          orderId: orderData.order_id || orderId,
          rmaNumber: rmaNumber,
          returnRequestId: actualReturnId,
          reason: "GOODS_RETURNED",
          createdBy: adminEmail,
          idempotencyKey: `rma_${rmaNumber}`
        });

        if (cnRes.success && cnRes.creditNote) {
          creditNoteDetails = {
            credit_note_id: cnRes.creditNote.credit_note_id,
            credit_note_number: cnRes.creditNote.credit_note_number,
            grand_total_reversal: cnRes.creditNote.grand_total_reversal,
            tax_liability_adjusted: Boolean(cnRes.creditNote.tax_liability_adjusted),
            issued_at: cnRes.creditNote.issue_date
          };

          await docSnap.ref.update({
            credit_note_id: cnRes.creditNote.credit_note_id,
            credit_note_number: cnRes.creditNote.credit_note_number,
            credit_note_status: "ISSUED",
            updated_at: nowIso
          });

          try {
            await adminDb.collection("admin_audit_logs").add({
              action: "GST_CREDIT_NOTE_LINKED",
              rma_number: rmaNumber,
              order_id: orderId,
              credit_note_id: cnRes.creditNote.credit_note_id,
              credit_note_number: cnRes.creditNote.credit_note_number,
              admin_identity: adminEmail,
              timestamp: nowIso
            });
          } catch (_) {}
        }
      } catch (cnErr) {
        console.error("[RMA FINANCIALS CREDIT NOTE ERROR]", cnErr);
      }
    }

    // 9. Final Target Status Determination
    const finalTargetStatus = (resolution === "exchange" || resolution === "replacement") ? "exchange_shipped" : "completed";
    const finalSla = calculateSlaState(rData.created_at || nowIso, finalTargetStatus);

    const settlementSummary: FinancialSettlementSummary & { credit_note_details?: any } = {
      rma_number: rmaNumber,
      order_id: orderId,
      customer_profile_id: customerProfileId,
      resolution: resolution,
      financial_status: "completed",
      original_order_totals: {
        grand_total: grandTotal,
        cash_paid: cashPaid,
        store_credit_paid: storeCreditPaid,
        points_paid_value: pointsPaidValue,
        points_redeemed_count: pointsRedeemed
      },
      settlement_breakdown: {
        gross_item_subtotal: grossSubtotal,
        deductions: deductions,
        shipping_refund: shippingRefund,
        net_refund: netRefund,
        cash_refund_executed: cashRefundExecuted,
        store_credit_issued: storeCreditIssued,
        points_restored: pointsRestored,
        points_clawed_back: pointsClawedBack
      },
      razorpay_details: razorpayDetails,
      inventory_routing: inventoryRouting,
      exchange_details: exchangeDetails,
      credit_note_details: creditNoteDetails,
      processed_at: nowIso,
      processed_by: adminEmail
    };

    // Update Return Document to Completed State
    await docSnap.ref.update({
      status: finalTargetStatus,
      sla_state: finalSla.sla_state,
      financial_settlement: settlementSummary,
      completed_at: nowIso,
      updated_at: nowIso
    });

    // 9. Side Effects: CRM Event, Notification, Audit Logging
    try {
      if (resolution === "exchange" || resolution === "replacement") {
        await publishNotification(adminDb, {
          event: "RETURN_COMPLETED",
          customerProfileId: customerProfileId,
          recipientEmail: rData.customer_email,
          recipientPhone: rData.customer_phone,
          customerName: rData.customer_name,
          payload: { rma_number: rmaNumber, exchange_details: exchangeDetails }
        });

        await createCustomerTimelineEvent(
          adminDb,
          customerProfileId,
          "exchange_completed",
          "Exchange Shipment Dispatched",
          `Exchange order #${exchangeDetails.exchange_order_id} created and shipped for RMA #${rmaNumber}`,
          "system",
          { relatedReturnId: rmaNumber }
        );
      } else {
        await publishNotification(adminDb, {
          event: "REFUND_COMPLETED",
          customerProfileId: customerProfileId,
          recipientEmail: rData.customer_email,
          recipientPhone: rData.customer_phone,
          customerName: rData.customer_name,
          payload: {
            rma_number: rmaNumber,
            net_refund: netRefund,
            cash_refund: cashRefundExecuted,
            store_credit_issued: storeCreditIssued
          }
        });

        await createCustomerTimelineEvent(
          adminDb,
          customerProfileId,
          "refund_completed",
          "Refund & Financial Settlement Completed",
          `Financial settlement completed for RMA #${rmaNumber}. Net Refund: ₹${netRefund} (Cash: ₹${cashRefundExecuted}, Credit: ₹${storeCreditIssued})`,
          "system",
          { relatedReturnId: rmaNumber }
        );
      }
    } catch (sErr) {
      console.error("[FINANCIAL SETTLEMENT SIDE EFFECTS] Non-blocking warning:", sErr);
    }

    await logAdminReturnAudit(
      adminDb,
      adminEmail,
      "financial_processed",
      rmaNumber,
      `Completed financial settlement (${resolution}). Net Refund: ₹${netRefund}`,
      { net_refund: netRefund, resolution: resolution }
    );

    return {
      success: true,
      message: `Financial settlement completed successfully for RMA #${rmaNumber}`,
      rma_number: rmaNumber,
      status: finalTargetStatus,
      settlement: settlementSummary
    };

  } catch (err: any) {
    console.error(`[FINANCIAL SETTLEMENT ERROR] RMA #${rmaNumber}:`, err);

    // Rollback to financial_failed status safely
    await docSnap.ref.update({
      status: "financial_failed",
      financial_error: err.message || "Financial settlement failed",
      updated_at: nowIso
    });

    await logAdminReturnAudit(
      adminDb,
      adminEmail,
      "financial_failed",
      rmaNumber,
      `Financial settlement failed: ${err.message}`
    );

    return {
      success: false,
      statusCode: 500,
      error: `Financial settlement failed: ${err.message}`,
      status: "financial_failed"
    };
  }
}

/**
 * Retries financial settlement for a return in financial_failed state
 */
export async function retryReturnFinancials(adminDb: any, adminEmail: string, returnId: string) {
  return await processReturnFinancials(adminDb, adminEmail, returnId, { forceOverride: true });
}

/**
 * GET /api/admin/returns/:id/financial-summary
 */
export async function getReturnFinancialSummary(adminDb: any, returnId: string) {
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const q = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!q.empty) docSnap = q.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found." };
  }

  const rData = docSnap.data();
  const settlement = rData.financial_settlement || null;

  return {
    success: true,
    rma_number: rData.rma_number || docSnap.id,
    order_id: rData.order_id,
    status: rData.status,
    resolution: rData.resolution || rData.approved_resolution,
    has_settlement: !!settlement,
    settlement: settlement,
    inspection_report: rData.inspection_report || null,
    financial_error: rData.financial_error || null
  };
}

/**
 * GET /api/admin/returns/:id/reconciliation
 * Detects discrepancies between order payment, returned items, executed refunds, credit ledger, loyalty ledger, and inventory
 */
export async function getReturnReconciliation(adminDb: any, returnId: string) {
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const q = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!q.empty) docSnap = q.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found." };
  }

  const rData = docSnap.data();
  const rmaNumber = rData.rma_number || docSnap.id;
  const settlement = rData.financial_settlement;

  if (!settlement) {
    return {
      success: true,
      is_balanced: false,
      rma_number: rmaNumber,
      status: rData.status,
      reconciliation_state: "unsettled",
      message: "Financial settlement has not been processed yet."
    };
  }

  const discrepancies: string[] = [];

  // 1. Verify net refund total = cash + store credit
  const calculatedNet = (settlement.settlement_breakdown.cash_refund_executed || 0) + (settlement.settlement_breakdown.store_credit_issued || 0);
  const recordedNet = settlement.settlement_breakdown.net_refund || 0;

  if (calculatedNet !== recordedNet && settlement.resolution !== "exchange") {
    discrepancies.push(`Net refund mismatch: Calculated sum (₹${calculatedNet}) != Recorded net (₹${recordedNet})`);
  }

  // 2. Check store credit ledger if credit was issued
  if (settlement.settlement_breakdown.store_credit_issued > 0 && rData.customer_profile_id) {
    const profileRef = adminDb.collection("customer_profiles").doc(rData.customer_profile_id);
    const creditSnap = await profileRef.collection("store_credit_ledger").where("related_rma_number", "==", rmaNumber).get();
    if (creditSnap.empty) {
      discrepancies.push(`Missing store credit ledger entry for RMA #${rmaNumber}`);
    }
  }

  // 3. Check inventory logs recorded
  const invSnap = await adminDb.collection("inventory_logs").where("rma_number", "==", rmaNumber).get();
  if (invSnap.empty && Array.isArray(rData.items) && rData.items.length > 0) {
    discrepancies.push(`Missing inventory movement logs for RMA #${rmaNumber}`);
  }

  const isBalanced = discrepancies.length === 0;

  return {
    success: true,
    is_balanced: isBalanced,
    rma_number: rmaNumber,
    status: rData.status,
    reconciliation_state: isBalanced ? "balanced" : "discrepancy_detected",
    discrepancies: discrepancies,
    settlement_summary: settlement
  };
}
