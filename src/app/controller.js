// Controller: translates user actions into model mutations and view updates.

import { isPercentText, toDisplayString, formatExprPart } from "./format.js";
import {
  applyOp,
  resolveRightOperand,
  evaluateTokens,
  extractLastOp,
} from "./math.js";

export function createController({ model, view, cfg }) {
  const { state } = model;
  const { OP_FROM_ATTR, OP_MAP, UNDEF, MAX_LEN } = cfg;

  // Expose to view: used in clear label calculation
  model.isPercentText = isPercentText;

  // --- Bottom line builder (live typing)
  function buildBottomText() {
    if (!state.operator) return state.currentValue;

    const parts = [];
    for (let i = 0; i < state.tokens.length; i++) {
      const t = state.tokens[i];
      if (typeof t === "number") parts.push(formatExprPart(t));
      else if (typeof t === "string") parts.push(OP_MAP[t]);
      else if (t && t.percent)
        parts.push(formatExprPart(String(t.value) + "%"));
    }

    if (state.waitingForSecond) {
      if (
        parts.length &&
        typeof state.tokens[state.tokens.length - 1] === "string"
      ) {
        parts[parts.length - 1] = OP_MAP[state.operator];
      } else {
        parts.push(OP_MAP[state.operator]);
      }
      return parts.join(" ");
    }

    parts.push(formatExprPart(state.currentValue));
    return parts.join(" ");
  }

  // --- Render helper
  function rerender() {
    view.update(model, buildBottomText());
  }

  // --- Input primitives
  function beginTyping() {
    state.showingResult = false;
    state.exprFrozen = "";
  }

  function inputDigit(d) {
    if (state.waitingForSecond) {
      state.currentValue = d;
      state.waitingForSecond = false;
      beginTyping();
      return rerender();
    }
    if (state.currentValue.length >= MAX_LEN) return;
    state.currentValue =
      state.currentValue === "0" ? d : state.currentValue + d;
    beginTyping();
    rerender();
  }

  function inputDot() {
    if (isPercentText(state.currentValue)) return;
    if (state.waitingForSecond) {
      state.currentValue = "0.";
      state.waitingForSecond = false;
      beginTyping();
      return rerender();
    }
    if (state.currentValue.includes(".")) return;
    state.currentValue += ".";
    beginTyping();
    rerender();
  }

  // --- Public handlers (bound by view)

  function onDigit(d) {
    if (state.currentValue === UNDEF) {
      // Clear implicit error on next digit
      state.currentValue = d;
      state.operator = null;
      state.waitingForSecond = false;
      state.tokens = [];
      state.lastOperator = null;
      state.lastOperand = null;
      state.showingResult = false;
      state.exprFrozen = "";
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

  function onAction(action, txt) {
    if (action === "dot" || (!action && txt === ".")) {
      inputDot();
      return;
    }

    if (action === "clear") {
      // iOS behavior: if entering second operand, C removes it and keeps "A op"
      if (state.operator && !state.waitingForSecond) {
        state.currentValue = "0";
        state.waitingForSecond = true;
        state.showingResult = false;
        state.exprFrozen = "";
        return rerender();
      } else {
        const isC =
          document.querySelector('button[data-action="clear"]')?.textContent ===
          "C";
        if (isC) model.clearEntry();
        else model.clearAll();
        view.clearOpHighlight();
        return rerender();
      }
    }

    if (action !== "clear" && state.currentValue === UNDEF) return;

    if (action === "equal" || action === "equals") {
      doEquals();
      return;
    }

    if (action === "sign") {
      // iOS: do nothing for zero
      if (state.currentValue === "0" || state.currentValue === "0.") return;
      if (isPercentText(state.currentValue)) {
        const core = state.currentValue.slice(0, -1).trim();
        const flipped = core.startsWith("-") ? core.slice(1) : "-" + core;
        state.currentValue = flipped + "%";
        if (!state.operator) state.exprFrozen = "";
        state.showingResult = false;
        return rerender();
      }
      if (state.currentValue.startsWith("-")) {
        state.currentValue = state.currentValue.slice(1);
        if (state.currentValue === "0") state.currentValue = "0";
      } else {
        state.currentValue = "-" + state.currentValue;
      }
      if (!state.operator) state.exprFrozen = "";
      state.showingResult = false;
      if (state.currentValue === "-0") state.currentValue = "0";
      return rerender();
    }

    if (action === "percent") {
      if (state.operator && state.waitingForSecond) {
        state.currentValue = String(model.peekLastNumberToken() ?? 0) + "%";
        state.operator = null;
        state.waitingForSecond = false;
        if (
          state.tokens.length &&
          typeof state.tokens[state.tokens.length - 1] === "string"
        ) {
          state.tokens.pop();
        }
        view.clearOpHighlight();
        state.showingResult = false;
        return rerender();
      }
      if (!isPercentText(state.currentValue)) {
        state.currentValue = state.currentValue.trim() + "%";
        state.showingResult = false;
        rerender();
      }
      if (state.currentValue.length > MAX_LEN) {
        state.currentValue = state.currentValue.slice(0, MAX_LEN);
        if (!state.currentValue.endsWith("%"))
          state.currentValue = state.currentValue.slice(0, -1) + "%";
        rerender();
      }
      return;
    }

    if (action === "backspace") {
      if (state.waitingForSecond) {
        state.waitingForSecond = false;
        state.operator = null;
        if (
          state.tokens.length &&
          typeof state.tokens[state.tokens.length - 1] === "string"
        ) {
          state.tokens.pop();
        }
        view.clearOpHighlight();
        state.showingResult = false;
        state.exprFrozen = "";
        return rerender();
      }
      if (state.currentValue.endsWith("%")) {
        state.currentValue = state.currentValue.slice(0, -1);
        beginTyping();
        return rerender();
      }
      state.currentValue = state.currentValue.slice(0, -1);
      if (state.currentValue === "" || state.currentValue === "-")
        state.currentValue = "0";
      beginTyping();
      return rerender();
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
        typeof state.tokens[state.tokens.length - 1] === "string"
      ) {
        state.tokens[state.tokens.length - 1] = nextOp;
      }
      view.highlightOperator(state.operator, OP_FROM_ATTR);
      return rerender();
    }

    if (!state.operator || !state.waitingForSecond) {
      model.pushCurrentAsToken();
    }

    state.operator = nextOp;
    state.waitingForSecond = true;
    state.tokens.push(nextOp);
    state.exprFrozen = "";
    state.lastOperator = null;
    state.lastOperand = null;
    view.highlightOperator(state.operator, OP_FROM_ATTR);
    return rerender();
  }

  function doEquals() {
    // Case 1: no pending operator — handle percent or repeat "="
    if (!state.operator) {
      const trimmed = state.currentValue.trim();

      if (trimmed.endsWith("%")) {
        const n = Number(trimmed.slice(0, -1).trim());
        const result = n / 100;
        if (!Number.isFinite(result)) {
          state.currentValue = UNDEF;
          state.operator = null;
          state.waitingForSecond = false;
          state.tokens = [];
          view.clearOpHighlight();
          state.showingResult = false;
          return rerender();
        }
        state.currentValue = toDisplayString(result, cfg);
        state.exprFrozen = formatExprPart(n) + " %";
        state.lastOperator = null;
        state.lastOperand = null;
        state.showingResult = true;
        return rerender();
      }

      if (state.lastOperator !== null && state.lastOperand !== null) {
        const a = model.toNumberSafe(state.currentValue);
        const result = applyOp(a, state.lastOperator, state.lastOperand);
        const exprText = `${formatExprPart(a)} ${
          cfg.OP_MAP[state.lastOperator]
        } ${formatExprPart(state.lastOperand)}`;
        if (!Number.isFinite(result)) {
          state.exprFrozen = exprText;
          state.currentValue = UNDEF;
          state.operator = null;
          state.waitingForSecond = false;
          state.tokens = [];
          view.clearOpHighlight();
          state.showingResult = false;
          return rerender();
        }
        state.exprFrozen = exprText;
        state.currentValue = toDisplayString(result, cfg);
        state.waitingForSecond = true;
        view.clearOpHighlight();
        state.showingResult = true;
        return rerender();
      }
      return;
    }

    // Case 2: evaluate with pending operator
    model.pushCurrentAsToken();

    const exprText = buildExprForTopLine(state.tokens, cfg);
    const evalRes = evaluateTokens(state.tokens);
    if (evalRes.error) {
      state.exprFrozen = exprText;
      state.currentValue = UNDEF;
      state.operator = null;
      state.waitingForSecond = false;
      state.tokens = [];
      view.clearOpHighlight();
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

    state.currentValue = toDisplayString(resultNumber, cfg);
    state.operator = null;
    state.waitingForSecond = true;
    state.tokens = [];
    view.clearOpHighlight();
    state.showingResult = true;
    return rerender();
  }

  // Helper to build human-readable top expression
  function buildExprForTopLine(seq, cfg) {
    let out = "";
    for (let i = 0; i < seq.length; i++) {
      const t = seq[i];
      if (typeof t === "number") out += formatExprPart(t);
      else if (typeof t === "string") out += " " + cfg.OP_MAP[t] + " ";
      else if (t && t.percent) out += formatExprPart(String(t.value) + "%");
    }
    return out.trim();
  }

  // Keyboard handler
  function onKey(e) {
    const k = e.key;

    if (/^[0-9]$/.test(k)) return onDigit(k);
    if (k === "." || k === ",") {
      onAction("dot", ".");
      e.preventDefault();
      return;
    }
    if (k === "Enter" || k === "=") {
      onAction("equal");
      e.preventDefault();
      return;
    }
    if (k === "Backspace") {
      onAction("backspace");
      e.preventDefault();
      return;
    }
    if (k === "Escape") {
      model.clearAll();
      view.clearOpHighlight();
      rerender();
      e.preventDefault();
      return;
    }
    if (k === "+") {
      onOperator("plus");
      e.preventDefault();
      return;
    }
    if (k === "-") {
      onOperator("minus");
      e.preventDefault();
      return;
    }
    if (k === "*") {
      onOperator("multiply");
      e.preventDefault();
      return;
    }
    if (k === "/") {
      onOperator("divide");
      e.preventDefault();
      return;
    }
    if (k === "%") {
      onAction("percent", "%");
      e.preventDefault();
      return;
    }
  }

  return {
    onDigit,
    onAction,
    onOperator,
    onKey,
    buildBottomText,
  };
}
