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
 * Converts a number to a displayable string under MAX_LEN constraint.
 * Always adds thousand separators.
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

  const reserve = (s.startsWith('-') ? 1 : 0) + 6;
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

function formatThousands(str) {
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// === render the bottom display =============================================

/**
 * Render the text shown on the main calculator display.
 * Handles incomplete input like "2222." and keeps commas consistent.
 */
export function renderDisplay(text, { showingResult = false } = {}) {
  const t = String(text).trim();
  const UNDEF = 'Undefined';
  if (t === UNDEF) return t;

  // If it's a composed expression (e.g. "12 + 5") — show as-is
  if (/[+\-×÷]/.test(t) && /\s/.test(t)) return t;

  const raw = t.replace(/,/g, '');

  // 1) Handle unfinished decimal input like "2222." or "-2222."
  if (/^-?\d+\.$/.test(raw)) {
    const base = raw.slice(0, -1); // remove final dot
    const fmt = addThousands(base);
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

// === expression parts =======================================================

/** Formats numeric or percent parts for the top expression line. */
export function formatExprPart(part) {
  if (part == null) return '';
  if (typeof part === 'number') {
    return addThousands(String(part));
  }
  if (typeof part === 'string') {
    if (/^-?\d+(\.\d+)?$/.test(part.replace(/,/g, ''))) {
      return addThousands(part.replace(/,/g, ''));
    }
    return part;
  }
  if (part && typeof part === 'object' && part.percent) {
    const core = addThousands(String(part.value));
    return `${core}%`;
  }
  return String(part);
}
