import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const EXAMPLES_ROOT = join(PACKAGE_ROOT, "apps");

async function main() {
  const entries = await readdir(EXAMPLES_ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const appRoot = join(EXAMPLES_ROOT, entry.name);
    await build({
      configFile: false,
      root: appRoot,
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env": "{}"
      },
      resolve: {
        alias: {
          "@jue/shared": resolve(REPO_ROOT, "packages/shared/src/index.ts"),
          "@jue/runtime-core": resolve(REPO_ROOT, "packages/runtime-core/src/index.ts"),
          "@jue/compiler": resolve(REPO_ROOT, "packages/compiler/src/index.ts"),
          "@jue/jsx": resolve(REPO_ROOT, "packages/jsx/src/index.ts"),
          "@jue/web": resolve(REPO_ROOT, "packages/web/src/index.ts")
        }
      },
      build: {
        target: "esnext",
        minify: false,
        outDir: join(appRoot, "dist"),
        emptyOutDir: true
      }
    });

    const builtIndexPath = join(appRoot, "dist", "index.html");
    const builtIndex = await readFile(builtIndexPath, "utf8");
    await writeFile(
      builtIndexPath,
      builtIndex.replaceAll('src="/assets/', 'src="./assets/').replaceAll('href="/assets/', 'href="./assets/'),
      "utf8"
    );
  }
}

void main();
