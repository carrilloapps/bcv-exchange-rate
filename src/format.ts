/**
 * Date and number formatting helpers for the upstream sources: the BCV portal
 * (Drupal in Spanish), the PTAX OData API and ISO 8601 normalization.
 */

/**
 * Month tokens expected by the BCV (Drupal) date filter. They are Drupal's
 * Spanish-translated abbreviations: every month is 3 letters except May,
 * which Drupal translates as the full word "Mayo". Sending "May" (or full
 * names like "Enero"/"Junio") makes the filter fail silently and the portal
 * returns an empty result view.
 */
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'Mayo', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Formats a date as `D MMM YYYY` with the Drupal-Spanish month tokens the BCV filter expects. */
export function formatBcvDate(date: Date): string {
    return `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Formats a date as `MM-DD-YYYY`, the format required by the PTAX OData API. */
export function formatPtaxDate(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}-${dd}-${date.getFullYear()}`;
}

/** Formats a date as ISO 8601 (`YYYY-MM-DD`) using local time. */
export function formatIsoDate(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Normalizes a `DD-MM-YYYY` (or `DD/MM/YY`) date string to ISO 8601.
 * Unrecognized formats are returned trimmed but otherwise untouched.
 */
export function toIsoDate(input: string): string {
    const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(input.trim());
    if (!match) return input.trim();
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Parses a Venezuelan-formatted number (`1.234,56` → `1234.56`).
 * Returns `null` when the text contains no parseable number.
 */
export function parseVenezuelanNumber(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned) return null;
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return Number.isNaN(num) ? null : num;
}
