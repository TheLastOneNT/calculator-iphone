// Controller: translates user actions into model mutations and view updates.

import { evaluateTokens, applyOp, extractLastOp } from './math.js';
import { toDisplayString, formatExprPart, isPercentText } from './format.js';
import {
  state,
  toNumberSafe,
  pushCurrentAsToken,
  peekLastNumberToken,
  clearAll,
  clearEntry,
} from './model.js';
import { render, highlightOperator, clearOpHighlight } from './view.js';
import { MAX_LEN, UNDEF, OP_FROM_ATTR, OP_MAP } from './config.js';

// ---- internal helpers -------------------------------------------------------

function beginTyping() {
  state.showingResult = false;
  state.exprFrozen = '';
}

// Build the bottom-line string (live typing / operators) — COMPACT (no spaces)
function buildBottomText() {
  if (!state.operator) return state.currentValue;

  const parts = [];
  for (let i = 0; i < state.tokens.length; i++) {
    const t = state.tokens[i];
    if (typeof t === 'number') parts.push(formatExprPart(t));
    else if (typeof t === 'string')
      parts.push(OP_MAP[t]); // no spaces
    else if (t && t.percent) parts.push(formatExprPart(String(t.value) + '%'));
  }

  if (state.waitingForSecond) {
    if (parts.length && typeof state.tokens[state.tokens.length - 1] === 'string') {
      parts[parts.length - 1] = OP_MAP[state.operator]; // replace op
    } else {
      parts.push(OP_MAP[state.operator]); // append op
    }
    return parts.join(''); // no spaces
  }

  parts.push(formatExprPart(state.currentValue));
  return parts.join(''); // no spaces
}

function rerender() {
  render(buildBottomText());
}

// ---- input primitives -------------------------------------------------------

function inputDigit(d) {
  if (state.waitingForSecond) {
    state.currentValue = d;
    state.waitingForSecond = false;
    beginTyping();
    return rerender();
  }
  if (state.currentValue.length >= MAX_LEN) return;
  state.currentValue = state.currentValue === '0' ? d : state.currentValue + d;
  beginTyping();
  rerender();
}

function inputDot() {
  if (isPercentText(state.currentValue)) return;

  if (state.waitingForSecond) {
    state.currentValue = '0.';
    state.waitingForSecond = false;
    beginTyping();
    return rerender();
  }
  if (state.currentValue.includes('.')) return;

  state.currentValue += '.';
  beginTyping();
  rerender();
}

// ---- public handlers (used by src/index.js) ---------------------------------

export function onDigit(d) {
  if (state.currentValue === UNDEF) {
    state.currentValue = d;
    state.operator = null;
    state.waitingForSecond = false;
    state.tokens = [];
    state.lastOperator = null;
    state.lastOperand = null;
    state.showingResult = false;
    state.exprFrozen = '';
    return rerender();
  }
  if (isPercentText(state.currentValue)) {
    state.currentValue = d;
    state.waitingForSecond = false;
    beginTyping();
    return rerender();
  }
  inputDigit(d);
}

export function onAction(action, txt) {
  if (action === 'dot' || (!action && txt === '.')) {
    inputDot();
    return;
  }

  if (action === 'clear') {
    // iOS: if entering second operand, C removes it and keeps "A op"
    if (state.operator && !state.waitingForSecond) {
      state.currentValue = '0';
      state.waitingForSecond = true;
      state.showingResult = false;
      state.exprFrozen = '';
      return rerender();
    } else {
      // compute "C" vs "AC" from state
      const hasPercent =
        typeof state.currentValue === 'string' && state.currentValue.trim().endsWith('%');
      const hasTyped =
        state.currentValue !== '0' || hasPercent || /[.]/.test(state.currentValue);
      if (hasTyped) clearEntry();
      else clearAll();
      clearOpHighlight();
      return rerender();
    }
  }

  if (action !== 'clear' && state.currentValue === UNDEF) return;

  if (action === 'equal' || action === 'equals') {
    return doEquals();
  }

  if (action === 'sign') {
    if (state.currentValue === '0' || state.currentValue === '0.') return;

    if (isPercentText(state.currentValue)) {
      const core = state.currentValue.slice(0, -1).trim();
      const flipped = core.startsWith('-') ? core.slice(1) : '-' + core;
      state.currentValue = flipped + '%';
      if (!state.operator) state.exprFrozen = '';
      state.showingResult = false;
      return rerender();
    }

    if (state.currentValue.startsWith('-')) {
      state.currentValue = state.currentValue.slice(1);
    } else {
      state.currentValue = '-' + state.currentValue;
    }
    if (!state.operator) state.exprFrozen = '';
    state.showingResult = false;
    if (state.currentValue === '-0') state.currentValue = '0';
    return rerender();
  }

  if (action === 'percent') {
    if (state.operator && state.waitingForSecond) {
      state.currentValue = String(peekLastNumberToken() ?? 0) + '%';
      state.operator = null;
      state.waitingForSecond = false;
      if (
        state.tokens.length &&
        typeof state.tokens[state.tokens.length - 1] === 'string'
      ) {
        state.tokens.pop();
      }
      clearOpHighlight();
      state.showingResult = false;
      return rerender();
    }

    if (!isPercentText(state.currentValue)) {
      state.currentValue = state.currentValue.trim() + '%';
      state.showingResult = false;
      rerender();
    }
    if (state.currentValue.length > MAX_LEN) {
      state.currentValue = state.currentValue.slice(0, MAX_LEN);
      if (!state.currentValue.endsWith('%'))
        state.currentValue = state.currentValue.slice(0, -1) + '%';
      rerender();
    }
    return;
  }

  if (action === 'backspace') {
    if (state.waitingForSecond) {
      state.waitingForSecond = false;
      state.operator = null;
      if (
        state.tokens.length &&
        typeof state.tokens[state.tokens.length - 1] === 'string'
      ) {
        state.tokens.pop();
      }
      clearOpHighlight();
      state.showingResult = false;
      state.exprFrozen = '';
      return rerender();
    }
    if (state.currentValue.endsWith('%')) {
      state.currentValue = state.currentValue.slice(0, -1);
      beginTyping();
      return rerender();
    }
    state.currentValue = state.currentValue.slice(0, -1);
    if (state.currentValue === '' || state.currentValue === '-') state.currentValue = '0';
    beginTyping();
    return rerender();
  }
}

