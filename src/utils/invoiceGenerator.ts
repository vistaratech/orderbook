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
  const customCols = order.customColumns || [];
  const isPaid = balance <= 0;

  const hasGst =
    cfg.showGSTRate && order.items.some((i) => (i.taxRate || 0) > 0 || !!i.hsnCode);
  const isInterState = order.isInterState || false;

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
  const igstAmount = totalTaxAmount;

  // UPI dynamic payment link & QR
  const upiId = cfg.upiId || business?.upiId;
  const upiPayUrl =
    cfg.showUpiQr && upiId && balance > 0
      ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
          businessName
        )}&am=${balance}&cu=INR&tn=Order_${order.orderNumber}`
      : '';
  const upiQrUrl = upiPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
        upiPayUrl
      )}`
    : '';

  const itemRowsHtml = order.items
    .map((item, idx) => {
      const unitStr =
        cfg.showUnit && item.unit
          ? ` <span style="font-size:11px; color:#64748B;">${item.unit}</span>`
          : '';
      const sNoCell = cfg.showItemSerialNo
        ? `<td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #64748B;">${
            idx + 1
          }</td>`
        : '';
      const hsnCell =
        cfg.showHsn && hasGst
          ? `<td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #64748B;">${
              item.hsnCode || '-'
            }</td>`
          : '';
      const gstCell =
        cfg.showGSTRate && hasGst
          ? `<td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #64748B;">${
              item.taxRate ? `${item.taxRate}%` : '-'
            }</td>`
          : '';
      const discCell =
        cfg.showDiscount && totalDiscountAmount > 0
          ? `<td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 12px; color: #EF4444;">${
              item.discount ? `-${formatCurrency(item.discount)}` : '-'
            }</td>`
          : '';
      const rateCell = cfg.showRate
        ? `<td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; color: #475569;">${formatCurrency(
            item.price
          )}</td>`
        : '';
      const customTds = customCols
        .map((c) => {
          const val =
            item.customValues?.[c.id] ||
            (c.name.toLowerCase() === 'unit' && item.unit ? item.unit : '-');
          return `<td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #475569;">${
            val || '-'
          }</td>`;
        })
        .join('');

      return `
    <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
      ${sNoCell}
      <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600; font-size: 13px; color: #1E293B;">${
        item.name || 'Item'
      }</td>
      ${hsnCell}
      <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 600; font-size: 13px; color: #334155;">${
        item.qty
      }${unitStr}</td>
      ${customTds}
      ${rateCell}
      ${discCell}
      ${gstCell}
      <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; font-size: 13px; color: #0F172A;">${formatCurrency(
        item.qty * item.price - (item.discount || 0)
      )}</td>
    </tr>`;
    })
    .join('');

  const logoHtml =
    cfg.showLogo && business?.logoUri
      ? `<img src="${business.logoUri}" class="brand-logo" alt="Logo" style="width: ${
          cfg.logoSize === 'large' ? '76px' : cfg.logoSize === 'small' ? '44px' : '60px'
        }; height: ${
          cfg.logoSize === 'large' ? '76px' : cfg.logoSize === 'small' ? '44px' : '60px'
        }; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);" />`
      : cfg.showLogo
      ? `<div class="brand-logo-default" style="width: 52px; height: 52px; border-radius: 10px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${cfg.headerTextColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
         </div>`
      : '';

  const bankText = cfg.bankDetailsCustom || business?.bankDetails;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cfg.invoiceTitle} - ${order.orderNumber}</title>
  <style>
    @page {
      size: ${cfg.paperSize === 'a5' ? 'A5 portrait' : 'A4 portrait'};
      margin: ${cfg.compactMode ? '6mm' : '10mm'};
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
      font-family: ${
        cfg.fontFamily === 'serif'
          ? 'Georgia, "Times New Roman", serif'
          : cfg.fontFamily === 'monospace'
          ? '"Courier New", Courier, monospace'
          : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      };
      background-color: #F8FAFC;
      color: #1E293B;
      margin: 0;
      padding: ${cfg.compactMode ? '12px' : '20px'};
    }
    .invoice-card {
      max-width: 740px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid ${cfg.cardBorderColor || '#E2E8F0'};
      position: relative;
    }
    .watermark {
      position: absolute;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 80px;
      font-weight: 900;
      color: rgba(15, 23, 42, 0.04);
      pointer-events: none;
      text-transform: uppercase;
      letter-spacing: 6px;
      user-select: none;
    }
    .header-banner {
      background: ${cfg.headerBgColor};
      color: ${cfg.headerTextColor};
      padding: ${cfg.compactMode ? '16px 20px' : '22px 28px'};
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid ${cfg.accentColor};
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: ${cfg.headerTextColor};
      margin: 0 0 2px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 11px;
      color: ${cfg.templateId === 'classic' ? '#64748B' : 'rgba(255, 255, 255, 0.85)'};
      margin: 0;
    }
    .header-right {
      text-align: right;
    }
    .doc-type-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      background-color: ${isPaid ? '#10B981' : cfg.accentColor};
      color: #FFFFFF;
      margin-bottom: 4px;
    }
    .bill-meta {
      font-size: 11px;
      color: ${cfg.templateId === 'classic' ? '#64748B' : 'rgba(255, 255, 255, 0.9)'};
      margin: 2px 0;
    }
    .content-body {
      padding: ${cfg.compactMode ? '16px 20px' : '22px 28px'};
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .info-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 12px 14px;
      border-radius: 8px;
    }
    .info-card h4 {
      margin: 0 0 6px 0;
      font-size: 10px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .info-card p {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
    }
    .info-sub {
      font-size: 11px !important;
      color: #475569 !important;
      font-weight: 400 !important;
      margin-top: 3px !important;
    }
    .gstin-badge {
      display: inline-block;
      background: #E2E8F0;
      color: #1E293B;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: ${cfg.primaryColor};
      color: ${cfg.headerTextColor};
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 12px;
    }
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 16px;
    }
    .notes-box {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 12px;
      border-radius: 8px;
      font-size: 11px;
      color: #334155;
    }
    .notes-box h5 {
      margin: 0 0 4px 0;
      font-size: 10px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-box {
      width: 270px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 14px;
      border-radius: 8px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
      color: #475569;
    }
    .summary-row.total {
      border-top: 2px solid #CBD5E1;
      padding-top: 8px;
      font-weight: 800;
      font-size: 15px;
      color: #0F172A;
    }
    .summary-row.balance {
      background: ${isPaid ? '#F0FDF4' : '#FEF2F2'};
      border: 1px solid ${isPaid ? '#BBF7D0' : '#FECACA'};
      padding: 8px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 13px;
      color: ${isPaid ? '#166534' : '#991B1B'};
      margin-top: 8px;
      margin-bottom: 0;
    }
    .bank-card {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .bank-card h5 {
      margin: 0 0 4px 0;
      font-size: 10px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bank-card p {
      margin: 0;
      font-size: 12px;
      color: #1E293B;
      white-space: pre-line;
      line-height: 1.4;
    }
    .signatory-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #E2E8F0;
    }
    .terms-text {
      font-size: 10px;
      color: #64748B;
      max-width: 400px;
      line-height: 1.4;
      white-space: pre-line;
    }
    .signatory-box {
      text-align: center;
      width: 190px;
    }
    .signatory-line {
      border-bottom: 1px solid #94A3B8;
      margin-bottom: 4px;
      height: 36px;
    }
    .signatory-title {
      font-size: 10px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
    }
    .footer-bar {
      text-align: center;
      margin-top: 16px;
      padding-top: 10px;
      font-size: 10px;
      color: #94A3B8;
      border-top: 1px dashed #E2E8F0;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    ${cfg.showWatermark ? `<div class="watermark">${cfg.watermarkText || (isPaid ? 'PAID' : 'ORIGINAL')}</div>` : ''}
    
    <div class="header-banner">
      <div class="brand-wrap">
        ${logoHtml}
        <div>
          <h1 class="brand-title">${businessName}</h1>
          ${cfg.showTagline && business?.tagline ? `<p class="brand-tagline">${business.tagline}</p>` : ''}
        </div>
      </div>
      <div class="header-right">
        <div class="doc-type-badge">${cfg.invoiceTitle.toUpperCase()}</div>
        <p class="bill-meta"><b>Invoice No:</b> ${order.orderNumber}</p>
        <p class="bill-meta"><b>Date:</b> ${formatDate(order.orderDate)}</p>
      </div>
    </div>

    <div class="content-body">
      <div class="info-grid">
        <div class="info-card">
          <h4>Seller Details</h4>
          <p>${businessName}</p>
          ${cfg.showBusinessAddress && business?.address ? `<p class="info-sub">Address: ${business.address}</p>` : ''}
          ${cfg.showBusinessPhone && business?.phone ? `<p class="info-sub">Phone: ${business.phone}</p>` : ''}
          ${cfg.showBusinessEmail && business?.email ? `<p class="info-sub">Email: ${business.email}</p>` : ''}
          ${cfg.showGstin && business?.gstin ? `<div class="gstin-badge">GSTIN: ${business.gstin}</div>` : ''}
        </div>
        <div class="info-card">
          <h4>Billed To (Customer)</h4>
          <p>${order.customerName || 'Walk-in Customer'}</p>
          ${cfg.showCustomerPhone ? `<p class="info-sub">${order.phoneNumber ? `Phone: ${order.phoneNumber}` : 'No phone recorded'}</p>` : ''}
          <p class="info-sub" style="margin-top:6px !important;"><b>Order No:</b> ${order.orderNumber}</p>
          <p class="info-sub"><b>Status:</b> ${order.status}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            ${cfg.showItemSerialNo ? '<th style="text-align: center; width: 36px;">#</th>' : ''}
            <th style="text-align: left;">Item Description</th>
            ${cfg.showHsn && hasGst ? '<th style="text-align: center; width: 64px;">HSN</th>' : ''}
            <th style="text-align: center; width: 64px;">Qty</th>
            ${customCols.map((c) => `<th style="text-align: center; width: 70px;">${c.name}</th>`).join('')}
            ${cfg.showRate ? '<th style="text-align: right; width: 80px;">Rate (₹)</th>' : ''}
            ${cfg.showDiscount && totalDiscountAmount > 0 ? '<th style="text-align: right; width: 70px;">Disc (₹)</th>' : ''}
            ${cfg.showGSTRate && hasGst ? '<th style="text-align: center; width: 56px;">GST</th>' : ''}
            <th style="text-align: right; width: 90px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <div class="summary-section">
        <div class="notes-box">
          <h5>${cfg.notesHeading || 'Special Instructions / Notes'}</h5>
          <p style="margin:0;">${order.customerNote || cfg.defaultNotes || 'Thank you for your business. Please retain this invoice for your records.'}</p>
        </div>

        <div class="summary-box">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotalAmount)}</span>
          </div>
          ${
            totalDiscountAmount > 0
              ? `<div class="summary-row" style="color: #EF4444;">
                  <span>Discount</span>
                  <span>-${formatCurrency(totalDiscountAmount)}</span>
                </div>`
              : ''
          }
          ${
            hasGst && totalTaxAmount > 0
              ? `
          <div class="summary-row">
            <span>Taxable Value</span>
            <span>${formatCurrency(subtotalAmount - totalDiscountAmount)}</span>
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
            <span style="color: #10B981; font-weight: 600;">${formatCurrency(order.advance)}</span>
          </div>
          <div class="summary-row total">
            <span>Grand Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
          <div class="summary-row balance">
            <span>Balance Due</span>
            <span>${isPaid ? 'PAID IN FULL (₹0)' : formatCurrency(balance)}</span>
          </div>
        </div>
      </div>

      ${
        cfg.showBankDetails && (upiQrUrl || bankText || upiId)
          ? `<div class="bank-card" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div style="flex: 1;">
                <h5>Payment & Bank Details</h5>
                ${upiId ? `<p style="font-weight: 700; color: #0F172A; margin-bottom: 2px;">UPI ID: ${upiId}</p>` : ''}
                ${bankText ? `<p>${bankText}</p>` : ''}
                ${upiPayUrl ? `<p style="font-size: 10px; color: #475569; margin-top: 4px;">Scan QR to pay directly via GPay / PhonePe / Paytm / BHIM</p>` : ''}
              </div>
              ${upiQrUrl ? `<div style="text-align: center;"><img src="${upiQrUrl}" alt="UPI QR Code" style="width: 90px; height: 90px; border-radius: 6px; border: 1px solid #CBD5E1;" /><p style="font-size: 9px; color: #64748B; margin: 2px 0 0 0; font-weight: 700;">SCAN TO PAY</p></div>` : ''}
            </div>`
          : ''
      }

      <div class="signatory-row">
        <div class="terms-text">
          ${cfg.showTerms ? `<p style="margin:0 0 2px 0; font-weight:700; color:#334155;">${cfg.termsHeading || 'Terms & Conditions'}:</p><p style="margin:0;">${cfg.termsAndConditions || 'E.&O.E. Computer generated invoice.'}</p>` : ''}
        </div>
        ${
          cfg.showSignatory
            ? `<div class="signatory-box">
                <div class="signatory-line"></div>
                <div class="signatory-title">${cfg.signatoryBusinessName || `For ${businessName}`}</div>
                <div style="font-size: 9px; color: #64748B;">(${cfg.signatoryTitle || 'Authorized Signatory'})</div>
              </div>`
            : ''
        }
      </div>

      ${cfg.footerMessage ? `<div class="footer-bar">${cfg.footerMessage}</div>` : ''}
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
    <div class="gst-header">
      <div class="gst-title">TAX INVOICE</div>
      <div style="font-size: 10px; margin-top: 2px;">(Issued under Section 31 of Central Goods and Services Tax Act, 2017)</div>
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
