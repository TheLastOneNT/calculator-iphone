export function trimTrailingZeros(str) {
  if (!str.includes('.')) return str;
  let [i, f] = str.split('.');
  if (!f) return i;
  f = f.replace(/0+$/, '');
  return f.length ? i + '.' + f : i;
}

export function toDisplayString(num, MAX_LEN = 13, UNDEF = 'Undefined') {
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

  // Exponential fallback (reserve chars for "e±NN")
  const reserve = (s.startsWith('-') ? 1 : 0) + 6;
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}
