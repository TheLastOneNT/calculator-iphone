// App entry: wires controller and view

import { createController } from './app/controller.js';
import * as view from './app/view.js';

const controller = createController();
view.init(controller);
