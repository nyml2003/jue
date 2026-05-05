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

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, extname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parsePhaseInvocation } from "./cli-argv";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CliTask {
  phase?: string;
  mode?: string;
  [key: string]: unknown;
}

export interface CliMainDeps {
  argv: string[];
  error: (...args: unknown[]) => void;
  exit: (code: number) => never;
  fileExists: (path: string) => boolean;
  importModule: (specifier: string) => Promise<{ run?: (config: any) => Promise<void> }>;
  lifecycleEvent: string | undefined;
  modeFiles: string[];
  modesDir: string;
  pkgText: string;
}

export function collectAvailableModes(modeFiles: string[]): Set<string> {
  return new Set(
    modeFiles
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => basename(file, extname(file))),
  );
}

function defaultExit(code: number): never {
  process.exit(code);
}

export async function main(deps: Partial<CliMainDeps> = {}): Promise<void> {
  const {
    argv = process.argv.slice(2),
    error = console.error,
    exit = defaultExit,
    fileExists = existsSync,
    importModule = async (specifier) => import(specifier),
    lifecycleEvent = process.env.npm_lifecycle_event,
    modeFiles = readdirSync(resolve(__dirname, "cli-modes")),
    modesDir = resolve(__dirname, "cli-modes"),
    pkgText = readFileSync("package.json", "utf-8"),
  } = deps;

  const { phase, forwardedArgs } = parsePhaseInvocation(argv, lifecycleEvent);
  if (!phase) {
    error("Usage: jue-cli <phase>");
    error("Or run via npm script (phase inferred from npm_lifecycle_event).");
    exit(1);
  }

  const pkg = JSON.parse(pkgText);
  const jueCli: CliTask[] = pkg.jueCli || [];
  const tasks = jueCli.filter((t) => t.phase === phase);

  if (tasks.length === 0) {
    error(`No jueCli task found for phase: "${phase}".`);
    error(
      `Configured phases: ${jueCli.map((t) => t.phase).join(", ") || "none"}.`,
    );
    exit(1);
  }

  const modes = new Map<string, (config: any) => Promise<void>>();
  const availableModes = collectAvailableModes(modeFiles);
  const requestedModeNames = tasks
    .map((task) => task.mode)
    .filter((modeName): modeName is string => typeof modeName === "string");

  for (const modeName of new Set(requestedModeNames)) {
    if (!availableModes.has(modeName)) {
      continue;
    }

    const modeFile = resolve(modesDir, `${modeName}.ts`);
    if (!fileExists(modeFile)) {
      continue;
    }

    const fileUrl = pathToFileURL(modeFile).href;
    const module = await importModule(fileUrl);
    if (typeof module.run === "function") {
      modes.set(modeName, module.run);
    }
  }

  for (const task of tasks) {
    if (!task.mode) {
      error(
        `jueCli task for phase "${phase}" is missing required "mode" field.`,
      );
      exit(1);
      continue;
    }
    const handler = modes.get(task.mode);
    if (!handler) {
      error(
        `Unknown mode: "${task.mode}" for phase "${phase}". ` +
          `Available modes: ${[...availableModes].join(", ")}.`,
      );
      exit(1);
      continue;
    }
    await handler({
      ...task,
      $args: forwardedArgs,
      $phase: phase,
    });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
