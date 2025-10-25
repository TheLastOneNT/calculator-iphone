// Centralized configuration and operator maps.

export const cfg = {
  MAX_LEN: 13, // iOS-like display length cap
  UNDEF: "Undefined", // shown for invalid operations
  MIN_SCALE: 0.5, // lower bound for display text scale
  OP_MAP: { add: "+", sub: "−", mul: "×", div: "÷" },
  OP_FROM_ATTR: {
    plus: "add",
    minus: "sub",
    multiply: "mul",
    divide: "div",
  },
};
