import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

import { buildBrowserGeneratedModule, buildMiniprogramOutputs } from "./generated-outputs";

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const expectedBrowser = await buildBrowserGeneratedModule();
  await assertFileEquals(join(root, "browser", "src", "generated", "app.generated.ts"), expectedBrowser);

  const expectedMiniprogramOutputs = await buildMiniprogramOutputs();
  for (const [relativePath, expected] of Object.entries(expectedMiniprogramOutputs)) {
    const outputPath = join(root, ...relativePath.split("/"));
    await assertFileEquals(outputPath, expected);
    if (outputPath.endsWith(".js")) {
      validateGeneratedJavaScript(outputPath, expected);
    }
  }
}

async function assertFileEquals(path: string, expected: string) {
  const actual = await readFile(path, "utf8");
  if (actual !== expected) {
    throw new Error(`Generated output is stale: ${path}`);
  }
}

function validateGeneratedJavaScript(path: string, source: string) {
  try {
    new Script(source, { filename: path });
  } catch (error) {
    throw new Error(`Generated JavaScript is invalid: ${path}\n${String(error)}`);
  }
}

void main();
