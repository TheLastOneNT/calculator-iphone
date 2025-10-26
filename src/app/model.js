// src/app/model.js
// Centralized calculator state + safe helpers for number parsing/pushing

import { UNDEF as UNDEF_FALLBACK } from './config.js';

// ---- State -----------------------------------------------------------------

export const state = {
  currentValue: '0', // bottom line text (user is typing here)
  tokens: [], // expression tokens: number | 'add'|'sub'|'mul'|'div' | { percent:true, value:number }
  operator: null, // 'add' | 'sub' | 'mul' | 'div' | null
  waitingForSecond: false,
  lastOperator: null, // for repeated "="
  lastOperand: null, // right operand for repeated "="
  showingResult: false,
  exprFrozen: '', // top line text after evaluation
};

// ---- Parsing helpers -------------------------------------------------------

/**
 * Strip visual formatting and return a clean string for numeric parsing.
 * Handles:
 *  - thousand separators (commas) → removed
 *  - unfinished decimals like "2222." → leave as-is (Number('2222.') works)
 *  - percent literals like "12%" → returns "0.12"
 */
function normalizeNumericString(input) {
  if (input == null) return '';
  if (typeof input !== 'string') return String(input);

  let s = input.trim();

  // Percent literal
  if (s.endsWith('%')) {
    const core = s.slice(0, -1).trim().replace(/,/g, '');
    if (core === '' || core === '-' || core === '+') return '';
    const n = Number(core);
    return Number.isFinite(n) ? String(n / 100) : '';
  }

  // Remove thousand separators for regular numbers / unfinished decimals
  s = s.replace(/,/g, '');

  return s;
}

/**
 * Convert currentValue-like input to Number safely.
 * Returns 0 when not finite (we prefer a neutral value for continued UX).
 */
export function toNumberSafe(x) {
  if (typeof x === 'number') {
    return Number.isFinite(x) ? x : 0;
  }
  const s = normalizeNumericString(String(x));
  if (s === '' || s === '-' || s === '+') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ---- Tokens helpers --------------------------------------------------------

/** Push currentValue as a numeric token (normalizing commas / percents). */
export function pushCurrentAsToken() {
  // If currentValue is a percent text like "12%", treat it as a percent node
  if (typeof state.currentValue === 'string' && state.currentValue.trim().endsWith('%')) {
    const core = state.currentValue.trim();
    const raw = core.slice(0, -1).trim().replace(/,/g, '');
    const n = Number(raw);
    // store percent node in tokens; evaluator already knows how to resolve it
    state.tokens.push({ percent: true, value: Number.isFinite(n) ? n : 0 });
    return;
  }

  const num = toNumberSafe(state.currentValue);
  state.tokens.push(num);
}

/** Peek last numeric token (right-most number) or null. */
export function peekLastNumberToken() {
  for (let i = state.tokens.length - 1; i >= 0; i--) {
    const t = state.tokens[i];
    if (typeof t === 'number') return t;
    if (t && typeof t === 'object' && t.percent === true) {
      // Percent node keeps original numeric value (not divided by 100 here)
      return t.value;
    }
  }
  return null;
}

// ---- Clearing helpers ------------------------------------------------------

export function clearAll(cfg = {}) {
  const undefText = cfg.UNDEF ?? UNDEF_FALLBACK ?? 'Undefined';
  state.currentValue = '0';
  state.tokens = [];
  state.operator = null;
  state.waitingForSecond = false;
  state.lastOperator = null;
  state.lastOperand = null;
  state.showingResult = false;
  state.exprFrozen = '';
  // do not render here; controller/view manage rerenders
}

export function clearEntry() {
  state.currentValue = '0';
  state.showingResult = false;
  state.exprFrozen = '';
}

// ---- Utility for controllers/tests ----------------------------------------

/**
 * Replace currentValue with a normalized numeric string (for tests/dev only).
 * Example: setCurrentRaw('1,024.') keeps the trailing dot for typing scenarios.
 */
export function setCurrentRaw(s) {
  state.currentValue = String(s);
}
