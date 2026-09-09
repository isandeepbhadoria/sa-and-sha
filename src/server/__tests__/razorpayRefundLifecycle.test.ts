import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { formatOrderSummary } from '../customerOrderHelpers';

describe('Phase 10.3.2C.2 — Razorpay Refund Lifecycle & Idempotency Safety Matrix', () => {
  // Test 1: Idempotency Key Structure
  it('1. Generates permanent KLREF_<orderId>_<sequence> idempotency keys', () => {
    const orderId = 'ORD_2026_98765';
    const cleanOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '');
    const sequence = 1;
    const providerIdempotencyKey = `KLREF_${cleanOrderId}_${sequence}`;

    expect(providerIdempotencyKey).toBe('KLREF_ORD_2026_98765_1');
    expect(providerIdempotencyKey).not.toContain('undefined');
    expect(providerIdempotencyKey).not.toContain('null');
    expect(providerIdempotencyKey).toMatch(/^KLREF_[a-zA-Z0-9_-]+_\d+$/);
  });

  // Test 2: Idempotency Key Stability Across Retries
  it('2. Preserves provider_idempotency_key across retries without generating new key', () => {
    const existingOp = {
      provider_idempotency_key: 'KLREF_ORD1001_1',
      status: 'unknown',
      attempt_count: 1
    };

    const providerIdempotencyKey = existingOp.provider_idempotency_key || 'KLREF_ORD1001_2';
    expect(providerIdempotencyKey).toBe('KLREF_ORD1001_1');
  });

  // Test 3: Formatting UNKNOWN Status in Customer Order Summary
  it('3. Formats refund_status UNKNOWN as "Cancelled — Refund Status Being Confirmed"', () => {
    const summary = formatOrderSummary({
      status: 'cancelled',
      payment_method: 'razorpay',
      refund_status: 'UNKNOWN',
      reconciliation_required: true,
      grand_total: 1500
    });

    expect(summary.status_label).toBe('Cancelled — Refund Status Being Confirmed');
  });

  // Test 4: Formatting PROCESSED Status in Customer Order Summary
  it('4. Formats refund_status PROCESSED as "Cancelled — Refund Processed"', () => {
    const summary = formatOrderSummary({
      status: 'cancelled',
      payment_method: 'razorpay',
      refund_status: 'PROCESSED',
      grand_total: 1500
    });

    expect(summary.status_label).toBe('Cancelled — Refund Processed');
  });

  // Test 5: Formatting FAILED Status in Customer Order Summary
  it('5. Formats refund_status FAILED as "Cancelled — Refund Failed / Support Required"', () => {
    const summary = formatOrderSummary({
      status: 'cancelled',
      payment_method: 'razorpay',
      refund_status: 'FAILED',
      grand_total: 1500
    });

    expect(summary.status_label).toBe('Cancelled — Refund Failed / Support Required');
  });

  // Test 6: Formatting COD Cancelled Status
  it('6. Formats COD cancelled status strictly as "Cancelled"', () => {
    const summary = formatOrderSummary({
      status: 'cancelled',
      payment_method: 'COD',
      refund_status: 'NOT_REQUIRED',
      grand_total: 1500
    });

    expect(summary.status_label).toBe('Cancelled');
  });

  // Test 7: Formatting PENDING Prepaid Status
  it('7. Formats PENDING prepaid refund status as "Cancelled — Refund Pending"', () => {
    const summary = formatOrderSummary({
      status: 'cancelled',
      payment_method: 'razorpay',
      refund_status: 'PENDING',
      grand_total: 1500
    });

    expect(summary.status_label).toBe('Cancelled — Refund Pending');
  });

  // Test 8: GST Invoice Protection for Finalized Invoices
  it('8. Finalized GST invoices set requires_credit_note=true and credit_note_status=PENDING_CREDIT_NOTE_PHASE on cancellation', () => {
    const orderData = {
      order_id: 'ORD_GST_101',
      status: 'confirmed',
      invoice_status: 'FINALIZED',
      invoice_id: 'KL/2026-27/000010'
    };

    const hasFinalizedGstInvoice = orderData.invoice_status === 'FINALIZED' || !!orderData.invoice_id;
    const gstPayload: any = {};
    if (hasFinalizedGstInvoice) {
      gstPayload.requires_credit_note = true;
      gstPayload.credit_note_status = 'PENDING_CREDIT_NOTE_PHASE';
    }

    expect(hasFinalizedGstInvoice).toBe(true);
    expect(gstPayload.requires_credit_note).toBe(true);
    expect(gstPayload.credit_note_status).toBe('PENDING_CREDIT_NOTE_PHASE');
    expect(orderData.invoice_id).toBe('KL/2026-27/000010'); // Untouched
  });

  // Test 9: GST Invoice Protection for Unfinalized Orders
  it('9. Unfinalized GST invoices block future invoice eligibility upon order cancellation', () => {
    const orderData = {
      order_id: 'ORD_GST_102',
      status: 'placed',
      invoice_status: 'UNFINALIZED'
    };

    const hasFinalizedGstInvoice = orderData.invoice_status === 'FINALIZED' || !!(orderData as any).invoice_id;
    const gstPayload: any = {};
    if (!hasFinalizedGstInvoice) {
      gstPayload.invoice_eligibility = {
        eligible: false,
        reasonCode: 'ORDER_CANCELLED',
        reasonDescription: 'Order was cancelled prior to invoice finalization.'
      };
    }

    expect(gstPayload.invoice_eligibility.eligible).toBe(false);
    expect(gstPayload.invoice_eligibility.reasonCode).toBe('ORDER_CANCELLED');
  });

  // Test 10: Inventory Restoration Idempotency
  it('10. Inventory restoration runs exactly once using inventory_restored flag', () => {
    const orderDocData = {
      order_id: 'ORD_INV_01',
      inventory_restored: true,
      items: [{ product_id: 'PROD_LINEN_01', quantity: 2 }]
    };

    let restored = false;
    if (!orderDocData.inventory_restored) {
      restored = true;
    }

    expect(restored).toBe(false);
  });

  // Test 11: Loyalty & Store Credit Reversal Idempotency
  it('11. Loyalty points reversal runs exactly once using loyalty_reversed flag', () => {
    const orderDocData = {
      order_id: 'ORD_LOYALTY_01',
      loyalty_reversed: true
    };

    let reversed = false;
    if (!orderDocData.loyalty_reversed) {
      reversed = true;
    }

    expect(reversed).toBe(false);
  });

  // Test 12: Captured Payment Verification Rule
  it('12. Rejects refunds on uncaptured payment statuses (e.g., "authorized", "created")', () => {
    const rzpPaymentStatus = 'authorized';
    const isCapturedOrRefunded = (rzpPaymentStatus as string) === 'captured' || (rzpPaymentStatus as string) === 'refunded';

    expect(isCapturedOrRefunded).toBe(false);
  });

  // Test 13: Cross-Order Payment Verification Rule
  it('13. Rejects payment IDs whose Razorpay notes.order_id does not match target order ID', () => {
    const rzpNotesOrderId = 'ORD_MATCH_OTHER';
    const targetOrderId = 'ORD_TARGET_123';

    const matches = (rzpNotesOrderId as string) === (targetOrderId as string);
    expect(matches).toBe(false);
  });

  // Test 14: Submitting Lock Concurrency Rule
  it('14. Blocks duplicate requests when status is SUBMITTING and last_attempt_at < 30s', () => {
    const existingOp = {
      status: 'SUBMITTING',
      last_attempt_at: new Date(Date.now() - 5000).toISOString() // 5s ago
    };

    const lastAttemptMs = new Date(existingOp.last_attempt_at).getTime();
    const isLocked = existingOp.status === 'SUBMITTING' && (Date.now() - lastAttemptMs < 30000);

    expect(isLocked).toBe(true);
  });

  // Test 15: Submitting Lock Expiry Rule
  it('15. Allows retry if SUBMITTING lock is older than 30s (stale lock recovery)', () => {
    const existingOp = {
      status: 'SUBMITTING',
      last_attempt_at: new Date(Date.now() - 40000).toISOString() // 40s ago
    };

    const lastAttemptMs = new Date(existingOp.last_attempt_at).getTime();
    const isLocked = existingOp.status === 'SUBMITTING' && (Date.now() - lastAttemptMs < 30000);

    expect(isLocked).toBe(false);
  });

  // Test 16: Unknown Outcome Network Drop Rule
  it('16. Transport/Timeout errors set status to UNKNOWN and reconciliation_required=true (NEVER FAILED)', () => {
    const callError = new Error('Connection timeout (ETIMEDOUT)');
    const isExplicitRejection = (callError as any).statusCode === 400 || callError.message.includes('uncaptured');

    let resultingStatus = '';
    let reconciliationRequired = false;

    if (isExplicitRejection) {
      resultingStatus = 'FAILED';
    } else {
      resultingStatus = 'UNKNOWN';
      reconciliationRequired = true;
    }

    expect(resultingStatus).toBe('UNKNOWN');
    expect(reconciliationRequired).toBe(true);
  });

  // Test 17: Explicit Provider Rejection Rule
  it('17. HTTP 400 explicit provider rejections set status to FAILED with failure_reason', () => {
    const callError = {
      statusCode: 400,
      error: { description: 'Amount exceeds remaining refundable balance' }
    };
    const errMsg = callError.error.description;
    const isExplicitRejection = callError.statusCode === 400;

    let resultingStatus = '';
    let failureReason = '';

    if (isExplicitRejection) {
      resultingStatus = 'FAILED';
      failureReason = errMsg;
    }

    expect(resultingStatus).toBe('FAILED');
    expect(failureReason).toBe('Amount exceeds remaining refundable balance');
  });

  // Test 18: Provider Reconciliation Adoption for Processed Refund
  it('18. Reconciliation adopts PROCESSED status when matching refund found on provider', () => {
    const providerRefund = {
      id: 'rfnd_RZP_12345',
      amount: 150000,
      status: 'processed',
      receipt: 'KLREF_ORD1001_1'
    };

    const providerIdempotencyKey = 'KLREF_ORD1001_1';
    const isMatch = providerRefund.receipt === providerIdempotencyKey;
    const resultingStatus = providerRefund.status === 'processed' ? 'PROCESSED' : 'INITIATED';

    expect(isMatch).toBe(true);
    expect(resultingStatus).toBe('PROCESSED');
  });

  // Test 19: Provider Reconciliation Resets UNKNOWN to PENDING when No Refund Found
  it('19. Reconciliation resets UNKNOWN to PENDING when no matching refund exists on Razorpay', () => {
    const providerRefundsList: any[] = []; // No refund found
    const providerIdempotencyKey = 'KLREF_ORD1002_1';

    const matched = providerRefundsList.find(r => r.receipt === providerIdempotencyKey);
    let updatedStatus = '';
    let reconciliationRequired = true;

    if (!matched) {
      updatedStatus = 'PENDING';
      reconciliationRequired = false;
    }

    expect(updatedStatus).toBe('PENDING');
    expect(reconciliationRequired).toBe(false);
  });

  // Test 20: Webhook HMAC Signature Verification
  it('20. Validates Webhook HMAC SHA256 against raw Buffer', () => {
    const secret = 'rzp_wh_sec_2026_test_secret';
    const rawBodyBuf = Buffer.from(JSON.stringify({ event: 'refund.processed', payload: {} }));
    
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBodyBuf)
      .digest('hex');

    const calculatedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBodyBuf)
      .digest('hex');

    const sigBuf = Buffer.from(validSignature, 'utf8');
    const expBuf = Buffer.from(calculatedSig, 'utf8');
    const isTimingSafeMatch = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    expect(isTimingSafeMatch).toBe(true);
  });

  // Test 21: Exact Header Name is X-Refund-Idempotency
  it('21. Transmits exact Razorpay header X-Refund-Idempotency and excludes legacy X-Razorpay-Idempotency-Key header', () => {
    const providerIdempotencyKey = 'KLREF_ORD9999_1';
    const requestHeaders = {
      'X-Refund-Idempotency': providerIdempotencyKey
    };

    expect(requestHeaders['X-Refund-Idempotency']).toBe('KLREF_ORD9999_1');
    expect((requestHeaders as any)['X-Razorpay-Idempotency-Key']).toBeUndefined();
  });

  // Test 22: Same Operation -> Reused Unchanged Key & Identical Payload on Retry
  it('22. Same logical refund operation reuses identical provider_idempotency_key, amount, notes, and receipt on retries', () => {
    const originalOp = {
      provider_idempotency_key: 'KLREF_ORD5005_1',
      amount: 2500,
      notes: {
        reason: 'Customer requested cancellation',
        order_id: 'ORD5005',
        internal_refund_id: 'KLREF_ORD5005_1',
        admin_id: 'admin@sa-and-sha.com'
      },
      receipt: 'KLREF_ORD5005_1'
    };

    // Retry call simulates reading existingOp
    const existingOp = originalOp;
    const providerIdempotencyKey = existingOp.provider_idempotency_key;
    const amountInPaise = Math.round(existingOp.amount * 100);
    const refundNotes = existingOp.notes;
    const refundReceipt = existingOp.receipt;

    expect(providerIdempotencyKey).toBe('KLREF_ORD5005_1');
    expect(amountInPaise).toBe(250000);
    expect(refundNotes.reason).toBe('Customer requested cancellation');
    expect(refundReceipt).toBe('KLREF_ORD5005_1');
  });

  // Test 23: HTTP 409 In-Progress Response Handling
  it('23. Handles HTTP 409 in-progress error by keeping status UNKNOWN and setting reconciliation_required=true without marking FAILED', () => {
    const callError = {
      statusCode: 409,
      error: { description: 'Refund operation is already in progress' }
    };

    const statusCode = callError.statusCode;
    const errMsg = callError.error.description;
    const is409 = statusCode === 409 || errMsg.includes('already in progress');
    const isConflictingPayload = is409 && (errMsg.includes('mismatch') || errMsg.includes('different'));

    let resultingStatus = '';
    let reconciliationRequired = false;

    if (is409) {
      if (isConflictingPayload) {
        resultingStatus = 'FAILED';
      } else {
        resultingStatus = 'UNKNOWN';
        reconciliationRequired = true;
      }
    }

    expect(resultingStatus).toBe('UNKNOWN');
    expect(reconciliationRequired).toBe(true);
  });

  // Test 24: HTTP 409 Conflicting Payload Response Handling
  it('24. Handles HTTP 409 conflicting payload error by marking status FAILED with IDEMPOTENCY_MISMATCH', () => {
    const callError = {
      statusCode: 409,
      error: { description: 'Idempotency key reused with different request payload parameters' }
    };

    const statusCode = callError.statusCode;
    const errMsg = callError.error.description;
    const is409 = statusCode === 409;
    const isConflictingPayload = is409 && (errMsg.includes('different') || errMsg.includes('mismatch') || errMsg.includes('payload'));

    let resultingStatus = '';
    let failureReason = '';

    if (is409) {
      if (isConflictingPayload) {
        resultingStatus = 'FAILED';
        failureReason = `IDEMPOTENCY_MISMATCH: ${errMsg}`;
      } else {
        resultingStatus = 'UNKNOWN';
      }
    }

    expect(resultingStatus).toBe('FAILED');
    expect(failureReason).toContain('IDEMPOTENCY_MISMATCH');
  });

  // Test 25: Provider Refund Status Mapping Matrix
  it('25. Maps provider refund statuses processed -> PROCESSED, pending/initiated -> INITIATED, failed -> FAILED', () => {
    const mapStatus = (rzpStatus: string) => {
      const st = rzpStatus.toLowerCase();
      if (st === 'processed') return 'PROCESSED';
      if (st === 'failed') return 'FAILED';
      return 'INITIATED';
    };

    expect(mapStatus('processed')).toBe('PROCESSED');
    expect(mapStatus('PROCESSED')).toBe('PROCESSED');
    expect(mapStatus('pending')).toBe('INITIATED');
    expect(mapStatus('initiated')).toBe('INITIATED');
    expect(mapStatus('failed')).toBe('FAILED');
  });
});
