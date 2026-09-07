import PDFDocument from 'pdfkit';
import { GstInvoice, GstInvoiceSellerSnapshot, GstInvoiceBuyerSnapshot, GstInvoiceAddressSnapshot } from './invoiceTypes';

/**
 * Converts numeric amount into Indian Rupee words.
 * Example: 12450.50 -> "Rupees Twelve Thousand Four Hundred Fifty and Fifty Paise Only"
 */
export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';

  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(num: number): string {
    if (num === 0) return '';
    if (num < 20) return units[num];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const rem = num % 10;
      return tens[ten] + (rem ? ' ' + units[rem] : '');
    }
    const hundred = Math.floor(num / 100);
    const rem = num % 100;
    return units[hundred] + ' Hundred' + (rem ? ' ' + convertChunk(rem) : '');
  }

  function convertRupees(num: number): string {
    if (num === 0) return 'Zero';
    let words = '';

    const crore = Math.floor(num / 10000000);
    num %= 10000000;

    const lakh = Math.floor(num / 100000);
    num %= 100000;

    const thousand = Math.floor(num / 1000);
    num %= 1000;

    if (crore > 0) {
      words += convertChunk(crore) + ' Crore ';
    }
    if (lakh > 0) {
      words += convertChunk(lakh) + ' Lakh ';
    }
    if (thousand > 0) {
      words += convertChunk(thousand) + ' Thousand ';
    }
    if (num > 0) {
      words += convertChunk(num);
    }

    return words.trim();
  }

  const rupeeStr = convertRupees(rupees);
  let result = `Rupees ${rupeeStr}`;

  if (paise > 0) {
    const paiseStr = convertChunk(paise);
    result += ` and ${paiseStr} Paise`;
  }

  return `${result} Only`;
}

/**
 * Generates an A4 PDF document buffer for a finalized GST invoice snapshot.
 * STRICTLY READ-ONLY: Consumes the immutable GstInvoice snapshot directly.
 * ZERO TAX RECALCULATION OR FIRESTORE WRITES.
 */