export function onOperator(opAttr) {
  if (state.currentValue === UNDEF) return;
  const nextOp = OP_FROM_ATTR[opAttr];
  if (!nextOp) return;

  state.showingResult = false;

  // change operator before entering the second operand
  if (state.operator && state.waitingForSecond) {
    state.operator = nextOp;
    if (
      state.tokens.length &&
      typeof state.tokens[state.tokens.length - 1] === 'string'
    ) {
      state.tokens[state.tokens.length - 1] = nextOp;
    }
    highlightOperator(state.operator);
    return rerender();
  }

  // push current number into tokens when transitioning
  if (!state.operator || !state.waitingForSecond) {
    pushCurrentAsToken();
  }

  state.operator = nextOp;
  state.waitingForSecond = true;
  state.tokens.push(nextOp);
  state.exprFrozen = '';
  state.lastOperator = null;
  state.lastOperand = null;
  highlightOperator(state.operator);
  return rerender();
}

export function onKey(e) {
  const k = e.key;

  if (/^[0-9]$/.test(k)) return onDigit(k);
  if (k === '.' || k === ',') {
    onAction('dot', '.');
    e.preventDefault();
    return;
  }
  if (k === 'Enter' || k === '=') {
    onAction('equal');
    e.preventDefault();
    return;
  }
  if (k === 'Backspace') {
    onAction('backspace');
    e.preventDefault();
    return;
  }
  if (k === 'Escape') {
    clearAll();
    clearOpHighlight();
    rerender();
    e.preventDefault();
    return;
  }
  if (k === '+') {
    onOperator('plus');
    e.preventDefault();
    return;
  }
  if (k === '-') {
    onOperator('minus');
    e.preventDefault();
    return;
  }
  if (k === '*') {
    onOperator('multiply');
    e.preventDefault();
    return;
  }
  if (k === '/') {
    onOperator('divide');
    e.preventDefault();
    return;
  }
  if (k === '%') {
    onAction('percent', '%');
    e.preventDefault();
    return;
  }
}

// ---- equals / evaluation ----------------------------------------------------

/** Build compact expr for the TOP line: NO spaces around operator. */
function buildExprForTopLine(seq) {
  let out = '';
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    if (typeof t === 'number') out += formatExprPart(t);
    else if (typeof t === 'string')
      out += OP_MAP[t]; // no spaces
    else if (t && t.percent) out += formatExprPart(String(t.value) + '%');
  }
  return out;
}

function doEquals() {
  // Case 1: no pending operator — percent or repeat "="
  if (!state.operator) {
    const trimmed = state.currentValue.trim();

    if (trimmed.endsWith('%')) {
      const n = Number(trimmed.slice(0, -1).trim());
      const result = n / 100;
      if (!Number.isFinite(result)) {
        state.currentValue = UNDEF;
        state.operator = null;
        state.waitingForSecond = false;
        state.tokens = [];
        clearOpHighlight();
        state.showingResult = false;
        return rerender();
      }
      state.currentValue = toDisplayString(result);
      state.exprFrozen = formatExprPart(n) + '%'; // compact
      state.lastOperator = null;
      state.lastOperand = null;
      state.showingResult = true;
      return rerender();
    }

    if (state.lastOperator !== null && state.lastOperand !== null) {
      const a = toNumberSafe(state.currentValue);
      const result = applyOp(a, state.lastOperator, state.lastOperand);
      const exprText =
        formatExprPart(a) +
        OP_MAP[state.lastOperator] +
        formatExprPart(state.lastOperand);
      if (!Number.isFinite(result)) {
        state.exprFrozen = exprText;
        state.currentValue = UNDEF;
        state.operator = null;
        state.waitingForSecond = false;
        state.tokens = [];
        clearOpHighlight();
        state.showingResult = false;
        return rerender();
      }
      state.exprFrozen = exprText;
      state.currentValue = toDisplayString(result);
      state.waitingForSecond = true; // iOS behavior
      clearOpHighlight();
      state.showingResult = true;
      return rerender();
    }
    return;
  }

  // Case 2: evaluate token stream with precedence
  pushCurrentAsToken();

  const exprText = buildExprForTopLine(state.tokens); // compact for top line
  const evalRes = evaluateTokens(state.tokens);
  if (evalRes.error) {
    state.exprFrozen = exprText;
    state.currentValue = UNDEF;
    state.operator = null;
    state.waitingForSecond = false;
    state.tokens = [];
    clearOpHighlight();
    state.showingResult = false;
    return rerender();
  }

  const resultNumber = evalRes.value;
  state.exprFrozen = exprText;

  const lastInfo = extractLastOp(state.tokens);
  if (lastInfo) {
    state.lastOperator = lastInfo.op;
    state.lastOperand = lastInfo.right;
  } else {
    state.lastOperator = null;
    state.lastOperand = null;
  }

  state.currentValue = toDisplayString(resultNumber);
  state.operator = null;
  state.waitingForSecond = true;
  state.tokens = [];
  clearOpHighlight();
  state.showingResult = true;
  return rerender();
}
