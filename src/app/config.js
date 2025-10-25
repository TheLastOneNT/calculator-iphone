// Shared constants & operator maps

export const MAX_LEN = 13; // iOS-like output cap
export const UNDEF = "Undefined"; // divide-by-zero / invalid result

export const SELECTORS = {
  expr: ".expr",
  display: ".display",
  buttons: ".buttons",
  clearBtn: 'button[data-action="clear"]',
  opButtons: "[data-op]",
};

export const OP_MAP = { add: "+", sub: "−", mul: "×", div: "÷" };
export const OP_FROM_ATTR = {
  plus: "add",
  minus: "sub",
  multiply: "mul",
  divide: "div",
};
