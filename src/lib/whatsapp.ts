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

/**
 * Generate WhatsApp Web link (web.whatsapp.com) for browser
 */
export function getWhatsAppWebLink(phone: string, message?: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const baseUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}`;
  return message ? `${baseUrl}&text=${encodeURIComponent(message)}` : baseUrl;
}

/**
 * Open WhatsApp conversation via wa.me (opens app or web)
 */
export function openWhatsApp(phone: string, message?: string): void {
  window.open(getWhatsAppLink(phone, message), '_blank');
}

/**
 * Open WhatsApp Web directly in browser
 */
export function openWhatsAppWeb(phone: string, message?: string): void {
  window.open(getWhatsAppWebLink(phone, message), '_blank');
}
