// Application state + business logic (pure w.r.t. DOM)

import { MAX_LEN, UNDEF, OP_FROM_ATTR } from "./config.js";
import {
  isPercentText,
  toNumberSafe,
  toDisplayString,
  renderDisplay,
  formatExprPart,
} from "./format.js";
import {
  applyOp,
  evaluateTokens,
  resolveRightOperand,
  buildExprForTop,
  extractLastOp,
} from "./math.js";

export function createModel() {
  // ---- state ----
  let currentValue = "0";
  let operator = null; // 'add' | 'sub' | 'mul' | 'div' | null
  let waitingForSecond = false; // true => next digit starts new number
  let exprFrozen = ""; // top line after '='
  let tokens = []; // [number | {percent}, "op", ...]
  let lastOperator = null; // for repeat '='
  let lastOperand = null;
  let showingResult = false;

  // ---- derived getters used by the view/controller ----
  const getOperator = () => operator;
  const isWaiting = () => waitingForSecond;
  const getExprFrozen = () => exprFrozen;

  function getClearLabel() {
    const hasPercent = isPercentText(currentValue);
    const hasTyped =
      currentValue !== "0" || hasPercent || /[.]/.test(currentValue);
    return hasTyped ? "C" : "AC";
  }

  function getBottomLiveText() {
    // If no operator — just the current entry
    if (!operator) return currentValue;

    // Render from tokens to support "8 + 2 ×" states
    const parts = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (typeof t === "number") parts.push(formatExprPart(t));
      else if (typeof t === "string") parts.push(mapOp(t));
      else if (t && t.percent)
        parts.push(formatExprPart(String(t.value) + "%"));
    }

    if (waitingForSecond) {
      // show chosen operator even if last token was another operator
      if (parts.length && typeof tokens[tokens.length - 1] === "string") {
        parts[parts.length - 1] = mapOp(operator);
      } else {
        parts.push(mapOp(operator));
      }
      return parts.join(" ");
    }

    parts.push(formatExprPart(currentValue));
    return parts.join(" ");
  }

  function getRenderedDisplayText() {
    return renderDisplay({
      rawText: getBottomLiveText(),
      showingResult,
    });
  }

  // ---- actions (invoked by controller) ----

  function beginTyping() {
    showingResult = false;
    exprFrozen = "";
  }

  function inputDigit(d) {
    if (waitingForSecond) {
      currentValue = d;
      waitingForSecond = false;
      beginTyping();
      return;
    }
    if (currentValue.length >= MAX_LEN) return;
    currentValue = currentValue === "0" ? d : currentValue + d;
    beginTyping();
  }

  function inputDot() {
    if (isPercentText(currentValue)) return;

    if (waitingForSecond) {
      currentValue = "0.";
      waitingForSecond = false;
      beginTyping();
      return;
    }
    if (currentValue.includes(".")) return;

    currentValue += ".";
    beginTyping();
  }

  function handleDigit(d) {
    if (currentValue === UNDEF) {
      // clear implicit error
      currentValue = d;
      operator = null;
      waitingForSecond = false;
      tokens = [];
      lastOperator = null;
      lastOperand = null;
      showingResult = false;
      exprFrozen = "";
      return;
    }
    if (isPercentText(currentValue)) {
      currentValue = d;
      waitingForSecond = false;
      beginTyping();
      return;
    }
    inputDigit(d);
  }

  function handleAction(action, txt) {
    if (action === "dot" || (!action && txt === ".")) {
      inputDot();
      return;
    }
    if (action === "clear") {
      if (operator && !waitingForSecond) {
        currentValue = "0";
        waitingForSecond = true; // keep "A op"
        showingResult = false;
        exprFrozen = "";
      } else {
        if (getClearLabel() === "C") clearEntry();
        else clearAll();
      }
      return;
    }
    if (action !== "clear" && currentValue === UNDEF) return;

    if (action === "equal" || action === "equals") {
      doEquals();
      return;
    }
    if (action === "sign") {
      toggleSign();
      return;
    }
    if (action === "percent") {
      percent();
      return;
    }
    if (action === "backspace") {
      backspace();
      return;
    }
  }

  function handleOperator(opAttr) {
    if (currentValue === UNDEF) return;
    const nextOp = OP_FROM_ATTR[opAttr];
    if (!nextOp) return;
    setOperator(nextOp);
  }

  // --- edit/clear ---

  function clearAll() {
    currentValue = "0";
    operator = null;
    waitingForSecond = false;
    tokens = [];
    lastOperator = null;
    lastOperand = null;
    showingResult = false;
    exprFrozen = "";
  }

  function clearEntry() {
    currentValue = "0";
    lastOperator = null;
    lastOperand = null;
    showingResult = false;
    exprFrozen = "";
  }

  function backspace() {
    if (waitingForSecond) {
      waitingForSecond = false;
      operator = null;
      if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
        tokens.pop();
      }
      showingResult = false;
      exprFrozen = "";
      return;
    }
    if (currentValue.endsWith("%")) {
      currentValue = currentValue.slice(0, -1);
      beginTyping();
      return;
    }
    currentValue = currentValue.slice(0, -1);
    if (currentValue === "" || currentValue === "-") currentValue = "0";
    beginTyping();
  }

  function toggleSign() {
    if (currentValue === "0" || currentValue === "0.") return;

    if (isPercentText(currentValue)) {
      const core = currentValue.slice(0, -1).trim();
      const flipped = core.startsWith("-") ? core.slice(1) : "-" + core;
      currentValue = flipped + "%";
      if (!operator) exprFrozen = "";
      showingResult = false;
      return;
    }

    if (currentValue.startsWith("-")) {
      currentValue = currentValue.slice(1);
      if (currentValue === "0") currentValue = "0";
    } else {
      currentValue = "-" + currentValue;
    }
    if (!operator) exprFrozen = "";
    showingResult = false;
    if (currentValue === "-0") currentValue = "0";
  }

  function percent() {
    if (operator && waitingForSecond) {
      currentValue = String(peekLastNumberToken() ?? 0) + "%";
      operator = null;
      waitingForSecond = false;
      if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
        tokens.pop();
      }
      showingResult = false;
      return;
    }
    if (!isPercentText(currentValue)) {
      currentValue = currentValue.trim() + "%";
      showingResult = false;
    }
    if (currentValue.length > MAX_LEN) {
      currentValue = currentValue.slice(0, MAX_LEN);
      if (!currentValue.endsWith("%"))
        currentValue = currentValue.slice(0, -1) + "%";
    }
  }

  // --- operators/tokens ---

  function setOperator(nextOp) {
    showingResult = false;

    if (operator && waitingForSecond) {
      operator = nextOp;
      if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
        tokens[tokens.length - 1] = nextOp;
      }
      return;
    }

    if (!operator || !waitingForSecond) {
      pushCurrentAsToken();
    }

    operator = nextOp;
    waitingForSecond = true;
    tokens.push(nextOp);
    exprFrozen = "";
    lastOperator = null;
    lastOperand = null;
  }

  function pushCurrentAsToken() {
    if (isPercentText(currentValue)) {
      const val = Number(currentValue.slice(0, -1).trim());
      tokens.push({ percent: true, value: Number.isFinite(val) ? val : 0 });
    } else {
      tokens.push(toNumberSafe(currentValue));
    }
  }

  function peekLastNumberToken() {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (typeof tokens[i] === "number") return tokens[i];
      if (tokens[i] && typeof tokens[i] === "object" && tokens[i].percent)
        return tokens[i].value;
    }
    return null;
  }

  // --- equals ---

  function doEquals() {
    // no pending operator: handle standalone % or repeat "="
    if (!operator) {
      const trimmed = currentValue.trim();

      if (trimmed.endsWith("%")) {
        const n = Number(trimmed.slice(0, -1).trim());
        const result = n / 100;
        if (!Number.isFinite(result)) {
          currentValue = UNDEF;
          operator = null;
          waitingForSecond = false;
          tokens = [];
          showingResult = false;
          return;
        }
        currentValue = toDisplayString(result);
        exprFrozen = formatExprPart(n) + " %";
        lastOperator = null;
        lastOperand = null;
        showingResult = true;
        return;
      }

      if (lastOperator !== null && lastOperand !== null) {
        const a = toNumberSafe(currentValue);
        const result = applyOp(a, lastOperator, lastOperand);
        const exprText = `${formatExprPart(a)} ${mapOp(
          lastOperator
        )} ${formatExprPart(lastOperand)}`;
        if (!Number.isFinite(result)) {
          exprFrozen = exprText;
          currentValue = UNDEF;
          operator = null;
          waitingForSecond = false;
          tokens = [];
          showingResult = false;
          return;
        }
        exprFrozen = exprText;
        currentValue = toDisplayString(result);
        waitingForSecond = true; // next digit starts fresh
        showingResult = true;
        return;
      }
      return;
    }

    // pending operator: evaluate with precedence
    pushCurrentAsToken();

    const exprText = buildExprForTop(tokens, formatExprPart);
    const evalRes = evaluateTokens(tokens);
    if (evalRes.error) {
      exprFrozen = exprText;
      currentValue = UNDEF;
      operator = null;
      waitingForSecond = false;
      tokens = [];
      showingResult = false;
      return;
    }

    const resultNumber = evalRes.value;
    exprFrozen = exprText;

    const lastInfo = extractLastOp(tokens);
    if (lastInfo) {
      const leftVal = resolveNodeToNumber(tokens[lastInfo.leftIndex], 0, "add");
      lastOperator = lastInfo.op;
      lastOperand = resolveRightOperand(
        leftVal,
        lastInfo.op,
        tokens[lastInfo.rightIndex]
      );
    } else {
      lastOperator = null;
      lastOperand = null;
    }

    currentValue = toDisplayString(resultNumber);
    operator = null;
    waitingForSecond = true;
    tokens = [];
    showingResult = true;
  }

  function resolveNodeToNumber(node, left, op) {
    if (typeof node === "number") return node;
    if (node && node.percent) return resolveRightOperand(left, op, node);
    return 0;
  }

  function mapOp(op) {
    switch (op) {
      case "add":
        return "+";
      case "sub":
        return "−";
      case "mul":
        return "×";
      case "div":
        return "÷";
      default:
        return "";
    }
  }

  // public API
  return {
    // getters for view
    getRenderedDisplayText,
    getExprFrozen,
    getClearLabel,
    getOperator,
    isWaiting,

    // actions for controller
    handleDigit,
    handleAction,
    handleOperator,

    // life-cycle helpers
    beginTyping, // (kept for completeness)
  };
}
