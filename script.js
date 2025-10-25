// === iPhone-like Calculator Logic (Stage 2, clean full file) ===

// ------------------------------------
// DOM
// ------------------------------------
document.addEventListener("keydown", onKey);
const exprEl = document.querySelector(".expr");
const displayEl = document.querySelector(".display");
const buttonsEl = document.querySelector(".buttons");
const clearBtn = document.querySelector('button[data-action="clear"]');
const opButtons = Array.from(document.querySelectorAll("[data-op]"));

// История (элементы могут отсутствовать в текущей разметке — учитываем это)
const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const historyClear = document.getElementById("historyClear");

const HISTORY_LIMIT = 10;
const history = [];

if (!displayEl || !buttonsEl) {
  throw new Error("Missing .display or .buttons in DOM");
}

// ------------------------------------
// State
// ------------------------------------
let currentValue = "0"; // текущий ввод (строка, может оканчиваться на '%')
let operator = null; // 'add' | 'sub' | 'mul' | 'div' | null
let waitingForSecond = false; // true => следующий ввод цифры начнёт новое число
let exprFrozen = ""; // верхняя строка (фиксируется на '=' и при ошибке)
let tokens = []; // токены выражения: [number|{percent}, 'op', ...]

let lastOperator = null; // для повторного '='
let lastOperand = null;

const MAX_LEN = 12;

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
  if (s === "." || s === "-" || s === "-.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------
// Rendering
// ------------------------------------
function renderDisplay(text) {
  const t = String(text).trim();
  if (t === "Error") return t;

  // процент с отрицанием → (-10%)
  if (isPercentText(t)) {
    const core = t.slice(0, -1).trim();
    if (core.startsWith("-")) return `(-${core.slice(1)}%)`;
    return t;
  }
  // обычное отрицательное → (-8), (-0.), и т.п.
  if (/^-/.test(t)) return `(-${t.slice(1)})`;
  return t;
}

function updateDisplay() {
  displayEl.textContent = renderDisplay(buildBottomText());
  updateClearLabel();
  updateExpressionLine();
}

function updateExpressionLine() {
  if (exprEl) exprEl.textContent = exprFrozen || "";
}

function updateClearLabel() {
  if (!clearBtn) return;
  const hasPercent = isPercentText(currentValue);
  const hasTyped = currentValue !== "0" || hasPercent;
  clearBtn.textContent = hasTyped ? "C" : "AC";
}

// ограничение длины
function trimTrailingZeros(str) {
  if (!str.includes(".")) return str;
  let [i, f] = str.split(".");
  if (!f) return i;
  f = f.replace(/0+$/, "");
  return f.length ? i + "." + f : i;
}
function toDisplayString(num) {
  if (!Number.isFinite(num)) return "Error";
  let s = String(num);
  s = trimTrailingZeros(s);
  if (s.length <= MAX_LEN) return s;
  if (s.includes(".")) {
    const [i, f = ""] = s.split(".");
    const free = Math.max(0, MAX_LEN - i.length - 1);
    if (free > 0) {
      s = trimTrailingZeros(i + "." + f.slice(0, free));
      if (s.length <= MAX_LEN) return s;
    } else {
      return i.slice(0, MAX_LEN);
    }
  }
  const reserve = (s.startsWith("-") ? 1 : 0) + 6; // для экспоненциальной формы
  const digits = Math.max(0, MAX_LEN - reserve);
  s = Number(num).toExponential(Math.max(0, digits));
  return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN);
}

// ------------------------------------
// Input
// ------------------------------------
function inputDigit(d) {
  if (waitingForSecond) {
    currentValue = d;
    waitingForSecond = false;
    exprFrozen = "";
    updateDisplay();
    return;
  }
  if (currentValue.length >= MAX_LEN) return;
  currentValue = currentValue === "0" ? d : currentValue + d;
  updateDisplay();
}

function inputDot() {
  if (isPercentText(currentValue)) return;
  if (waitingForSecond) {
    currentValue = "0.";
    waitingForSecond = false;
    updateDisplay();
    return;
  }
  if (!currentValue.includes(".")) {
    currentValue += ".";
    updateDisplay();
  }
}

