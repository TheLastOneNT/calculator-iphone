import { trimTrailingZeros, toDisplayString, renderDisplay } from '../src/app/format.js';
import { describe, it, expect } from 'vitest';

const cfg = { MAX_LEN: 13, UNDEF: 'Undefined' };

describe('format helpers', () => {
  it('trimTrailingZeros', () => {
    expect(trimTrailingZeros('1.2300')).toBe('1.23');
    expect(trimTrailingZeros('10.')).toBe('10');
    expect(trimTrailingZeros('5')).toBe('5');
  });

  it('toDisplayString fits into MAX_LEN', () => {
    expect(toDisplayString(1.23, cfg)).toBe('1.23');
    expect(renderDisplay('-5', cfg, false)).toBe('(-5)');
  });

  it('renderDisplay percent negative as (-10%)', () => {
    expect(renderDisplay('-10%', cfg, false)).toBe('(-10%)');
  });
});
