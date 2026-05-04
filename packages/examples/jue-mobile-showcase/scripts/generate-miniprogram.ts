import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildMiniprogramOutputs } from "./generated-outputs";

async function main() {
  const outputRoot = fileURLToPath(new URL("../", import.meta.url));
  const outputs = await buildMiniprogramOutputs();

  await rm(join(outputRoot, "miniprogram", "app.ts"), { force: true });
  await rm(join(outputRoot, "miniprogram", "pages", "showcase", "index.ts"), { force: true });

  for (const [relativePath, content] of Object.entries(outputs)) {
    const outputPath = join(outputRoot, ...relativePath.split("/"));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf8");
  }
}

void main();
