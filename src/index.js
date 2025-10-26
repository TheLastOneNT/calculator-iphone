// src/index.js — module entry: wire DOM events to controller handlers.

import { onDigit, onAction, onOperator, onKey } from './app/controller.js';
import { buttonsEl, render } from './app/view.js';
import { state } from './app/model.js';

// Initial paint (shows "0" and sets correct C/AC label)
render(state.currentValue);

// Keyboard
document.addEventListener('keydown', onKey);

// Click delegation on keypad
buttonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const txt = btn.textContent.trim();
  const action = btn.dataset.action;
  const op = btn.dataset.op;

  if (/^[0-9]$/.test(txt)) {
    onDigit(txt);
    return;
  }
  if (action) {
    onAction(action, txt);
    return;
  }
  if (op) {
    onOperator(op);
    return;
  }
});
