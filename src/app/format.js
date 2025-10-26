// format.js — pure presentation helpers shared by controller and tests

// === helpers ================================================================

/** True if string is a percent literal, e.g. "15%". */
export function isPercentText(s) {
  return typeof s === 'string' && s.trim().endsWith('%');
}

/** Trim trailing zeros in fractional part: "1.230" -> "1.23", "10.0" -> "10". */
export function trimTrailingZeros(str) {
  if (!str.includes('.')) return str;
  let [i, f] = str.split('.');
  if (!f) return i;
  f = f.replace(/0+$/, '');
  return f.length ? i + '.' + f : i;
}

/**
 * Insert thousand separators (commas) into a numeric string.
 * Idempotent; expects a plain numeric string (optionally with a dot).
 */
function addThousands(numStr) {
  if (typeof numStr !== 'string') numStr = String(numStr);
  const plain = numStr.replace(/,/g, '');
  if (!/^[-]?\d+(\.\d+)?$/.test(plain)) return numStr; // not a plain number
  if (numStr.includes(',')) return numStr; // already formatted

  const sign = plain.startsWith('-') ? '-' : '';
  const s = sign ? plain.slice(1) : plain;
  const [intPart, frac = ''] = s.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? sign + withCommas + '.' + frac : sign + withCommas;
}

/** Add commas to an integer-only string (no dot), keeping sign. */
function addThousandsIntOnly(intStr) {
  const sign = intStr.startsWith('-') ? '-' : '';
  const body = sign ? intStr.slice(1) : intStr;
  const withCommas = body.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + withCommas;
}

// === number → display string ===============================================

/**
 * Convert a number to a displayable string under MAX_LEN constraint.
 * Always adds thousand separators for the integer part.
 * Note: live typing cases (like "2222.") are handled in renderDisplay/formatExprPart.
 */
export function toDisplayString(num, cfg = {}) {
  const MAX_LEN = Number.isFinite(cfg.MAX_LEN) ? cfg.MAX_LEN : 13;
  const UNDEF = cfg.UNDEF ?? 'Undefined';

  if (num === null || num === undefined) return UNDEF;
  if (!Number.isFinite(num)) return UNDEF;

  let s = String(num);
  s = trimTrailingZeros(s);

  if (s.includes('.')) {
    const [intPart, decPart] = s.split('.');
    s = formatThousands(intPart) + '.' + decPart;
  } else {
    s = formatThousands(s);
  }

  if (s.length <= MAX_LEN) return s;

  if (s.includes('.')) {
    const [i] = s.split('.');
    const free = Math.max(0, MAX_LEN - i.length - 1);
    if (free > 0) {
      s = Number(num).toFixed(free);
      s = trimTrailingZeros(s);
      return formatThousands(s);
    } else {
      return formatThousands(i.slice(0, MAX_LEN));
    }
  }

  const reserve = (s.startsWith('-') ? 1 : 0) + 6; // space for "e±NN" and sign
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

/** Add thousand separators to any numeric-looking string. */
function formatThousands(str) {
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// === bottom display (live) ==================================================

/**
 * Render the text shown on the main calculator display.
 * Handles incomplete input like "2222." and keeps commas consistent.
 * When the bottom line is a composed expression (built by controller),
 * numbers inside should already be formatted via formatExprPart(..),
 * so we leave composed strings as-is (except for the special unfinished-decimal case handled there).
 */
export function renderDisplay(text, { showingResult = false } = {}) {
  const t = String(text).trim();
  const UNDEF = 'Undefined';
  if (t === UNDEF) return t;

  // If it's a composed expression (contains an operator + spaces), return as-is.
  // (The controller uses formatExprPart for parts, including the current input.)
  if (/[+\-×÷]/.test(t) && /\s/.test(t)) return t;

  const raw = t.replace(/,/g, '');

  // 1) Unfinished decimal input like "2222." or "-2222."
  if (/^-?\d+\.$/.test(raw)) {
    const base = raw.slice(0, -1);
    const fmt = addThousandsIntOnly(base);
    if (fmt.startsWith('-')) {
      return showingResult ? fmt + '.' : `(-${fmt.slice(1)}.)`;
    }
    return fmt + '.';
  }

  // 2) Percent literal (e.g. "15%")
  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim();
    const coreFmt = addThousands(core.replace(/,/g, ''));
    if (core.startsWith('-')) return `(-${coreFmt.slice(1)}%)`;
    return coreFmt + '%';
  }

  // 3) Regular numbers (e.g. "1234", "1234.56")
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const fmt = addThousands(raw);
    if (fmt.startsWith('-')) {
      return showingResult ? fmt : `(-${fmt.slice(1)})`;
    }
    return fmt;
  }

  // 4) Anything else — leave untouched
  return t;
}

// === expression parts (used in top line and bottom composed string) =========

/**
 * Format a single expression token (number / percent / operator).
 * Crucially, this now supports unfinished decimals like "5555." so that
 * the second operand is formatted with commas while typing (e.g. "5,555.").
 */
export function formatExprPart(part) {
  if (part == null) return '';

  // Number type
  if (typeof part === 'number') {
    return addThousands(String(part));
  }

  // String type
  if (typeof part === 'string') {
    const raw = part.replace(/,/g, '');

    // Unfinished decimal like "5555." or "-5555."
    if (/^-?\d+\.$/.test(raw)) {
      const base = raw.slice(0, -1); // "5555" / "-5555"
      const withCommas = addThousandsIntOnly(base);
      return withCommas + '.';
    }

    // Plain numeric string
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      return addThousands(raw);
    }

    // Percent literal embedded in string (rare path)
    if (isPercentText(part)) {
      const core = part.slice(0, -1).trim();
      const coreFmt = addThousands(core.replace(/,/g, ''));
      if (core.startsWith('-')) return `(-${coreFmt.slice(1)}%)`;
      return coreFmt + '%';
    }

    // Operator or anything else — return as-is
    return part;
  }

  // Percent node objects like { percent: true, value: 1234 }
  if (part && typeof part === 'object' && part.percent) {
    const core = addThousands(String(part.value));
    return `${core}%`;
  }

  // Fallback
  return String(part);
}
