// Math engine: operator application, % resolution, precedence evaluation

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
      return b;
  }
}

/** Resolve right operand that may be a percent node, iOS rules. */
export function resolveRightOperand(left, op, rightNode) {
  if (typeof rightNode === 'number') return rightNode;
  if (rightNode && rightNode.percent) {
    const n = rightNode.value;
    if (op === 'add' || op === 'sub') return left * (n / 100);
    if (op === 'mul' || op === 'div') return n / 100;
    return n;
  }
  return 0;
}

export function evaluateTokens(seq) {
  const values = [];
  const ops = [];
  let expectNumber = true;

  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    if (expectNumber) {
      if (typeof t === 'number' || (t && typeof t === 'object' && t.percent)) {
        values.push(t);
        expectNumber = false;
      }
    } else if (typeof t === 'string') {
      ops.push(t);
      expectNumber = true;
    }
  }
  if (ops.length === values.length) ops.pop();

  // pass 1: × ÷
  for (let i = 0; i < ops.length; ) {
    const op = ops[i];
    if (op === 'mul' || op === 'div') {
      const leftVal =
        typeof values[i] === 'number'
          ? values[i]
          : resolveRightOperand(0, 'add', values[i]);
      const rightVal = resolveRightOperand(leftVal, op, values[i + 1]);
      const raw = applyOp(leftVal, op, rightVal);
      if (!Number.isFinite(raw)) return { error: true };
      values.splice(i, 2, raw);
      ops.splice(i, 1);
    } else i++;
  }

  // pass 2: + −
  while (ops.length) {
    const op = ops.shift();
    const leftVal =
      typeof values[0] === 'number'
        ? values[0]
        : resolveRightOperand(0, 'add', values[0]);
    const rightVal = resolveRightOperand(leftVal, op, values[1]);
    const raw = applyOp(leftVal, op, rightVal);
    if (!Number.isFinite(raw)) return { error: true };
    values.splice(0, 2, raw);
  }

  const final =
    typeof values[0] === 'number' ? values[0] : resolveRightOperand(0, 'add', values[0]);
  return { error: false, value: final };
}
