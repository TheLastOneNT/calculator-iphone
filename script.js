// === iPhone-like Calculator Logic (Stage 2, clean full file; no history/no extra modes) ===
//
// This module implements an iOS-style basic calculator with:
// - live expression line (top) and scalable result line (bottom),
// - operator precedence (+/− after ×/÷),
// - iOS-like percent semantics and "repeat equals" behavior,
// - strictly static layout: text scales inside the display, the UI never reflows.

/* ------------------------------------
 * DOM
 * ------------------------------------ */

document.addEventListener("keydown", onKey);

const exprEl = document.querySelector(".expr");
const displayEl = document.querySelector(".display");
const buttonsEl = document.querySelector(".buttons");
const clearBtn = document.querySelector('button[data-action="clear"]');
const opButtons = Array.from(document.querySelectorAll("[data-op]"));

// Scalable text layer injected into .display so scaling never affects layout.
let fitSpan = null;

if (!displayEl || !buttonsEl) {
  throw new Error("Missing .display or .buttons in DOM");
}

/* ------------------------------------
 * State
 * ------------------------------------ */

let currentValue = "0"; // current entry (string; may be "0.", "-3.2", "15%")
let operator = null; // 'add' | 'sub' | 'mul' | 'div' | null
let waitingForSecond = false; // when true, next digit starts a new number
let exprFrozen = ""; // top expression line, frozen on '=' or error
let tokens = []; // parsed tokens: numbers, {percent}, and operators

let lastOperator = null; // for "repeat equals" (A op B, then "=" again)
let lastOperand = null;
let showingResult = false; // when true, negatives render without parentheses

const MAX_LEN = 13; // output length cap to emulate iOS rounding
const UNDEF = "Undefined"; // label for invalid operations (e.g., divide by zero)

/* ------------------------------------
 * Helpers / Tokens
 * ------------------------------------ */

const OP_MAP = { add: "+", sub: "−", mul: "×", div: "÷" };
const OP_FROM_ATTR = {
  plus: "add",
  minus: "sub",
  multiply: "mul",
  divide: "div",
};

function isPercentText(s) {
  return typeof s === "string" && s.trim().endsWith("%");
}

