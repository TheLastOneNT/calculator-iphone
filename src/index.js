// src/index.js — module entry: wire DOM events to controller handlers

import { onDigit, onAction, onOperator, onKey } from './app/controller.js';
import { buttonsEl, render } from './app/view.js';
import { state } from './app/model.js';

// Initial render (shows "0" and sets correct C/AC label)
render(state.currentValue);

// Keyboard support
document.addEventListener('keydown', onKey);

// ---------------------------------------------------------------------------
// Prevent accidental zoom on iOS (double-tap / pinch) within the calculator
// ---------------------------------------------------------------------------

const calcRoot = document.querySelector('.calc');

// Block double-tap zoom (second tap within ~300ms)
let lastTouchEnd = 0;
if (calcRoot) {
  calcRoot.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault(); // cancel the zoom
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // Block pinch-zoom (multi-touch move) inside calculator area
  calcRoot.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Safety: prevent dblclick-based zoom (not always fired on iOS, but harmless)
  calcRoot.addEventListener(
    'dblclick',
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
}

// Some iOS versions emit non-standard gesture events; prevent them globally
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

// ---------------------------------------------------------------------------
// Delegate clicks on calculator buttons
// ---------------------------------------------------------------------------

buttonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const { action, op } = btn.dataset;
  const txt = btn.textContent.trim();

  if (/^[0-9]$/.test(txt)) {
    onDigit(txt);
  } else if (action) {
    onAction(action, txt);
  } else if (op) {
    onOperator(op);
  }
});
