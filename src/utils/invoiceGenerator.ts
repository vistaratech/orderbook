import { Linking, Share, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Order, orderTotal, orderBalance } from '../types/order';
import { Estimate, estimateTotal } from '../types/estimate';
import { formatCurrency, formatDate } from './format';
import { getBusinessPreset, BusinessType } from '../config/businessTypes';
import {
  InvoiceTemplateConfig,
  InvoiceTemplateId,
  DEFAULT_INVOICE_TEMPLATE_CONFIG,
  INVOICE_THEME_PRESETS,
} from '../types/invoiceTemplate';
import { getInvoiceTemplateConfig } from '../storage/invoiceTemplateStorage';

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
  business?: BusinessProfile,
  config?: Partial<InvoiceTemplateConfig>
): string {
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const businessName = business?.businessName || business?.name || DEFAULT_BUSINESS_NAME;
  const invoiceTitle = config?.invoiceTitle || 'TAX INVOICE / CASH BILL';

  const itemRows = order.items
    .map((item, idx) => {
      const unitStr = item.unit ? ` ${item.unit}` : '';
      const hsnStr = item.hsnCode && config?.showHsn !== false ? ` [HSN: ${item.hsnCode}]` : '';
      const taxStr = item.taxRate && config?.showGSTRate !== false ? ` (GST ${item.taxRate}%)` : '';
      let extraInfo = '';
      if (order.customColumns && order.customColumns.length > 0) {
        const extras = order.customColumns
          .map((col) => {
            const v =
              item.customValues?.[col.id] ||
              (col.name.toLowerCase() === 'unit' ? item.unit : null);
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
    })
    .join('\n');

  const paymentStatus =
    balance <= 0
      ? '*PAID IN FULL*'
      : `*BALANCE DUE: ${formatCurrency(balance)}* (Advance: ${formatCurrency(order.advance)})`;

  // UPI payment link if balance is due
  const upiId = config?.upiId || business?.upiId;
  let upiSection = '';
  if (balance > 0 && upiId) {
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      businessName
    )}&am=${balance}&cu=INR&tn=Order_${order.orderNumber}`;
    upiSection = `\n*Quick Pay via UPI:*\n${upiLink}\n========================================\n`;
  }

  const termsText =
    config?.showTerms !== false && config?.termsAndConditions
      ? `*Terms:*\n${config.termsAndConditions}\n========================================\n`
      : '';

  return `*${invoiceTitle.toUpperCase()}*
========================================
*${businessName.toUpperCase()}*
${business?.tagline && config?.showTagline !== false ? `_${business.tagline}_\n` : ''}${business?.address && config?.showBusinessAddress !== false ? `Address: ${business.address}\n` : ''}${business?.phone && config?.showBusinessPhone !== false ? `Phone: ${business.phone}\n` : ''}${business?.gstin && config?.showGstin !== false ? `GSTIN: ${business.gstin}\n` : ''}========================================
*Bill No:* ${order.orderNumber}
*Date:* ${formatDate(order.orderDate)}
*Customer:* ${order.customerName || 'Walk-in Customer'} ${
    order.phoneNumber && config?.showCustomerPhone !== false ? `(${order.phoneNumber})` : ''
  }
========================================
*PARTICULARS / ITEMS:*
${itemRows || 'No items recorded'}

----------------------------------------
*Grand Total:* *${formatCurrency(total)}*
*Advance Paid:* ${formatCurrency(order.advance)}
*Payment Status:* ${paymentStatus}
========================================
${upiSection}${
    business?.bankDetails && config?.showBankDetails !== false
      ? `*Payment / Bank Details:*\n${business.bankDetails}\n========================================\n`
      : ''
  }${
    order.customerNote && config?.showNotes !== false
      ? `*Customer Note:* ${order.customerNote}\n========================================\n`
      : ''
  }${termsText}${config?.footerMessage || 'Thank you for your business!'}`;
}

/**
 * Sends the invoice text directly to customer's WhatsApp or falls back to system Share.
 */
export async function sendWhatsAppInvoice(
  order: Order,
  business?: BusinessProfile,
  config?: Partial<InvoiceTemplateConfig>
): Promise<boolean> {
  const message = generateWhatsAppInvoiceText(order, business, config);
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
  business?: BusinessProfile,
  templateOrConfig?: InvoiceTemplateConfig | InvoiceTemplateId
): Promise<boolean> {
  try {
    const html = await resolveAndGenerateInvoiceHtml(order, business, templateOrConfig);

    if (Platform.OS === 'web') {
      await printPdfInvoice(order, business, templateOrConfig);
      return true;
    }

    const { uri } = await Print.printToFileAsync({ html });

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
    await printPdfInvoice(order, business, templateOrConfig);
    return false;
  }
}

/**
 * Triggers native Print dialog or PDF file creation for an order.
 */
export async function printPdfInvoice(
  order: Order,
  business?: BusinessProfile,
  templateOrConfig?: InvoiceTemplateConfig | InvoiceTemplateId
): Promise<void> {
  try {
    const html = await resolveAndGenerateInvoiceHtml(order, business, templateOrConfig);

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
 * Helper to resolve template configuration object and generate HTML.
 */
export async function resolveAndGenerateInvoiceHtml(
  order: Order,
  business?: BusinessProfile,
  templateOrConfig?: InvoiceTemplateConfig | InvoiceTemplateId
): Promise<string> {
  let config: InvoiceTemplateConfig;

  if (templateOrConfig && typeof templateOrConfig === 'object') {
    config = templateOrConfig;
  } else if (templateOrConfig && typeof templateOrConfig === 'string') {
    const preset = INVOICE_THEME_PRESETS[templateOrConfig as InvoiceTemplateId];
    const saved = await getInvoiceTemplateConfig();
    if (preset) {
      config = {
        ...saved,
        templateId: preset.id,
        primaryColor: preset.primaryColor,
        accentColor: preset.accentColor,
        headerBgColor: preset.headerBgColor,
        headerTextColor: preset.headerTextColor,
        cardBorderColor: preset.cardBorderColor,
        fontFamily: preset.fontFamily,
        paperSize: preset.paperSize,
      };
    } else {
      config = saved;
    }
  } else {
    config = await getInvoiceTemplateConfig();
  }

  return generatePrintableInvoiceHtml(order, business, config);
}

/**
 * Generates responsive printable HTML document for PDF/Print modal.
 */
export function generatePrintableInvoiceHtml(
  order: Order,
  business?: BusinessProfile,
  templateOrConfig?: InvoiceTemplateConfig | InvoiceTemplateId
): string {
  let cfg: InvoiceTemplateConfig;

  if (templateOrConfig && typeof templateOrConfig === 'object') {
    cfg = { ...DEFAULT_INVOICE_TEMPLATE_CONFIG, ...templateOrConfig };
  } else if (typeof templateOrConfig === 'string') {
    const preset = INVOICE_THEME_PRESETS[templateOrConfig as InvoiceTemplateId];
    if (preset) {
      cfg = {
        ...DEFAULT_INVOICE_TEMPLATE_CONFIG,
        templateId: preset.id,
        primaryColor: preset.primaryColor,
        accentColor: preset.accentColor,
        headerBgColor: preset.headerBgColor,
        headerTextColor: preset.headerTextColor,
        cardBorderColor: preset.cardBorderColor,
        fontFamily: preset.fontFamily,
        paperSize: preset.paperSize,
      };
    } else {
      cfg = DEFAULT_INVOICE_TEMPLATE_CONFIG;
    }
  } else {
    cfg = DEFAULT_INVOICE_TEMPLATE_CONFIG;
  }

  const templateId = cfg.templateId || 'modern_slate';

  if (templateId === 'thermal_pos' || cfg.paperSize === 'thermal_80mm' || cfg.paperSize === 'thermal_58mm') {
    return generateThermalPosHtml(order, business, cfg);
  }

  if (templateId === 'gst_tax_invoice') {
    return generateGstTaxInvoiceHtml(order, business, cfg);
  }

  return generateStandardInvoiceHtml(order, business, cfg);
}

/**
 * 1. Standard Multi-Theme Invoice HTML Generator
 * (Modern Slate, Warm Terracotta, Classic Minimal, Emerald Pro, Sapphire Corporate, Ruby Retail)
 */
function generateStandardInvoiceHtml(
  order: Order,
  business: BusinessProfile | undefined,
  cfg: InvoiceTemplateConfig
): string {
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const businessName = business?.businessName || business?.name || DEFAULT_BUSINESS_NAME;
  const isPaid = balance <= 0;

  let totalTaxAmount = 0;
  let subtotalAmount = 0;
  let totalDiscountAmount = 0;

  order.items.forEach((it) => {
    const itemSub = (it.qty || 0) * (it.price || 0);
    const itemDisc = it.discount || 0;
    const taxable = Math.max(0, itemSub - itemDisc);
    const rate = it.taxRate || 0;
    subtotalAmount += itemSub;
    totalDiscountAmount += itemDisc;
    totalTaxAmount += (taxable * rate) / 100;
  });

  totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
  const cgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
  const sgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;

  // UPI dynamic payment link & QR
  const upiId = cfg.upiId || business?.upiId;
  const upiPayUrl =
    cfg.showUpiQr && upiId && balance > 0
      ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
          businessName
        )}&am=${balance}&cu=INR&tn=Order_${order.orderNumber}`
      : (cfg.showUpiQr && upiId ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}` : '');
  const upiQrUrl = upiPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
        upiPayUrl
      )}`
    : '';

  const itemRowsHtml = order.items
    .map((item, idx) => {
      const sNoCell = cfg.showItemSerialNo
        ? `<td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: center; font-size: 11px; color: #64748B;">${
            idx + 1
          }</td>`
        : '';
      const hsnCell = cfg.showHsn
        ? `<td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: center; font-size: 11px; color: #64748B;">${
            item.hsnCode || '-'
          }</td>`
        : '';
      const unitCell = cfg.showUnit
        ? `<td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: center; font-size: 11px; color: #64748B;">${
            item.unit || '-'
          }</td>`
        : '';
      const rateCell = cfg.showRate
        ? `<td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: right; font-size: 11.5px; color: #334155;">${formatCurrency(
            item.price
          )}</td>`
        : '';
      const gstCell = cfg.showGSTRate
        ? `<td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: center; font-size: 11px; color: #475569;">${
            item.taxRate ? `${item.taxRate}%` : '0%'
          }</td>`
        : '';
      const discCell = cfg.showDiscount
        ? `<td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: right; font-size: 11px; color: #16A34A;">${
            item.discount ? `-${formatCurrency(item.discount)}` : '-'
          }</td>`
        : '';

      return `
    <tr style="background-color: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
      ${sNoCell}
      <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-weight: 600; font-size: 12px; color: #0F172A;">${
        item.name || 'Item'
      }</td>
      ${hsnCell}
      <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: center; font-size: 12px; color: #334155;">${
        item.qty
      }</td>
      ${unitCell}
      ${rateCell}
      ${gstCell}
      ${discCell}
      <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; text-align: right; font-weight: 700; font-size: 12px; color: #0F172A;">${formatCurrency(
        item.qty * item.price - (item.discount || 0)
      )}</td>
    </tr>`;
    })
    .join('');

  const logoHtml =
    cfg.showLogo && business?.logoUri
      ? `<img src="${business.logoUri}" alt="Store Logo" style="width: 58px; height: 58px; object-fit: contain; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); background: #FFFFFF; flex-shrink: 0;" />`
      : '';

  const bankText = cfg.bankDetailsCustom || business?.bankDetails;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cfg.invoiceTitle || 'TAX INVOICE'} - ${order.orderNumber}</title>
  <style>
    @page {
      size: ${cfg.paperSize === 'a5' ? 'A5 portrait' : 'A4 portrait'};
      margin: ${cfg.compactMode ? '5mm' : '8mm'};
    }
    @media print {
      html, body {
        background-color: #FFFFFF !important;
        padding: 0 !important;
        margin: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .invoice-sheet {
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
      font-family: ${
        cfg.fontFamily === 'serif'
          ? 'Georgia, "Times New Roman", serif'
          : cfg.fontFamily === 'monospace'
          ? '"Courier New", Courier, monospace'
          : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      };
      background-color: #EEF2F6;
      color: #0F172A;
      margin: 0;
      padding: ${cfg.compactMode ? '10px' : '18px'};
      display: flex;
      justify-content: center;
    }
    .invoice-sheet {
      width: 100%;
      max-width: 720px;
      background: #FFFFFF;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
      border: 1.5px solid ${cfg.cardBorderColor || '#CBD5E1'};
    }
    .sheet-header {
      background: ${cfg.headerBgColor || '#F8FAFC'};
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${cfg.primaryColor};
      gap: 12px;
    }
    .brand-section {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex: 1.6;
    }
    .store-name {
      font-size: 18px;
      font-weight: 800;
      color: ${cfg.headerTextColor || cfg.primaryColor};
      margin: 0 0 2px 0;
      letter-spacing: 0.3px;
    }
    .tagline {
      font-size: 11px;
      color: #64748B;
      margin: 0 0 4px 0;
    }
    .address-line {
      font-size: 10.5px;
      color: #334155;
      margin: 0 0 3px 0;
      line-height: 1.35;
    }
    .contacts-row {
      font-size: 10.5px;
      color: #334155;
      margin: 2px 0 0 0;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .gstin-tag {
      font-weight: 700;
      color: ${cfg.primaryColor};
    }
    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 140px;
    }
    .title-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      background-color: ${cfg.primaryColor};
      color: #FFFFFF;
      margin-bottom: 6px;
      text-align: center;
    }
    .meta-text {
      font-size: 10.5px;
      color: #1E293B;
      margin: 1px 0;
      text-align: right;
    }
    .buyer-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 16px;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
    }
    .buyer-heading {
      font-size: 9.5px;
      color: #64748B;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .buyer-name {
      font-size: 12.5px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 1px;
    }
    .buyer-phone {
      font-size: 10px;
      color: #64748B;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      background-color: ${isPaid ? '#DCFCE7' : '#FEF3C7'};
      color: ${isPaid ? '#15803D' : '#B45309'};
    }
    .table-container {
      padding: 12px 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: ${cfg.primaryColor};
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 10px;
      border: none;
    }
    th:first-child {
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
    }
    th:last-child {
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
    }
    .totals-section {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      border-top: 1px solid #E2E8F0;
      background: #FAFAFA;
      gap: 16px;
    }
    .words-and-notes {
      flex: 1;
    }
    .section-small-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .words-value {
      font-size: 10px;
      font-style: italic;
      color: #1E293B;
      margin-top: 2px;
    }
    .notes-value {
      font-size: 10px;
      color: #334155;
      margin-top: 2px;
    }
    .totals-card {
      width: 220px;
    }
    .calc-row {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #1E293B;
      margin-bottom: 4px;
    }
    .calc-row.total {
      border-top: 1.5px solid #CBD5E1;
      padding-top: 5px;
      margin-top: 4px;
      font-weight: 800;
      font-size: 12px;
    }
    .calc-row.balance {
      background: ${isPaid ? '#F0FDF4' : '#FEF2F2'};
      border: 1px solid ${isPaid ? '#BBF7D0' : '#FECACA'};
      padding: 4px 6px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 11px;
      color: ${isPaid ? '#15803D' : '#DC2626'};
      margin-top: 5px;
    }
    .payment-container {
      padding: 10px 16px;
      border-top: 1px solid #E2E8F0;
      background: #FFFFFF;
    }
    .payment-inner-row {
      display: flex;
      gap: 12px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .qr-card-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 6px 10px;
      border-radius: 6px;
      min-width: 110px;
    }
    .bank-card-box {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 9.5px;
      color: #1E293B;
      white-space: pre-line;
      line-height: 1.35;
    }
    .footer-terms-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 12px 16px;
      border-top: 1px solid #E2E8F0;
      background: #FFFFFF;
      gap: 14px;
    }
    .terms-box {
      flex: 1.4;
      font-size: 9px;
      color: #475569;
      line-height: 1.35;
      white-space: pre-line;
    }
    .greeting-line {
      font-size: 10px;
      font-weight: 700;
      color: ${cfg.primaryColor};
      margin-top: 6px;
    }
    .signatory-box {
      width: 140px;
      text-align: center;
    }
    .signatory-line {
      width: 100%;
      height: 1px;
      background: #94A3B8;
      margin-bottom: 4px;
    }
    .signatory-store {
      font-size: 9.5px;
      font-weight: 700;
      color: #0F172A;
    }
    .signatory-title {
      font-size: 8.5px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="invoice-sheet">
    <!-- 1. Header Banner -->
    <div class="sheet-header">
      <div class="brand-section">
        ${logoHtml}
        <div>
          <h1 class="store-name">${businessName}</h1>
          ${cfg.showTagline && business?.tagline ? `<p class="tagline">${business.tagline}</p>` : ''}
          ${cfg.showBusinessAddress && business?.address ? `<p class="address-line">${business.address}</p>` : ''}
          <div class="contacts-row">
            ${cfg.showBusinessPhone && business?.phone ? `<span>Ph: ${business.phone}</span>` : ''}
            ${cfg.showGstin && business?.gstin ? `<span class="gstin-tag">GSTIN: ${business.gstin}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="header-right">
        <div class="title-badge">${(cfg.invoiceTitle || 'TAX INVOICE').toUpperCase()}</div>
        <div class="meta-text"><b>Bill #:</b> ${order.orderNumber}</div>
        <div class="meta-text"><b>Date:</b> ${formatDate(order.orderDate)}</div>
        <div class="meta-text"><b>Place:</b> Tamil Nadu (33)</div>
      </div>
    </div>

    <!-- 2. Buyer Strip -->
    <div class="buyer-strip">
      <div>
        <div class="buyer-heading">BUYER / CUSTOMER DETAILS:</div>
        <div class="buyer-name">${order.customerName || 'Walk-in Customer'}</div>
        ${cfg.showCustomerPhone && order.phoneNumber ? `<div class="buyer-phone">Mobile: ${order.phoneNumber}</div>` : ''}
      </div>
      <div>
        <div class="status-badge">${isPaid ? 'PAID IN FULL' : 'Partially Paid'}</div>
      </div>
    </div>

    <!-- 3. Items Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            ${cfg.showItemSerialNo ? '<th style="text-align: center; width: 30px;">#</th>' : ''}
            <th style="text-align: left;">Item Description</th>
            ${cfg.showHsn ? '<th style="text-align: center; width: 50px;">HSN</th>' : ''}
            <th style="text-align: center; width: 40px;">Qty</th>
            ${cfg.showUnit ? '<th style="text-align: center; width: 40px;">Unit</th>' : ''}
            ${cfg.showRate ? '<th style="text-align: right; width: 65px;">Rate</th>' : ''}
            ${cfg.showGSTRate ? '<th style="text-align: center; width: 45px;">GST</th>' : ''}
            ${cfg.showDiscount ? '<th style="text-align: right; width: 50px;">Disc</th>' : ''}
            <th style="text-align: right; width: 75px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- 4. Totals & Notes Section -->
    <div class="totals-section">
      <div class="words-and-notes">
        <div class="section-small-title">Amount in Words:</div>
        <div class="words-value">Rupees ${Math.round(total)} Only</div>
        ${
          cfg.showNotes && (order.customerNote || cfg.defaultNotes)
            ? `<div style="margin-top: 8px;">
                <div class="section-small-title">${cfg.notesHeading || 'Customer Note / Instructions'}:</div>
                <div class="notes-value">${order.customerNote || cfg.defaultNotes}</div>
               </div>`
            : ''
        }
      </div>

      <div class="totals-card">
        <div class="calc-row">
          <span>Subtotal:</span>
          <b>${formatCurrency(subtotalAmount)}</b>
        </div>
        ${
          totalDiscountAmount > 0 || cfg.showDiscount
            ? `<div class="calc-row" style="color: #16A34A;">
                <span>Discount:</span>
                <b>-${formatCurrency(totalDiscountAmount)}</b>
               </div>`
            : ''
        }
        ${
          cfg.showGSTRate && totalTaxAmount > 0
            ? `<div class="calc-row"><span>CGST (2.5%):</span><b>+${formatCurrency(cgstAmount)}</b></div>
               <div class="calc-row"><span>SGST (2.5%):</span><b>+${formatCurrency(sgstAmount)}</b></div>`
            : ''
        }
        <div class="calc-row total">
          <span>Grand Total:</span>
          <span>${formatCurrency(total)}</span>
        </div>
        <div class="calc-row" style="color: #16A34A;">
          <span>Advance Paid:</span>
          <b>${formatCurrency(order.advance)}</b>
        </div>
        <div class="calc-row balance">
          <span>Balance Due:</span>
          <span>${isPaid ? 'PAID IN FULL (₹0)' : formatCurrency(balance)}</span>
        </div>
      </div>
    </div>

    <!-- 5. Payment & QR Section -->
    ${
      (cfg.showUpiQr && (upiQrUrl || upiId)) || (cfg.showBankDetails && bankText)
        ? `<div class="payment-container">
            <div class="section-small-title" style="margin-bottom: 3px;">Payment & Bank Transfer Details</div>
            <div class="payment-inner-row">
              ${
                cfg.showUpiQr && (upiQrUrl || upiId)
                  ? `<div class="qr-card-box">
                      ${upiQrUrl ? `<img src="${upiQrUrl}" alt="QR" style="width: 50px; height: 50px; border-radius: 4px;" />` : ''}
                      <div style="font-size: 8.5px; font-weight: 700; color: #0F172A; margin-top: 2px;">Scan with UPI</div>
                      ${upiId ? `<div style="font-size: 8px; color: ${cfg.primaryColor}; font-weight: 600;">${upiId}</div>` : ''}
                    </div>`
                  : ''
              }
              ${
                cfg.showBankDetails && bankText
                  ? `<div class="bank-card-box">
                      <div style="font-weight: 700; margin-bottom: 2px; color: #0F172A;">🏦 Bank Account Information:</div>
                      ${bankText}
                    </div>`
                  : ''
              }
            </div>
           </div>`
        : ''
    }

    <!-- 6. Footer Terms & Signature -->
    <div class="footer-terms-section">
      <div class="terms-box">
        ${
          cfg.showTerms && cfg.termsAndConditions
            ? `<div><b>${cfg.termsHeading || 'Terms & Conditions'}:</b>\n${cfg.termsAndConditions}</div>`
            : ''
        }
        ${cfg.footerMessage ? `<div class="greeting-line">${cfg.footerMessage}</div>` : ''}
      </div>

      ${
        cfg.showSignatory
          ? `<div class="signatory-box">
              <div class="signatory-line"></div>
              <div class="signatory-store">For ${businessName}</div>
              <div class="signatory-title">${cfg.signatoryTitle || 'Authorized Signatory'}</div>
            </div>`
          : ''
      }
    </div>
  </div>
</body>
</html>`;
}

/**
 * 2. POS Thermal Receipt (80mm & 58mm) Format
 * Monospaced receipt format optimized for thermal Bluetooth printers.
 */
function generateThermalPosHtml(
  order: Order,
  business: BusinessProfile | undefined,
  cfg: InvoiceTemplateConfig
): string {
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const businessName = business?.businessName || business?.name || DEFAULT_BUSINESS_NAME;
  const isPaid = balance <= 0;
  const is58mm = cfg.paperSize === 'thermal_58mm';

  const upiId = cfg.upiId || business?.upiId;
  const upiPayUrl =
    cfg.showUpiQr && upiId && balance > 0
      ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
          businessName
        )}&am=${balance}&cu=INR&tn=Order_${order.orderNumber}`
      : '';
  const upiQrUrl = upiPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
        upiPayUrl
      )}`
    : '';

  const itemRowsHtml = order.items
    .map((item, idx) => {
      const itemTotal = item.qty * item.price - (item.discount || 0);
      return `
    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
      <span style="font-weight: 700;">${idx + 1}. ${item.name || 'Item'}</span>
      <span style="font-weight: 700;">${formatCurrency(itemTotal)}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; margin-bottom: 4px; padding-left: 12px;">
      <span>${item.qty} ${item.unit || 'pcs'} x ${formatCurrency(item.price)}</span>
      ${item.taxRate ? `<span>GST ${item.taxRate}%</span>` : ''}
    </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt - ${order.orderNumber}</title>
  <style>
    @page {
      size: ${is58mm ? '58mm auto' : '80mm auto'};
      margin: 2mm;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .thermal-wrapper {
        width: 100% !important;
        box-shadow: none !important;
        border: none !important;
      }
    }
    body {
      font-family: "Courier New", Courier, monospace;
      background-color: #FAFAFA;
      color: #000000;
      margin: 0;
      padding: 10px;
      display: flex;
      justify-content: center;
    }
    .thermal-wrapper {
      width: ${is58mm ? '200px' : '280px'};
      background: #FFFFFF;
      padding: 8px;
      font-size: 11px;
      line-height: 1.3;
      border: 1px dashed #CCCCCC;
    }
    .dashed-divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .solid-divider {
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .center {
      text-align: center;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .bold {
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="thermal-wrapper">
    <div class="center">
      <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.5px;">${businessName.toUpperCase()}</div>
      ${cfg.showTagline && business?.tagline ? `<div style="font-size: 10px;">${business.tagline}</div>` : ''}
      ${cfg.showBusinessAddress && business?.address ? `<div style="font-size: 9px;">${business.address}</div>` : ''}
      ${cfg.showBusinessPhone && business?.phone ? `<div style="font-size: 10px;">Ph: ${business.phone}</div>` : ''}
      ${cfg.showGstin && business?.gstin ? `<div style="font-size: 10px; font-weight: 700;">GSTIN: ${business.gstin}</div>` : ''}
      <div style="font-size: 12px; font-weight: 800; margin-top: 4px; text-transform: uppercase;">${cfg.invoiceTitle || 'CASH RECEIPT'}</div>
    </div>

    <div class="dashed-divider"></div>

    <div class="row">
      <span>Bill #: ${order.orderNumber}</span>
      <span>${formatDate(order.orderDate)}</span>
    </div>
    <div class="row">
      <span>Customer: ${order.customerName || 'Walk-in'}</span>
      ${cfg.showCustomerPhone && order.phoneNumber ? `<span>${order.phoneNumber}</span>` : ''}
    </div>

    <div class="solid-divider"></div>

    <div style="margin: 6px 0;">
      ${itemRowsHtml}
    </div>

    <div class="solid-divider"></div>

    <div class="row bold">
      <span>TOTAL AMOUNT:</span>
      <span>${formatCurrency(total)}</span>
    </div>
    <div class="row">
      <span>Advance Paid:</span>
      <span>${formatCurrency(order.advance)}</span>
    </div>
    <div class="row bold" style="font-size: 12px; margin-top: 2px;">
      <span>${isPaid ? 'STATUS:' : 'BALANCE DUE:'}</span>
      <span>${isPaid ? 'PAID IN FULL' : formatCurrency(balance)}</span>
    </div>

    ${
      upiQrUrl
        ? `<div class="dashed-divider"></div>
           <div class="center">
             <div style="font-size: 9px; font-weight: 700; margin-bottom: 2px;">SCAN TO PAY VIA UPI</div>
             <img src="${upiQrUrl}" alt="UPI QR" style="width: 80px; height: 80px;" />
             ${upiId ? `<div style="font-size: 9px;">UPI: ${upiId}</div>` : ''}
           </div>`
        : ''
    }

    <div class="dashed-divider"></div>

    ${
      cfg.showTerms && cfg.termsAndConditions
        ? `<div style="font-size: 8px; color: #555; margin-bottom: 6px;">
             ${cfg.termsAndConditions}
           </div>`
        : ''
    }

    <div class="center" style="font-size: 10px; font-weight: 700; margin-top: 4px;">
      ${cfg.footerMessage || '*** THANK YOU FOR SHOPPING! ***'}
    </div>
  </div>
</body>
</html>`;
}

/**
 * 3. Official GST Tax Invoice Generator
 * Standard 2-column statutory format with complete CGST/SGST/IGST breakdown & HSN summary.
 */
function generateGstTaxInvoiceHtml(
  order: Order,
  business: BusinessProfile | undefined,
  cfg: InvoiceTemplateConfig
): string {
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const businessName = business?.businessName || business?.name || DEFAULT_BUSINESS_NAME;
  const isPaid = balance <= 0;
  const isInterState = order.isInterState || false;

  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  // Group items for HSN Tax breakdown table
  const hsnMap: Record<
    string,
    { hsn: string; taxable: number; rate: number; cgst: number; sgst: number; igst: number }
  > = {};

  const itemRowsHtml = order.items
    .map((item, idx) => {
      const itemSub = item.qty * item.price;
      const itemDisc = item.discount || 0;
      const taxable = Math.max(0, itemSub - itemDisc);
      const rate = item.taxRate || 0;
      const taxAmt = (taxable * rate) / 100;
      const hsn = item.hsnCode || 'N/A';

      totalTaxableValue += taxable;

      if (isInterState) {
        totalIgst += taxAmt;
      } else {
        totalCgst += taxAmt / 2;
        totalSgst += taxAmt / 2;
      }

      if (!hsnMap[hsn]) {
        hsnMap[hsn] = {
          hsn,
          taxable: 0,
          rate,
          cgst: 0,
          sgst: 0,
          igst: 0,
        };
      }
      hsnMap[hsn].taxable += taxable;
      if (isInterState) {
        hsnMap[hsn].igst += taxAmt;
      } else {
        hsnMap[hsn].cgst += taxAmt / 2;
        hsnMap[hsn].sgst += taxAmt / 2;
      }

      return `
    <tr>
      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 6px; font-weight: 700; font-size: 12px;">${item.name || 'Item'}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px;">${item.hsnCode || '-'}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px;">${item.qty} ${item.unit || 'pcs'}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11px;">${formatCurrency(item.price)}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11px;">${formatCurrency(taxable)}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px;">${rate}%</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: 700; font-size: 11px;">${formatCurrency(
        taxable + taxAmt
      )}</td>
    </tr>`;
    })
    .join('');

  const hsnRowsHtml = Object.values(hsnMap)
    .map(
      (h) => `
    <tr>
      <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px;">${h.hsn}</td>
      <td style="border: 1px solid #000; padding: 4px; text-align: right; font-size: 10px;">${formatCurrency(h.taxable)}</td>
      ${
        isInterState
          ? `<td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px;">${h.rate}%</td>
             <td style="border: 1px solid #000; padding: 4px; text-align: right; font-size: 10px;">${formatCurrency(h.igst)}</td>`
          : `<td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px;">${h.rate / 2}%</td>
             <td style="border: 1px solid #000; padding: 4px; text-align: right; font-size: 10px;">${formatCurrency(h.cgst)}</td>
             <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px;">${h.rate / 2}%</td>
             <td style="border: 1px solid #000; padding: 4px; text-align: right; font-size: 10px;">${formatCurrency(h.sgst)}</td>`
      }
      <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: 700; font-size: 10px;">${formatCurrency(
        h.cgst + h.sgst + h.igst
      )}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GST Tax Invoice - ${order.orderNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    @media print {
      body { margin: 0; padding: 0; }
      .gst-container { width: 100% !important; box-shadow: none !important; border: 2px solid #000 !important; }
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      background: #F8FAFC;
      margin: 0;
      padding: 16px;
    }
    .gst-container {
      max-width: 740px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 2px solid #000000;
      padding: 0;
    }
    .gst-header {
      text-align: center;
      padding: 12px;
      border-bottom: 2px solid #000000;
      background: #F1F5F9;
    }
    .gst-title {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #000000;
    }
    .grid-cell {
      padding: 8px 12px;
      font-size: 11px;
      line-height: 1.4;
    }
    .grid-cell:first-child {
      border-right: 1px solid #000000;
    }
    table.gst-table {
      width: 100%;
      border-collapse: collapse;
    }
    table.gst-table th {
      border: 1px solid #000000;
      background: #E2E8F0;
      padding: 6px;
      font-size: 11px;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <div class="gst-container">
    <div class="gst-header" style="display: flex; align-items: center; justify-content: center; gap: 12px; position: relative; padding: 12px;">
      ${cfg.showLogo && business?.logoUri ? `<img src="${business.logoUri}" alt="Logo" style="width: 48px; height: 48px; object-fit: contain; position: absolute; left: 12px; top: 8px;" />` : ''}
      <div>
        <div class="gst-title">${cfg.invoiceTitle || 'TAX INVOICE'}</div>
        <div style="font-size: 10px; margin-top: 2px;">(Issued under Section 31 of Central Goods and Services Tax Act, 2017)</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="grid-cell">
        <div style="font-weight: 800; font-size: 14px; text-transform: uppercase;">${businessName}</div>
        <div>${business?.address || ''}</div>
        <div>Phone: ${business?.phone || '-'} | Email: ${business?.email || '-'}</div>
        <div style="font-weight: 800; margin-top: 4px;">GSTIN / UIN: ${business?.gstin || 'UNREGISTERED'}</div>
        <div>State: Tamil Nadu (Code: 33)</div>
      </div>
      <div class="grid-cell">
        <div><b>Invoice Number:</b> ${order.orderNumber}</div>
        <div><b>Invoice Date:</b> ${formatDate(order.orderDate)}</div>
        <div><b>Place of Supply:</b> ${isInterState ? 'Inter-State' : 'Intra-State (33)'}</div>
        <div><b>Reverse Charge:</b> No</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="grid-cell">
        <div style="font-weight: 800; text-transform: uppercase; font-size: 11px; color: #475569;">DETAILS OF RECEIVER / BILLED TO:</div>
        <div style="font-weight: 800; font-size: 13px;">${order.customerName || 'Walk-in Customer'}</div>
        <div>Phone: ${order.phoneNumber || 'N/A'}</div>
      </div>
      <div class="grid-cell">
        <div style="font-weight: 800; text-transform: uppercase; font-size: 11px; color: #475569;">PAYMENT SUMMARY:</div>
        <div><b>Grand Total:</b> ${formatCurrency(total)}</div>
        <div><b>Advance Paid:</b> ${formatCurrency(order.advance)}</div>
        <div><b>Balance Due:</b> ${isPaid ? 'PAID IN FULL' : formatCurrency(balance)}</div>
      </div>
    </div>

    <table class="gst-table">
      <thead>
        <tr>
          <th style="width: 32px;">#</th>
          <th>Description of Goods / Services</th>
          <th style="width: 60px;">HSN/SAC</th>
          <th style="width: 60px;">Qty</th>
          <th style="width: 75px;">Rate</th>
          <th style="width: 80px;">Taxable Value</th>
          <th style="width: 50px;">GST %</th>
          <th style="width: 90px;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>

    <div style="padding: 10px; border-top: 1px solid #000; background: #F8FAFC;">
      <div style="font-size: 11px; font-weight: 800; margin-bottom: 4px;">HSN / SAC TAX SUMMARY:</div>
      <table class="gst-table" style="background: #FFF;">
        <thead>
          <tr>
            <th>HSN/SAC</th>
            <th>Taxable Amount</th>
            ${
              isInterState
                ? '<th>IGST Rate</th><th>IGST Amt</th>'
                : '<th>CGST Rate</th><th>CGST Amt</th><th>SGST Rate</th><th>SGST Amt</th>'
            }
            <th>Total Tax</th>
          </tr>
        </thead>
        <tbody>
          ${hsnRowsHtml}
        </tbody>
      </table>
    </div>

    <div class="grid-2" style="border-top: 1px solid #000;">
      <div class="grid-cell">
        <div style="font-weight: 800; font-size: 10px;">BANK & PAYMENT DETAILS:</div>
        <div>${business?.bankDetails || 'Bank Name: State Bank of India\nA/C No: Available on request'}</div>
        ${business?.upiId ? `<div><b>UPI ID:</b> ${business.upiId}</div>` : ''}
        <div style="margin-top: 6px; font-size: 9px; color: #555;">
          <b>Declaration:</b> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>
      </div>
      <div class="grid-cell" style="text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="font-weight: 800; font-size: 11px;">For ${businessName.toUpperCase()}</div>
        <div style="border-bottom: 1px solid #000; width: 80%; margin: 30px auto 4px auto;"></div>
        <div style="font-size: 10px; font-weight: 700;">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates printable HTML for Quotations / Estimates.
 */
export function generateEstimateHtml(
  estimate: Estimate,
  business?: BusinessProfile,
  templateOrConfig?: InvoiceTemplateConfig | InvoiceTemplateId
): string {
  const pseudoOrder: Order = {
    id: estimate.id,
    orderNumber: estimate.estimateNumber,
    orderDate: estimate.estimateDate,
    customerName: estimate.customerName,
    phoneNumber: estimate.phoneNumber,
    paymentMethod: 'Unpaid',
    paymentStatus: 'Pending',
    items: estimate.items,
    advance: 0,
    status: 'Placed',
    customerNote: estimate.customerNote,
    createdAt: estimate.createdAt,
    updatedAt: estimate.updatedAt,
  };

  let cfg: InvoiceTemplateConfig;
  if (templateOrConfig && typeof templateOrConfig === 'object') {
    cfg = { ...templateOrConfig, invoiceTitle: 'ESTIMATE / QUOTATION' };
  } else {
    cfg = { ...DEFAULT_INVOICE_TEMPLATE_CONFIG, invoiceTitle: 'ESTIMATE / QUOTATION' };
  }

  return generatePrintableInvoiceHtml(pseudoOrder, business, cfg);
}
