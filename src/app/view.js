// view.js — DOM bindings + scaling layer; no business logic inside

import { renderDisplay } from './format.js';
import { state } from './model.js';
import { MIN_SCALE, OP_FROM_ATTR } from './config.js';

const exprEl = document.querySelector('.expr');
const displayEl = document.querySelector('.display');
const buttonsEl = document.querySelector('.buttons');
const clearBtn = document.querySelector('button[data-action="clear"]');
const opButtons = Array.from(document.querySelectorAll('[data-op]'));

let fitSpan = null;

// Inject absolute .fit layer so text scaling never triggers reflow.
(function initDisplayLayer() {
  fitSpan = document.createElement('span');
  fitSpan.className = 'fit';
  while (displayEl.firstChild) fitSpan.appendChild(displayEl.firstChild);
  displayEl.appendChild(fitSpan);
})();

export function render(bottomText) {
  // bottom line
  fitSpan.textContent = renderDisplay(bottomText, {
    showingResult: state.showingResult,
  });

  // top line
  exprEl.textContent = state.exprFrozen || '';

  // "C" vs "AC" label, directly from state
  const hasPercent =
    typeof state.currentValue === 'string' && state.currentValue.trim().endsWith('%');
  const hasTyped =
    state.currentValue !== '0' || hasPercent || /[.]/.test(state.currentValue);
  if (clearBtn) clearBtn.textContent = hasTyped ? 'C' : 'AC';

  fitDisplayText();
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
  if (scale < MIN_SCALE) scale = MIN_SCALE;
  fitSpan.style.transform = `scale(${scale})`;
}

export function highlightOperator(op /* "add" | "sub" | "mul" | "div" */) {
  opButtons.forEach((btn) => {
    const internal = OP_FROM_ATTR[btn.dataset.op]; // plus→add, …
    btn.classList.toggle('active-op', internal === op);
  });
}

export function clearOpHighlight() {
  opButtons.forEach((btn) => btn.classList.remove('active-op'));
}

// Refit on resize/orientation changes
let rafId = null;
window.addEventListener('resize', () => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    fitDisplayText();
    rafId = null;
  });
});

// Expose root elements for controller to bind
export { buttonsEl };
