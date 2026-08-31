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
  upiId?: string;
  businessType?: BusinessType;
}

const DEFAULT_BUSINESS_NAME = 'KadaiBook Store';

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
        const hsnStr = item.hsnCode ? ` [HSN: ${item.hsnCode}]` : '';
        const taxStr = item.taxRate ? ` (GST ${item.taxRate}%)` : '';
        let extraInfo = '';
        if (order.customColumns && order.customColumns.length > 0) {
          const extras = order.customColumns
            .map((col) => {
              const v = item.customValues?.[col.id] || (col.name.toLowerCase() === 'unit' ? item.unit : null);
              return v ? `${col.name}: ${v}` : null;
            })
            .filter(Boolean);
          if (extras.length > 0) {
            extraInfo = ` [${extras.join(', ')}]`;
          }
        }
        return `${idx + 1}. *${item.name.trim() || 'Item'}*${hsnStr}${taxStr}${extraInfo} × ${item.qty}${unitStr} @ ${formatCurrency(
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

  // UPI payment link if balance is due
  let upiSection = '';
  if (balance > 0 && business?.upiId) {
    const upiLink = `upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(businessName)}&am=${balance}&cu=INR&tn=Order_${order.orderNumber}`;
    upiSection = `\n*Quick Pay via UPI:*\n${upiLink}\n========================================\n`;
  }

  return `*TAX INVOICE / CASH BILL*
========================================
*${businessName.toUpperCase()}*
${business?.tagline ? `_${business.tagline}_\n` : ''}${business?.address ? `Address: ${business.address}\n` : ''}${business?.phone ? `Phone: ${business.phone}\n` : ''}${business?.gstin ? `GSTIN: ${business.gstin}\n` : ''}========================================
*Bill No:* ${order.orderNumber}
*Date:* ${formatDate(order.orderDate)}
*Customer:* ${order.customerName || 'Walk-in Customer'} ${order.phoneNumber ? `(${order.phoneNumber})` : ''
    }
========================================
*PARTICULARS / ITEMS:*
${itemRows || 'No items recorded'}

