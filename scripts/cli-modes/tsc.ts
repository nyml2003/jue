/**
 * Mode: tsc
 *
 * Runs `tsc -p <tsconfig> --noEmit` for type checking.
 */

import { execSync } from "node:child_process";

interface TscConfig {
  tsconfig?: string;
  pretty?: boolean;
}

export async function run(cfg: TscConfig): Promise<void> {
  const tsconfig = cfg.tsconfig || "tsconfig.json";
  const pretty = cfg.pretty === false ? " --pretty false" : "";
  execSync(`tsc -p ${tsconfig} --noEmit${pretty}`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}