function handleDigit(d) {
  if (currentValue === "Error") {
    currentValue = d;
    operator = null;
    waitingForSecond = false;
    tokens = [];
    lastOperator = null;
    lastOperand = null;
    exprFrozen = "";
    updateDisplay();
    return;
  }
  if (isPercentText(currentValue)) {
    currentValue = d;
    waitingForSecond = false;
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
    if (clearBtn && clearBtn.textContent === "C") clearEntry();
    else clearAll();
    return;
  }
  if (action !== "clear" && currentValue === "Error") return;
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
  if (currentValue === "Error") return;
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
  exprFrozen = "";
  clearOpHighlight();
  updateDisplay();
}

function clearEntry() {
  currentValue = "0";
  lastOperator = null;
  lastOperand = null;
  exprFrozen = "";
  updateDisplay();
}

function backspace() {
  // Если только что выбрали оператор — удаляем оператор (как на iPhone)
  if (waitingForSecond) {
    waitingForSecond = false;
    operator = null;
    if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
      tokens.pop();
    }
    clearOpHighlight();
    exprFrozen = "";
    updateDisplay();
    return;
  }

  if (currentValue.endsWith("%")) {
    currentValue = currentValue.slice(0, -1);
    updateDisplay();
    return;
  }
  currentValue = currentValue.slice(0, -1);
  if (currentValue === "" || currentValue === "-") currentValue = "0";
  updateDisplay();
}

function toggleSign() {
  if (currentValue === "0") return;
  if (isPercentText(currentValue)) {
    const core = currentValue.slice(0, -1).trim();
    const flipped = core.startsWith("-") ? core.slice(1) : "-" + core;
    currentValue = flipped + "%";
    if (!operator) exprFrozen = "";
    updateDisplay();
    return;
  }
  currentValue = currentValue.startsWith("-")
    ? currentValue.slice(1)
    : "-" + currentValue;
  if (!operator) exprFrozen = "";
  if (currentValue === "-0") currentValue = "0";
  updateDisplay();
}

