// Formatting helpers (pure)

import { MAX_LEN, UNDEF } from "./config.js";

export function isPercentText(s) {
  return typeof s === "string" && s.trim().endsWith("%");
}

export function toNumberSafe(s) {
  // tolerate partial user input
  if (s === "." || s === "-" || s === "-." || s === "0.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function trimTrailingZeros(str) {
  if (!str.includes(".")) return str;
  let [i, f] = str.split(".");
  if (!f) return i;
  f = f.replace(/0+$/, "");
  return f.length ? i + "." + f : i;
}

/**
 * Convert JS number to a display string under MAX_LEN constraints.
 * Falls back to exponential if needed. Returns UNDEF for invalid numbers.
 */
export function toDisplayString(num) {
  if (!Number.isFinite(num)) return UNDEF;

  let s = String(num);
  s = trimTrailingZeros(s);
  if (s.length <= MAX_LEN) return s;

  if (s.includes(".")) {
    const [i, f = ""] = s.split(".");
    const free = Math.max(0, MAX_LEN - i.length - 1);
    if (free > 0) {
      s = Number(num).toFixed(free);
      s = trimTrailingZeros(s);
      if (s.length <= MAX_LEN) return s;
    } else {
      return i.slice(0, MAX_LEN);
    }
  }
  const reserve = (s.startsWith("-") ? 1 : 0) + 6; // for "e±NN"
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

/**
 * Render a value for the top expression line.
 * Preserves "0." while typing and prints raw percent literals.
 */
export function formatExprPart(value) {
  if (typeof value === "string") {
    const s = value.trim();

    if (s.endsWith("%")) {
      const core = s.slice(0, -1).trim();
      const n = Number(core);
      return (Number.isFinite(n) ? n.toLocaleString() : core) + "%";
    }
    if (/^-?\d+\.$/.test(s) || s === "0.") return s;

    const n = Number(s);
    if (Number.isFinite(n)) return trimTrailingZeros(String(n));
    return s;
  }
  if (typeof value === "number") return trimTrailingZeros(String(value));
  if (value && typeof value === "object" && value.percent)
    return formatExprPart(String(value.value) + "%");

  return String(value);
}

/**
 * Final text for the bottom line, matching iOS nuances.
 * Parentheses for negatives while typing; plain "-" on results.
 */
export function renderDisplay({ rawText, showingResult }) {
  const t = String(rawText).trim();

  if (t === UNDEF) return t;

  // If looks like a live expression "12 × 3" — pass through
  if (/[+\-×÷]/.test(t) && /\s/.test(t)) return t;

  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim();
    if (core.startsWith("-")) return `(-${core.slice(1)}%)`;
    return t;
  }

  if (/^-/.test(t)) return showingResult ? t : `(-${t.slice(1)})`;
  return t;
}
