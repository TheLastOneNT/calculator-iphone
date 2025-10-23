document.addEventListener("keydown", onKey);
const exprEl = document.querySelector(".expr");
const displayEl = document.querySelector(".display");
const buttonsEl = document.querySelector(".buttons");
const clearBtn = document.querySelector('button[data-action="clear"]');
const opButtons = Array.from(document.querySelectorAll("[data-op]"));

if (!displayEl || !buttonsEl) {
  throw new Error("Missing .display or .buttons in DOM");
}

let currentValue = "0"; // value currently shown on the screen
let firstOperand = null; // first number or null
let operator = null; // "add" | "sub" | "mul" | "div" | null
let waitingForSecond = false; // waiting for second operand after chose operator
let lastOperator = null; // remember last operator for repeat equal operation
let lastOperand = null; // remember last operand for repeat equal operation
let exprFrozen = "";
const MAX_LEN = 12;

// Update the display and cut the string to MAX_LEN
function updateDisplay() {
  displayEl.textContent = buildBottomText();
  updateClearLabel();
  updateExpressionLine();
}
updateDisplay();
updateClearLabel();

// Check buttons click
buttonsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const txt = btn.textContent.trim(); // check buttons name and trim it
  const action = btn.dataset.action; // search buttons type (data-action)
  const op = btn.dataset.op; // search buttons type (data-op)

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

// ------- Input functions ------- //

function inputDigit(d) {
  if (waitingForSecond) {
    currentValue = d;
    waitingForSecond = false;
    exprFrozen = "";
    updateDisplay();
    return;
  }
  if (currentValue.length >= MAX_LEN) {
    return;
  }
  currentValue = currentValue === "0" ? d : currentValue + d; // if currentValue is 0, replace it by d, else add
  updateDisplay();
}

