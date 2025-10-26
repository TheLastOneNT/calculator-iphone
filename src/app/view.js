// View layer: DOM refs, rendering, scaling, and event binding.

import { renderDisplay } from './format.js';

export function createView({
  exprSelector,
  displaySelector,
  buttonsSelector,
  clearSelector,
  opButtonsSelector,
  minScale = 0.5,
}) {
  // --- DOM
  const exprEl = document.querySelector(exprSelector);
  const displayEl = document.querySelector(displaySelector);
  const buttonsEl = document.querySelector(buttonsSelector);
  const clearBtn = document.querySelector(clearSelector);
  const opButtons = Array.from(document.querySelectorAll(opButtonsSelector));

  if (!displayEl || !buttonsEl) {
    throw new Error('Missing .display or .buttons in DOM');
  }

  // Create scalable layer inside the result display so layout never shifts.
  let fitSpan = document.createElement('span');
  fitSpan.className = 'fit';
  while (displayEl.firstChild) fitSpan.appendChild(displayEl.firstChild);
  displayEl.appendChild(fitSpan);

  // --- Rendering helpers
  function fitDisplayText() {
    if (!fitSpan) return;
    fitSpan.style.transform = 'scale(1)';

    const cw = displayEl.clientWidth;
    const sw = fitSpan.scrollWidth;
    if (sw <= 0 || cw <= 0) return;

    let scale = cw / sw;
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    if (scale > 1) scale = 1;
    if (scale < minScale) scale = minScale;

    fitSpan.style.transform = `scale(${scale})`;
  }

  function updateClearLabel(currentValue, isPercentText) {
    if (!clearBtn) return;
    const hasPercent = isPercentText(currentValue);
    const hasTyped = currentValue !== '0' || hasPercent || /[.]/.test(currentValue);
    clearBtn.textContent = hasTyped ? 'C' : 'AC';
  }

  function updateExpressionLine(exprFrozen) {
    if (exprEl) exprEl.textContent = exprFrozen || '';
  }

  function highlightOperator(op, OP_FROM_ATTR) {
    opButtons.forEach((btn) => {
      btn.classList.toggle(
        'active-op',
        btn.dataset.op && OP_FROM_ATTR[btn.dataset.op] === op
      );
    });
  }

  function clearOpHighlight() {
    opButtons.forEach((btn) => btn.classList.remove('active-op'));
  }

  // Public render: consumes model and prepared bottom text
  function update(model, bottomText) {
    const { cfg, state } = model;
    const txt = renderDisplay(bottomText, cfg, state.showingResult);
    fitSpan.textContent = txt;

    updateClearLabel(state.currentValue, model.isPercentText || (() => false));
    updateExpressionLine(state.exprFrozen);
    fitDisplayText();
  }

  // --- Event binding (delegation + keyboard)
  function bindUI({ onDigit, onAction, onOperator, onKey }) {
    // Buttons
    buttonsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const txt = btn.textContent.trim();
      const action = btn.dataset.action;
      const op = btn.dataset.op;

      if (/^[0-9]$/.test(txt)) return onDigit(txt);
      if (action) return onAction(action, txt);
      if (op) return onOperator(op);
    });

    // Keyboard
    document.addEventListener('keydown', (e) => onKey(e));
  }

  return {
    update,
    bindUI,
    fitDisplayText,
    highlightOperator,
    clearOpHighlight,
  };
}
