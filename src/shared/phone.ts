/**
 * Normalises an Indian mobile number to its 10 digits, or returns null.
 * Accepts spaces, dashes, a leading +91, 91 (12 digits) or 0 (11 digits).
 */
export function normalizeIndianMobile(input: string): string | null {
  let s = input.trim().replace(/[\s-]/g, '');
  if (s.startsWith('+91')) s = s.slice(3);
  else if (/^91\d{10}$/.test(s)) s = s.slice(2);
  else if (/^0\d{10}$/.test(s)) s = s.slice(1);
  return /^[6-9]\d{9}$/.test(s) ? s : null;
}

/** `9876543210` → `98765 43210` for display. */
export function formatPhone(tenDigits: string): string {
  return tenDigits.length === 10 ? `${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}` : tenDigits;
}
