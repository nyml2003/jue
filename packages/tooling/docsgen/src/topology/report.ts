import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { Container, Edge, Registry, WorkspacePackage } from "./types.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const REPORT_PATH = join(REPO_ROOT, "docs", "30-engineering", "05-monorepo-dependency-report.md");

const ORDERED_LAYERS = [
  "kernel",
  "official-authoring",
  "official-host",
  "official-host-target",
  "official-stdlib",
  "official-tooling",
  "example-packages"
];

const LAYER_LABEL: Record<string, string> = {
  kernel: "Kernel",
  "official-authoring": "Official Authoring",
  "official-host": "Official Host",
  "official-host-target": "Official Host Target",
  "official-stdlib": "Official Stdlib",
  "official-tooling": "Official Tooling",
  "example-packages": "Example Packages"
};

export async function writeTopologyReport(registry: Registry, workspacePackages: WorkspacePackage[]): Promise<void> {
  const report = renderReport(registry, workspacePackages);
  await writeFile(REPORT_PATH, report, "utf8");
  console.log(`Wrote ${relative(REPO_ROOT, REPORT_PATH).replaceAll("\\", "/")}`);
}

export function renderReport(registry: Registry, workspacePackages: WorkspacePackage[]): string {
  const workspaceById = new Map(workspacePackages.map(pkg => [pkg.packageId, pkg]));
  const edges = collectInternalEdges(workspacePackages);
  const lines: string[] = [];

  lines.push("# Monorepo Dependency Report");
  lines.push("");
  lines.push("这个文件由 `@jue/docsgen topology --write` 生成。");
  lines.push("它只总结当前 registry 与 workspace manifests 的一致结果，不额外推断未来结构。");
  lines.push("");
  lines.push("## Layer Summary");
  lines.push("");

  for (const layer of ORDERED_LAYERS) {
    lines.push(`### ${LAYER_LABEL[layer]}`);
    lines.push("");
    const units = registry.containers
      .flatMap(container => container.disclosureUnits)
      .filter(unit => unit.layer === layer)
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const unit of units) {
      lines.push(`- \`${unit.id}\``);
    }
    lines.push("");
  }

  lines.push("## Package Containers");
  lines.push("");
  lines.push("| Package | Kind | Path | Internal deps |");
  lines.push("| --- | --- | --- | --- |");
  for (const container of [...registry.containers].sort((left, right) => left.packageId.localeCompare(right.packageId))) {
    const workspacePackage = workspaceById.get(container.packageId);
    if (!workspacePackage) {
      continue;
    }
    const deps = collectPackageDeps(workspacePackage, workspaceById);
    lines.push(`| \`${container.packageId}\` | ${container.containerKind} | \`${container.path}\` | ${deps.length > 0 ? deps.map(dep => `\`${dep}\``).join(", ") : "-" } |`);
  }
  lines.push("");

  lines.push("## Direct Internal Edges");
  lines.push("");
  for (const edge of edges) {
    lines.push(`- \`${edge.from}\` -> \`${edge.to}\` (${edge.kind})`);
  }
  lines.push("");

  lines.push("## Mermaid");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph TD");
  for (const edge of edges) {
    lines.push(`  ${toMermaidId(edge.from)}["${edge.from}"] --> ${toMermaidId(edge.to)}["${edge.to}"]`);
  }
  lines.push("```");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function collectInternalEdges(workspacePackages: WorkspacePackage[]): Edge[] {
  const workspaceIds = new Set(workspacePackages.map(pkg => pkg.packageId));
  const edges: Edge[] = [];

  for (const pkg of workspacePackages) {
    const deps = pkg.manifest.dependencies as Record<string, string> | undefined;
    const devDeps = pkg.manifest.devDependencies as Record<string, string> | undefined;

    for (const [name, version] of Object.entries(deps ?? {})) {
      if (!workspaceIds.has(name) || !version.startsWith("workspace:")) {
        continue;
      }
      edges.push({ from: pkg.packageId, to: name, kind: "dependency" });
    }

    for (const [name, version] of Object.entries(devDeps ?? {})) {
      if (!workspaceIds.has(name) || !version.startsWith("workspace:")) {
        continue;
      }
      edges.push({ from: pkg.packageId, to: name, kind: "devDependency" });
    }
  }

  return edges.sort((left, right) => {
    if (left.from !== right.from) {
      return left.from.localeCompare(right.from);
    }
    if (left.to !== right.to) {
      return left.to.localeCompare(right.to);
    }
    return left.kind.localeCompare(right.kind);
  });
}

function collectPackageDeps(pkg: WorkspacePackage, workspaceById: Map<string, WorkspacePackage>): string[] {
  const depsNames = Object.keys((pkg.manifest.dependencies as Record<string, string>) ?? {});
  const devDepsNames = Object.keys((pkg.manifest.devDependencies as Record<string, string>) ?? {});
  const names = [...depsNames, ...devDepsNames].filter(name => workspaceById.has(name));

  return [...new Set(names)].sort();
}

function toMermaidId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}
