import PDFDocument from 'pdfkit';
import { GstCreditNote } from './creditNoteTypes';
import { GstInvoiceSellerSnapshot, GstInvoiceBuyerSnapshot, GstInvoiceAddressSnapshot } from './invoiceTypes';
import { numberToIndianWords } from './invoicePdfGenerator';

/**
 * Generates an A4 PDF document buffer for a finalized GST Credit Note snapshot.
 * STRICTLY READ-ONLY: Consumes the immutable GstCreditNote snapshot directly.
 * ZERO TAX RECALCULATION, ZERO FIRESTORE WRITES, ZERO REPORTING MUTATION.
 */
export async function generateGstCreditNotePdfBuffer(creditNote: GstCreditNote): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30,
        bufferPages: true
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const isIntrastate = creditNote.supply_type === 'INTRASTATE';
      const isB2B = creditNote.gst_customer_type === 'B2B' || Boolean(creditNote.buyer_snapshot?.gstin);
      const seller: Partial<GstInvoiceSellerSnapshot> = creditNote.seller_snapshot || {};
      const buyer: Partial<GstInvoiceBuyerSnapshot> = creditNote.buyer_snapshot || {};
      const shipping: Partial<GstInvoiceAddressSnapshot> = creditNote.shipping_snapshot || {};

      // Colors
      const PRIMARY = '#1C1917'; // Neutral dark
      const MUTED = '#78716C';   // Stone gray
      const BORDER = '#E7E5E4';  // Light border
      const BG_HEADER = '#F5F5F4';

      let y = 30;

      // --- HEADER SECTION ---
      doc.fillColor(PRIMARY).fontSize(18).font('Helvetica-Bold').text('SA AND SHA', 30, y);
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Ladies Apparel', 30, y + 22);

      // GST Credit Note Title Box on Top Right
      doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text('GST CREDIT NOTE', 380, y, { align: 'right' });
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(
        `[${creditNote.gst_customer_type || 'B2C'} - ${creditNote.supply_type || 'INTRASTATE'}]`,
        380,
        y + 20,
        { align: 'right' }
      );

      y += 38;

      // Seller Details Box (Left)
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text(seller.legal_name || 'SA AND SHA PRIVATE LIMITED', 30, y);
      if (seller.trade_name && seller.trade_name !== seller.legal_name) {
        y += 11;
        doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(`Trade Name: ${seller.trade_name}`, 30, y);
      }
      y += 11;
      const sellerAddr = [seller.address_line_1, seller.address_line_2, `${seller.city || ''} ${seller.state || ''} - ${seller.pincode || ''}`]
        .filter(Boolean)
        .join(', ');
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(sellerAddr, 30, y, { width: 320 });
      y += 11;
      doc.text(`GSTIN: ${seller.gstin || 'N/A'}${seller.pan ? ' | PAN: ' + seller.pan : ''}`, 30, y);
      y += 11;
      doc.text(`State: ${seller.state || 'N/A'} (Code: ${seller.state_code || 'N/A'}) | Email: ${seller.support_email || 'support@sa-and-sha.com'}`, 30, y);

      y += 16;
      doc.strokeColor(BORDER).lineWidth(0.75).moveTo(30, y).lineTo(565, y).stroke();
      y += 10;

      // --- METADATA & BILLING/RECIPIENT GRID ---
      const gridTop = y;

      // Left Column: Credit Note Metadata
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('CREDIT NOTE DETAILS', 30, y);
      y += 13;
      doc.font('Helvetica').fontSize(8).fillColor(PRIMARY);
      doc.text(`Credit Note No: `, 30, y, { continued: true }).font('Helvetica-Bold').text(creditNote.credit_note_number);
      y += 11;
      doc.font('Helvetica').text(`Credit Note Date: ${creditNote.issue_date ? creditNote.issue_date.substring(0, 10) : 'N/A'}`, 30, y);
      y += 11;
      doc.text(`Original Invoice No: `, 30, y, { continued: true }).font('Helvetica-Bold').text(creditNote.original_invoice_number || 'N/A');
      y += 11;
      doc.font('Helvetica').text(`Original Invoice Date: ${creditNote.original_invoice_date ? creditNote.original_invoice_date.substring(0, 10) : 'N/A'}`, 30, y);
      y += 11;
      doc.text(`Order Number: #${creditNote.order_number || creditNote.order_id}`, 30, y);
      y += 11;
      doc.text(`RMA / Return Ref: ${creditNote.rma_number || creditNote.return_request_id || 'N/A'}`, 30, y);
      y += 11;
      doc.text(`Financial Year: ${creditNote.financial_year || 'N/A'}`, 30, y);
      y += 11;
      const reasonLabel = (creditNote.reason || 'GOODS_RETURNED').replace(/_/g, ' ');
      doc.text(`Reason: ${reasonLabel}${creditNote.reason_details ? ' (' + creditNote.reason_details + ')' : ''}`, 30, y, { width: 260 });
      y += 11;
      doc.text(`Place of Supply: ${creditNote.place_of_supply || 'N/A'} (Code: ${creditNote.place_of_supply_state_code || 'N/A'})`, 30, y);

      // Right Column: Recipient (Billed / Shipped To)
      let rightY = gridTop;
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('RECIPIENT (BUYER)', 310, rightY);
      rightY += 13;
      doc.font('Helvetica').fontSize(8).fillColor(PRIMARY);

      const buyerName = buyer.full_name || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Valued Customer';
      doc.font('Helvetica-Bold').text(buyerName, 310, rightY);
      rightY += 11;

      if (isB2B && buyer.legal_name) {
        doc.font('Helvetica').text(`Legal Name: ${buyer.legal_name}`, 310, rightY);
        rightY += 11;
      }

      if (buyer.gstin) {
        doc.font('Helvetica-Bold').text(`GSTIN: ${buyer.gstin}`, 310, rightY);
        rightY += 11;
      }

      const buyerAddr = [buyer.address_line_1, buyer.address_line_2, `${buyer.city || ''}, ${buyer.state || ''} - ${buyer.pincode || ''}`]
        .filter(Boolean)
        .join(', ');
      doc.font('Helvetica').text(buyerAddr, 310, rightY, { width: 250 });
      rightY += 18;

      if (shipping.address_line_1 || shipping.full_name) {
        doc.font('Helvetica-Bold').text('SHIPPED TO', 310, rightY);
        rightY += 11;
        const shipName = shipping.full_name || buyerName;
        doc.font('Helvetica').text(shipName, 310, rightY);
        rightY += 11;
        const shipAddr = [shipping.address_line_1, shipping.address_line_2, `${shipping.city || ''}, ${shipping.state || ''} - ${shipping.pincode || ''}`]
          .filter(Boolean)
          .join(', ');
        doc.text(shipAddr, 310, rightY, { width: 250 });
        rightY += 16;
      }

      y = Math.max(y, rightY) + 6;
      doc.strokeColor(BORDER).lineWidth(0.75).moveTo(30, y).lineTo(565, y).stroke();
      y += 10;

      // --- GST REPORTING & E-INVOICE STATUS BANNER ---
      doc.fillColor(BG_HEADER).rect(30, y, 535, 20).fill();
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold');
      const formatGstStatus = (status?: string) => {
        if (status === 'NOT_REPORTED') return 'Not Reported';
        if (status === 'REPORTED') return 'Reported';
        if (status === 'ADJUSTED') return 'Adjusted';
        if (status === 'NOT_ELIGIBLE_FOR_ADJUSTMENT') return 'Not Eligible For Adjustment';
        return status || 'Not Reported';
      };
      const gstStatusStr = `GST Reporting Status: ${formatGstStatus(creditNote.gst_reporting_status)}`;
      const taxAdjStr = `Tax Liability Adjusted: ${creditNote.tax_liability_adjusted ? 'YES' : 'NO'}`;
      doc.text(`${gstStatusStr}  |  ${taxAdjStr}  |  Deadline: ${creditNote.gst_adjustment_deadline ? creditNote.gst_adjustment_deadline.substring(0, 10) : 'N/A'}`, 36, y + 5, { width: 520 });
      y += 26;

      if (creditNote.e_invoice_status === 'GENERATED' && creditNote.irn) {
        doc.fillColor(PRIMARY).fontSize(8).font('Helvetica');
        doc.text(`E-Invoice IRN: ${creditNote.irn}`, 30, y, { width: 535 });
        y += 11;
        doc.text(`Ack No: ${creditNote.ack_number || 'N/A'} | Ack Date: ${creditNote.ack_date || 'N/A'}`, 30, y);
        y += 14;
      }

      // --- CREDITED ITEM TABLE ---
      const renderTableHeader = (currentY: number) => {
        doc.fillColor(BG_HEADER).rect(30, currentY, 535, 18).fill();
        doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold');

        doc.text('#', 34, currentY + 5, { width: 14 });
        doc.text('Item Description / SKU', 50, currentY + 5, { width: 140 });
        doc.text('HSN', 192, currentY + 5, { width: 42 });
        doc.text('Orig Qty', 236, currentY + 5, { width: 34, align: 'right' });
        doc.text('Cred Qty', 272, currentY + 5, { width: 34, align: 'right' });
        doc.text('Rate', 308, currentY + 5, { width: 38, align: 'right' });
        doc.text('Taxable Rev', 348, currentY + 5, { width: 48, align: 'right' });
        doc.text('GST%', 398, currentY + 5, { width: 26, align: 'right' });

        if (isIntrastate) {
          doc.text('CGST', 426, currentY + 5, { width: 34, align: 'right' });
          doc.text('SGST', 462, currentY + 5, { width: 34, align: 'right' });
        } else {
          doc.text('IGST', 426, currentY + 5, { width: 70, align: 'right' });
        }

        doc.text('Total Rev (₹)', 498, currentY + 5, { width: 63, align: 'right' });
        return currentY + 22;
      };

      y = renderTableHeader(y);
      doc.font('Helvetica').fontSize(8).fillColor(PRIMARY);

      const items = Array.isArray(creditNote.line_items) ? creditNote.line_items : [];
      let index = 1;

      for (const item of items) {
        if (y > 700) {
          doc.addPage();
          y = 30;
          y = renderTableHeader(y);
        }

        const itemName = item.product_name || 'Garment';
        const skuStr = item.sku ? `SKU: ${item.sku}` : '';
        const variantStr = item.variant ? `(${item.variant})` : '';
        const fullDesc = `${itemName} ${variantStr}`.trim();
        const origQty = typeof item.original_quantity === 'number' ? item.original_quantity : item.credited_quantity;

        doc.text(index.toString(), 34, y, { width: 14 });
        doc.text(fullDesc, 50, y, { width: 140 });
        if (skuStr) {
          doc.fontSize(7).fillColor(MUTED).text(skuStr, 50, y + 10, { width: 140 });
          doc.fontSize(8).fillColor(PRIMARY);
        }

        doc.text(item.hsn_code || '6205', 192, y, { width: 42 });
        doc.text(origQty.toString(), 236, y, { width: 34, align: 'right' });
        doc.text(item.credited_quantity.toString(), 272, y, { width: 34, align: 'right' });
        doc.text(`₹${(item.unit_price || 0).toFixed(2)}`, 308, y, { width: 38, align: 'right' });
        doc.text(`₹${(item.taxable_value_reversal || 0).toFixed(2)}`, 348, y, { width: 48, align: 'right' });
        doc.text(`${item.gst_rate}%`, 398, y, { width: 26, align: 'right' });

        if (isIntrastate) {
          doc.text(`₹${(item.cgst_reversal || 0).toFixed(2)}`, 426, y, { width: 34, align: 'right' });
          doc.text(`₹${(item.sgst_reversal || 0).toFixed(2)}`, 462, y, { width: 34, align: 'right' });
        } else {
          doc.text(`₹${(item.igst_reversal || 0).toFixed(2)}`, 426, y, { width: 70, align: 'right' });
        }

        doc.text(`₹${(item.line_total_reversal || 0).toFixed(2)}`, 498, y, { width: 63, align: 'right' });

        y += skuStr ? 22 : 16;
        doc.strokeColor(BORDER).lineWidth(0.5).moveTo(30, y).lineTo(565, y).stroke();
        y += 6;
        index++;
      }

      // --- SHIPPING / FREIGHT CREDITED (IF APPLICABLE) ---
      if ((creditNote.shipping_taxable_reversal || 0) > 0 || (creditNote.shipping_total_reversal || 0) > 0) {
        const shipSac = creditNote.shipping_sac || (creditNote as any).shipping_tax_config?.hsn_or_sac_code || (creditNote as any).shipping_snapshot?.sac_code || (creditNote as any).shipping_snapshot?.hsn_or_sac_code;
        const shipGstRate = creditNote.shipping_gst_rate ?? (creditNote as any).shipping_tax_config?.gst_rate ?? (creditNote as any).shipping_snapshot?.gst_rate;

        if (!shipSac || shipGstRate === undefined || shipGstRate === null) {
          const err = new Error("Credit note is missing shipping tax snapshot metadata (shipping SAC or GST rate) required for shipping tax reversal.");
          (err as any).code = "CREDIT_NOTE_SHIPPING_TAX_SNAPSHOT_MISSING";
          throw err;
        }

        if (y > 700) {
          doc.addPage();
          y = 30;
          y = renderTableHeader(y);
        }

        const shipTaxable = creditNote.shipping_taxable_reversal || 0;
        const shipTax = creditNote.shipping_tax_reversal || 0;
        const shipTotal = creditNote.shipping_total_reversal || (shipTaxable + shipTax);

        doc.text(index.toString(), 34, y, { width: 14 });
        doc.text('Shipping & Delivery Freight Reversal', 50, y, { width: 140 });
        doc.text(shipSac, 192, y, { width: 42 });
        doc.text('1', 236, y, { width: 34, align: 'right' });
        doc.text('1', 272, y, { width: 34, align: 'right' });
        doc.text(`₹${shipTaxable.toFixed(2)}`, 308, y, { width: 38, align: 'right' });
        doc.text(`₹${shipTaxable.toFixed(2)}`, 348, y, { width: 48, align: 'right' });
        doc.text(`${shipGstRate}%`, 398, y, { width: 26, align: 'right' });

        if (isIntrastate) {
          const halfTax = shipTax / 2;
          doc.text(`₹${halfTax.toFixed(2)}`, 426, y, { width: 34, align: 'right' });
          doc.text(`₹${halfTax.toFixed(2)}`, 462, y, { width: 34, align: 'right' });
        } else {
          doc.text(`₹${shipTax.toFixed(2)}`, 426, y, { width: 70, align: 'right' });
        }

        doc.text(`₹${shipTotal.toFixed(2)}`, 498, y, { width: 63, align: 'right' });

        y += 18;
        doc.strokeColor(BORDER).lineWidth(0.5).moveTo(30, y).lineTo(565, y).stroke();
        y += 8;
      }

      // --- TOTALS & SUMMARY BLOCK ---
      if (y > 660) {
        doc.addPage();
        y = 30;
      }

      y += 8;
      const summaryLeft = 330;
      const valLeft = 480;

      doc.fontSize(8).font('Helvetica').fillColor(PRIMARY);

      doc.text('Subtotal Reversal:', summaryLeft, y);
      doc.text(`₹${(creditNote.subtotal_reversal || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
      y += 12;

      if ((creditNote.discount_total_reversal || 0) > 0) {
        doc.text('Discount Reversal:', summaryLeft, y);
        doc.text(`-₹${creditNote.discount_total_reversal.toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      doc.text('Taxable Value Reversed:', summaryLeft, y);
      doc.text(`₹${(creditNote.taxable_total_reversal || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
      y += 12;

      if (isIntrastate) {
        doc.text('CGST Reversed:', summaryLeft, y);
        doc.text(`₹${(creditNote.cgst_total_reversal || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;

        doc.text('SGST Reversed:', summaryLeft, y);
        doc.text(`₹${(creditNote.sgst_total_reversal || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      } else {
        doc.text('IGST Reversed:', summaryLeft, y);
        doc.text(`₹${(creditNote.igst_total_reversal || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      if ((creditNote.shipping_total_reversal || 0) > 0) {
        doc.text('Freight Charges Reversal:', summaryLeft, y);
        doc.text(`₹${creditNote.shipping_total_reversal.toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      if (typeof creditNote.round_off_reversal === 'number' && creditNote.round_off_reversal !== 0) {
        doc.text('Round Off:', summaryLeft, y);
        doc.text(`₹${creditNote.round_off_reversal.toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      doc.strokeColor(PRIMARY).lineWidth(1).moveTo(summaryLeft, y).lineTo(565, y).stroke();
      y += 6;

      doc.fontSize(10).font('Helvetica-Bold').fillColor(PRIMARY);
      doc.text('TOTAL CREDIT NOTE VALUE:', summaryLeft - 20, y);
      doc.text(`₹${(creditNote.grand_total_reversal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valLeft, y, { width: 85, align: 'right' });
      y += 20;

      // --- AMOUNT IN WORDS BLOCK ---
      doc.fillColor(BG_HEADER).rect(30, y, 535, 22).fill();
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold');
      const amountWords = numberToIndianWords(creditNote.grand_total_reversal || 0);
      doc.text(`Amount in Words: ${amountWords}`, 36, y + 6, { width: 520 });

      y += 32;

      // --- DECLARATION & SIGNATORY BLOCK ---
      if (y > 720) {
        doc.addPage();
        y = 30;
      }

      doc.fontSize(7).font('Helvetica').fillColor(MUTED);
      const decText = (creditNote.tax_liability_adjusted || creditNote.gst_reporting_status === 'ADJUSTED')
        ? 'Declaration: This document is a GST Credit Note issued in relation to the referenced original supply under Section 34 of the CGST Act. Tax liability adjusted and reported.'
        : 'Declaration: This document is a GST Credit Note issued in relation to the referenced original supply under Section 34 of the CGST Act.';
      doc.text(
        decText,
        30,
        y,
        { width: 330 }
      );

      // Signatory block right aligned
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text(`For ${seller.legal_name || 'SA AND SHA PRIVATE LIMITED'}`, 380, y, { align: 'right', width: 185 });
      y += 35;
      doc.font('Helvetica').fontSize(8).text('Authorised Signatory', 380, y, { align: 'right', width: 185 });

      // --- MULTI-PAGE FOOTER & PAGINATION PASS ---
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = 810;
        doc.strokeColor(BORDER).lineWidth(0.5).moveTo(30, footerY - 8).lineTo(565, footerY - 8).stroke();
        doc.fontSize(7).font('Helvetica').fillColor(MUTED);
        doc.text('This is a computer-generated GST CREDIT NOTE. Accounting snapshot preserved immutably.', 30, footerY, { width: 380 });
        doc.text(`Page ${i + 1} of ${range.count}`, 380, footerY, { align: 'right', width: 185 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper to stream generated GST Credit Note PDF directly into an Express HTTP Response object.
 */
export async function streamGstCreditNotePdfResponse(creditNote: GstCreditNote, res: any): Promise<void> {
  const pdfBuffer = await generateGstCreditNotePdfBuffer(creditNote);
  const cnNumberClean = (creditNote.credit_note_number || 'credit-note').replace(/[\/\\]/g, '-');
  const filename = `Sa-and-Sha-Credit-Note-${cnNumberClean}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
}
