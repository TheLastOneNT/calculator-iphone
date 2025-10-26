// App state + small helpers that mutate/read it

import { isPercentText } from './format.js';

export const state = {
  currentValue: '0',
  operator: null, // 'add' | 'sub' | 'mul' | 'div' | null
  waitingForSecond: false,
  exprFrozen: '',
  tokens: [],
  lastOperator: null,
  lastOperand: null,
  showingResult: false,
};

export function resetState() {
  state.currentValue = '0';
  state.operator = null;
  state.waitingForSecond = false;
  state.tokens = [];
  state.lastOperator = null;
  state.lastOperand = null;
  state.showingResult = false;
  state.exprFrozen = '';
}

export function toNumberSafe(s) {
  if (s === '.' || s === '-' || s === '-.' || s === '0.') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function pushCurrentAsToken() {
  if (isPercentText(state.currentValue)) {
    const val = Number(state.currentValue.slice(0, -1).trim());
    state.tokens.push({ percent: true, value: Number.isFinite(val) ? val : 0 });
  } else {
    state.tokens.push(toNumberSafe(state.currentValue));
  }
}

export function peekLastNumberToken() {
  for (let i = state.tokens.length - 1; i >= 0; i--) {
    const t = state.tokens[i];
    if (typeof t === 'number') return t;
    if (t && typeof t === 'object' && t.percent) return t.value;
  }
  return null;
}

export function clearEntry() {
  state.currentValue = '0';
  state.lastOperator = null;
  state.lastOperand = null;
  state.showingResult = false;
  state.exprFrozen = '';
}

export function clearAll() {
  resetState();
}