export async function generateGstInvoicePdfBuffer(invoice: GstInvoice): Promise<Buffer> {
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

      const isIntrastate = invoice.supply_type === 'INTRASTATE';
      const isB2B = invoice.gst_customer_type === 'B2B' || Boolean(invoice.buyer_snapshot?.gstin);
      const seller: Partial<GstInvoiceSellerSnapshot> = invoice.seller_snapshot || {};
      const buyer: Partial<GstInvoiceBuyerSnapshot> = invoice.buyer_snapshot || {};
      const shipping: Partial<GstInvoiceAddressSnapshot> = invoice.shipping_snapshot || {};

      // Colors
      const PRIMARY = '#1C1917'; // Neutral dark
      const MUTED = '#78716C';   // Stone gray
      const BORDER = '#E7E5E4';  // Light border
      const BG_HEADER = '#F5F5F4';

      let y = 30;

      // --- HEADER SECTION ---
      doc.fillColor(PRIMARY).fontSize(18).font('Helvetica-Bold').text('SA AND SHA', 30, y);
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Handcrafted Pure Linen Wear', 30, y + 22);

      // Tax Invoice Title Box on Top Right
      doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 380, y, { align: 'right' });
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(
        `[${invoice.gst_customer_type} - ${invoice.supply_type}]`,
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
      doc.text(`State: ${seller.state || 'N/A'} (Code: ${seller.state_code || 'N/A'}) | Email: ${seller.support_email || 'support@saandsha.com'}`, 30, y);

      y += 16;
      doc.strokeColor(BORDER).lineWidth(0.75).moveTo(30, y).lineTo(565, y).stroke();
      y += 10;

      // --- METADATA & BILLING/SHIPPING GRID ---
      const gridTop = y;

      // Left Column: Invoice Metadata
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('INVOICE DETAILS', 30, y);
      y += 13;
      doc.font('Helvetica').fontSize(8).fillColor(PRIMARY);
      doc.text(`Invoice No: `, 30, y, { continued: true }).font('Helvetica-Bold').text(invoice.invoice_number);
      y += 11;
      doc.font('Helvetica').text(`Invoice Date: ${invoice.invoice_date || 'N/A'}`, 30, y);
      y += 11;
      doc.text(`Order Number: #${invoice.order_number || invoice.order_id}`, 30, y);
      y += 11;
      doc.text(`Financial Year: ${invoice.financial_year || 'N/A'}`, 30, y);
      y += 11;
      doc.text(`Payment Method: ${(invoice.payment_method || 'COD').toUpperCase()} (${invoice.payment_status || 'PAID'})`, 30, y);
      y += 11;
      doc.text(`Place of Supply: ${invoice.place_of_supply || 'N/A'} (Code: ${invoice.place_of_supply_state_code || 'N/A'})`, 30, y);

      // Right Column: Customer Billed / Shipped To
      let rightY = gridTop;
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('BILLED TO (BUYER)', 310, rightY);
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

      y = Math.max(y, rightY) + 6;
      doc.strokeColor(BORDER).lineWidth(0.75).moveTo(30, y).lineTo(565, y).stroke();
      y += 10;

      // --- ITEM TAX TABLE ---
      const renderTableHeader = (currentY: number) => {
        doc.fillColor(BG_HEADER).rect(30, currentY, 535, 18).fill();
        doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold');

        doc.text('#', 34, currentY + 5, { width: 16 });
        doc.text('Item Description / SKU', 52, currentY + 5, { width: 158 });
        doc.text('HSN', 212, currentY + 5, { width: 45 });
        doc.text('Qty', 259, currentY + 5, { width: 22, align: 'right' });
        doc.text('Rate', 283, currentY + 5, { width: 42, align: 'right' });
        doc.text('Taxable', 327, currentY + 5, { width: 50, align: 'right' });
        doc.text('GST%', 379, currentY + 5, { width: 28, align: 'right' });

        if (isIntrastate) {
          doc.text('CGST', 409, currentY + 5, { width: 38, align: 'right' });
          doc.text('SGST', 449, currentY + 5, { width: 38, align: 'right' });
        } else {
          doc.text('IGST', 409, currentY + 5, { width: 78, align: 'right' });
        }

        doc.text('Total (₹)', 489, currentY + 5, { width: 72, align: 'right' });
        return currentY + 22;
      };

      y = renderTableHeader(y);
      doc.font('Helvetica').fontSize(8).fillColor(PRIMARY);

      const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
      let index = 1;

      for (const item of items) {
        if (y > 700) {
          doc.addPage();
          y = 30;
          y = renderTableHeader(y);
        }

        const itemName = item.product_name || 'Linen Garment';
        const skuStr = item.sku ? `SKU: ${item.sku}` : '';
        const variantStr = item.variant ? `(${item.variant})` : '';
        const fullDesc = `${itemName} ${variantStr}`.trim();

        doc.text(index.toString(), 34, y, { width: 16 });
        doc.text(fullDesc, 52, y, { width: 158 });
        if (skuStr) {
          doc.fontSize(7).fillColor(MUTED).text(skuStr, 52, y + 10, { width: 158 });
          doc.fontSize(8).fillColor(PRIMARY);
        }

        doc.text(item.hsn_code || '6205', 212, y, { width: 45 });
        doc.text(item.quantity.toString(), 259, y, { width: 22, align: 'right' });
        doc.text(`₹${item.unit_price.toFixed(2)}`, 283, y, { width: 42, align: 'right' });
        doc.text(`₹${item.taxable_value.toFixed(2)}`, 327, y, { width: 50, align: 'right' });
        doc.text(`${item.gst_rate}%`, 379, y, { width: 28, align: 'right' });

        if (isIntrastate) {
          doc.text(`₹${(item.cgst_amount || 0).toFixed(2)}`, 409, y, { width: 38, align: 'right' });
          doc.text(`₹${(item.sgst_amount || 0).toFixed(2)}`, 449, y, { width: 38, align: 'right' });
        } else {
          doc.text(`₹${(item.igst_amount || 0).toFixed(2)}`, 409, y, { width: 78, align: 'right' });
        }

        doc.text(`₹${item.line_total.toFixed(2)}`, 489, y, { width: 72, align: 'right' });

        y += skuStr ? 22 : 16;
        doc.strokeColor(BORDER).lineWidth(0.5).moveTo(30, y).lineTo(565, y).stroke();
        y += 6;
        index++;
      }

      // --- SHIPPING / FREIGHT LINE (IF APPLICABLE) ---
      if ((invoice.shipping_taxable || 0) > 0 || (invoice.shipping_total || 0) > 0) {
        if (y > 700) {
          doc.addPage();
          y = 30;
          y = renderTableHeader(y);
        }

        const shipTaxable = invoice.shipping_taxable || 0;
        const shipTax = invoice.shipping_tax || 0;
        const shipTotal = invoice.shipping_total || (shipTaxable + shipTax);
        const shipGstRate = shipTaxable > 0 ? Math.round((shipTax / shipTaxable) * 100) : 18;

        doc.text(index.toString(), 34, y, { width: 16 });
        doc.text('Shipping & Delivery Freight', 52, y, { width: 158 });
        doc.text('996812', 212, y, { width: 45 });
        doc.text('1', 259, y, { width: 22, align: 'right' });
        doc.text(`₹${shipTaxable.toFixed(2)}`, 283, y, { width: 42, align: 'right' });
        doc.text(`₹${shipTaxable.toFixed(2)}`, 327, y, { width: 50, align: 'right' });
        doc.text(`${shipGstRate}%`, 379, y, { width: 28, align: 'right' });

        if (isIntrastate) {
          const halfTax = shipTax / 2;
          doc.text(`₹${halfTax.toFixed(2)}`, 409, y, { width: 38, align: 'right' });
          doc.text(`₹${halfTax.toFixed(2)}`, 449, y, { width: 38, align: 'right' });
        } else {
          doc.text(`₹${shipTax.toFixed(2)}`, 409, y, { width: 78, align: 'right' });
        }

        doc.text(`₹${shipTotal.toFixed(2)}`, 489, y, { width: 72, align: 'right' });

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

      doc.text('Subtotal (Gross Value):', summaryLeft, y);
      doc.text(`₹${(invoice.subtotal || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
      y += 12;

      if ((invoice.discount_total || 0) > 0) {
        doc.text('Discount:', summaryLeft, y);
        doc.text(`-₹${invoice.discount_total.toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      doc.text('Taxable Value:', summaryLeft, y);
      doc.text(`₹${(invoice.taxable_total || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
      y += 12;

      if (isIntrastate) {
        doc.text('CGST Total:', summaryLeft, y);
        doc.text(`₹${(invoice.cgst_total || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;

        doc.text('SGST Total:', summaryLeft, y);
        doc.text(`₹${(invoice.sgst_total || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      } else {
        doc.text('IGST Total:', summaryLeft, y);
        doc.text(`₹${(invoice.igst_total || 0).toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      if ((invoice.shipping_total || 0) > 0) {
        doc.text('Freight Charges:', summaryLeft, y);
        doc.text(`₹${invoice.shipping_total.toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      if (typeof invoice.round_off === 'number' && invoice.round_off !== 0) {
        doc.text('Round Off:', summaryLeft, y);
        doc.text(`₹${invoice.round_off.toFixed(2)}`, valLeft, y, { width: 85, align: 'right' });
        y += 12;
      }

      doc.strokeColor(PRIMARY).lineWidth(1).moveTo(summaryLeft, y).lineTo(565, y).stroke();
      y += 6;

      doc.fontSize(10).font('Helvetica-Bold').fillColor(PRIMARY);
      doc.text('GRAND TOTAL:', summaryLeft, y);
      doc.text(`₹${(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valLeft, y, { width: 85, align: 'right' });
      y += 20;

      // --- AMOUNT IN WORDS BLOCK ---
      doc.fillColor(BG_HEADER).rect(30, y, 535, 22).fill();
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold');
      const amountWords = numberToIndianWords(invoice.grand_total || 0);
      doc.text(`Amount in Words: ${amountWords}`, 36, y + 6, { width: 520 });

      y += 32;

      // --- DECLARATION & SIGNATORY BLOCK ---
      if (y > 720) {
        doc.addPage();
        y = 30;
      }

      doc.fontSize(7).font('Helvetica').fillColor(MUTED);
      doc.text(
        'Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
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
        doc.text('This is a computer-generated TAX INVOICE. Statutory E-Invoice snapshot preserved immutably.', 30, footerY, { width: 380 });
        doc.text(`Page ${i + 1} of ${range.count}`, 380, footerY, { align: 'right', width: 185 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper to stream generated PDF directly into an Express HTTP Response object.
 */
export async function streamGstInvoicePdfResponse(invoice: GstInvoice, res: any): Promise<void> {
  const pdfBuffer = await generateGstInvoicePdfBuffer(invoice);
  const invNumberClean = (invoice.invoice_number || 'invoice').replace(/[\/\\]/g, '-');
  const filename = `Kora-Linen-Tax-Invoice-${invNumberClean}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
}
