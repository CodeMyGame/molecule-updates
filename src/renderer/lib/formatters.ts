import i18n from './i18n';
import { currencySymbolForLanguage } from './currencyLocale';

/**
 * Formats an amount in paise using the currency symbol for the active UI language.
 * Amounts are still INR; only the glyph changes (e.g. $ / € / ₹).
 */
export function formatCurrency(paise: number): string {
  const symbol = currencySymbolForLanguage(i18n.language ?? 'en');
  if (paise == null || isNaN(paise)) return `${symbol}0.00`;
  const rupees = paise / 100;
  return `${symbol}${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a date string to Indian locale date.
 * Example: "2026-03-20T10:30:00" -> "20 Mar 2026"
 */
export function formatDate(dateStr: string): string {
  const normalized = dateStr.includes('T') || dateStr.includes('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats a date string to time only.
 * Example: "2026-03-20T10:30:00" -> "10:30 AM"
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a date string to full date and time.
 * Example: "2026-03-20T10:30:00" -> "20 Mar 2026, 10:30 AM"
 */
export function formatDateTime(dateStr: string): string {
  // SQLite datetime('now') stores UTC without Z suffix — add it so JS parses as UTC
  const normalized = dateStr.includes('T') || dateStr.includes('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats an order number for display.
 * Example: "42" -> "#042", "1234" -> "#1234"
 */
export function formatOrderNumber(num: string): string {
  const padded = num.padStart(3, '0');
  return `#${padded}`;
}
