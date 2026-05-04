/**
 * Mode: eslint
 *
 * Runs `eslint .` in the current working directory.
 */

import { execSync } from "node:child_process";

export async function run(_cfg: unknown): Promise<void> {
  execSync("eslint .", { stdio: "inherit", cwd: process.cwd() });
}
