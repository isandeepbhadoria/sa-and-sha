import {
  GstInvoice,
  GstInvoiceLineItem,
  GstInvoiceBuyerSnapshot,
  GstInvoiceAddressSnapshot,
  GstCustomerType,
  InvoiceType
} from './invoiceTypes';
import { SellerTaxConfig, getSellerTaxConfig, validateSellerTaxConfig, calculateFinancialYear } from './sellerTaxConfig';
import { ShippingTaxConfig, getDefaultShippingTaxConfig, validateShippingTaxConfig } from './shippingTaxConfig';
import {
  normalizeGstStateCode,
  getStateNameFromCode,
  determineGstTreatment
} from './gstUtils';
import { lookupProductTaxMetadata } from './productTaxMaster';

/**
 * Safely rounds numbers to 2 decimal places.
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export type BuildGstInvoiceResult =
  | { success: true; invoice: Omit<GstInvoice, 'invoice_id' | 'invoice_number'> & { invoice_number?: string } }
  | {
      success: false;
      code: "SELLER_TAX_CONFIGURATION_REQUIRED" | "SELLER_TAX_CONFIGURATION_INVALID" | "INVOICE_TAX_METADATA_MISSING" | "INVOICE_TOTAL_RECONCILIATION_FAILED";
      error: string;
      details?: any;
    };

export function buildGstInvoiceData(
  order: any,
  options?: {
    sellerConfig?: SellerTaxConfig;
    shippingTaxConfig?: ShippingTaxConfig;
    invoiceNumber?: string;
    invoiceType?: InvoiceType;
    createdBy?: string;
  }
): BuildGstInvoiceResult {
  const seller = options?.sellerConfig || getSellerTaxConfig();
  const createdBy = options?.createdBy || 'system';
  const invoiceType = options?.invoiceType || 'TAX_INVOICE';

  // 1. Validate Seller Tax Config - FAIL CLOSED if incomplete or unverified
  const sellerValidation = validateSellerTaxConfig(seller);
  if (!sellerValidation.valid) {
    return {
      success: false,
      code: sellerValidation.code || "SELLER_TAX_CONFIGURATION_REQUIRED",
      error: sellerValidation.error || "Seller tax configuration required before invoice finalization."
    };
  }

  // 2. Resolve Shipping / Place of Supply state
  const rawShippingState = order.state || order.shipping_address?.state || order.delivery_address?.state;
  const rawShippingGstin = order.gstin || order.gst_details?.gstin || order.billing_address?.gstin;
  const posStateCode = normalizeGstStateCode(rawShippingGstin || rawShippingState, seller.state_code);
  const placeOfSupply = getStateNameFromCode(posStateCode, seller.state);

  // 3. B2C vs B2B Classification
  const rawGstinString = (rawShippingGstin || '').toString().trim().toUpperCase();
  const isGstFormatValid = Boolean(rawGstinString && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(rawGstinString));
  const isGstVerified = Boolean(
    order.gst_details?.valid === true ||
    order.gst_verified === true ||
    order.b2b_verified === true ||
    (order.gst_details && (order.gst_details.status === "ACTIVE" || order.gst_details.valid === true))
  );

  // Require BOTH valid format AND explicit verified GST status snapshot for B2B classification
  const isB2B = isGstFormatValid && isGstVerified;
  const gstCustomerType: GstCustomerType = isB2B ? 'B2B' : 'B2C';

  // 4. Buyer & Address Snapshots
  const cleanEmail = String(order.customer_email || order.email || '').trim().toLowerCase();
  const cleanPhone = String(order.customer_phone || order.phone || '').trim();
  const fullName = order.customer_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Valued Customer';

  const shippingSnapshot: GstInvoiceAddressSnapshot = {
    first_name: order.first_name || undefined,
    last_name: order.last_name || undefined,
    full_name: fullName,
    phone: cleanPhone,
    address_line_1: order.address || order.address_line_1 || 'Address Not Provided',
    address_line_2: order.address_line_2 || undefined,
    city: order.city || 'N/A',
    state: getStateNameFromCode(normalizeGstStateCode(order.state, seller.state_code), seller.state),
    state_code: normalizeGstStateCode(order.state, seller.state_code),
    pincode: order.pincode || '000000',
    country: order.country || 'India'
  };

  const bAddress = order.billing_address || {};
  const billingSnapshot: GstInvoiceAddressSnapshot = {
    first_name: bAddress.first_name || order.first_name || undefined,
    last_name: bAddress.last_name || order.last_name || undefined,
    full_name: bAddress.first_name ? `${bAddress.first_name} ${bAddress.last_name || ''}`.trim() : fullName,
    phone: bAddress.phone || cleanPhone,
    address_line_1: bAddress.address_line_1 || shippingSnapshot.address_line_1,
    address_line_2: bAddress.address_line_2 || shippingSnapshot.address_line_2,
    city: bAddress.city || shippingSnapshot.city,
    state: getStateNameFromCode(normalizeGstStateCode(bAddress.state || shippingSnapshot.state, seller.state_code), seller.state),
    state_code: normalizeGstStateCode(bAddress.state || shippingSnapshot.state_code, seller.state_code),
    pincode: bAddress.pincode || bAddress.postal_code || shippingSnapshot.pincode,
    country: bAddress.country || 'India',
    gstin: rawShippingGstin || null,
    legal_name: order.business_name || order.gst_details?.legal_name || null,
    trade_name: order.gst_details?.trade_name || null,
    is_same_as_shipping: typeof order.billing_same_as_shipping === 'boolean' ? order.billing_same_as_shipping : true
  };

  const buyerSnapshot: GstInvoiceBuyerSnapshot = {
    customer_id: order.customer_id || order.profile_id || 'GUEST',
    customer_type: isB2B ? 'BUSINESS' : 'INDIVIDUAL',
    first_name: order.first_name || undefined,
    last_name: order.last_name || undefined,
    full_name: fullName,
    email: cleanEmail,
    phone: cleanPhone,
    gstin: rawShippingGstin || null,
    legal_name: order.business_name || order.gst_details?.legal_name || null,
    trade_name: order.gst_details?.trade_name || null,
    gst_verified: isGstVerified,
    address_line_1: billingSnapshot.address_line_1,
    address_line_2: billingSnapshot.address_line_2,
    city: billingSnapshot.city,
    state: billingSnapshot.state,
    state_code: billingSnapshot.state_code,
    pincode: billingSnapshot.pincode,
    country: billingSnapshot.country
  };

  // 5. Line Items Tax Calculation - Check Product Tax Master explicitly
  const rawItems: any[] = Array.isArray(order.items) ? order.items : [];
  const orderDiscount = Number(order.discount || order.discount_amount || 0);

  if (rawItems.length === 0) {
    return {
      success: false,
      code: "INVOICE_TAX_METADATA_MISSING",
      error: "Cannot generate GST invoice for order with zero items."
    };
  }

  // Compute total gross amount of items and pre-allocate discounts deterministically
  let totalItemsGross = 0;
  const itemGrossList: Array<{
    qty: number;
    unitPrice: number;
    grossAmount: number;
    lineDiscount: number;
    netAmount: number;
    unitTransactionValue: number;
  }> = [];

  rawItems.forEach((it) => {
    const qty = Math.max(1, Number(it.quantity || 1));
    const unitPrice = round2(Number(it.price || it.unit_price || 0));
    const grossAmount = round2(qty * unitPrice);
    totalItemsGross += grossAmount;
    itemGrossList.push({
      qty,
      unitPrice,
      grossAmount,
      lineDiscount: 0,
      netAmount: grossAmount,
      unitTransactionValue: unitPrice
    });
  });

  let prevDiscountsSum = 0;
  for (let idx = 0; idx < rawItems.length; idx++) {
    const it = rawItems[idx];
    const itemData = itemGrossList[idx];
    let lineDiscount = 0;

    if (typeof it.line_discount === 'number' && it.line_discount > 0) {
      lineDiscount = round2(it.line_discount);
    } else if (orderDiscount > 0 && totalItemsGross > 0) {
      if (idx === rawItems.length - 1) {
        // Last item gets remaining discount balance to prevent rounding drift
        lineDiscount = round2(Math.max(0, orderDiscount - prevDiscountsSum));
      } else {
        lineDiscount = round2((itemData.grossAmount / totalItemsGross) * orderDiscount);
      }
    }

    prevDiscountsSum += lineDiscount;
    const netAmount = Math.max(0, round2(itemData.grossAmount - lineDiscount));
    const unitTransactionValue = itemData.qty > 0 ? round2(netAmount / itemData.qty) : itemData.unitPrice;

    itemData.lineDiscount = lineDiscount;
    itemData.netAmount = netAmount;
    itemData.unitTransactionValue = unitTransactionValue;
  }

  const line_items: GstInvoiceLineItem[] = [];
  let calculatedSubtotal = 0;
  let calculatedDiscountTotal = 0;
  let calculatedTaxableTotal = 0;
  let calculatedCgstTotal = 0;
  let calculatedSgstTotal = 0;
  let calculatedIgstTotal = 0;

  for (let idx = 0; idx < rawItems.length; idx++) {
    const it = rawItems[idx];
    const { qty, unitPrice, grossAmount, lineDiscount, netAmount, unitTransactionValue } = itemGrossList[idx];

    // Strict Product Tax Master Verification using authoritative post-discount transaction value per piece
    const taxLookup = lookupProductTaxMetadata({
      item: it,
      product_id: it.product_id || it.id,
      sku: it.sku,
      tax_class: it.tax_class || it.taxClass,
      category: it.category,
      price: unitTransactionValue,
      invoice_date: order.created_at || order.order_date
    });

    if (!taxLookup.success || !taxLookup.metadata) {
      return {
        success: false,
        code: (taxLookup.code as any) || "INVOICE_TAX_METADATA_MISSING",
        error: taxLookup.error || `Missing verified HSN/GST metadata for item '${it.name || it.sku || idx}'.`,
        details: {
          order_id: String(order.order_id),
          affected_sku: it.sku || it.id,
          missing_field: taxLookup.missing_field || "hsn_code"
        }
      };
    }

    const { hsn_code, gst_rate, tax_category, tax_config_version } = taxLookup.metadata;

    const isTaxInclusive =
      it.is_tax_inclusive !== undefined
        ? Boolean(it.is_tax_inclusive)
        : (taxLookup.metadata as any)?.is_tax_inclusive !== undefined
        ? Boolean((taxLookup.metadata as any).is_tax_inclusive)
        : true;

    const lineNetGross = netAmount;
    const taxableValue = isTaxInclusive
      ? round2(lineNetGross / (1 + gst_rate / 100))
      : round2(lineNetGross);

    const treatment = determineGstTreatment({
      sellerStateCode: seller.state_code,
      placeOfSupplyStateCode: posStateCode,
      gstRate: gst_rate
    });

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (treatment.supply_type === 'INTRASTATE') {
      const taxHalf = round2((taxableValue * (gst_rate / 2)) / 100);
      cgstAmount = taxHalf;
      sgstAmount = taxHalf;
    } else {
      igstAmount = round2((taxableValue * gst_rate) / 100);
    }

    const lineTotal = round2(taxableValue + cgstAmount + sgstAmount + igstAmount);

    line_items.push({
      line_id: `line_${idx + 1}_${it.id || it.product_id || idx}`,
      product_id: String(it.product_id || it.id || `prod_${idx}`),
      sku: String(it.sku || it.id || `SKU-${idx + 1}`),
      product_name: String(it.name || it.title || 'Linen Garment'),
      variant: [it.selectedSize || it.size ? `Size: ${it.selectedSize || it.size}` : '', it.color ? `Color: ${it.color}` : ''].filter(Boolean).join(' | '),
      quantity: qty,
      unit_price: unitPrice,
      gross_amount: grossAmount,
      line_discount: lineDiscount,
      taxable_value: taxableValue,
      hsn_code: hsn_code,
      gst_rate: gst_rate,
      cgst_rate: treatment.cgst_rate,
      cgst_amount: cgstAmount,
      sgst_rate: treatment.sgst_rate,
      sgst_amount: sgstAmount,
      igst_rate: treatment.igst_rate,
      igst_amount: igstAmount,
      line_total: lineTotal,
      net_amount: lineNetGross,
      unit_transaction_value: unitTransactionValue,
      tax_record_id: taxLookup.metadata.tax_record_id,
      tax_config_version: tax_config_version || "v1.0",
      tax_rule_scope: taxLookup.metadata.resolved_scope,
      tax_class: it.tax_class || it.taxClass || taxLookup.metadata.tax_class || undefined
    });

    calculatedSubtotal += grossAmount;
    calculatedDiscountTotal += lineDiscount;
    calculatedTaxableTotal += taxableValue;
    calculatedCgstTotal += cgstAmount;
    calculatedSgstTotal += sgstAmount;
    calculatedIgstTotal += igstAmount;
  }

  // 6. Shipping Charges
  const shippingCost = round2(Number(order.shipping_cost || 0));
  let shippingTaxable = 0;
  let shippingTax = 0;
  let shippingCgst = 0;
  let shippingSgst = 0;
  let shippingIgst = 0;

  if (shippingCost > 0) {
    const shipCfg = options?.shippingTaxConfig;
    const shipVal = validateShippingTaxConfig(shipCfg);

    if (!shipVal.valid) {
      return {
        success: false,
        code: "INVOICE_TAX_METADATA_MISSING",
        error: shipVal.error || "Missing or invalid shipping tax configuration."
      };
    }

    const shippingGstRate = shipCfg!.gst_rate;
    const treatment = determineGstTreatment({
      sellerStateCode: seller.state_code,
      placeOfSupplyStateCode: posStateCode,
      gstRate: shippingGstRate
    });

    shippingTaxable = shippingCost;
    if (treatment.supply_type === 'INTRASTATE') {
      const half = round2((shippingTaxable * (shippingGstRate / 2)) / 100);
      shippingCgst = half;
      shippingSgst = half;
      shippingTax = round2(shippingCgst + shippingSgst);
    } else {
      shippingIgst = round2((shippingTaxable * shippingGstRate) / 100);
      shippingTax = shippingIgst;
    }

    calculatedCgstTotal += shippingCgst;
    calculatedSgstTotal += shippingSgst;
    calculatedIgstTotal += shippingIgst;
  }

  const calculatedTaxTotal = round2(calculatedCgstTotal + calculatedSgstTotal + calculatedIgstTotal);
  const shippingTotal = round2(shippingTaxable + shippingTax);

  // 7. Reconciliation & Rounding against Order Grand Total
  const orderGrandTotal = round2(Number(order.grand_total || order.total_amount || 0));
  const totalBeforeRoundOff = round2(calculatedTaxableTotal + shippingTaxable + calculatedTaxTotal);
  const roundOff = round2(orderGrandTotal - totalBeforeRoundOff);

  // Verify Reconciliation: taxable + shipping + taxes + roundOff MUST equal grandTotal exactly and roundOff must be reasonable (<= 1.00)
  const reconciledSum = round2(totalBeforeRoundOff + roundOff);
  if (Math.abs(roundOff) > 1.00 || Math.abs(reconciledSum - orderGrandTotal) > 0.01) {
    return {
      success: false,
      code: "INVOICE_TOTAL_RECONCILIATION_FAILED",
      error: `Invoice totals fail to reconcile with order total. Reconciled: ₹${reconciledSum}, Order Total: ₹${orderGrandTotal}, Round Off: ₹${roundOff}.`
    };
  }

  const orderDate = order.created_at || new Date().toISOString();
  const financialYear = calculateFinancialYear(orderDate);

  const treatment = determineGstTreatment({
    sellerStateCode: seller.state_code,
    placeOfSupplyStateCode: posStateCode,
    gstRate: 12
  });

  return {
    success: true,
    invoice: {
      invoice_number: options?.invoiceNumber,
      invoice_type: invoiceType,
      status: 'FINALIZED',
      order_id: String(order.order_id),
      order_number: String(order.order_id),
      invoice_date: new Date().toISOString(),
      financial_year: financialYear,
      currency: 'INR',
      seller_snapshot: seller,
      buyer_snapshot: buyerSnapshot,
      shipping_snapshot: shippingSnapshot,
      billing_snapshot: billingSnapshot,
      place_of_supply: placeOfSupply,
      place_of_supply_state_code: posStateCode,
      supply_type: treatment.supply_type,
      line_items: line_items,
      subtotal: round2(calculatedSubtotal),
      discount_total: round2(calculatedDiscountTotal),
      taxable_total: round2(calculatedTaxableTotal),
      cgst_total: round2(calculatedCgstTotal),
      sgst_total: round2(calculatedSgstTotal),
      igst_total: round2(calculatedIgstTotal),
      tax_total: round2(calculatedTaxTotal),
      shipping_taxable: shippingTaxable,
      shipping_tax: shippingTax,
      shipping_total: shippingTotal,
      shipping_sac: shippingCost > 0 ? (options?.shippingTaxConfig?.hsn_or_sac_code || "996812") : undefined,
      shipping_gst_rate: shippingCost > 0 ? (options?.shippingTaxConfig?.gst_rate ?? 18) : undefined,
      round_off: roundOff,
      grand_total: orderGrandTotal,
      payment_method: String(order.payment_method || 'razorpay').toUpperCase(),
      payment_status: String(order.status || 'PAID').toUpperCase(),
      customer_id: String(buyerSnapshot.customer_id),
      customer_profile_id: order.profile_id || null,
      gst_customer_type: gstCustomerType,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      version: 1,
      pdf_status: 'NOT_GENERATED',
      pdf_generated_at: null,
      pdf_storage_reference: null,
      immutable: true
    }
  };
}
