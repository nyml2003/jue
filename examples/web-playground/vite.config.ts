import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@jue/shared": resolve(import.meta.dirname, "../../packages/shared/src/index.ts")
    }
  }
});