function inputDot() {
  if (currentValue.trim().endsWith("%")) return;

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

// ------- Handle functions ------- //

function handleDigit(d) {
  if (currentValue === "Error") return;

  if (currentValue.trim().endsWith("%")) {
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
    if (clearBtn && clearBtn.textContent === "C") {
      clearEntry();
    } else {
      clearAll();
    }
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
  const nextOp = mapOp(opAttr);
  if (!nextOp) return;
  setOperator(nextOp);
}

// function for AC button
function clearAll() {
  currentValue = "0";
  firstOperand = null;
  operator = null;
  waitingForSecond = false;
  lastOperator = null;
  lastOperand = null;
  exprFrozen = "";
  clearOpHighlight();
  updateDisplay();
}

function mapOp(opAttr) {
  switch (opAttr) {
    case "plus":
      return "add";
    case "minus":
      return "sub";
    case "multiply":
      return "mul";
    case "divide":
      return "div";
    default:
      return null;
  }
}

function opSymbol(op) {
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

function setOperator(nextOp) {
  if (operator && !waitingForSecond) {
    const a = firstOperand ?? 0;
    const b = Number(currentValue);
    logCompute("chain", a, operator, b);
    const result = compute(a, operator, b);
    if (!isFinite(result)) {
      currentValue = "Error";
      updateDisplay();
      firstOperand = null;
      operator = null;
      waitingForSecond = false;
      lastOperator = null;
      lastOperand = null;
      return;
    }
    currentValue = toDisplayString(result);
    updateDisplay();
    firstOperand = result;
  } else if (firstOperand === null) {
    firstOperand = Number(currentValue);
  }
  operator = nextOp;
  waitingForSecond = true;
  lastOperator = null;
  lastOperand = null;
  exprFrozen = "";
  highlightOperator(operator);
  updateDisplay();
}

function logCompute(where, a, op, b) {
  console.log(`[calc:${where}] a=`, a, "op=", op, "b=", b);
}

function compute(a, op, b) {
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

function doEquals() {
  if (!operator) {
    const trimmed = currentValue.trim();
    if (trimmed.endsWith("%")) {
      const n = Number(trimmed.replace("%", "").trim());
      const result = n / 100;
      if (!isFinite(result)) {
        currentValue = "Error";
        updateDisplay();
        firstOperand = null;
        operator = null;
        waitingForSecond = false;
        clearOpHighlight();
        return;
      }
      currentValue = toDisplayString(result);
      updateDisplay();
      firstOperand = result;
      waitingForSecond = true;
      clearOpHighlight();
      return;
    }

    if (lastOperator !== null && lastOperand !== null) {
      const a = Number(currentValue);
      const result = compute(a, lastOperator, lastOperand);
      if (!isFinite(result)) {
        currentValue = "Error";
        updateDisplay();
        firstOperand = null;
        operator = null;
        waitingForSecond = false;
        clearOpHighlight();
        return;
      }
      currentValue = toDisplayString(result);
      updateDisplay();
      firstOperand = result;
      waitingForSecond = true;
      clearOpHighlight();
      return;
    }

    return;
  }

  const a = firstOperand ?? 0;

  if (waitingForSecond) {
    return;
  }

  let b;
  if (currentValue.trim().endsWith("%")) {
    const n = Number(currentValue.replace("%", "").trim());
    const frac = n / 100;
    if (operator === "add" || operator === "sub") {
      b = a * frac;
    } else if (operator === "mul" || operator === "div") {
      b = frac;
    } else {
      b = 0;
    }
  } else {
    b = Number(currentValue);
  }

  const shownB = currentValue.trim().endsWith("%") ? currentValue : String(b);

  exprFrozen = `${formatExprPart(a)} ${opSymbol(operator)} ${formatExprPart(
    shownB
  )}`;

  logCompute("equals", a, operator, b);
  const result = compute(a, operator, b);

  if (!isFinite(result)) {
    currentValue = "Error";
    updateDisplay();
    firstOperand = null;
    operator = null;
    waitingForSecond = false;
    clearOpHighlight();
    return;
  }

  lastOperator = operator;
  lastOperand = b;

  currentValue = toDisplayString(result);
  firstOperand = result;
  operator = null;
  waitingForSecond = true;
  clearOpHighlight();
  updateDisplay();
}

function toggleSign() {
  if (currentValue === "0") return;

  if (currentValue.trim().endsWith("%")) {
    const core = currentValue.slice(0, -1).trim(); // "10" или "-10"
    const flipped = core.startsWith("-") ? core.slice(1) : "-" + core;
    currentValue = flipped + "%";
    updateDisplay();
    return;
  }

  currentValue = currentValue.startsWith("-")
    ? currentValue.slice(1)
    : "-" + currentValue;

  if (currentValue === "-0") currentValue = "0";
  updateDisplay();
}

function percent() {
  if (!currentValue.trim().endsWith("%")) {
    currentValue = currentValue.trim() + "%";
    updateDisplay();
  }
}

// Remove zeros from the end of the fractional part of a number
function trimTrailingZeros(str) {
  if (!str.includes(".")) return str;
  let [i, f] = str.split(".");
  if (!f) return i;
  f = f.replace(/0+$/, "");
  return f.length ? i + "." + f : i;
}

function toDisplayString(num) {
  let s = String(num);
  s = trimTrailingZeros(s);
  if (s.length > MAX_LEN) {
    if (s.includes(".")) {
      const [i, f = ""] = s.split(".");
      const free = Math.max(0, MAX_LEN - (i.length + 1));
      s = free > 0 ? i + "." + f.slice(0, free) : i.slice(0, MAX_LEN);
    } else {
      s = s.slice(0, MAX_LEN);
    }
  }
  return s;
}

function backspace() {
  if (waitingForSecond) {
    currentValue = "0";
    waitingForSecond = false;
    updateDisplay();
    return;
  }

  if (currentValue.endsWith("%")) {
    currentValue = currentValue.slice(0, -1);
    updateDisplay();
    return;
  }

  currentValue = currentValue.slice(0, -1);

  if (currentValue === "" || currentValue === "-") {
    currentValue = "0";
  }

  updateDisplay();
}

// Switch between "AC" and "C"
function updateClearLabel() {
  if (!clearBtn) return;
  const hasPercent = currentValue.trim().endsWith("%");
  const hasTyped = currentValue !== "0" || hasPercent;
  const showC = hasTyped;
  clearBtn.textContent = showC ? "C" : "AC";
}

// Clear current display
function clearEntry() {
  currentValue = "0";
  lastOperator = null;
  lastOperand = null;
  exprFrozen = "";
  updateDisplay();
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

function updateExpressionLine() {
  if (!exprEl) return;
  exprEl.textContent = exprFrozen || "";
}

function buildBottomText() {
  if (!operator) return currentValue;

  const aStr = formatExprPart(firstOperand ?? 0);
  const sym = opSymbol(operator);

  const hasSecond = !waitingForSecond;

  if (hasSecond) {
    return `${aStr} ${sym} ${formatExprPart(currentValue)}`;
  }
  return `${aStr} ${sym}`;
}

// Keyboard
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
}

function highlightOperator(op) {
  opButtons.forEach((btn) => {
    btn.classList.toggle(
      "active-op",
      btn.dataset.op && mapOp(btn.dataset.op) === op
    );
  });
}

function clearOpHighlight() {
  opButtons.forEach((btn) => btn.classList.remove("active-op"));
}

function setKeyTypographyFromSize() {
  const k = document.querySelector(".buttons > button");
  if (!k) return;
  const size = k.getBoundingClientRect().width;
  const r = document.documentElement.style;
  r.setProperty("--btnSize", `${size}px`);
  r.setProperty("--btnFontDigit", `${size * 0.48}px`);
  r.setProperty("--btnFontOp", `${size * 0.54}px`);
  r.setProperty("--btnFontFunc", `${size * 0.46}px`);
}
window.addEventListener("DOMContentLoaded", setKeyTypographyFromSize);
window.addEventListener("resize", setKeyTypographyFromSize);