----------------------------------------
*Grand Total:* *${formatCurrency(total)}*
*Advance Paid:* ${formatCurrency(order.advance)}
*Payment Status:* ${paymentStatus}
========================================
${upiSection}${business?.bankDetails ? `*Payment / Bank Details:*\n${business.bankDetails}\n========================================\n` : ''}${order.customerNote ? `*Customer Note:* ${order.customerNote}\n========================================\n` : ''}Thank you for your business!`;
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

export type InvoiceTemplateId = 'dark' | 'terracotta' | 'classic' | 'emerald';

interface TemplateTheme {
  headerBg: string;
  headerTextColor: string;
  tableHeaderBg: string;
  tableHeaderTextColor: string;
  accentColor: string;
  cardBorder: string;
  statusPaidBg: string;
  statusPaidText: string;
}

export const TEMPLATE_THEMES: Record<InvoiceTemplateId, TemplateTheme> = {
  dark: {
    headerBg: '#0F172A',
    headerTextColor: '#FFFFFF',
    tableHeaderBg: '#0F172A',
    tableHeaderTextColor: '#FFFFFF',
    accentColor: '#334155',
    cardBorder: '1px solid #CBD5E1',
    statusPaidBg: '#10B981',
    statusPaidText: '#FFFFFF',
  },
  terracotta: {
    headerBg: 'linear-gradient(135deg, #B96659 0%, #8C4337 100%)',
    headerTextColor: '#FFFFFF',
    tableHeaderBg: '#B96659',
    tableHeaderTextColor: '#FFFFFF',
    accentColor: '#B96659',
    cardBorder: '1px solid #E5C3BD',
    statusPaidBg: '#4E8A54',
    statusPaidText: '#FFFFFF',
  },
  classic: {
    headerBg: '#FFFFFF',
    headerTextColor: '#0F172A',
    tableHeaderBg: '#F1F5F9',
    tableHeaderTextColor: '#0F172A',
    accentColor: '#0F172A',
    cardBorder: '2px solid #0F172A',
    statusPaidBg: '#0F172A',
    statusPaidText: '#FFFFFF',
  },
  emerald: {
    headerBg: 'linear-gradient(135deg, #15803D 0%, #166534 100%)',
    headerTextColor: '#FFFFFF',
    tableHeaderBg: '#15803D',
    tableHeaderTextColor: '#FFFFFF',
    accentColor: '#15803D',
    cardBorder: '1px solid #BBF7D0',
    statusPaidBg: '#166534',
    statusPaidText: '#FFFFFF',
  },
};

/**
 * Generates an actual PDF file on device and opens native Share Sheet (target WhatsApp PDF file sharing).
 */
export async function sharePdfInvoiceToWhatsApp(
  order: Order,
  business?: BusinessProfile,
  templateId: InvoiceTemplateId = 'dark'
): Promise<boolean> {
  try {
    const html = generatePrintableInvoiceHtml(order, business, templateId);

    if (Platform.OS === 'web') {
      // Web: Open PDF Print / Save-as-PDF dialog for PDF invoice
      await printPdfInvoice(order, business, templateId);
      return true;
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
    await printPdfInvoice(order, business, templateId);
    return false;
  }
}

/**
 * Triggers native Print dialog or PDF file creation.
 */
export async function printPdfInvoice(
  order: Order,
  business?: BusinessProfile,
  templateId: InvoiceTemplateId = 'dark'
): Promise<void> {
  try {
    const html = generatePrintableInvoiceHtml(order, business, templateId);
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        let iframe = document.getElementById('print-invoice-iframe') as HTMLIFrameElement | null;
        if (iframe) {
          iframe.remove();
        }
        iframe = document.createElement('iframe');
        iframe.id = 'print-invoice-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();

          setTimeout(() => {
            try {
              iframe?.contentWindow?.focus();
              iframe?.contentWindow?.print();
            } catch (e) {
              console.error('Error triggering iframe print:', e);
            }
          }, 300);
        }
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
  business?: BusinessProfile,
  templateId: InvoiceTemplateId = 'dark'
): string {
  const theme = TEMPLATE_THEMES[templateId] || TEMPLATE_THEMES.dark;
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const businessName = business?.businessName || business?.name || DEFAULT_BUSINESS_NAME;
  const preset = getBusinessPreset(business?.businessType);
  const customCols = order.customColumns || [];

  const hasGst = order.items.some((i) => (i.taxRate || 0) > 0 || !!i.hsnCode);
  const isInterState = order.isInterState || false;

    // Calculate tax breakdown
    let totalTaxAmount = 0;
    order.items.forEach((it) => {
      const taxable = (it.qty || 0) * (it.price || 0) - (it.discount || 0);
      const rate = it.taxRate || 0;
      totalTaxAmount += (taxable * rate) / 100;
    });
    totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;

    const cgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
    const sgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
    const igstAmount = totalTaxAmount;

  const itemRowsHtml = order.items
    .map(
      (item, idx) => {
        const unitStr = item.unit ? ` <span style="font-size:11px; color:#64748B;">${item.unit}</span>` : '';
        const hsnCell = hasGst ? `<td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #64748B;">${item.hsnCode || '-'}</td>` : '';
        const gstCell = hasGst ? `<td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #64748B;">${item.taxRate ? `${item.taxRate}%` : '-'}</td>` : '';
        const customTds = customCols
          .map((c) => {
            const val =
              item.customValues?.[c.id] ||
              (c.name.toLowerCase() === 'unit' && item.unit ? item.unit : '-');
            return `<td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">${val || '-'}</td>`;
          })
          .join('');

        return `
    <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #64748B;">${idx + 1}</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; font-size: 14px; color: #1E293B;">${item.name || 'Item'
          }</td>
      ${hsnCell}
      <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 600; font-size: 14px; color: #334155;">${item.qty
          }${unitStr}</td>
      ${customTds}
      ${gstCell}
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

  // UPI payment link & QR
  const upiPayUrl = business?.upiId && balance > 0
    ? `upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(businessName)}&am=${balance}&cu=INR&tn=Order_${order.orderNumber}`
    : '';
  const upiQrUrl = upiPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(upiPayUrl)}`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tax Invoice - ${order.orderNumber}</title>
  <style>
    @page {
      size: auto;
      margin: 10mm;
    }
    @media print {
      html, body {
        background-color: #FFFFFF !important;
        padding: 0 !important;
        margin: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .invoice-card {
        box-shadow: none !important;
        border: none !important;
        max-width: 100% !important;
        width: 100% !important;
        border-radius: 0 !important;
        margin: 0 !important;
      }
    }
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
      border: ${theme.cardBorder};
    }
    .header-banner {
      background: ${theme.headerBg};
      color: ${theme.headerTextColor};
      padding: 24px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid ${theme.accentColor};
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
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .brand-logo-default {
      width: 52px;
      height: 52px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: ${theme.headerTextColor};
      margin: 0 0 4px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 12px;
      color: ${templateId === 'classic' ? '#64748B' : 'rgba(255, 255, 255, 0.8)'};
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
      background-color: ${isPaid ? theme.statusPaidBg : '#854D0E'};
      color: ${theme.statusPaidText};
      margin-bottom: 6px;
    }
    .bill-meta {
      font-size: 12px;
      color: ${templateId === 'classic' ? '#64748B' : 'rgba(255, 255, 255, 0.85)'};
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
      background: ${theme.tableHeaderBg};
      color: ${theme.tableHeaderTextColor};
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
        ${
          business?.logoUri
            ? `<img src="${business.logoUri}" class="brand-logo" alt="Logo" />`
            : `<div class="brand-logo-default">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
               </div>`
        }
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
            ${hasGst ? '<th style="text-align: center; width: 70px;">HSN</th>' : ''}
            <th style="text-align: center; width: 70px;">Qty</th>
            ${customCols.map((c) => `<th style="text-align: center; width: 80px;">${c.name}</th>`).join('')}
            ${hasGst ? '<th style="text-align: center; width: 60px;">GST</th>' : ''}
            <th style="text-align: right; width: 90px;">Rate (₹)</th>
            <th style="text-align: right; width: 100px;">Amount (₹)</th>
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
          ${
            hasGst && totalTaxAmount > 0
              ? `
          <div class="summary-row">
            <span>Taxable Amount</span>
            <span>${formatCurrency(total - totalTaxAmount)}</span>
          </div>
          ${
            isInterState
              ? `<div class="summary-row"><span>IGST</span><span>+${formatCurrency(igstAmount)}</span></div>`
              : `<div class="summary-row"><span>CGST</span><span>+${formatCurrency(cgstAmount)}</span></div>
                 <div class="summary-row"><span>SGST</span><span>+${formatCurrency(sgstAmount)}</span></div>`
          }
          `
              : ''
          }
          <div class="summary-row">
            <span>Advance Paid</span>
            <span style="color: #2e7d32; font-weight: 600;">${formatCurrency(order.advance)}</span>
          </div>
          <div class="summary-row">
            <span>Balance Due</span>
            <span style="color: ${isPaid ? '#2e7d32' : '#c62828'}; font-weight: 600;">${isPaid ? 'PAID IN FULL (₹0)' : formatCurrency(balance)}</span>
          </div>
          <div class="summary-row total">
            <span>Grand Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      ${
        upiQrUrl || business?.bankDetails
          ? `<div class="bank-card" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div style="flex: 1;">
                <h5>Payment & Bank Details</h5>
                ${business?.upiId ? `<p style="font-weight: 700; color: #0F172A; margin-bottom: 4px;">UPI ID: ${business.upiId}</p>` : ''}
                ${business?.bankDetails ? `<p>${business.bankDetails}</p>` : ''}
                ${upiPayUrl ? `<p style="font-size: 11px; color: #475569; margin-top: 4px;">Scan QR to pay directly via Google Pay / PhonePe / Paytm</p>` : ''}
              </div>
              ${upiQrUrl ? `<div style="text-align: center;"><img src="${upiQrUrl}" alt="UPI QR Code" style="width: 100px; height: 100px; border-radius: 6px; border: 1px solid #CBD5E1;" /><p style="font-size: 10px; color: #64748B; margin: 2px 0 0 0; font-weight: 600;">SCAN TO PAY</p></div>` : ''}
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
