// Stateful model: holds calculator state and token helpers.

import { isPercentText } from './format.js';

export function createModel(cfg) {
  const state = {
    currentValue: '0',
    operator: null, // 'add' | 'sub' | 'mul' | 'div' | null
    waitingForSecond: false,
    exprFrozen: '',
    tokens: [],
    lastOperator: null, // for repeat '='
    lastOperand: null,
    showingResult: false,
  };

  // --- Safe number read for partial inputs (".", "-.", "0.")
  function toNumberSafe(s) {
    if (s === '.' || s === '-' || s === '-.' || s === '0.') return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function pushCurrentAsToken() {
    const s = state.currentValue;
    if (isPercentText(s)) {
      const val = Number(s.slice(0, -1).trim());
      state.tokens.push({
        percent: true,
        value: Number.isFinite(val) ? val : 0,
      });
    } else {
      state.tokens.push(toNumberSafe(s));
    }
  }

  function peekLastNumberToken() {
    for (let i = state.tokens.length - 1; i >= 0; i--) {
      const t = state.tokens[i];
      if (typeof t === 'number') return t;
      if (t && typeof t === 'object' && t.percent) return t.value;
    }
    return null;
  }

  function clearAll() {
    state.currentValue = '0';
    state.operator = null;
    state.waitingForSecond = false;
    state.tokens = [];
    state.lastOperator = null;
    state.lastOperand = null;
    state.showingResult = false;
    state.exprFrozen = '';
  }

  function clearEntry() {
    state.currentValue = '0';
    state.lastOperator = null;
    state.lastOperand = null;
    state.showingResult = false;
    state.exprFrozen = '';
  }

  return {
    cfg,
    state,
    toNumberSafe,
    pushCurrentAsToken,
    peekLastNumberToken,
    clearAll,
    clearEntry,
  };
}
