import "./app.css";

import { mountCompiledModule } from "@jue/web";

import {
  blueprint,
  createRuntime,
  initialSignalValues,
  signalCount,
  signalSlots
} from "./generated/app.generated";

mountInto("#app-a");
mountInto("#app-b");

function mountInto(selector: string) {
  const root = document.querySelector(selector);
  if (!root) {
    throw new Error(`Missing mount root for ${selector}.`);
  }

  const runtime = createRuntime();
  const mounted = mountCompiledModule({
    root,
    blueprint,
    signalCount,
    initialSignalValues,
    signalSlots,
    configureSignalRuntime: runtime.configureSignalRuntime,
    handlers: runtime.handlers
  });

  if (!mounted.ok) {
    throw new Error(`${selector}: ${mounted.error.code} ${mounted.error.message}`);
  }
}