function toNumberSafe(s) {
  // Tolerate partial inputs like ".", "-.", "0." during typing.
  if (s === "." || s === "-" || s === "-." || s === "0.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------
 * Rendering
 * ------------------------------------ */

function renderDisplay(text) {
  // Format final text for the bottom display, matching iOS nuances.
  const t = String(text).trim();
  if (t === UNDEF) return t;

  // If live expression (contains operator glyphs and spaces), render as-is.
  if (/[+\-×÷]/.test(t) && /\s/.test(t)) return t;

  // Percent input: render negatives as (-10%); final numeric results are plain numbers.
  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim();
    if (core.startsWith("-")) return `(-${core.slice(1)}%)`;
    return t;
  }

  // Negatives: during typing wrap in parentheses; on result show plain "-N".
  if (/^-/.test(t)) return showingResult ? t : `(-${t.slice(1)})`;

  return t;
}

/**
 * Scale only the result text (fitSpan) so the container never grows/shifts.
 * Absolute positioning ensures zero impact on layout while scaling.
 */
function fitDisplayText() {
  if (!fitSpan) return;

  // Reset scale before measuring intrinsic width.
  fitSpan.style.transform = "scale(1)";

  const cw = displayEl.clientWidth; // available width
  const sw = fitSpan.scrollWidth; // natural text width
  if (sw <= 0 || cw <= 0) return;

  // Downscale only — never upscale text.
  let scale = cw / sw;
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  if (scale > 1) scale = 1;

  // Lower bound for readability.
  const MIN_SCALE = 0.5;
  if (scale < MIN_SCALE) scale = MIN_SCALE;

  fitSpan.style.transform = `scale(${scale})`;
}

function updateDisplay() {
  const txt = renderDisplay(buildBottomText());
  if (fitSpan) {
    fitSpan.textContent = txt;
  } else {
    // Fallback (shouldn't happen after init, but safe in SSR/partial mounts).
    displayEl.textContent = txt;
  }

  updateClearLabel();
  updateExpressionLine();

  // Always scale at the end so measurements reflect the latest content.
  fitDisplayText();
}

function updateExpressionLine() {
  if (exprEl) exprEl.textContent = exprFrozen || "";
}

function updateClearLabel() {
  if (!clearBtn) return;
  const hasPercent = isPercentText(currentValue);
  const hasTyped =
    currentValue !== "0" || hasPercent || /[.]/.test(currentValue);
  clearBtn.textContent = hasTyped ? "C" : "AC";
}

/* ------------------------------------
 * Formatting / Numeric presentation
 * ------------------------------------ */

function trimTrailingZeros(str) {
  if (!str.includes(".")) return str;
  let [i, f] = str.split(".");
  if (!f) return i;
  f = f.replace(/0+$/, "");
  return f.length ? i + "." + f : i;
}

/**
 * Convert a number to a string under MAX_LEN constraints:
 * - Prefer fixed/trimmed decimals up to the limit.
 * - Fall back to exponential if needed.
 * - Return "Undefined" for invalid numbers.
 */
function toDisplayString(num) {
  if (!Number.isFinite(num)) return UNDEF;

  let s = String(num);
  s = trimTrailingZeros(s);
  if (s.length <= MAX_LEN) return s;

  if (s.includes(".")) {
    const [i, f = ""] = s.split(".");
    const free = Math.max(0, MAX_LEN - i.length - 1); // room for fractional digits
    if (free > 0) {
      s = Number(num).toFixed(free);
      s = trimTrailingZeros(s);
      if (s.length <= MAX_LEN) return s;
    } else {
      return i.slice(0, MAX_LEN);
    }
  }

  // Reserve characters for "e±NN".
  const reserve = (s.startsWith("-") ? 1 : 0) + 6;
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

/* ------------------------------------
 * Input
 * ------------------------------------ */

function beginTyping() {
  // Reset derived state when user starts typing a new number.
  showingResult = false;
  exprFrozen = "";
}

function inputDigit(d) {
  if (waitingForSecond) {
    currentValue = d;
    waitingForSecond = false;
    beginTyping();
    updateDisplay();
    return;
  }
  if (currentValue.length >= MAX_LEN) return;
  currentValue = currentValue === "0" ? d : currentValue + d;
  beginTyping();
  updateDisplay();
}

function inputDot() {
  if (isPercentText(currentValue)) return;

  if (waitingForSecond) {
    currentValue = "0.";
    waitingForSecond = false;
    beginTyping();
    updateDisplay();
    return;
  }
  if (currentValue.includes(".")) return;

  currentValue += ".";
  beginTyping();
  updateDisplay();
}

function handleDigit(d) {
  if (currentValue === UNDEF) {
    // Clear implicit error state on next digit entry.
    currentValue = d;
    operator = null;
    waitingForSecond = false;
    tokens = [];
    lastOperator = null;
    lastOperand = null;
    showingResult = false;
    exprFrozen = "";
    updateDisplay();
    return;
  }
  if (isPercentText(currentValue)) {
    // Starting fresh after a percent literal.
    currentValue = d;
    waitingForSecond = false;
    beginTyping();
    updateDisplay();
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
    // iOS behavior:
    // - If entering second operand, C removes it and keeps "A op".
    // - Else, C clears entry, AC clears all.
    if (operator && !waitingForSecond) {
      currentValue = "0";
      waitingForSecond = true;
      showingResult = false;
      exprFrozen = "";
      updateDisplay();
    } else {
      if (clearBtn && clearBtn.textContent === "C") clearEntry();
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

/* ------------------------------------
 * Editing / Clear
 * ------------------------------------ */

function clearAll() {
  currentValue = "0";
  operator = null;
  waitingForSecond = false;
  tokens = [];
  lastOperator = null;
  lastOperand = null;
  showingResult = false;
  exprFrozen = "";
  clearOpHighlight();
  updateDisplay();
}

function clearEntry() {
  currentValue = "0";
  lastOperator = null;
  lastOperand = null;
  showingResult = false;
  exprFrozen = "";
  updateDisplay();
}

function backspace() {
  // If an operator was just chosen, backspace removes it (iOS behavior).
  if (waitingForSecond) {
    waitingForSecond = false;
    operator = null;
    if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
      tokens.pop();
    }
    clearOpHighlight();
    showingResult = false;
    exprFrozen = "";
    updateDisplay();
    return;
  }

  if (currentValue.endsWith("%")) {
    currentValue = currentValue.slice(0, -1);
    beginTyping();
    updateDisplay();
    return;
  }

  currentValue = currentValue.slice(0, -1);
  if (currentValue === "" || currentValue === "-") currentValue = "0";
  beginTyping();
  updateDisplay();
}

function toggleSign() {
  // iOS: do nothing for zero.
  if (currentValue === "0" || currentValue === "0.") return;

  if (isPercentText(currentValue)) {
    // Flip sign inside the percent literal.
    const core = currentValue.slice(0, -1).trim();
    const flipped = core.startsWith("-") ? core.slice(1) : "-" + core;
    currentValue = flipped + "%";
    if (!operator) exprFrozen = "";
    showingResult = false;
    updateDisplay();
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

  // Normalize "-0" → "0".
  if (currentValue === "-0") currentValue = "0";
  updateDisplay();
}

function percent() {
  // If operator is selected and second operand not started: interpret as A%.
  if (operator && waitingForSecond) {
    currentValue = String(peekLastNumberToken() ?? 0) + "%";
    operator = null;
    waitingForSecond = false;
    if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
      tokens.pop();
    }
    clearOpHighlight();
    showingResult = false;
    updateDisplay();
    return;
  }

  // Append % to current input (once).
  if (!isPercentText(currentValue)) {
    currentValue = currentValue.trim() + "%";
    showingResult = false;
    updateDisplay();
  }
  if (currentValue.length > MAX_LEN) {
    // Keep the trailing '%' even when trimming.
    currentValue = currentValue.slice(0, MAX_LEN);
    if (!currentValue.endsWith("%"))
      currentValue = currentValue.slice(0, -1) + "%";
    updateDisplay();
  }
}

/* ------------------------------------
 * Operators & tokens
 * ------------------------------------ */

function setOperator(nextOp) {
  showingResult = false;

  // Change the operator before entering the second operand.
  if (operator && waitingForSecond) {
    operator = nextOp;
    if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
      tokens[tokens.length - 1] = nextOp;
    }
    highlightOperator(operator);
    updateDisplay();
    return;
  }

  // Push current number into tokens when transitioning between operands.
  if (!operator || !waitingForSecond) {
    pushCurrentAsToken();
  }

  operator = nextOp;
  waitingForSecond = true;
  tokens.push(nextOp);
  exprFrozen = "";
  lastOperator = null;
  lastOperand = null;
  highlightOperator(operator);
  updateDisplay();
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

/* ------------------------------------
 * Evaluation with precedence
 * ------------------------------------ */

function applyOp(a, op, b) {
  switch (op) {
    case "add":
      return a + b;
    case "sub":
      return a - b;
    case "mul":
      return a * b;
    case "div":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

/**
 * Resolve a right operand that might be a percent node,
 * using iOS rules:
 * - For add/sub: right% is (left * right/100)
 * - For mul/div: right% is (right/100)
 */
function resolveRightOperand(left, op, rightNode) {
  if (typeof rightNode === "number") return rightNode;
  if (rightNode && rightNode.percent) {
    const n = rightNode.value;
    if (op === "add" || op === "sub") return left * (n / 100);
    if (op === "mul" || op === "div") return n / 100;
    return n;
  }
  return 0;
}

function evaluateTokens(seq) {
  // Shunting-lite: split into values and ops, then fold with precedence.
  const values = [];
  const ops = [];
  let expectNumber = true;

  // Tokenize: number / percent nodes and operators only; ignore trailing op.
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    if (expectNumber) {
      if (typeof t === "number" || (t && typeof t === "object" && t.percent)) {
        values.push(t);
        expectNumber = false;
      }
    } else if (typeof t === "string") {
      ops.push(t);
      expectNumber = true;
    }
  }
  if (ops.length === values.length) ops.pop();

  // Pass 1: × / ÷
  for (let i = 0; i < ops.length; ) {
    const op = ops[i];
    if (op === "mul" || op === "div") {
      const leftVal =
        typeof values[i] === "number"
          ? values[i]
          : resolveRightOperand(0, "add", values[i]);
      const rightVal = resolveRightOperand(leftVal, op, values[i + 1]);
      const raw = applyOp(leftVal, op, rightVal);
      if (!Number.isFinite(raw)) return { error: true };
      values.splice(i, 2, raw);
      ops.splice(i, 1);
    } else {
      i++;
    }
  }

  // Pass 2: + / −
  while (ops.length) {
    const op = ops.shift();
    const leftVal =
      typeof values[0] === "number"
        ? values[0]
        : resolveRightOperand(0, "add", values[0]);
    const rightVal = resolveRightOperand(leftVal, op, values[1]);
    const raw = applyOp(leftVal, op, rightVal);
    if (!Number.isFinite(raw)) return { error: true };
    values.splice(0, 2, raw);
  }

  const final =
    typeof values[0] === "number"
      ? values[0]
      : resolveRightOperand(0, "add", values[0]);
  return { error: false, value: final };
}

/* ------------------------------------
 * Expression formatting (top line)
 * ------------------------------------ */

function formatExprPart(value) {
  // Preserve "0." / "-0." while typing.
  if (typeof value === "string") {
    const s = value.trim();

    // Raw percent literal as text.
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

function buildExprForTop(seq) {
  // Join tokens into a human-readable expression (e.g., "12 × 5 + 10%").
  let out = "";
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    if (typeof t === "number") out += formatExprPart(t);
    else if (typeof t === "string") out += " " + OP_MAP[t] + " ";
    else if (t && t.percent) out += formatExprPart(String(t.value) + "%");
  }
  return out.trim();
}

// Extract last binary operation for "repeat equals" (A op B, then '=' repeats op B).
function extractLastOp(seq) {
  let lastOpIndex = -1;
  for (let i = seq.length - 2; i >= 1; i--) {
    if (typeof seq[i] === "string") {
      lastOpIndex = i;
      break;
    }
  }
  if (lastOpIndex === -1) return null;
  const leftVal = resolveNodeToNumber(seq[lastOpIndex - 1], 0, "add");
  const op = seq[lastOpIndex];
  const rightVal = resolveRightOperand(leftVal, op, seq[lastOpIndex + 1]);
  return { op, right: rightVal };
}

function resolveNodeToNumber(node, left, op) {
  if (typeof node === "number") return node;
  if (node && node.percent) return resolveRightOperand(left, op, node);
  return 0;
}

/* ------------------------------------
 * Equals
 * ------------------------------------ */

function doEquals() {
  // Case 1: no pending operator — handle solitary percent or repeat "=".
  if (!operator) {
    const trimmed = currentValue.trim();

    // Standalone percent: interpret as n/100.
    if (trimmed.endsWith("%")) {
      const n = Number(trimmed.slice(0, -1).trim());
      const result = n / 100;
      if (!Number.isFinite(result)) {
        currentValue = UNDEF;
        operator = null;
        waitingForSecond = false;
        tokens = [];
        clearOpHighlight();
        showingResult = false;
        updateDisplay();
        return;
      }
      currentValue = toDisplayString(result);
      exprFrozen = formatExprPart(n) + " %";
      lastOperator = null;
      lastOperand = null;
      showingResult = true;
      updateDisplay();
      return;
    }

    // Repeat equals: apply last binary op to the current display value.
    if (lastOperator !== null && lastOperand !== null) {
      const a = toNumberSafe(currentValue);
      const result = applyOp(a, lastOperator, lastOperand);
      const exprText = `${formatExprPart(a)} ${
        OP_MAP[lastOperator]
      } ${formatExprPart(lastOperand)}`;
      if (!Number.isFinite(result)) {
        exprFrozen = exprText;
        currentValue = UNDEF;
        operator = null;
        waitingForSecond = false;
        tokens = [];
        clearOpHighlight();
        showingResult = false;
        updateDisplay();
        return;
      }
      exprFrozen = exprText;
      currentValue = toDisplayString(result);
      waitingForSecond = true; // iOS: result is ready; next digit will start a new entry.
      clearOpHighlight();
      showingResult = true;
      updateDisplay();
      return;
    }
    return;
  }

  // Case 2: pending operator — evaluate full token stream with precedence.
  pushCurrentAsToken();

  const exprText = buildExprForTop(tokens);
  const evalRes = evaluateTokens(tokens);
  if (evalRes.error) {
    exprFrozen = exprText;
    currentValue = UNDEF;
    operator = null;
    waitingForSecond = false;
    tokens = [];
    clearOpHighlight();
    showingResult = false;
    updateDisplay();
    return;
  }

  const resultNumber = evalRes.value;
  exprFrozen = exprText;

  // Prepare "repeat equals" info from the last binary op.
  const lastInfo = extractLastOp(tokens);
  if (lastInfo) {
    lastOperator = lastInfo.op;
    lastOperand = lastInfo.right;
  } else {
    lastOperator = null;
    lastOperand = null;
  }

  currentValue = toDisplayString(resultNumber);
  operator = null;
  waitingForSecond = true;
  tokens = [];
  clearOpHighlight();
  showingResult = true;
  updateDisplay();
}

/* ------------------------------------
 * Bottom line builder (live typing)
 * ------------------------------------ */

function buildBottomText() {
  // If no operator is selected, show the current entry only.
  if (!operator) return currentValue;

  // Otherwise, render from tokens so intermediate states like "8 + 2 ×" are correct.
  const parts = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (typeof t === "number") parts.push(formatExprPart(t));
    else if (typeof t === "string") parts.push(OP_MAP[t]);
    else if (t && t.percent) parts.push(formatExprPart(String(t.value) + "%"));
  }

  if (waitingForSecond) {
    // Just pressed an operator: ensure the visible operator matches the current one.
    if (parts.length && typeof tokens[tokens.length - 1] === "string") {
      parts[parts.length - 1] = OP_MAP[operator];
    } else {
      parts.push(OP_MAP[operator]);
    }
    return parts.join(" ");
  }

  // Typing the second operand; append live input formatting.
  parts.push(formatExprPart(currentValue));
  return parts.join(" ");
}

function highlightOperator(op) {
  opButtons.forEach((btn) => {
    btn.classList.toggle(
      "active-op",
      btn.dataset.op && OP_FROM_ATTR[btn.dataset.op] === op
    );
  });
}

function clearOpHighlight() {
  opButtons.forEach((btn) => btn.classList.remove("active-op"));
}

/* ------------------------------------
 * Keyboard
 * ------------------------------------ */

function onKey(e) {
  const k = e.key;

  if (/^[0-9]$/.test(k)) {
    handleDigit(k);
    return;
  }
  if (k === "." || k === ",") {
    handleAction("dot", ".");
    e.preventDefault();
    return;
  }
  if (k === "Enter" || k === "=") {
    handleAction("equal");
    e.preventDefault();
    return;
  }
  if (k === "Backspace") {
    backspace();
    e.preventDefault();
    return;
  }
  if (k === "Escape") {
    clearAll();
    e.preventDefault();
    return;
  }
  if (k === "+") {
    handleOperator("plus");
    e.preventDefault();
    return;
  }
  if (k === "-") {
    handleOperator("minus");
    e.preventDefault();
    return;
  }
  if (k === "*") {
    handleOperator("multiply");
    e.preventDefault();
    return;
  }
  if (k === "/") {
    handleOperator("divide");
    e.preventDefault();
    return;
  }
  if (k === "%") {
    handleAction("percent", "%");
    e.preventDefault();
    return;
  }
  // History hotkeys removed — basic calculator only.
}

/* ------------------------------------
 * Buttons
 * ------------------------------------ */

buttonsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const txt = btn.textContent.trim();
  const action = btn.dataset.action;
  const op = btn.dataset.op;

  if (/^[0-9]$/.test(txt)) {
    handleDigit(txt);
    return;
  }
  if (action) {
    handleAction(action, txt);
    return;
  }
  if (op) {
    handleOperator(op);
    return;
  }
});

/* ------------------------------------
 * Init
 * ------------------------------------ */

(function init() {
  // Inject absolute .fit layer so text scaling never triggers reflow of the display.
  fitSpan = document.createElement("span");
  fitSpan.className = "fit";
  while (displayEl.firstChild) fitSpan.appendChild(displayEl.firstChild);
  displayEl.appendChild(fitSpan);

  updateDisplay();
  updateClearLabel();

  // Refit on resize/orientation changes. rAF avoids layout thrash.
  let rafId = null;
  const onResize = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      fitDisplayText();
      rafId = null;
    });
  };
  window.addEventListener("resize", onResize);
})();
