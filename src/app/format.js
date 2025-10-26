// format.js — pure presentation helpers shared by controller and tests

// Keep these helpers framework-agnostic and side-effect free.
// Tests import renderDisplay() and toDisplayString() from here.

/** Returns true when string is a percent literal (e.g., "15%"). */
export function isPercentText(s) {
  return typeof s === 'string' && s.trim().endsWith('%');
}

/** Remove trailing zeros in fractional part ("1.230" -> "1.23", "10.0" -> "10"). */
export function trimTrailingZeros(str) {
  if (!str.includes('.')) return str;
  let [i, f] = str.split('.');
  if (!f) return i;
  f = f.replace(/0+$/, '');
  return f.length ? i + '.' + f : i;
}

/**
 * Convert a number to a human string under a MAX_LEN constraint.
 * - Prefers fixed decimal when it fits, trims trailing zeros.
 * - Falls back to exponential if needed.
 * - Returns "Undefined" for invalid numbers.
 */
export function toDisplayString(num, cfg = {}) {
  const MAX_LEN = Number.isFinite(cfg.MAX_LEN) ? cfg.MAX_LEN : 13;
  const UNDEF = cfg.UNDEF ?? 'Undefined';

  if (!Number.isFinite(num)) return UNDEF;

  let s = String(num);
  s = trimTrailingZeros(s);
  if (s.length <= MAX_LEN) return s;

  if (s.includes('.')) {
    const [i] = s.split('.');
    const free = Math.max(0, MAX_LEN - i.length - 1);
    if (free > 0) {
      s = Number(num).toFixed(free);
      s = trimTrailingZeros(s);
      if (s.length <= MAX_LEN) return s;
    } else {
      return i.slice(0, MAX_LEN);
    }
  }

  const reserve = (s.startsWith('-') ? 1 : 0) + 6; // "e±NN"
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

/**
 * Render final text for the bottom display, matching iOS nuances.
 * Consumers pass { showingResult } to decide how to style negatives.
 */
export function renderDisplay(text, { showingResult = false } = {}) {
  const t = String(text).trim();
  const UNDEF = 'Undefined';
  if (t === UNDEF) return t;

  // Live expression: if it already contains operators and spaces — show as is.
  if (/[+\-×÷]/.test(t) && /\s/.test(t)) return t;

  // Percent literal: during typing negatives show as (-10%)
  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim();
    if (core.startsWith('-')) return `(-${core.slice(1)}%)`;
    return t;
  }

  // Negatives: wrap while typing; plain "-N" on result screen.
  if (/^-/.test(t)) return showingResult ? t : `(-${t.slice(1)})`;

  return t;
}

/** Format numeric or percent parts for expression line */
export function formatExprPart(part) {
  if (part == null) return '';
  if (typeof part === 'number') return String(part);
  if (typeof part === 'string') return part;
  if (part && typeof part === 'object' && part.percent) {
    return String(part.value) + '%';
  }
  return String(part);
}
