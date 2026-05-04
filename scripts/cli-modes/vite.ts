/**
 * Build mode: vite
 *
 * Runs an optional preBuild command, then `vite build`.
 */

import { execSync } from "node:child_process";

interface ViteBuildConfig {
  preBuild?: string;
  viteConfig?: string;
}

export async function run(cfg: ViteBuildConfig): Promise<void> {
  if (cfg.preBuild) {
    execSync(cfg.preBuild, { stdio: "inherit", cwd: process.cwd() });
  }
  const viteConfig = cfg.viteConfig ? ` --config ${cfg.viteConfig}` : "";
  execSync(`vite build${viteConfig}`, { stdio: "inherit", cwd: process.cwd() });
}
