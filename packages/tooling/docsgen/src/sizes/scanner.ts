import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface PackageRoot {
  readonly packageName: string;
  readonly root: string;
}

export function collectPackageRoots(packagesRoot: string): PackageRoot[] {
  const roots: PackageRoot[] = [];

  for (const groupEntry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!groupEntry.isDirectory()) {
      continue;
    }

    const groupPath = join(packagesRoot, groupEntry.name);
    for (const packageEntry of readdirSync(groupPath, { withFileTypes: true })) {
      if (!packageEntry.isDirectory()) {
        continue;
      }

      const root = join(groupPath, packageEntry.name);
      const packageName = `${groupEntry.name}/${packageEntry.name}`;
      roots.push({ packageName, root });
    }
  }

  return roots;
}

export function collectFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}
