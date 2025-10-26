// math.js — pure arithmetic & token evaluation with iOS percent semantics

// ---- small type guards -----------------------------------------------------

/** True when token is a "value node": number or { percent: true, value: number }. */
function isValueNode(t) {
  return typeof t === 'number' || (t && typeof t === 'object' && t.percent);
}

/** Convert a value node to a plain number using iOS percent rules for add/sub seed. */
function asNumberValue(node) {
  return typeof node === 'number' ? node : resolveRightOperand(0, 'add', node);
}

// ---- primitive ops ---------------------------------------------------------

export function applyOp(a, op, b) {
  switch (op) {
    case 'add':
      return a + b;
    case 'sub':
      return a - b;
    case 'mul':
      return a * b;
    case 'div':
      return b === 0 ? NaN : a / b;
    default:
      // Unknown operator: pass-through right (keeps existing behavior)
      return b;
  }
}

/**
 * Resolve a right operand that might be a percent node, using iOS rules:
 *  - For add/sub: right% is (left * right/100)
 *  - For mul/div: right% is (right/100)
 */
export function resolveRightOperand(left, op, rightNode) {
  if (typeof rightNode === 'number') return rightNode;
  if (rightNode && rightNode.percent) {
    const n = rightNode.value;
    if (op === 'add' || op === 'sub') return left * (n / 100);
    if (op === 'mul' || op === 'div') return n / 100;
    return n; // fallback (should not happen with known ops)
  }
  return 0; // non-value/null — keep prior behavior
}

// ---- evaluator -------------------------------------------------------------

/**
 * Evaluate a token sequence like: [number, 'add'|'mul'..., number|percent, ...]
 * - Ignores a trailing operator if present (e.g., "A +")
 * - Honors operator precedence: pass1 ×/÷, pass2 +/−
 * - Returns { error: true } for non-finite intermediate results (e.g., division by 0)
 */
export function evaluateTokens(seq) {
  const values = [];
  const ops = [];
  let expectNumber = true;

  // 1) Tokenize (skip anything that breaks the expected pattern)
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    if (expectNumber) {
      if (isValueNode(t)) {
        values.push(t);
        expectNumber = false;
      }
      // else: ignore unexpected token while expecting a number
    } else if (typeof t === 'string') {
      ops.push(t);
      expectNumber = true;
    }
    // else: ignore stray values when an operator was expected
  }

  // If there is a dangling operator at the end, drop it.
  if (ops.length === values.length) ops.pop();

  // 2) Pass 1: resolve all × / ÷ left-to-right
  for (let i = 0; i < ops.length; ) {
    const op = ops[i];
    if (op === 'mul' || op === 'div') {
      const leftVal = asNumberValue(values[i]);
      const rightVal = resolveRightOperand(leftVal, op, values[i + 1]);
      const raw = applyOp(leftVal, op, rightVal);
      if (!Number.isFinite(raw)) return { error: true };
      values.splice(i, 2, raw);
      ops.splice(i, 1);
      // do not advance i — there may be another mul/div at same index
    } else {
      i++;
    }
  }

  // 3) Pass 2: resolve remaining + / − left-to-right
  while (ops.length) {
    const op = ops.shift();
    const leftVal = asNumberValue(values[0]);
    const rightVal = resolveRightOperand(leftVal, op, values[1]);
    const raw = applyOp(leftVal, op, rightVal);
    if (!Number.isFinite(raw)) return { error: true };
    values.splice(0, 2, raw);
  }

  // 4) Final number
  const final = asNumberValue(values[0]);
  return { error: false, value: final };
}

/**
 * Extract last binary operation and its resolved right operand.
 * Used for "repeat equals" behavior.
 * Example: [A, 'mul', B, 'add', C%]  -> returns { op: 'add', right: resolved(C%) }
 */
export function extractLastOp(seq) {
  let lastOpIndex = -1;

  // find last operator that has both sides
  for (let i = seq.length - 2; i >= 1; i--) {
    if (typeof seq[i] === 'string') {
      lastOpIndex = i;
      break;
    }
  }
  if (lastOpIndex === -1) return null;

  const leftNode = seq[lastOpIndex - 1];
  const op = seq[lastOpIndex];
  const leftVal = asNumberValue(leftNode);
  const rightVal = resolveRightOperand(leftVal, op, seq[lastOpIndex + 1]);

  return { op, right: rightVal };
}
