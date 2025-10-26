// src/index.js — module entry: wire DOM events to controller handlers

import { onDigit, onAction, onOperator, onKey } from './app/controller.js';
import { buttonsEl, render } from './app/view.js';
import { state } from './app/model.js';

// Initial render (shows "0" and sets correct C/AC label)
render(state.currentValue);

// Keyboard support
document.addEventListener('keydown', onKey);

// ---------------------------------------------------------------------------
// Prevent pinch/double-tap zoom on iOS while keeping taps instant
// ---------------------------------------------------------------------------

const calcRoot = document.querySelector('.calc');

// Block pinch-zoom (multi-touch move) inside the calculator area
if (calcRoot) {
  calcRoot.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
}

// Some iOS/Safari versions emit non-standard gesture events — prevent them
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

// ---------------------------------------------------------------------------
// Ultra-fast input: fire on pointerdown, then swallow the synthetic click
// ---------------------------------------------------------------------------

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

// Immediate handling on pointerdown (touch/pen/mouse)
if (buttonsEl) {
  buttonsEl.addEventListener(
    'pointerdown',
    (e) => {
      // Ignore non-primary pointers (e.g., multi-touch second finger, right/middle mouse)
      if (e.isPrimary === false) return;
      if (e.button != null && e.button !== 0) return;

      const btn = e.target.closest('button');
      if (!btn) return;

      handleButton(btn);
      // Do NOT preventDefault here — keeps taps snappy on iOS
    },
    // passive:true lets the browser optimize touch handling paths
    { passive: true }
  );

  // Swallow the follow-up click to avoid double-trigger on some browsers
  buttonsEl.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.preventDefault();
    },
    { passive: false }
  );
}
