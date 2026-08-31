import { Linking, Share } from 'react-native';
import { formatCurrency } from './format';

export interface ReminderParams {
  customerName: string;
  phoneNumber: string;
  balanceAmount: number;
  businessName: string;
  orderNumbers?: string[];
}

/**
 * Generate a polite payment reminder text message
 */
export function generatePaymentReminderText(params: ReminderParams): string {
  const { customerName, balanceAmount, businessName, orderNumbers } = params;

  const orderRef = orderNumbers && orderNumbers.length > 0
    ? `\n📋 Order(s): ${orderNumbers.join(', ')}`
    : '';

  return `🙏 வணக்கம் ${customerName},

இது ${businessName}-இல் இருந்து ஒரு நினைவூட்டல்.

💰 உங்கள் நிலுவைத் தொகை: *${formatCurrency(balanceAmount)}*${orderRef}

தயவுசெய்து உங்கள் வசதிக்கேற்ப பணம் செலுத்தவும்.

நன்றி! 🙏
— ${businessName}

---

Dear ${customerName},

This is a gentle reminder from ${businessName}.

💰 Your pending balance: *${formatCurrency(balanceAmount)}*${orderRef}

Kindly clear the dues at your earliest convenience.

Thank you! 🙏
— ${businessName}`;
}

/**
 * Send payment reminder via WhatsApp
 */
export async function sendPaymentReminder(params: ReminderParams): Promise<boolean> {
  const message = generatePaymentReminderText(params);
  const encodedText = encodeURIComponent(message);

  if (params.phoneNumber) {
    const cleanPhone = params.phoneNumber.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;
    const canOpen = await Linking.canOpenURL(waUrl);

    if (canOpen) {
      await Linking.openURL(waUrl);
      return true;
    }
  }

  // Fallback to system Share
  try {
    await Share.share({
      message,
      title: `Payment Reminder for ${params.customerName}`,
    });
    return true;
  } catch (err) {
    console.error('Error sending payment reminder:', err);
    return false;
  }
}

/**
 * Generate a simple SMS-friendly reminder
 */
export function generateSmsReminder(params: ReminderParams): string {
  return `Dear ${params.customerName}, your pending balance of ${formatCurrency(params.balanceAmount)} is due. Please pay at your earliest. - ${params.businessName}`;
}