function percent() {
  // Если оператор выбран и второй операнд ещё не начат — трактуем как A%
  if (operator && waitingForSecond) {
    currentValue = String(peekLastNumberToken() ?? 0) + "%";
    operator = null;
    waitingForSecond = false;
    if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
      tokens.pop();
    }
    clearOpHighlight();
    updateDisplay();
    return;
  }

  if (!isPercentText(currentValue)) {
    currentValue = currentValue.trim() + "%";
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
  // смена оператора до ввода второго
  if (operator && waitingForSecond) {
    operator = nextOp;
    if (tokens.length && typeof tokens[tokens.length - 1] === "string") {
      tokens[tokens.length - 1] = nextOp;
    }
    highlightOperator(operator);
    updateDisplay();
    return;
  }

  // пушим текущее число в токены
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

// правый операнд-процент согласно правилам
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

  // разбор токенов
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
  // обрезаем висящий оператор
  if (ops.length === values.length) ops.pop();

  // проход 1: × / ÷
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

  // проход 2: + / −
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

function formatExprPart(value) {
  const s = String(value).trim();
  if (s.endsWith("%")) {
    const core = s.slice(0, -1).trim();
    const n = Number(core);
    return (Number.isFinite(n) ? n.toLocaleString() : core) + "%";
  }
  const n = Number(s);
  return Number.isFinite(n) ? n.toLocaleString() : s;
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

// Для повторного '=' — достаём последнюю бинарную операцию и её правый операнд
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
  // Нет оператора: одиночный % или повтор '='
  if (!operator) {
    const trimmed = currentValue.trim();

    // отдельный % → перевод в дробь (n/100)
    if (trimmed.endsWith("%")) {
      const n = Number(trimmed.slice(0, -1).trim());
      const result = n / 100;
      if (!Number.isFinite(result)) {
        currentValue = "Error";
        operator = null;
        waitingForSecond = false;
        tokens = [];
        clearOpHighlight();
        updateDisplay();
        return;
      }
      currentValue = toDisplayString(result);
      exprFrozen = formatExprPart(n) + " %";
      lastOperator = null;
      lastOperand = null;
      updateDisplay();
      return;
    }

    // повтор '='
    if (lastOperator !== null && lastOperand !== null) {
      const a = toNumberSafe(currentValue);
      const result = applyOp(a, lastOperator, lastOperand);
      const exprText = `${formatExprPart(a)} ${
        OP_MAP[lastOperator]
      } ${formatExprPart(lastOperand)}`;
      if (!Number.isFinite(result)) {
        exprFrozen = exprText;
        currentValue = "Error";
        operator = null;
        waitingForSecond = false;
        tokens = [];
        clearOpHighlight();
        updateDisplay();
        return;
      }
      exprFrozen = exprText;
      pushHistory(exprText, toDisplayString(result));
      currentValue = toDisplayString(result);
      waitingForSecond = true; // как на iPhone
      clearOpHighlight();
      updateDisplay();
      return;
    }
    return;
  }

  // Есть ожидающий оператор — завершаем токены и считаем с приоритетом
  pushCurrentAsToken();

  const exprText = buildExprForTop(tokens);
  const evalRes = evaluateTokens(tokens);
  if (evalRes.error) {
    exprFrozen = exprText;
    currentValue = "Error";
    operator = null;
    waitingForSecond = false;
    tokens = [];
    clearOpHighlight();
    updateDisplay();
    return;
  }

  const resultNumber = evalRes.value;
  exprFrozen = exprText;
  pushHistory(exprText, toDisplayString(resultNumber));

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
  updateDisplay();
}

// ------------------------------------
// History UI
// ------------------------------------
function pushHistory(expr, result) {
  history.unshift({ expr, result });
  if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
  renderHistory();
}
function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = "";
  history.forEach(({ expr, result }) => {
    const li = document.createElement("li");
    li.className = "hist-item";
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.setAttribute("aria-label", `${expr} equals ${result}`);
    li.innerHTML = `<div class="h-expr">${expr}</div><div class="h-res">= ${result}</div>`;
    li.addEventListener("click", () => {
      currentValue = result;
      operator = null;
      waitingForSecond = true;
      tokens = [];
      lastOperator = null;
      lastOperand = null;
      updateDisplay();
    });
    historyList.appendChild(li);
  });
}
function toggleHistory(force) {
  if (!historyPanel || !historyBtn) return;
  const willOpen =
    typeof force === "boolean" ? force : historyPanel.hasAttribute("hidden");
  if (willOpen) {
    historyPanel.removeAttribute("hidden");
    historyBtn.setAttribute("aria-expanded", "true");
  } else {
    historyPanel.setAttribute("hidden", "");
    historyBtn.setAttribute("aria-expanded", "false");
  }
}
historyBtn?.addEventListener("click", () => toggleHistory());
historyClear?.addEventListener("click", () => {
  history.length = 0;
  renderHistory();
});

// ------------------------------------
// Bottom line builder (live typing)
// ------------------------------------
function buildBottomText() {
  // Если оператор не выбран — показываем текущий ввод
  if (!operator) return currentValue;

  // Рендерим из tokens, чтобы состояния типа "8 + 2 ×" были корректными
  const parts = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (typeof t === "number") parts.push(formatExprPart(t));
    else if (typeof t === "string") parts.push(OP_MAP[t]);
    else if (t && t.percent) parts.push(formatExprPart(String(t.value) + "%"));
  }

  if (waitingForSecond) {
    // Только что нажали оператор — гарантируем показ текущего оператора
    if (parts.length && typeof tokens[tokens.length - 1] === "string") {
      parts[parts.length - 1] = OP_MAP[operator];
    } else {
      parts.push(OP_MAP[operator]);
    }
    return parts.join(" ");
  }

  // Вводим следующий операнд
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
  if (k === "h" || k === "H") {
    toggleHistory();
    e.preventDefault();
    return;
  }
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
  updateDisplay();
  updateClearLabel();
})();
