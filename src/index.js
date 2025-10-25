// Entry point: wires controller to the DOM
import { createController } from "./app/controller.js";
import { createModel } from "./app/model.js";
import { createView } from "./app/view.js";

const controller = createController({
  model: createModel(),
  view: createView(),
});

controller.init();
