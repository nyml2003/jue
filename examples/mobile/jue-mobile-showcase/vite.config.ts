import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const browserRoot = fileURLToPath(new URL("./browser", import.meta.url));

export default defineConfig({
  root: browserRoot,
  resolve: {
    alias: {
      "@jue/compiler": fileURLToPath(new URL("../../../packages/compiler/src/index.ts", import.meta.url)),
      "@jue/compiler/frontend": fileURLToPath(new URL("../../../packages/compiler/src/frontend/index.ts", import.meta.url)),
      "@jue/jsx": fileURLToPath(new URL("../../../packages/jsx/src/index.ts", import.meta.url)),
      "@jue/primitives": fileURLToPath(new URL("../../../packages/primitives/src/index.ts", import.meta.url)),
      "@jue/runtime-core": fileURLToPath(new URL("../../../packages/runtime-core/src/index.ts", import.meta.url)),
      "@jue/shared": fileURLToPath(new URL("../../../packages/shared/src/index.ts", import.meta.url)),
      "@jue/web": fileURLToPath(new URL("../../../packages/web/src/index.ts", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [repoRoot]
    }
  }
});
