/**
 * Format phone number for WhatsApp link
 * Removes non-numeric characters and ensures Brazil country code (55)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

/**
 * Generate WhatsApp link (wa.me) for mobile/desktop app
 */
export function getWhatsAppLink(phone: string, message?: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const baseUrl = `https://wa.me/${formattedPhone}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

