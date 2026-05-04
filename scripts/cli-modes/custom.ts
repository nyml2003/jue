/**
 * Mode: custom
 *
 * Runs a user-defined shell command.
 */

import { execSync } from "node:child_process";

interface CustomConfig {
  command: string;
}

export async function run(cfg: CustomConfig): Promise<void> {
  if (!cfg.command) {
    throw new Error('custom mode requires "command" field');
  }
  execSync(cfg.command, { stdio: "inherit", cwd: process.cwd() });
}
