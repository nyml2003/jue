/**
 * Build mode: workspace
 *
 * Builds all workspace packages under packages/ (excluding root),
 * then runs an optional post-build command.
 */

import { execSync } from "node:child_process";

interface WorkspaceConfig {
  post?: string;
}

export async function run(cfg: WorkspaceConfig): Promise<void> {
  execSync('pnpm -r --filter "./packages/*/*" run build', {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (cfg.post) {
    execSync(cfg.post, { stdio: "inherit", cwd: process.cwd() });
  }
}
