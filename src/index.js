// src/index.js — module entry: wire DOM events to controller handlers

import { onDigit, onAction, onOperator, onKey } from './app/controller.js';
import { buttonsEl, render } from './app/view.js';
import { state } from './app/model.js';

// Initial render (shows "0" and sets correct C/AC label)
render(state.currentValue);

// Keyboard support
document.addEventListener('keydown', onKey);

// Delegate clicks on calculator buttons
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
