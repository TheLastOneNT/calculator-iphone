// src/index.js — module entry: wire DOM events to controller handlers

import { onDigit, onAction, onOperator, onKey } from './app/controller.js';
import { buttonsEl, render } from './app/view.js';
import { state } from './app/model.js';

// Initial render (shows "0" and sets correct C/AC label)
render(state.currentValue);

// Keyboard support
document.addEventListener('keydown', onKey);

// ---------------------------------------------------------------------------
// Prevent pinch-zoom on iOS within the calculator, but DO NOT block fast taps
// ---------------------------------------------------------------------------

const calcRoot = document.querySelector('.calc');

// Block pinch-zoom (multi-touch move) inside calculator area
if (calcRoot) {
  calcRoot.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

// (Optional safety for older iOS gesture events)
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

// ---------------------------------------------------------------------------
// Immediate input on pointerdown (no 300ms feel); swallow the subsequent click
// ---------------------------------------------------------------------------

let suppressClicksUntil = 0;

function handleButton(btn) {
  const { action, op } = btn.dataset;
  const txt = btn.textContent.trim();

  if (/^[0-9]$/.test(txt)) {
    onDigit(txt);
  } else if (action) {
    onAction(action, txt);
  } else if (op) {
    onOperator(op);
  }
}

// Fire immediately on pointerdown (touch/pen/mouse)
buttonsEl.addEventListener(
  'pointerdown',
  (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // immediately handle the input
    handleButton(btn);

    // prevent text selection / native gestures, and mark to suppress the next click
    e.preventDefault();
    suppressClicksUntil = performance.now() + 80; // small window to swallow the synthetic click
  },
  { passive: false }
);

// Fallback: clicks (keyboard/mouse) — ignored if we just handled pointerdown
buttonsEl.addEventListener('click', (e) => {
  if (performance.now() < suppressClicksUntil) return; // swallow the synthetic click after pointerdown

  const btn = e.target.closest('button');
  if (!btn) return;
  handleButton(btn);
});

// ---------------------------------------------------------------------------
// (existing) Keyboard mapping stays above
// ---------------------------------------------------------------------------
