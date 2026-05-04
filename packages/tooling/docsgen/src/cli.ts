import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateCoreSpecSnippet, generateExampleRegistrySnippet, generateSupportMatrix } from "./index";
import { collectWorkspacePackages } from "./topology/scanner.js";
import { renderReport, writeTopologyReport } from "./topology/report.js";
import type { Registry } from "./topology/types.js";
import { collectPackageRoots } from "./sizes/scanner.js";
import { buildSizeRows, printSizeReport } from "./sizes/report.js";
import type { SizeRow } from "./sizes/report.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const REGISTRY_PATH = join(REPO_ROOT, "docs", "30-engineering", "monorepo-topology.registry.json");

async function main() {
  const command = process.argv[2] ?? "all";

  if (command === "status") {
    await runStatus();
    return;
  }

  if (command === "topology") {
    await runTopology();
    return;
  }

  if (command === "sizes") {
    runSizes();
    return;
  }

  if (command === "all") {
    await runStatus();
    console.log("");
    await runTopology();
    console.log("");
    runSizes();
    return;
  }

  console.error(`Unknown command: ${command}. Available: status, topology, sizes, all`);
  process.exitCode = 1;
}

async function runStatus() {
  const output = [
    await generateSupportMatrix(),
    "",
    await generateExampleRegistrySnippet(),
    "",
    await generateCoreSpecSnippet()
  ].join("\n");

  console.log(output);
}

async function runTopology() {
  const registryContent = await readFile(REGISTRY_PATH, "utf8");
  const registry = JSON.parse(registryContent) as Registry;
  const workspacePackages = await collectWorkspacePackages();

  const { validateRegistry } = await import("./topology/registry.js");
  validateRegistry(registry, workspacePackages);
  console.log("Monorepo topology registry is valid.");

  const writeFlag = process.argv.includes("--write");
  if (writeFlag) {
    await writeTopologyReport(registry, workspacePackages);
  } else {
    console.log("\nPreview (use --write to save to docs/30-engineering/05-monorepo-dependency-report.md):");
    console.log(renderReport(registry, workspacePackages));
  }
}

function runSizes() {
  const packagesRoot = join(REPO_ROOT, "packages");
  const packageRoots = collectPackageRoots(packagesRoot).sort((left, right) => left.packageName.localeCompare(right.packageName));

  const allRows: SizeRow[] = [];
  for (const { packageName, root } of packageRoots) {
    allRows.push(...buildSizeRows(packageName, root));
  }

  printSizeReport(allRows);
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
