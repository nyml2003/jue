import "../../src/demo.css";

import { mountCompiledModule } from "@jue/web";

import {
  blueprint,
  createRuntime,
  initialSignalValues,
  signalCount,
  signalSlots
} from "./generated/app.generated";

const root = document.querySelector("#app");
if (root === null) {
  throw new Error("Missing #app mount root.");
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
  throw new Error(`${mounted.error.code}: ${mounted.error.message}`);
}
