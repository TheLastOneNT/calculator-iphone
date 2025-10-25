// Numeric evaluation with operator precedence and iOS percent semantics

import { OP_MAP } from "./config.js";

export function applyOp(a, op, b) {
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
 * Resolve right operand that may be a {percent} node using iOS rules:
 * - add/sub: right% is left * (right/100)
 * - mul/div: right% is right/100
 */
export function resolveRightOperand(left, op, rightNode) {
  if (typeof rightNode === "number") return rightNode;
  if (rightNode && rightNode.percent) {
    const n = rightNode.value;
    if (op === "add" || op === "sub") return left * (n / 100);
    if (op === "mul" || op === "div") return n / 100;
    return n;
  }
  return 0;
}

export function evaluateTokens(seq) {
  // split into values & ops then fold with precedence
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
  // drop trailing operator
  if (ops.length === values.length) ops.pop();

  // pass 1: × ÷
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

  // pass 2: + −
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

/** Build top expression text from tokens (e.g., "12 × 5 + 10%"). */
export function buildExprForTop(tokens, formatExprPart) {
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (typeof t === "number") out += formatExprPart(t);
    else if (typeof t === "string") out += " " + OP_MAP[t] + " ";
    else if (t && t.percent) out += formatExprPart(String(t.value) + "%");
  }
  return out.trim();
}

/** Extract last binary op for "repeat equals". */
export function extractLastOp(seq) {
  let lastOpIndex = -1;
  for (let i = seq.length - 2; i >= 1; i--) {
    if (typeof seq[i] === "string") {
      lastOpIndex = i;
      break;
    }
  }
  if (lastOpIndex === -1) return null;
  return {
    leftIndex: lastOpIndex - 1,
    op: seq[lastOpIndex],
    rightIndex: lastOpIndex + 1,
  };
}
