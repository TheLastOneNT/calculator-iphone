// Formatting & presentation helpers (pure functions)

/** Detects a percent literal like "12%" or "-3.5%". */
export function isPercentText(s) {
  return typeof s === 'string' && s.trim().endsWith('%');
}

export function trimTrailingZeros(str) {
  if (!str.includes('.')) return str;
  let [i, f] = str.split('.');
  if (!f) return i;
  f = f.replace(/0+$/, '');
  return f.length ? i + '.' + f : i;
}

/** Fit a number string into the iOS-like MAX_LEN window. */
export function toDisplayString(num, { MAX_LEN, UNDEF }) {
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

  const reserve = (s.startsWith('-') ? 1 : 0) + 6; // for e±NN
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

/** Format a token for the top expression line. */
export function formatExprPart(value) {
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.endsWith('%')) {
      const core = s.slice(0, -1).trim();
      const n = Number(core);
      return (Number.isFinite(n) ? n.toLocaleString() : core) + '%';
    }
    if (/^-?\d+\.$/.test(s) || s === '0.') return s;
    const n = Number(s);
    if (Number.isFinite(n)) return trimTrailingZeros(String(n));
    return s;
  }
  if (typeof value === 'number') return trimTrailingZeros(String(value));
  if (value && typeof value === 'object' && value.percent)
    return formatExprPart(String(value.value) + '%');
  return String(value);
}
