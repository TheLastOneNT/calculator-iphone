// View layer: DOM refs, rendering, event binding, fit-to-width scaling

import { isPercentText, formatExprPart } from './format.js';
import { MAX_LEN } from './config.js';

const exprEl = document.querySelector('.expr');
const displayEl = document.querySelector('.display');
const buttonsEl = document.querySelector('.buttons');
const clearBtn = document.querySelector('button[data-action="clear"]');
const opButtons = Array.from(document.querySelectorAll('[data-op]'));

let fitSpan = null;

export function init(controller) {
  if (!displayEl || !buttonsEl) {
    throw new Error('Missing .display or .buttons in DOM');
  }

  // Inject absolute .fit layer so scaling does not affect layout.
  fitSpan = document.createElement('span');
  fitSpan.className = 'fit';
  while (displayEl.firstChild) fitSpan.appendChild(displayEl.firstChild);
  displayEl.appendChild(fitSpan);

  // Buttons
  buttonsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const txt = btn.textContent.trim();
    const action = btn.dataset.action;
    const op = btn.dataset.op;

    if (/^[0-9]$/.test(txt)) return controller.onDigit(txt);
    if (action) return controller.onAction(action, txt);
    if (op) return controller.onOperator(op);
  });

  // Keyboard
  document.addEventListener('keydown', controller.onKey);

  // First paint
  controller._rerender();
}

export function update(model, bottomText) {
  // Expression (top)
  if (exprEl) exprEl.textContent = model.state.exprFrozen || '';

  // Clear button label
  if (clearBtn) {
    const cv = model.state.currentValue;
    const hasPercent = isPercentText(cv);
    const hasTyped = cv !== '0' || hasPercent || /[.]/.test(cv);
    clearBtn.textContent = hasTyped ? 'C' : 'AC';
  }

  // Bottom display (fit into width)
  if (fitSpan) fitSpan.textContent = bottomText;
  else displayEl.textContent = bottomText;

  fitDisplayText();
}

export function highlightOperator(currentOp, OP_FROM_ATTR) {
  opButtons.forEach((btn) => {
    const isActive = btn.dataset.op && OP_FROM_ATTR[btn.dataset.op] === currentOp;
    btn.classList.toggle('active-op', isActive);
  });
}

export function clearOpHighlight() {
  opButtons.forEach((btn) => btn.classList.remove('active-op'));
}

function fitDisplayText() {
  if (!fitSpan) return;
  fitSpan.style.transform = 'scale(1)';
  const cw = displayEl.clientWidth;
  const sw = fitSpan.scrollWidth;
  if (sw <= 0 || cw <= 0) return;
  let scale = cw / sw;
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  if (scale > 1) scale = 1;
  const MIN_SCALE = 0.5;
  if (scale < MIN_SCALE) scale = MIN_SCALE;
  fitSpan.style.transform = `scale(${scale})`;
}

// helper export used by controller for formatting the top line
export { formatExprPart };
