// config.js — centralized constants & operator maps

// ---- limits & display ------------------------------------------------------

export const MAX_LEN = 13;
export const UNDEF = 'Undefined';
export const MIN_SCALE = 0.5;

// ---- operator symbols ------------------------------------------------------

export const OP_MAP = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
};

// mapping from HTML data attributes to internal operation codes
export const OP_FROM_ATTR = {
  plus: 'add',
  minus: 'sub',
  multiply: 'mul',
  divide: 'div',
};
