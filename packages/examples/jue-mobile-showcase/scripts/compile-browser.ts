import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBrowserGeneratedModule } from "./generated-outputs";

async function main() {
  const outputPath = fileURLToPath(
    new URL("../browser/src/generated/app.generated.ts", import.meta.url)
  );
  const generatedModule = await buildBrowserGeneratedModule();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generatedModule, "utf8");
}

void main();
