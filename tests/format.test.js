// tests/format.test.js
import { trimTrailingZeros, toDisplayString, renderDisplay } from '../src/app/format.js';
import { describe, it, expect } from 'vitest';

const cfg = { MAX_LEN: 13, UNDEF: 'Undefined' };

describe('format helpers', () => {
  it('trimTrailingZeros removes unnecessary zeros and dots', () => {
    expect(trimTrailingZeros('1.2300')).toBe('1.23');
    expect(trimTrailingZeros('10.')).toBe('10');
    expect(trimTrailingZeros('5')).toBe('5');
  });

  it('toDisplayString returns properly formatted number', () => {
    expect(toDisplayString(1.23, cfg)).toBe('1.23');
  });

  it('renderDisplay wraps negatives in parentheses', () => {
    expect(renderDisplay('-5', cfg, false)).toBe('(-5)');
  });

  it('renderDisplay formats negative percent as (-10%)', () => {
    expect(renderDisplay('-10%', cfg, false)).toBe('(-10%)');
  });
});
