import type { Container, Registry, WorkspacePackage } from "./types.js";

const ORDERED_LAYERS = [
  "kernel",
  "official-authoring",
  "official-host",
  "official-host-target",
  "official-stdlib",
  "official-tooling",
  "example-packages"
];

export function validateRegistry(registry: Registry, workspacePackages: WorkspacePackage[]): void {
  const workspaceById = new Map(workspacePackages.map(pkg => [pkg.packageId, pkg]));
  const registryById = new Map(registry.containers.map(container => [container.packageId, container]));

  const workspaceIds = [...workspaceById.keys()].sort();
  const registryIds = [...registryById.keys()].sort();

  assertSameSet("workspace packages", workspaceIds, registryIds);

  const disclosureIds = new Set<string>();

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

function hasExport(manifest: Record<string, unknown>, entry: string): boolean {
  const exportsField = manifest.exports;
  if (!exportsField || typeof exportsField !== "object" || exportsField === null) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(exportsField, entry);
}

function assertSameSet(label: string, left: string[], right: string[]): void {
  const onlyLeft = left.filter(item => !right.includes(item));
  const onlyRight = right.filter(item => !left.includes(item));

  if (onlyLeft.length === 0 && onlyRight.length === 0) {
    return;
  }

  throw new Error(
    `${label} mismatch:\nonly in workspace: ${onlyLeft.join(", ") || "(none)"}\nonly in registry: ${onlyRight.join(", ") || "(none)"}`
  );
}
