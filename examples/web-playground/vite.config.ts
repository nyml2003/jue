import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@jue/shared": resolve(import.meta.dirname, "../../packages/shared/src/index.ts"),
      "@jue/runtime-core": resolve(import.meta.dirname, "../../packages/runtime-core/src/index.ts"),
      "@jue/web": resolve(import.meta.dirname, "../../packages/web/src/index.ts")
    }
  }
});
