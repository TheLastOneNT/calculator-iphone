// === iPhone-like Calculator Logic (Stage 2, clean full file, trimmed: no history, no extra modes) ===

// ------------------------------------
// DOM
// ------------------------------------
document.addEventListener("keydown", onKey);
const exprEl = document.querySelector(".expr");
const displayEl = document.querySelector(".display");
const buttonsEl = document.querySelector(".buttons");
const clearBtn = document.querySelector('button[data-action="clear"]');
const opButtons = Array.from(document.querySelectorAll("[data-op]"));
// слой для масштабирования текста результата
let fitSpan = null;

if (!displayEl || !buttonsEl) {
  throw new Error("Missing .display or .buttons in DOM");
}

// ------------------------------------
// State
// ------------------------------------
let currentValue = "0";
let operator = null; // 'add' | 'sub' | 'mul' | 'div' | null
let waitingForSecond = false;
let exprFrozen = "";
let tokens = [];

let lastOperator = null;
let lastOperand = null;
let showingResult = false;

const MAX_LEN = 13;
const UNDEF = "Undefined";

// ------------------------------------
// Helpers / Tokens
// ------------------------------------
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
  if (s === "." || s === "-" || s === "-." || s === "0.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------
// Rendering
// ------------------------------------
function renderDisplay(text) {
  const t = String(text).trim();
  if (t === UNDEF) return t;
  if (/[+\-×÷]/.test(t) && /\s/.test(t)) return t; // выражение в live-строке
  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim();
    if (core.startsWith("-")) return `(-${core.slice(1)}%)`;
    return t;
  }
  if (/^-/.test(t)) return showingResult ? t : `(-${t.slice(1)})`;
  return t;
}

// Масштабируем только текст результата. Абсолютное позиционирование .fit гарантирует нулевое влияние на макет.
function fitDisplayText() {
  if (!fitSpan) return;

  // сброс масштаба перед измерением
  fitSpan.style.transform = "scale(1)";

  const cw = displayEl.clientWidth; // доступная ширина контейнера
  const sw = fitSpan.scrollWidth; // естественная ширина текста
  if (sw <= 0 || cw <= 0) return;

  let scale = cw / sw; // только уменьшение
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  if (scale > 1) scale = 1; // не увеличиваем
  const MIN_SCALE = 0.5; // нижний предел для читабельности
  if (scale < MIN_SCALE) scale = MIN_SCALE;

  fitSpan.style.transform = `scale(${scale})`;
}

function updateDisplay() {
  const txt = renderDisplay(buildBottomText());
  if (fitSpan) {
    fitSpan.textContent = txt;
  } else {
    displayEl.textContent = txt;
  }
  updateClearLabel();
  updateExpressionLine();

  // подгоняем масштаб в конце, чтобы текст гарантированно помещался
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

// ограничение длины и форматирование
function trimTrailingZeros(str) {
  if (!str.includes(".")) return str;
  let [i, f] = str.split(".");
  if (!f) return i;
  f = f.replace(/0+$/, "");
  return f.length ? i + "." + f : i;
}
function toDisplayString(num) {
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

  const reserve = (s.startsWith("-") ? 1 : 0) + 6; // для e+NN
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

// ------------------------------------
// Input
// ------------------------------------
function beginTyping() {
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

// ------------------------------------
// Editing / Clear
// ------------------------------------
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
  if (currentValue === "0" || currentValue === "0.") return;

  if (isPercentText(currentValue)) {
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
  if (currentValue === "-0") currentValue = "0";
  updateDisplay();
}

function percent() {
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

  if (!isPercentText(currentValue)) {
    currentValue = currentValue.trim() + "%";
    showingResult = false;
    updateDisplay();
  }
  if (currentValue.length > MAX_LEN) {
    currentValue = currentValue.slice(0, MAX_LEN);
    if (!currentValue.endsWith("%"))
      currentValue = currentValue.slice(0, -1) + "%";
    updateDisplay();
  }
}

// ------------------------------------
// Operators & tokens
// ------------------------------------
function setOperator(nextOp) {
  showingResult = false;

  if (operator && waitingForSecond) {
    operator = nextOp;
    if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
      tokens[tokens.length - 1] = nextOp;
    }
    highlightOperator(operator);
    updateDisplay();
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

// ------------------------------------
// Evaluation with precedence
// ------------------------------------
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
  const values = [];
  const ops = [];
  let expectNumber = true;

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

// форматирование частей
function formatExprPart(value) {
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

function buildExprForTop(seq) {
  let out = "";
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    if (typeof t === "number") out += formatExprPart(t);
    else if (typeof t === "string") out += " " + OP_MAP[t] + " ";
    else if (t && t.percent) out += formatExprPart(String(t.value) + "%");
  }
  return out.trim();
}

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

// ------------------------------------
// Equals
// ------------------------------------
function doEquals() {
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
      currentValue = toDisplayString(result); // история удалена — просто показываем результат
      waitingForSecond = true;
      clearOpHighlight();
      showingResult = true;
      updateDisplay();
      return;
    }
    return;
  }

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

// ------------------------------------
// Bottom line builder (live typing)
// ------------------------------------
function buildBottomText() {
  if (!operator) return currentValue;

  const parts = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (typeof t === "number") parts.push(formatExprPart(t));
    else if (typeof t === "string") parts.push(OP_MAP[t]);
    else if (t && t.percent) parts.push(formatExprPart(String(t.value) + "%"));
  }

  if (waitingForSecond) {
    if (parts.length && typeof tokens[tokens.length - 1] === "string") {
      parts[parts.length - 1] = OP_MAP[operator];
    } else {
      parts.push(OP_MAP[operator]);
    }
    return parts.join(" ");
  }

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

// ------------------------------------
// Keyboard
// ------------------------------------
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
  /* удалено: 'h'/'H' для истории */
}

// ------------------------------------
// Buttons
// ------------------------------------
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

// ------------------------------------
// Init
// ------------------------------------
(function init() {
  // создаём абсолютный слой .fit, чтобы текст результата НЕ влиял на размеры
  fitSpan = document.createElement("span");
  fitSpan.className = "fit";
  while (displayEl.firstChild) fitSpan.appendChild(displayEl.firstChild);
  displayEl.appendChild(fitSpan);

  updateDisplay();
  updateClearLabel();

  // Подгон масштаба при ресайзе окна/смене ориентации
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
