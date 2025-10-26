// format.js — pure presentation helpers shared by controller and tests

// === helpers ================================================================

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

/** Insert thousand separators (commas) into a numeric string. Idempotent. */
function addThousands(numStr) {
  if (typeof numStr !== 'string') numStr = String(numStr);
  if (!/^[-]?\d+(\.\d+)?$/.test(numStr.replace(/,/g, ''))) return numStr; // not a plain number
  if (numStr.includes(',')) return numStr; // already formatted

  const sign = numStr.startsWith('-') ? '-' : '';
  const s = sign ? numStr.slice(1) : numStr;
  const [intPart, frac = ''] = s.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? sign + withCommas + '.' + frac : sign + withCommas;
}

// === number → display string ===============================================

/**
 * Convert a number to a human string under a MAX_LEN constraint.
 * Now always uses thousand separators for the integer part.
 */
export function toDisplayString(num, cfg = {}) {
  const MAX_LEN = Number.isFinite(cfg.MAX_LEN) ? cfg.MAX_LEN : 13;
  const UNDEF = cfg.UNDEF ?? 'Undefined';

  const n = Number(num);
  if (!Number.isFinite(n)) return UNDEF;

  // 1) Try fixed with commas, reducing fractional digits until it fits
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const MAX_FRAC = 12;

  for (let frac = MAX_FRAC; frac >= 0; frac--) {
    let s = abs.toString();
    if (frac < MAX_FRAC) {
      s = abs.toFixed(frac);
      s = trimTrailingZeros(s);
    }
    s = addThousands(s);
    s = sign ? (s.startsWith('-') ? s : '-' + s) : s; // ensure sign

    if (s.length <= MAX_LEN) return s;
  }

  // 2) Fall back to exponential
  const reserve = (sign ? 1 : 0) + 6; // "e±NN" and sign
  const digits = Math.max(0, MAX_LEN - reserve);
  const exp = n.toExponential(digits);
  return exp.length <= MAX_LEN ? exp : exp.slice(0, MAX_LEN);
}

// === render the bottom display =============================================

/**
 * Render final text for the bottom display, matching iOS nuances.
 * Now also adds thousands separators while typing numbers.
 */
export function renderDisplay(text, { showingResult = false } = {}) {
  const t = String(text).trim();
  const UNDEF = 'Undefined';
  if (t === UNDEF) return t;

  // If it already looks like a composed expression ("A op B") — show as is;
  // numbers inside приходят уже отформатированными через formatExprPart.
  if (/[+\-×÷]/.test(t) && /\s/.test(t)) return t;

  // Percent literal: during typing negatives show as (-10%); also add commas to core
  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim(); // may be "-12345.6"
    const coreFmt = addThousands(core.replace(/,/g, ''));
    if (core.startsWith('-')) return `(-${coreFmt.slice(1)}%)`;
    return coreFmt + '%';
  }

  // Plain number: add commas; negatives wrapped while typing
  if (/^-?\d+(\.\d+)?$/.test(t.replace(/,/g, ''))) {
    const fmt = addThousands(t.replace(/,/g, ''));
    if (/^-/.test(fmt)) {
      return showingResult ? fmt : `(-${fmt.slice(1)})`;
    }
    return fmt;
  }

  return t;
}

// === expression parts =======================================================

/** Format numeric or percent parts for expression line (top) */
export function formatExprPart(part) {
  if (part == null) return '';
  if (typeof part === 'number') {
    return addThousands(String(part));
  }
  if (typeof part === 'string') {
    // numeric string?
    if (/^-?\d+(\.\d+)?$/.test(part.replace(/,/g, ''))) {
      return addThousands(part.replace(/,/g, ''));
    }
    return part;
  }
  // percent node
  if (part && typeof part === 'object' && part.percent) {
    const core = addThousands(String(part.value));
    return `${core}%`;
  }
  return String(part);
}
