import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@jue/jsx": fileURLToPath(new URL("../../../packages/authoring/jsx/src/index.ts", import.meta.url)),
      "@jue/primitives": fileURLToPath(new URL("../../../packages/authoring/primitives/src/index.ts", import.meta.url)),
      "@jue/runtime-core": fileURLToPath(new URL("../../../packages/kernel/runtime-core/src/index.ts", import.meta.url)),
      "@jue/shared": fileURLToPath(new URL("../../../packages/kernel/shared/src/index.ts", import.meta.url)),
      "@jue/web": fileURLToPath(new URL("../../../packages/host/web/src/index.ts", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [repoRoot]
    }
  }
});
