/**
 * Shared formatters. Every helper here is deliberately defensive: it accepts
 * `number | string | null | undefined`, coerces with `Number(value)`, and falls
 * back to a safe default instead of throwing. This is what kept the dashboard
 * from rendering after login — the API's summary endpoint (and several others)
 * returns fields that may be missing on partially-populated rows, and the old
 * per-component formatters crashed on `undefined` instead of showing `฿0.00`.
 *
 * Keep the surface area small; anything more clever belongs in a feature-local
 * helper.
 */

const toFiniteNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Format a currency amount as `฿1,234.56` (default 2 fraction digits). */
export function formatCurrencyTH(
  value: number | string | null | undefined,
  fractionDigits = 2,
): string {
  const amount = toFiniteNumber(value);
  const formatted = amount.toLocaleString("th-TH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `฿${formatted}`;
}

/** Format an integer as a Thai-locale number with no fraction digits. */
export function formatIntegerTH(
  value: number | string | null | undefined,
): string {
  const amount = toFiniteNumber(value);
  return amount.toLocaleString("th-TH", {
    maximumFractionDigits: 0,
  });
}

/** Format a date as a Thai-locale short date. Returns `"-"` for invalid input. */
export function formatDateTH(
  value: string | number | Date | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "-";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}