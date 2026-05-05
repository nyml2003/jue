import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

export interface TestConfig {
  config?: string;
  coverageConfig?: string;
  testFiles?: string[];
  coverageSource?: string[];
  passWithNoTests?: boolean;
  $args?: string[];
}

interface VitestInvocation {
  configPath: string;
  coverageIncludePatterns: string[];
  includePatterns: string[];
  vitestArgs: string[];
  workspaceRoot: string;
}

export function hasCoverageFlag(args: string[]): boolean {
  return args.some(
    (arg) =>
      arg === "--coverage" ||
      arg.startsWith("--coverage=") ||
      arg.startsWith("--coverage."),
  );
}

export function findWorkspaceRoot(startDir: string): string {
  let currentDir = resolve(startDir);

  while (true) {
    if (existsSync(resolve(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }

    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate workspace root from "${startDir}".`);
    }

    currentDir = parentDir;
  }
}

export function buildVitestInvocation(
  cwd: string,
  cfg: TestConfig,
): VitestInvocation {
  const workspaceRoot = findWorkspaceRoot(cwd);
  const relativeDir = relative(workspaceRoot, cwd).replaceAll("\\", "/");
  const forwardedArgs = cfg.$args ?? [];
  const collectingCoverage = hasCoverageFlag(forwardedArgs);
  const configFile =
    collectingCoverage && cfg.coverageConfig
      ? cfg.coverageConfig
      : (cfg.config ?? "vitest.config.ts");

  const includePatterns = buildPatternList(
    relativeDir,
    cfg.testFiles,
    relativeDir ? ["test/**/*.test.ts", "test/**/*.test.tsx"] : [],
  );
  const coverageIncludePatterns = collectingCoverage
    ? buildPatternList(
        relativeDir,
        cfg.coverageSource,
        relativeDir ? ["src/**/*.ts", "src/**/*.tsx"] : [],
      )
    : [];

  const vitestArgs = [
    resolve(workspaceRoot, "node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    resolve(workspaceRoot, configFile),
  ];

  if (cfg.passWithNoTests && !forwardedArgs.includes("--passWithNoTests")) {
    vitestArgs.push("--passWithNoTests");
  }

  vitestArgs.push(...forwardedArgs);

  return {
    configPath: resolve(workspaceRoot, configFile),
    coverageIncludePatterns,
    includePatterns,
    vitestArgs,
    workspaceRoot,
  };
}

export function buildVitestEnvironment(
  env: NodeJS.ProcessEnv,
  invocation: VitestInvocation,
): NodeJS.ProcessEnv {
  return {
    ...env,
    JUE_VITEST_COVERAGE_INCLUDE:
      invocation.coverageIncludePatterns.length > 0
        ? JSON.stringify(invocation.coverageIncludePatterns)
        : "",
    JUE_VITEST_INCLUDE:
      invocation.includePatterns.length > 0
        ? JSON.stringify(invocation.includePatterns)
        : "",
  };
}

interface TestModeRuntime {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  spawnSyncImpl?: (
    command: string,
    args: readonly string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      stdio: "inherit";
    },
  ) => { status: number | null };
}

export async function run(
  cfg: TestConfig,
  runtime: TestModeRuntime = {},
): Promise<void> {
  const cwd = runtime.cwd ?? process.cwd();
  const invocation = buildVitestInvocation(cwd, cfg);
  const env = buildVitestEnvironment(runtime.env ?? process.env, invocation);

  const result = (runtime.spawnSyncImpl ?? spawnSync)(
    runtime.execPath ?? process.execPath,
    invocation.vitestArgs,
    {
    cwd: invocation.workspaceRoot,
    env,
    stdio: "inherit",
    },
  );

  if ((result.status ?? 0) !== 0) {
    throw new Error(`Vitest exited with status ${result.status ?? 1}.`);
  }
}

function buildPatternList(
  relativeDir: string,
  configuredPatterns: string[] | undefined,
  defaultPatterns: string[],
): string[] {
  const patterns =
    configuredPatterns && configuredPatterns.length > 0
      ? configuredPatterns
      : defaultPatterns;

  return patterns.map((pattern) => prefixPattern(relativeDir, pattern));
}

function prefixPattern(relativeDir: string, pattern: string): string {
  if (!relativeDir) {
    return pattern;
  }

  if (pattern.startsWith("!")) {
    return `!${prefixPattern(relativeDir, pattern.slice(1))}`;
  }

  if (
    pattern.startsWith("./") ||
    pattern.startsWith("../") ||
    pattern.startsWith("/") ||
    pattern.startsWith("packages/") ||
    pattern.startsWith("docs/") ||
    pattern.startsWith("scripts/")
  ) {
    return pattern.replace(/^\.\//, "");
  }

  return `${relativeDir}/${pattern}`;
}
