// Controller: connects user actions with model mutations and view updates.

import { evaluateTokens, applyOp } from './math.js';
import { isPercentText, formatExprPart, toDisplayString } from './format.js';
import {
  state,
  resetState,
  pushCurrentAsToken,
  peekLastNumberToken,
  toNumberSafe,
  clearAll,
  clearEntry,
} from './model.js';
import {
  update as viewUpdate,
  highlightOperator,
  clearOpHighlight,
  formatExprPart as fmt,
} from './view.js';
import { OP_FROM_ATTR, OP_MAP, MAX_LEN, UNDEF } from './config.js';

export function createController() {
  // --- bottom line (live typing) builder
  function buildBottomText() {
    if (!state.operator) return state.currentValue;

    const parts = [];
    for (let i = 0; i < state.tokens.length; i++) {
      const t = state.tokens[i];
      if (typeof t === 'number') parts.push(fmt(t));
      else if (typeof t === 'string') parts.push(OP_MAP[t]);
      else if (t && t.percent) parts.push(fmt(String(t.value) + '%'));
    }

    if (state.waitingForSecond) {
      if (parts.length && typeof state.tokens[state.tokens.length - 1] === 'string') {
        parts[parts.length - 1] = OP_MAP[state.operator];
      } else {
        parts.push(OP_MAP[state.operator]);
      }
      return parts.join(' ');
    }

    parts.push(fmt(state.currentValue));
    return parts.join(' ');
  }

  // expose a tiny rerender for first paint from view.init
  function _rerender() {
    viewUpdate({ state }, buildBottomText());
  }

  // --- typing primitives
  function beginTyping() {
    state.showingResult = false;
    state.exprFrozen = '';
  }

  function inputDigit(d) {
    if (state.waitingForSecond) {
      state.currentValue = d;
      state.waitingForSecond = false;
      beginTyping();
      return _rerender();
    }
    if (state.currentValue.length >= MAX_LEN) return;
    state.currentValue = state.currentValue === '0' ? d : state.currentValue + d;
    beginTyping();
    _rerender();
  }

  function inputDot() {
    if (isPercentText(state.currentValue)) return;
    if (state.waitingForSecond) {
      state.currentValue = '0.';
      state.waitingForSecond = false;
      beginTyping();
      return _rerender();
    }
    if (state.currentValue.includes('.')) return;
    state.currentValue += '.';
    beginTyping();
    _rerender();
  }

  // --- public handlers
  function onDigit(d) {
    if (state.currentValue === UNDEF) {
      state.currentValue = d;
      state.operator = null;
      state.waitingForSecond = false;
      state.tokens = [];
      state.lastOperator = null;
      state.lastOperand = null;
      state.showingResult = false;
      state.exprFrozen = '';
      return _rerender();
    }
    if (isPercentText(state.currentValue)) {
      state.currentValue = d;
      state.waitingForSecond = false;
      beginTyping();
      return _rerender();
    }
    inputDigit(d);
  }

  function onAction(action, txt) {
    if (action === 'dot' || (!action && txt === '.')) {
      inputDot();
      return;
    }

    if (action === 'clear') {
      if (state.operator && !state.waitingForSecond) {
        state.currentValue = '0';
        state.waitingForSecond = true;
        state.showingResult = false;
        state.exprFrozen = '';
        return _rerender();
      } else {
        const isC =
          document.querySelector('button[data-action="clear"]')?.textContent === 'C';
        if (isC) clearEntry();
        else clearAll();
        clearOpHighlight();
        return _rerender();
      }
    }

    if (action !== 'clear' && state.currentValue === UNDEF) return;

    if (action === 'equal' || action === 'equals') {
      doEquals();
      return;
    }

    if (action === 'sign') {
      if (state.currentValue === '0' || state.currentValue === '0.') return;
      if (isPercentText(state.currentValue)) {
        const core = state.currentValue.slice(0, -1).trim();
        const flipped = core.startsWith('-') ? core.slice(1) : '-' + core;
        state.currentValue = flipped + '%';
        if (!state.operator) state.exprFrozen = '';
        state.showingResult = false;
        return _rerender();
      }
      if (state.currentValue.startsWith('-')) {
        state.currentValue = state.currentValue.slice(1);
        if (state.currentValue === '0') state.currentValue = '0';
      } else {
        state.currentValue = '-' + state.currentValue;
      }
      if (!state.operator) state.exprFrozen = '';
      state.showingResult = false;
      if (state.currentValue === '-0') state.currentValue = '0';
      return _rerender();
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
        return _rerender();
      }
      if (!isPercentText(state.currentValue)) {
        state.currentValue = state.currentValue.trim() + '%';
        state.showingResult = false;
        _rerender();
      }
      if (state.currentValue.length > MAX_LEN) {
        state.currentValue = state.currentValue.slice(0, MAX_LEN);
        if (!state.currentValue.endsWith('%'))
          state.currentValue = state.currentValue.slice(0, -1) + '%';
        _rerender();
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
        return _rerender();
      }
      if (state.currentValue.endsWith('%')) {
        state.currentValue = state.currentValue.slice(0, -1);
        beginTyping();
        return _rerender();
      }
      state.currentValue = state.currentValue.slice(0, -1);
      if (state.currentValue === '' || state.currentValue === '-')
        state.currentValue = '0';
      beginTyping();
      return _rerender();
    }
  }

  function onOperator(opAttr) {
    if (state.currentValue === UNDEF) return;
    const nextOp = OP_FROM_ATTR[opAttr];
    if (!nextOp) return;

    state.showingResult = false;

    if (state.operator && state.waitingForSecond) {
      state.operator = nextOp;
      if (
        state.tokens.length &&
        typeof state.tokens[state.tokens.length - 1] === 'string'
      ) {
        state.tokens[state.tokens.length - 1] = nextOp;
      }
      highlightOperator(state.operator, OP_FROM_ATTR);
      return _rerender();
    }

    if (!state.operator || !state.waitingForSecond) {
      pushCurrentAsToken();
    }

    state.operator = nextOp;
    state.waitingForSecond = true;
    state.tokens.push(nextOp);
    state.exprFrozen = '';
    state.lastOperator = null;
    state.lastOperand = null;
    highlightOperator(state.operator, OP_FROM_ATTR);
    return _rerender();
  }

  // ===== equals =====
  function doEquals() {
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
          return _rerender();
        }
        state.currentValue = toDisplayString(result, { MAX_LEN, UNDEF });
        state.exprFrozen = formatExprPart(n) + ' %';
        state.lastOperator = null;
        state.lastOperand = null;
        state.showingResult = true;
        return _rerender();
      }

      if (state.lastOperator !== null && state.lastOperand !== null) {
        const a = toNumberSafe(state.currentValue);
        const result = applyOp(a, state.lastOperator, state.lastOperand);
        const exprText = `${formatExprPart(a)} ${OP_MAP[state.lastOperator]} ${formatExprPart(
          state.lastOperand
        )}`;
        if (!Number.isFinite(result)) {
          state.exprFrozen = exprText;
          state.currentValue = UNDEF;
          state.operator = null;
          state.waitingForSecond = false;
          state.tokens = [];
          clearOpHighlight();
          state.showingResult = false;
          return _rerender();
        }
        state.exprFrozen = exprText;
        state.currentValue = toDisplayString(result, { MAX_LEN, UNDEF });
        state.waitingForSecond = true;
        clearOpHighlight();
        state.showingResult = true;
        return _rerender();
      }
      return;
    }

    // with pending operator
    pushCurrentAsToken();

    const exprText = buildExprForTopLine(state.tokens);
    const evalRes = evaluateTokens(state.tokens);
    if (evalRes.error) {
      state.exprFrozen = exprText;
      state.currentValue = UNDEF;
      state.operator = null;
      state.waitingForSecond = false;
      state.tokens = [];
      clearOpHighlight();
      state.showingResult = false;
      return _rerender();
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

    state.currentValue = toDisplayString(resultNumber, { MAX_LEN, UNDEF });
    state.operator = null;
    state.waitingForSecond = true;
    state.tokens = [];
    clearOpHighlight();
    state.showingResult = true;
    return _rerender();
  }

  function buildExprForTopLine(seq) {
    let out = '';
    for (let i = 0; i < seq.length; i++) {
      const t = seq[i];
      if (typeof t === 'number') out += formatExprPart(t);
      else if (typeof t === 'string') out += ' ' + OP_MAP[t] + ' ';
      else if (t && t.percent) out += formatExprPart(String(t.value) + '%');
    }
    return out.trim();
  }

  function extractLastOp(seq) {
    let lastOpIndex = -1;
    for (let i = seq.length - 2; i >= 1; i--) {
      if (typeof seq[i] === 'string') {
        lastOpIndex = i;
        break;
      }
    }
    if (lastOpIndex === -1) return null;
    const leftVal = resolveNodeToNumber(seq[lastOpIndex - 1], 0, 'add');
    const op = seq[lastOpIndex];
    const rightVal = resolveRightOperand(leftVal, op, seq[lastOpIndex + 1]);
    return { op, right: rightVal };
  }

  function resolveRightOperand(left, op, rightNode) {
    if (typeof rightNode === 'number') return rightNode;
    if (rightNode && rightNode.percent) {
      const n = rightNode.value;
      if (op === 'add' || op === 'sub') return left * (n / 100);
      if (op === 'mul' || op === 'div') return n / 100;
      return n;
    }
    return 0;
  }
  function resolveNodeToNumber(node, left, op) {
    if (typeof node === 'number') return node;
    if (node && node.percent) return resolveRightOperand(left, op, node);
    return 0;
  }

  // keyboard
  function onKey(e) {
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
      _rerender();
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

  return {
    onDigit,
    onAction,
    onOperator,
    onKey,
    _rerender, // used by view.init for first paint
  };
}
