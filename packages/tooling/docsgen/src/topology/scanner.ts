import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { WorkspacePackage } from "./types.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

export async function collectWorkspacePackages(): Promise<WorkspacePackage[]> {
  const packages = await collectPackagesFromNestedRoot("packages");
  return [...packages].sort((left, right) => left.packageId.localeCompare(right.packageId));
}

async function collectPackagesFromNestedRoot(root: string): Promise<WorkspacePackage[]> {
  const rootPath = join(REPO_ROOT, root);
  const groupEntries = await readdir(rootPath, { withFileTypes: true });
  const packages: WorkspacePackage[] = [];

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
        packageId: String(manifest.name),
        path: relative(REPO_ROOT, packagePath).replaceAll("\\", "/"),
        manifest
      });
    }
  }

  return packages;
}

async function tryReadManifest(directory: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(join(directory, "package.json"), "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}
