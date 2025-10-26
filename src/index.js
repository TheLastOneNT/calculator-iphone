// src/index.js — module entry: wire DOM events to controller handlers

import { onDigit, onAction, onOperator, onKey } from './app/controller.js';
import { buttonsEl, render } from './app/view.js';
import { state } from './app/model.js';

// Initial render (shows "0" and sets correct C/AC label)
render(state.currentValue);

// Keyboard support
document.addEventListener('keydown', onKey);

// ---------------------------------------------------------------------------
// Prevent pinch-zoom on iOS within the calculator (fast taps stay instant)
// ---------------------------------------------------------------------------

const calcRoot = document.querySelector('.calc');

if (calcRoot) {
  // Block pinch-zoom (multi-touch move) inside calculator area
  calcRoot.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
}

// Some iOS versions emit non-standard gesture events; prevent them globally
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

// ---------------------------------------------------------------------------
// Ultra-fast input: fire on pointerdown, ignore subsequent synthetic click
// ---------------------------------------------------------------------------

function handleButton(btn) {
  const { action, op } = btn.dataset;
  const txt = btn.textContent.trim();

  if (/^[0-9]$/.test(txt)) onDigit(txt);
  else if (action) onAction(action, txt);
  else if (op) onOperator(op);
}

// Immediate handling on pointerdown (touch/pen/mouse)
buttonsEl.addEventListener(
  'pointerdown',
  (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    handleButton(btn);
    // don't call preventDefault here — это убирает микрозадержки на iOS
  },
  { passive: true } // passive:true = ещё быстрее скролл/тачи обрабатываются движком
);

// Swallow the follow-up click to avoid double-trigger on some browsers
buttonsEl.addEventListener(
  'click',
  (e) => {
    const btn = e.target.closest('button');
    if (btn) e.preventDefault();
  },
  { passive: false }
);
