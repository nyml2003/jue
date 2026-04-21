import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": "{}"
  },
  resolve: {
    alias: {
      "@jue/shared": resolve(import.meta.dirname, "../../packages/shared/src/index.ts"),
      "@jue/runtime-core": resolve(import.meta.dirname, "../../packages/runtime-core/src/index.ts"),
      "@jue/compiler": resolve(import.meta.dirname, "../../packages/compiler/src/index.ts"),
      "@jue/jsx": resolve(import.meta.dirname, "../../packages/jsx/src/index.ts"),
      "@jue/web": resolve(import.meta.dirname, "../../packages/web/src/index.ts")
    }
  },
  build: {
    target: "esnext",
    minify: true,
    outDir: "dist"
  }
});
