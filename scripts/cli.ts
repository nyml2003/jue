/**
 * jue-cli — registration-extension router.
 *
 * Scans scripts/cli-modes/ for *.ts files, auto-registers each as a mode.
 * Reads package.json from cwd, looks up jueCli array for the current phase,
 * and dispatches to the matching handler(s).
 *
 * Adding a new mode:
 *   1. Create scripts/cli-modes/<name>.ts
 *   2. Export `export async function run(cfg: any): Promise<void>`
 *   3. Add `{ "phase": "...", "mode": "<name>" }` to a package's jueCli array
 *   No changes to this file needed.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, extname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const phase = process.argv[2] || process.env.npm_lifecycle_event;
  if (!phase) {
    console.error("Usage: jue-cli <phase>");
    console.error("Or run via npm script (phase inferred from npm_lifecycle_event).");
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
  const jueCli: Array<{ phase: string; mode: string; [key: string]: any }> =
    pkg.jueCli || [];
  const tasks = jueCli.filter((t) => t.phase === phase);

  if (tasks.length === 0) {
    console.error(`No jueCli task found for phase: "${phase}".`);
    console.error(
      `Configured phases: ${jueCli.map((t) => t.phase).join(", ") || "none"}.`,
    );
    process.exit(1);
  }

  const modesDir = resolve(__dirname, "cli-modes");
  const modes = new Map<string, (config: any) => Promise<void>>();

  for (const file of readdirSync(modesDir)) {
    if (!file.endsWith(".ts")) continue;
    const modeName = basename(file, extname(file));
    const fileUrl = pathToFileURL(resolve(modesDir, file)).href;
    const module = await import(fileUrl);
    if (typeof module.run === "function") {
      modes.set(modeName, module.run);
    }
  }

  for (const task of tasks) {
    if (!task.mode) {
      console.error(
        `jueCli task for phase "${phase}" is missing required "mode" field.`,
      );
      process.exit(1);
    }
    const handler = modes.get(task.mode);
    if (!handler) {
      console.error(
        `Unknown mode: "${task.mode}" for phase "${phase}". ` +
          `Available modes: ${[...modes.keys()].join(", ")}.`,
      );
      process.exit(1);
    }
    await handler(task);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
