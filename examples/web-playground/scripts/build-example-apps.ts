import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { listExampleApps } from "../../../packages/examples/src/index";
import { build } from "vite";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const EXAMPLES_ROOT = join(PACKAGE_ROOT, "apps");

async function main() {
  const examples = await listExampleApps(EXAMPLES_ROOT);

  for (const example of examples) {
    const appRoot = example.appRoot;
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
          "@jue/primitives": resolve(REPO_ROOT, "packages/primitives/src/index.ts"),
          "@jue/authoring-check": resolve(REPO_ROOT, "packages/authoring-check/src/index.ts"),
          "@jue/stream": resolve(REPO_ROOT, "packages/stream/src/index.ts"),
          "@jue/router": resolve(REPO_ROOT, "packages/router/src/index.ts"),
          "@jue/query": resolve(REPO_ROOT, "packages/query/src/index.ts"),
          "@jue/devtrace": resolve(REPO_ROOT, "packages/devtrace/src/index.ts"),
          "@jue/docsgen": resolve(REPO_ROOT, "packages/docsgen/src/index.ts"),
          "@jue/examples": resolve(REPO_ROOT, "packages/examples/src/index.ts"),
          "@jue/inspect": resolve(REPO_ROOT, "packages/inspect/src/index.ts"),
          "@jue/testkit": resolve(REPO_ROOT, "packages/testkit/src/index.ts"),
          "@jue/bench": resolve(REPO_ROOT, "packages/bench/src/index.ts"),
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
