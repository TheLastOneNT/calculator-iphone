export function trimTrailingZeros(str) {
  if (!str.includes('.')) return str;
  const [intPart, fracRaw = ''] = str.split('.');
  if (!fracRaw) return intPart;
  const frac = fracRaw.replace(/0+$/, '');
  return frac.length ? `${intPart}.${frac}` : intPart;
}

export function toDisplayString(num, maxLen, UNDEF_LABEL = 'Undefined') {
  if (!Number.isFinite(num)) return UNDEF_LABEL;

  let s = String(num);
  s = trimTrailingZeros(s);
  if (s.length <= maxLen) return s;

  if (s.includes('.')) {
    const [intPart, frac = ''] = s.split('.');
    const free = Math.max(0, maxLen - intPart.length - 1);
    if (free > 0) {
      s = Number(num).toFixed(free);
      s = trimTrailingZeros(s);
      if (s.length <= maxLen) return s;
    } else {
      return intPart.slice(0, maxLen);
    }
  }

  const reserve = (s.startsWith('-') ? 1 : 0) + 6; // room for "e±NN"
  const digits = Math.max(0, maxLen - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}
