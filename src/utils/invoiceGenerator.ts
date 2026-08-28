import { Linking, Share, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Order, orderTotal, orderBalance } from '../types/order';
import { formatCurrency, formatDate } from './format';
import { getBusinessPreset, BusinessType } from '../config/businessTypes';

export interface BusinessProfile {
  businessName?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  tagline?: string;
  logoUri?: string;
  bankDetails?: string;
  businessType?: BusinessType;
}

const DEFAULT_BUSINESS_NAME = 'Order Book Store';

/**
 * Generates a clean, professional WhatsApp text receipt message for an order.
 */
export function generateWhatsAppInvoiceText(
  order: Order,
  business?: BusinessProfile
): string {
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const businessName = business?.businessName || business?.name || DEFAULT_BUSINESS_NAME;

  const preset = getBusinessPreset(business?.businessType);

  const itemRows = order.items
    .map(
      (item, idx) => {
        const unitStr = item.unit ? ` ${item.unit}` : '';
        return `${idx + 1}. *${item.name.trim() || 'Item'}* × ${item.qty}${unitStr} @ ${formatCurrency(
          item.price
        )} = *${formatCurrency(item.qty * item.price)}*`;
      }
    )
    .join('\n');

  const paymentStatus =
    balance <= 0
      ? '*PAID IN FULL*'
      : `*BALANCE DUE: ${formatCurrency(balance)}* (Advance: ${formatCurrency(
          order.advance
        )})`;

  return `*TAX INVOICE / CASH BILL*
========================================
*${businessName.toUpperCase()}*
${business?.tagline ? `_${business.tagline}_\n` : ''}${business?.address ? `Address: ${business.address}\n` : ''}${business?.phone ? `Phone: ${business.phone}\n` : ''}${business?.gstin ? `GSTIN: ${business.gstin}\n` : ''}========================================
*Bill No:* ${order.orderNumber}
*Date:* ${formatDate(order.orderDate)}
*Customer:* ${order.customerName || 'Walk-in Customer'} ${
    order.phoneNumber ? `(${order.phoneNumber})` : ''
  }
========================================
*PARTICULARS / ITEMS:*
${itemRows || 'No items recorded'}

----------------------------------------
*Grand Total:* *${formatCurrency(total)}*
*Advance Paid:* ${formatCurrency(order.advance)}
*Payment Status:* ${paymentStatus}
========================================
${business?.bankDetails ? `*Payment / Bank Details:*\n${business.bankDetails}\n========================================\n` : ''}${order.customerNote ? `*Customer Note:* ${order.customerNote}\n========================================\n` : ''}Thank you for your business!`;
}

/**
 * Sends the invoice text directly to customer's WhatsApp or falls back to system Share.
 */
export async function sendWhatsAppInvoice(
  order: Order,
  business?: BusinessProfile
): Promise<boolean> {
  const message = generateWhatsAppInvoiceText(order, business);
  const encodedText = encodeURIComponent(message);

  if (order.phoneNumber) {
    const cleanPhone = order.phoneNumber.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;
    const canOpen = await Linking.canOpenURL(waUrl);

    if (canOpen) {
      await Linking.openURL(waUrl);
      return true;
    }
  }

  try {
    await Share.share({
      message,
      title: `Invoice ${order.orderNumber}`,
    });
    return true;
  } catch (err) {
    console.error('Error sharing WhatsApp invoice:', err);
    return false;
  }
}

/**
 * Generates an actual PDF file on device and opens native Share Sheet (target WhatsApp PDF file sharing).
 */
export async function sharePdfInvoiceToWhatsApp(
  order: Order,
  business?: BusinessProfile
): Promise<boolean> {
  try {
    const html = generatePrintableInvoiceHtml(order, business);

    if (Platform.OS === 'web') {
      // Web fallback: text + print modal
      return await sendWhatsAppInvoice(order, business);
    }

    // 1. Generate real PDF file on device filesystem
    const { uri } = await Print.printToFileAsync({ html });

    // 2. Share PDF file via Expo Sharing (select WhatsApp or any target app)
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share PDF Invoice #${order.orderNumber}`,
        UTI: 'com.adobe.pdf',
      });
      return true;
    } else {
      return await sendWhatsAppInvoice(order, business);
    }
  } catch (err) {
    console.error('Error generating PDF for WhatsApp:', err);
    return await sendWhatsAppInvoice(order, business);
  }
}

