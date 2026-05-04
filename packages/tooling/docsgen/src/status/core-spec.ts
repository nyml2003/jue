import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

export async function generateCoreSpecSnippet(): Promise<string> {
  const specsRoot = join(REPO_ROOT, "docs", "10-specs");
  const entries = await readdir(specsRoot, { withFileTypes: true });

  return [
    "## Core Spec Index",
    ...entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
      .map(entry => `- ${entry.name}`)
      .sort((left, right) => left.localeCompare(right))
  ].join("\n");
}
