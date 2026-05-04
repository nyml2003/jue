import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO_ROOT = process.cwd();
const REGISTRY_PATH = join(REPO_ROOT, "docs", "30-engineering", "monorepo-topology.registry.json");
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

const LAYER_LABEL = {
  kernel: "Kernel",
  "official-authoring": "Official Authoring",
  "official-host": "Official Host",
  "official-host-target": "Official Host Target",
  "official-stdlib": "Official Stdlib",
  "official-tooling": "Official Tooling",
  "example-packages": "Example Packages"
};

async function main() {
  const command = process.argv[2] ?? "check";
  const registry = await readRegistry();
  const workspacePackages = await collectWorkspacePackages();

  validateRegistry(registry, workspacePackages);

  if (command === "check") {
    console.log("Monorepo topology registry is valid.");
    return;
  }

  if (command === "report") {
    const report = renderReport(registry, workspacePackages);
    await writeFile(REPORT_PATH, report, "utf8");
    console.log(`Wrote ${relative(REPO_ROOT, REPORT_PATH).replaceAll("\\", "/")}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function readRegistry() {
  const content = await readFile(REGISTRY_PATH, "utf8");
  return JSON.parse(content);
}

async function collectWorkspacePackages() {
  const packages = await collectPackagesFromNestedRoot("packages");
  return [...packages].sort((left, right) => left.packageId.localeCompare(right.packageId));
}

async function collectPackagesFromNestedRoot(root) {
  const rootPath = join(REPO_ROOT, root);
  const groupEntries = await readdir(rootPath, { withFileTypes: true });
  const packages = [];

  for (const groupEntry of groupEntries) {
    if (!groupEntry.isDirectory()) {
      continue;
    }

    const groupPath = join(rootPath, groupEntry.name);
    const packageEntries = await readdir(groupPath, { withFileTypes: true });

    for (const packageEntry of packageEntries) {
      if (!packageEntry.isDirectory()) {
        continue;
      }

      const packagePath = join(groupPath, packageEntry.name);
      const manifest = await tryReadManifest(packagePath);
      if (!manifest?.name) {
        continue;
      }

      packages.push({
        packageId: manifest.name,
        path: relative(REPO_ROOT, packagePath).replaceAll("\\", "/"),
        manifest
      });
    }
  }

  return packages;
}

async function tryReadManifest(directory) {
  try {
    const content = await readFile(join(directory, "package.json"), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function validateRegistry(registry, workspacePackages) {
  const workspaceById = new Map(workspacePackages.map(pkg => [pkg.packageId, pkg]));
  const registryById = new Map(registry.containers.map(container => [container.packageId, container]));

  const workspaceIds = [...workspaceById.keys()].sort();
  const registryIds = [...registryById.keys()].sort();

  assertSameSet("workspace packages", workspaceIds, registryIds);

  const disclosureIds = new Set();

  for (const container of registry.containers) {
    const workspacePackage = workspaceById.get(container.packageId);
    if (!workspacePackage) {
      throw new Error(`Missing workspace package for ${container.packageId}`);
    }

    if (workspacePackage.path !== container.path) {
      throw new Error(`Path mismatch for ${container.packageId}: registry=${container.path}, workspace=${workspacePackage.path}`);
    }

    if (container.disclosureUnits.length === 0) {
      throw new Error(`Container ${container.packageId} must expose at least one disclosure unit.`);
    }

    for (const unit of container.disclosureUnits) {
      if (disclosureIds.has(unit.id)) {
        throw new Error(`Duplicate disclosure unit id: ${unit.id}`);
      }
      disclosureIds.add(unit.id);

      if (!ORDERED_LAYERS.includes(unit.layer)) {
        throw new Error(`Unknown layer ${unit.layer} for ${unit.id}`);
      }

      if (unit.entry !== "." && !hasExport(workspacePackage.manifest, unit.entry)) {
        throw new Error(`Disclosure unit ${unit.id} points to missing export ${unit.entry} in ${container.packageId}`);
      }
    }
  }
}

function hasExport(manifest, entry) {
  const exportsField = manifest.exports;
  if (!exportsField || typeof exportsField !== "object") {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(exportsField, entry);
}

function assertSameSet(label, left, right) {
  const onlyLeft = left.filter(item => !right.includes(item));
  const onlyRight = right.filter(item => !left.includes(item));

  if (onlyLeft.length === 0 && onlyRight.length === 0) {
    return;
  }

  throw new Error(
    `${label} mismatch:\nonly in workspace: ${onlyLeft.join(", ") || "(none)"}\nonly in registry: ${onlyRight.join(", ") || "(none)"}`
  );
}

function renderReport(registry, workspacePackages) {
  const workspaceById = new Map(workspacePackages.map(pkg => [pkg.packageId, pkg]));
  const edges = collectInternalEdges(workspacePackages);
  const lines = [];

  lines.push("# Monorepo Dependency Report");
  lines.push("");
  lines.push("这个文件由 `node ./scripts/monorepo-topology.mjs report` 生成。");
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
    lines.push(`  ${toMermaidId(edge.from)}[\"${edge.from}\"] --> ${toMermaidId(edge.to)}[\"${edge.to}\"]`);
  }
  lines.push("```");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function collectInternalEdges(workspacePackages) {
  const workspaceIds = new Set(workspacePackages.map(pkg => pkg.packageId));
  const edges = [];

  for (const pkg of workspacePackages) {
    for (const [name, version] of Object.entries(pkg.manifest.dependencies ?? {})) {
      if (!workspaceIds.has(name) || !version.startsWith("workspace:")) {
        continue;
      }

      edges.push({ from: pkg.packageId, to: name, kind: "dependency" });
    }

    for (const [name, version] of Object.entries(pkg.manifest.devDependencies ?? {})) {
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

function collectPackageDeps(pkg, workspaceById) {
  const names = [
    ...Object.keys(pkg.manifest.dependencies ?? {}),
    ...Object.keys(pkg.manifest.devDependencies ?? {})
  ].filter(name => workspaceById.has(name));

  return [...new Set(names)].sort();
}

function toMermaidId(value) {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
