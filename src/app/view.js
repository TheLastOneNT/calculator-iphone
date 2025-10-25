// View layer: DOM refs, rendering, scaling, highlighting

import { SELECTORS } from "./config.js";

export function createView() {
  const exprEl = document.querySelector(SELECTORS.expr);
  const displayEl = document.querySelector(SELECTORS.display);
  const buttonsEl = document.querySelector(SELECTORS.buttons);
  const clearBtn = document.querySelector(SELECTORS.clearBtn);
  const opButtons = Array.from(document.querySelectorAll(SELECTORS.opButtons));

  if (!displayEl || !buttonsEl) {
    throw new Error("Missing .display or .buttons in DOM");
  }

  // scaling layer inside .display
  let fitSpan = null;

  function mount() {
    fitSpan = document.createElement("span");
    fitSpan.className = "fit";
    while (displayEl.firstChild) fitSpan.appendChild(displayEl.firstChild);
    displayEl.appendChild(fitSpan);
  }

  function setDisplayText(text) {
    if (fitSpan) fitSpan.textContent = text;
    else displayEl.textContent = text;
  }

  function setExprText(text) {
    if (exprEl) exprEl.textContent = text || "";
  }

  function setClearLabel(text) {
    if (clearBtn) clearBtn.textContent = text;
  }

  function highlightOperator(op) {
    opButtons.forEach((btn) => {
      const isActive = btn.dataset.op && mapAttrToOp(btn.dataset.op) === op;
      btn.classList.toggle("active-op", !!isActive);
    });
  }

  function clearOpHighlight() {
    opButtons.forEach((btn) => btn.classList.remove("active-op"));
  }

  function fitDisplayText() {
    if (!fitSpan) return;
    fitSpan.style.transform = "scale(1)";
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

  function render({ displayText, exprText, clearText, operator, waiting }) {
    setDisplayText(displayText);
    setExprText(exprText);
    setClearLabel(clearText);

    if (operator && waiting) highlightOperator(operator);
    else clearOpHighlight();

    fitDisplayText();
  }

  function mapAttrToOp(attr) {
    switch (attr) {
      case "plus":
        return "add";
      case "minus":
        return "sub";
      case "multiply":
        return "mul";
      case "divide":
        return "div";
      default:
        return null;
    }
  }

  function onResize(handler) {
    let rafId = null;
    const r = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        fitDisplayText();
        if (typeof handler === "function") handler();
        rafId = null;
      });
    };
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }

  return {
    mount,
    render,
    fitDisplayText,
    elements: { buttonsEl, clearBtn },
    utils: { mapAttrToOp },
    onResize,
  };
}
