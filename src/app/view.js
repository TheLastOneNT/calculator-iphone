// view.js — DOM bindings + scaling layer; no business logic inside

import { renderDisplay } from './format.js';
import { state } from './model.js';
import { MIN_SCALE, OP_FROM_ATTR } from './config.js';

const exprEl = document.querySelector('.expr');
const displayEl = document.querySelector('.display');
const buttonsEl = document.querySelector('.buttons');
const clearBtn = document.querySelector('button[data-action="clear"]');
const opButtons = Array.from(document.querySelectorAll('[data-op]'));

let fitSpan = null; // bottom display scaler layer
let fitTopSpan = null; // top expression scaler layer

// Inject absolute .fit layer so scaling never triggers reflow (bottom).
(function initDisplayLayer() {
  fitSpan = document.createElement('span');
  fitSpan.className = 'fit';
  while (displayEl.firstChild) fitSpan.appendChild(displayEl.firstChild);
  displayEl.appendChild(fitSpan);
})();

// Inject absolute .fit-top layer for top expression (prevents layout growth).
(function initTopExprLayer() {
  fitTopSpan = document.createElement('span');
  fitTopSpan.className = 'fit-top';
  while (exprEl.firstChild) fitTopSpan.appendChild(exprEl.firstChild);
  exprEl.appendChild(fitTopSpan);
})();

export function render(bottomText) {
  // Bottom line
  fitSpan.textContent = renderDisplay(bottomText, {
    showingResult: state.showingResult,
  });

  // Top line (already compact; no spaces around operators)
  fitTopSpan.textContent = state.exprFrozen || '';

  // "C" vs "AC" label (derived only from state)
  const hasPercent =
    typeof state.currentValue === 'string' && state.currentValue.trim().endsWith('%');
  const hasTyped =
    state.currentValue !== '0' || hasPercent || /[.]/.test(state.currentValue);
  if (clearBtn) clearBtn.textContent = hasTyped ? 'C' : 'AC';

  fitDisplayText();
  fitTopText();
}

// ------- scaling functions ---------------------------------------------------

function fitDisplayText() {
  if (!fitSpan) return;
  fitSpan.style.transform = 'scale(1)';
  const cw = displayEl.clientWidth;
  const sw = fitSpan.scrollWidth;
  if (sw <= 0 || cw <= 0) return;
  let scale = cw / sw;
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  if (scale > 1) scale = 1; // never upscale
  if (scale < MIN_SCALE) scale = MIN_SCALE;
  fitSpan.style.transform = `scale(${scale})`;
}

function fitTopText() {
  if (!fitTopSpan) return;
  fitTopSpan.style.transform = 'scale(1)';
  const cw = exprEl.clientWidth;
  const sw = fitTopSpan.scrollWidth;
  if (sw <= 0 || cw <= 0) return;
  let scale = cw / sw;
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  if (scale > 1) scale = 1; // never upscale
  if (scale < MIN_SCALE) scale = MIN_SCALE;
  fitTopSpan.style.transform = `scale(${scale})`;
}

// ------- operator highlight --------------------------------------------------

export function highlightOperator(op /* 'add' | 'sub' | 'mul' | 'div' */) {
  opButtons.forEach((btn) => {
    const internal = OP_FROM_ATTR[btn.dataset.op]; // plus→add, …
    btn.classList.toggle('active-op', internal === op);
  });
}

export function clearOpHighlight() {
  opButtons.forEach((btn) => btn.classList.remove('active-op'));
}

// ------- react to size changes ----------------------------------------------

// Throttled resize refit (fallback for older browsers)
let rafId = null;
function scheduleRefit() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    fitDisplayText();
    fitTopText();
    rafId = null;
  });
}
window.addEventListener('resize', scheduleRefit);

// Precise refit when any observed element changes size
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(scheduleRefit);
  // Observe both text containers and their parents (covers orientation + safe area changes)
  ro.observe(displayEl);
  ro.observe(exprEl);
  if (displayEl.parentElement) ro.observe(displayEl.parentElement);
  if (exprEl.parentElement) ro.observe(exprEl.parentElement);
}

// Expose root elements for controller to bind
export { buttonsEl };
