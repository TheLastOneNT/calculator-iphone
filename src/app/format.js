// format.js — presentation-only helpers used by controller and tests

// === shared regexes =========================================================
const NUM_PLAIN = /^-?\d+(\.\d+)?$/; // numeric string (optional dot)
const UNFINISHED_DEC = /^-?\d+\.$/; // e.g. "2222."
const UNDEF_STR = 'Undefined';

// === helpers ================================================================

/** True if string is a percent literal, e.g., "15%". */
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
  if (!NUM_PLAIN.test(plain)) return numStr; // not a plain number
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

/** Add thousand separators to any numeric-looking string (shallow). */
function formatThousands(str) {
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// === number → display string ===============================================

/**
 * Convert a number to a displayable string under MAX_LEN constraint.
 * Always adds thousand separators for the integer part.
 * Note: live typing cases (like "2222.") are handled elsewhere.
 */
export function toDisplayString(num, cfg = {}) {
  const MAX_LEN = Number.isFinite(cfg.MAX_LEN) ? cfg.MAX_LEN : 13;
  const UNDEF = cfg.UNDEF ?? UNDEF_STR;

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
    }
    return formatThousands(i.slice(0, MAX_LEN));
  }

  // fall back to scientific
  const reserve = (s.startsWith('-') ? 1 : 0) + 6; // space for "e±NN" and sign
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

// === bottom display (live) ==================================================

/**
 * Render text for the main display.
 * Keeps commas consistent; supports unfinished decimals like "2222.".
 * For composed expressions (with operator glyphs), returns text as-is
 * (we already produce operator spacing upstream).
 */
export function renderDisplay(text, { showingResult = false } = {}) {
  const t = String(text).trim();
  if (t === UNDEF_STR) return t;

  // Composed string (contains operator glyphs) — leave as-is.
  // Note: uses unicode minus (U+2212) for the operator, not '-' from negatives.
  if (/[+×÷−]/.test(t)) return t;

  const raw = t.replace(/,/g, '');

  // 1) Unfinished decimal like "2222." or "-2222."
  if (UNFINISHED_DEC.test(raw)) {
    const base = raw.slice(0, -1);
    const fmt = addThousandsIntOnly(base);
    return fmt.startsWith('-')
      ? showingResult
        ? fmt + '.'
        : `(-${fmt.slice(1)}.)`
      : fmt + '.';
  }

  // 2) Percent literal
  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim();
    const coreFmt = addThousands(core.replace(/,/g, ''));
    return core.startsWith('-') ? `(-${coreFmt.slice(1)}%)` : coreFmt + '%';
  }

  // 3) Plain number
  if (NUM_PLAIN.test(raw)) {
    const fmt = addThousands(raw);
    return fmt.startsWith('-') ? (showingResult ? fmt : `(-${fmt.slice(1)})`) : fmt;
  }

  // 4) Anything else — unchanged
  return t;
}

// === expression parts (top line / composed bottom) ==========================

/**
 * Format a single expression token (number / percent / operator).
 * Supports unfinished decimals like "5555." so the second operand
 * keeps commas while typing (e.g., "5,555.").
 */
export function formatExprPart(part) {
  if (part == null) return '';

  // Number
  if (typeof part === 'number') return addThousands(String(part));

  // String
  if (typeof part === 'string') {
    const raw = part.replace(/,/g, '');

    if (UNFINISHED_DEC.test(raw)) {
      const base = raw.slice(0, -1);
      return addThousandsIntOnly(base) + '.';
    }
    if (NUM_PLAIN.test(raw)) return addThousands(raw);

    if (isPercentText(part)) {
      const core = part.slice(0, -1).trim();
      const coreFmt = addThousands(core.replace(/,/g, ''));
      return core.startsWith('-') ? `(-${coreFmt.slice(1)}%)` : coreFmt + '%';
    }

    return part; // operator or anything else
  }

  // Percent node objects like { percent: true, value: 1234 }
  if (part && typeof part === 'object' && part.percent) {
    return `${addThousands(String(part.value))}%`;
  }

  return String(part);
}
