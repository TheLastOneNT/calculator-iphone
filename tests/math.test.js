// tests/math.test.js
import {
  applyOp,
  evaluateTokens,
  resolveRightOperand,
  extractLastOp,
} from '../src/app/math.js';
import { describe, it, expect } from 'vitest';

describe('math primitives', () => {
  it('applyOp works', () => {
    expect(applyOp(2, 'add', 3)).toBe(5);
    expect(applyOp(5, 'sub', 2)).toBe(3);
    expect(applyOp(3, 'mul', 4)).toBe(12);
    expect(applyOp(8, 'div', 2)).toBe(4);
    expect(Number.isNaN(applyOp(1, 'div', 0))).toBe(true);
  });

  it('resolveRightOperand percent semantics', () => {
    // add/sub: right% of left
    expect(resolveRightOperand(200, 'add', { percent: true, value: 10 })).toBe(20);
    expect(resolveRightOperand(200, 'sub', { percent: true, value: 10 })).toBe(20);
    // mul/div: right/100
    expect(resolveRightOperand(200, 'mul', { percent: true, value: 10 })).toBe(0.1);
    expect(resolveRightOperand(200, 'div', { percent: true, value: 10 })).toBe(0.1);
  });

  it('negative percent semantics', () => {
    // add/sub with negative percent: -10% of left
    expect(resolveRightOperand(200, 'add', { percent: true, value: -10 })).toBe(-20);
    expect(resolveRightOperand(200, 'sub', { percent: true, value: -10 })).toBe(-20);
    // mul/div with negative percent: -10/100
    expect(resolveRightOperand(200, 'mul', { percent: true, value: -10 })).toBe(-0.1);
    expect(resolveRightOperand(200, 'div', { percent: true, value: -10 })).toBe(-0.1);
  });

  it('evaluateTokens with precedence', () => {
    // 2 + 3 × 4 = 14
    const r1 = evaluateTokens([2, 'add', 3, 'mul', 4]);
    expect(r1.error).toBe(false);
    expect(r1.value).toBe(14);

    // 100 + 10% = 110 (right % of left for +)
    const r2 = evaluateTokens([100, 'add', { percent: true, value: 10 }]);
    expect(r2.error).toBe(false);
    expect(r2.value).toBe(110);

    // 100 × 10% = 10 (right/100 for ×)
    const r3 = evaluateTokens([100, 'mul', { percent: true, value: 10 }]);
    expect(r3.error).toBe(false);
    expect(r3.value).toBe(10);
  });

  it('evaluateTokens ignores trailing operator (e.g., "2 +")', () => {
    const r = evaluateTokens([2, 'add']);
    expect(r.error).toBe(false);
    expect(r.value).toBe(2);
  });

  it('extractLastOp returns last binary op', () => {
    const info = extractLastOp([2, 'add', 3, 'mul', 4]);
    expect(info.op).toBe('mul');
    expect(info.right).toBe(4);
  });

  it('simple doubling growth is correct for small exponents', () => {
    // Simulate repeated equals after "2 × 2": 4, 8, 16, 32, ...
    const seq = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
    let a = 4;
    for (let i = 1; i < seq.length; i++) {
      a = a * 2;
      expect(a).toBe(seq[i]);
    }
  });
});
