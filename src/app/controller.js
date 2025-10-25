// Controller: maps user input (clicks/keys) to model actions, then asks view to render

import { OP_FROM_ATTR } from "./config.js";

export function createController({ model, view }) {
  function init() {
    view.mount();
    renderNow();

    // buttons
    view.elements.buttonsEl.addEventListener("click", onButtonClick);

    // keyboard
    document.addEventListener("keydown", onKey);

    // fit on resize / orientation
    view.onResize(() => {});
  }

  function renderNow() {
    view.render({
      displayText: model.getRenderedDisplayText(),
      exprText: model.getExprFrozen(),
      clearText: model.getClearLabel(),
      operator: model.getOperator(),
      waiting: model.isWaiting(),
    });
  }

  function onButtonClick(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const txt = btn.textContent.trim();
    const action = btn.dataset.action;
    const opAttr = btn.dataset.op;

    if (/^[0-9]$/.test(txt)) {
      model.handleDigit(txt);
      return renderNow();
    }
    if (action) {
      model.handleAction(action, txt);
      return renderNow();
    }
    if (opAttr) {
      model.handleOperator(opAttr);
      return renderNow();
    }
  }

  function onKey(e) {
    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      model.handleDigit(k);
      return renderNow();
    }
    if (k === "." || k === ",") {
      model.handleAction("dot", ".");
      e.preventDefault();
      return renderNow();
    }
    if (k === "Enter" || k === "=") {
      model.handleAction("equal");
      e.preventDefault();
      return renderNow();
    }
    if (k === "Backspace") {
      model.handleAction("backspace");
      e.preventDefault();
      return renderNow();
    }
    if (k === "Escape") {
      model.handleAction("clear");
      e.preventDefault();
      return renderNow();
    }
    if (k === "+") {
      model.handleOperator("plus");
      e.preventDefault();
      return renderNow();
    }
    if (k === "-") {
      model.handleOperator("minus");
      e.preventDefault();
      return renderNow();
    }
    if (k === "*") {
      model.handleOperator("multiply");
      e.preventDefault();
      return renderNow();
    }
    if (k === "/") {
      model.handleOperator("divide");
      e.preventDefault();
      return renderNow();
    }
    if (k === "%") {
      model.handleAction("percent", "%");
      e.preventDefault();
      return renderNow();
    }
  }

  return { init };
}
