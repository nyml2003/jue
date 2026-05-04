import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { listExampleApps } from "../../../tooling/examples/src/index";
import { build } from "vite";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
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
          "@jue/shared": resolve(REPO_ROOT, "packages/kernel/shared/src/index.ts"),
          "@jue/runtime-core": resolve(REPO_ROOT, "packages/kernel/runtime-core/src/index.ts"),
          "@jue/compiler": resolve(REPO_ROOT, "packages/kernel/compiler/src/index.ts"),
          "@jue/jsx": resolve(REPO_ROOT, "packages/authoring/jsx/src/index.ts"),
          "@jue/primitives": resolve(REPO_ROOT, "packages/authoring/primitives/src/index.ts"),
          "@jue/authoring-check": resolve(REPO_ROOT, "packages/authoring/authoring-check/src/index.ts"),
          "@jue/stream": resolve(REPO_ROOT, "packages/stdlib/stream/src/index.ts"),
          "@jue/router": resolve(REPO_ROOT, "packages/stdlib/router/src/index.ts"),
          "@jue/query": resolve(REPO_ROOT, "packages/stdlib/query/src/index.ts"),
          "@jue/devtrace": resolve(REPO_ROOT, "packages/tooling/devtrace/src/index.ts"),
          "@jue/docsgen": resolve(REPO_ROOT, "packages/tooling/docsgen/src/index.ts"),
          "@jue/examples": resolve(REPO_ROOT, "packages/tooling/examples/src/index.ts"),
          "@jue/inspect": resolve(REPO_ROOT, "packages/tooling/inspect/src/index.ts"),
          "@jue/testkit": resolve(REPO_ROOT, "packages/tooling/testkit/src/index.ts"),
          "@jue/bench": resolve(REPO_ROOT, "packages/tooling/bench/src/index.ts"),
          "@jue/web": resolve(REPO_ROOT, "packages/host/web/src/index.ts")
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
