/**
 * Format phone number for WhatsApp link
 * Removes non-numeric characters and ensures country code
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  // Add Brazil country code if not present
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

/**
 * Generate WhatsApp link for a phone number
 * @param phone - Phone number (with or without formatting)
 * @param message - Optional pre-filled message
 */
export function getWhatsAppLink(phone: string, message?: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const baseUrl = `https://wa.me/${formattedPhone}`;
  
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  
  return baseUrl;
}

/**
 * Open WhatsApp conversation in a new tab
 */
export function openWhatsApp(phone: string, message?: string): void {
  const link = getWhatsAppLink(phone, message);
  window.open(link, '_blank');
}