/**
 * Triggers native Print dialog or PDF file creation.
 */
export async function printPdfInvoice(
  order: Order,
  business?: BusinessProfile
): Promise<void> {
  try {
    const html = generatePrintableInvoiceHtml(order, business);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.print) {
        window.print();
      }
    } else {
      await Print.printAsync({ html });
    }
  } catch (err) {
    console.error('Error printing PDF:', err);
  }
}

/**
 * Generates responsive printable HTML document for PDF/Print modal.
 */
export function generatePrintableInvoiceHtml(
  order: Order,
  business?: BusinessProfile
): string {
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const businessName = business?.businessName || business?.name || DEFAULT_BUSINESS_NAME;

  const preset = getBusinessPreset(business?.businessType);

  const itemRowsHtml = order.items
    .map(
      (item, idx) => {
        const unitStr = item.unit ? ` <span style="font-size:11px; color:#64748B;">${item.unit}</span>` : '';
        return `
    <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #64748B;">${idx + 1}</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; font-size: 14px; color: #1E293B;">${
        item.name || 'Item'
      }</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 600; font-size: 14px; color: #334155;">${
        item.qty
      }${unitStr}</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; color: #475569;">${formatCurrency(
        item.price
      )}</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; font-size: 14px; color: #0F172A;">${formatCurrency(
        item.qty * item.price
      )}</td>
    </tr>`;
      }
    )
    .join('');

  const isPaid = balance <= 0;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tax Invoice - ${order.orderNumber}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      color: #1E293B;
      margin: 0;
      padding: 24px;
    }
    .invoice-card {
      max-width: 740px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #CBD5E1;
    }
    .header-banner {
      background: #0F172A;
      color: #FFFFFF;
      padding: 24px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #334155;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid #475569;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
      margin: 0 0 4px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 12px;
      color: #94A3B8;
      margin: 0;
    }
    .header-right {
      text-align: right;
    }
    .doc-type-badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      background-color: ${isPaid ? '#166534' : '#854D0E'};
      color: #FFFFFF;
      margin-bottom: 6px;
    }
    .bill-meta {
      font-size: 12px;
      color: #CBD5E1;
      margin: 2px 0;
    }
    .content-body {
      padding: 28px 32px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    .info-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 16px;
      border-radius: 8px;
    }
    .info-card h4 {
      margin: 0 0 8px 0;
      font-size: 11px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .info-card p {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
    }
    .info-sub {
      font-size: 12px !important;
      color: #475569 !important;
      font-weight: 400 !important;
      margin-top: 4px !important;
    }
    .gstin-badge {
      display: inline-block;
      background: #E2E8F0;
      color: #1E293B;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-top: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: #1E293B;
      color: #F8FAFC;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
    }
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .notes-box {
      flex: 1;
      max-width: 340px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 14px;
      border-radius: 8px;
      font-size: 12px;
      color: #334155;
    }
    .notes-box h5 {
      margin: 0 0 4px 0;
      font-size: 11px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-box {
      width: 280px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 16px;
      border-radius: 8px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      color: #475569;
    }
    .summary-row.total {
      border-top: 2px solid #E2E8F0;
      padding-top: 10px;
      font-weight: 800;
      font-size: 16px;
      color: #0F172A;
    }
    .summary-row.balance {
      background: ${isPaid ? '#F0FDF4' : '#FEF2F2'};
      border: 1px solid ${isPaid ? '#BBF7D0' : '#FECACA'};
      padding: 10px 12px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 14px;
      color: ${isPaid ? '#166534' : '#991B1B'};
      margin-top: 10px;
      margin-bottom: 0;
    }
    .bank-card {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .bank-card h5 {
      margin: 0 0 6px 0;
      font-size: 11px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bank-card p {
      margin: 0;
      font-size: 13px;
      color: #1E293B;
      white-space: pre-line;
      line-height: 1.5;
    }
    .signatory-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #E2E8F0;
    }
    .terms-text {
      font-size: 11px;
      color: #64748B;
      max-width: 380px;
      line-height: 1.4;
    }
    .signatory-box {
      text-align: center;
      width: 200px;
    }
    .signatory-line {
      border-bottom: 1px solid #94A3B8;
      margin-bottom: 6px;
      height: 40px;
    }
    .signatory-title {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header-banner">
      <div class="brand-wrap">
        ${business?.logoUri ? `<img src="${business.logoUri}" class="brand-logo" alt="Logo" />` : ''}
        <div>
          <h1 class="brand-title">${businessName}</h1>
          <p class="brand-tagline">${business?.tagline || 'Commercial Tax Invoice & Receipt'}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="doc-type-badge">${isPaid ? 'CASH RECEIPT' : 'TAX INVOICE'}</div>
        <p class="bill-meta"><b>Invoice No:</b> ${order.orderNumber}</p>
        <p class="bill-meta"><b>Date:</b> ${formatDate(order.orderDate)}</p>
      </div>
    </div>

    <div class="content-body">
      <div class="info-grid">
        <div class="info-card">
          <h4>Seller Details</h4>
          <p>${businessName}</p>
          ${business?.address ? `<p class="info-sub">Address: ${business.address}</p>` : ''}
          ${business?.phone ? `<p class="info-sub">Phone: ${business.phone}</p>` : ''}
          ${business?.email ? `<p class="info-sub">Email: ${business.email}</p>` : ''}
          ${business?.gstin ? `<div class="gstin-badge">GSTIN: ${business.gstin}</div>` : ''}
        </div>
        <div class="info-card">
          <h4>Billed To (Customer)</h4>
          <p>${order.customerName || 'Walk-in Customer'}</p>
          <p class="info-sub">${order.phoneNumber ? `Phone: ${order.phoneNumber}` : 'No phone recorded'}</p>
          <p class="info-sub" style="margin-top:8px !important;"><b>Ref No:</b> ${order.orderNumber}</p>
          <p class="info-sub"><b>Status:</b> ${order.status}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align: center; width: 40px;">#</th>
            <th style="text-align: left;">${preset.invoiceItemLabel}</th>
            <th style="text-align: center; width: 80px;">Qty</th>
            <th style="text-align: right; width: 100px;">Rate (₹)</th>
            <th style="text-align: right; width: 110px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <div class="summary-section">
        <div class="notes-box">
          <h5>Special Instructions / Notes</h5>
          <p style="margin:0;">${order.customerNote || 'Thank you for your business. Please retain this invoice for your records.'}</p>
        </div>

        <div class="summary-box">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatCurrency(total)}</span>
          </div>
          <div class="summary-row">
            <span>Advance Paid</span>
            <span>${formatCurrency(order.advance)}</span>
          </div>
          <div class="summary-row total">
            <span>Grand Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
          <div class="summary-row balance">
            <span>${isPaid ? 'Payment Status' : 'Balance Payable'}</span>
            <span>${isPaid ? 'PAID IN FULL' : formatCurrency(balance)}</span>
          </div>
        </div>
      </div>

      ${
        business?.bankDetails
          ? `<div class="bank-card">
              <h5>Payment & Transfer Information</h5>
              <p>${business.bankDetails}</p>
            </div>`
          : ''
      }

      <div class="signatory-row">
        <div class="terms-text">
          <p style="margin:0;"><b>Terms & Conditions:</b></p>
          <p style="margin:2px 0 0 0;">This is a computer-generated tax invoice. E.&O.E.</p>
        </div>
        <div class="signatory-box">
          <div class="signatory-line"></div>
          <div class="signatory-title">For ${businessName}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
