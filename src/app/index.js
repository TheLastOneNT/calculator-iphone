// Orchestrates model/view/controller wiring for the Calculator app.
import { createModel } from "./model.js";
import { createView } from "./view.js";
import { createController } from "./controller.js";
import { cfg } from "./config.js";

export function start() {
  // Mount view (reads DOM, prepares scaling layer).
  const view = createView({
    exprSelector: ".expr",
    displaySelector: ".display",
    buttonsSelector: ".buttons",
    clearSelector: 'button[data-action="clear"]',
    opButtonsSelector: "[data-op]",
    minScale: cfg.MIN_SCALE,
  });

  // Create model (pure state + helpers).
  const model = createModel(cfg);

  // Glue it together.
  const controller = createController({ model, view, cfg });

  // Bind UI events to controller handlers.
  view.bindUI({
    onDigit: controller.onDigit,
    onAction: controller.onAction,
    onOperator: controller.onOperator,
    onKey: controller.onKey,
  });

  // Initial render.
  view.update(model, controller.buildBottomText());
}
