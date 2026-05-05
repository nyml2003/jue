import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildVitestEnvironment,
  buildVitestInvocation,
  findWorkspaceRoot,
  hasCoverageFlag,
  run,
} from "./test";

const workspaceRoot = process.cwd().replaceAll("\\", "/");
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

function createTempDir(name: string): string {
  const dir = join(tmpdir(), `jue-${name}-${Date.now()}-${Math.random()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function createSpawnResult(status: number): { status: number | null } {
  return {
    status,
  };
}

describe("buildVitestInvocation", () => {
  it("detects coverage flags in different forms", () => {
    expect(hasCoverageFlag(["--coverage"])).toBe(true);
    expect(hasCoverageFlag(["--coverage.enabled"])).toBe(true);
    expect(hasCoverageFlag(["--coverage=true"])).toBe(true);
    expect(hasCoverageFlag(["--runInBand"])).toBe(false);
  });

  it("uses package-local test and src globs by default", () => {
    const invocation = buildVitestInvocation(
      resolve(process.cwd(), "packages/kernel/runtime-core"),
      {
        $args: ["--coverage"],
        coverageConfig: "vitest.coverage-all.config.ts",
      },
    );

    expect(invocation.workspaceRoot.replaceAll("\\", "/")).toBe(workspaceRoot);
    expect(invocation.configPath.replaceAll("\\", "/")).toBe(
      `${workspaceRoot}/vitest.coverage-all.config.ts`,
    );
    expect(invocation.includePatterns).toEqual([
      "packages/kernel/runtime-core/test/**/*.test.ts",
      "packages/kernel/runtime-core/test/**/*.test.tsx",
    ]);
    expect(invocation.coverageIncludePatterns).toEqual([
      "packages/kernel/runtime-core/src/**/*.ts",
      "packages/kernel/runtime-core/src/**/*.tsx",
    ]);
  });

  it("keeps root runs unfiltered", () => {
    const invocation = buildVitestInvocation(process.cwd(), {
      $args: ["--coverage"],
      coverageConfig: "vitest.coverage-all.config.ts",
    });

    expect(invocation.includePatterns).toEqual([]);
    expect(invocation.coverageIncludePatterns).toEqual([]);
    expect(invocation.configPath.replaceAll("\\", "/")).toBe(
      `${workspaceRoot}/vitest.coverage-all.config.ts`,
    );
  });

  it("uses the non-coverage config and passWithNoTests when coverage is disabled", () => {
    const invocation = buildVitestInvocation(
      resolve(process.cwd(), "packages/tooling/lab"),
      {
        $args: ["--reporter=verbose"],
        config: "vitest.config.ts",
        passWithNoTests: true,
      },
    );

    expect(invocation.configPath.replaceAll("\\", "/")).toBe(
      `${workspaceRoot}/vitest.config.ts`,
    );
    expect(invocation.coverageIncludePatterns).toEqual([]);
    expect(invocation.vitestArgs).toContain("--passWithNoTests");
  });

  it("prefixes custom package patterns for nonstandard layouts", () => {
    const invocation = buildVitestInvocation(
      resolve(process.cwd(), "packages/examples/web-playground"),
      {
        $args: ["--coverage"],
        coverageConfig: "vitest.coverage-all.config.ts",
        coverageSource: ["apps/**/*.ts", "runtime/**/*.ts"],
        testFiles: ["apps/**/*.test.ts", "runtime/**/*.test.ts"],
      },
    );

    expect(invocation.includePatterns).toEqual([
      "packages/examples/web-playground/apps/**/*.test.ts",
      "packages/examples/web-playground/runtime/**/*.test.ts",
    ]);
    expect(invocation.coverageIncludePatterns).toEqual([
      "packages/examples/web-playground/apps/**/*.ts",
      "packages/examples/web-playground/runtime/**/*.ts",
    ]);
  });

  it("preserves already rooted and negated patterns", () => {
    const invocation = buildVitestInvocation(
      resolve(process.cwd(), "packages/kernel/compiler"),
      {
        $args: ["--coverage"],
        coverageConfig: "vitest.coverage-all.config.ts",
        coverageSource: ["scripts/**/*.ts", "!src/**/*.d.ts"],
        testFiles: ["./test/**/*.test.ts"],
      },
    );

    expect(invocation.includePatterns).toEqual(["test/**/*.test.ts"]);
    expect(invocation.coverageIncludePatterns).toEqual([
      "scripts/**/*.ts",
      "!packages/kernel/compiler/src/**/*.d.ts",
    ]);
  });
});

describe("findWorkspaceRoot", () => {
  it("walks up to the nearest pnpm workspace root", () => {
    const root = createTempDir("workspace");
    const nested = resolve(root, "packages/kernel/runtime-core");
    mkdirSync(nested, { recursive: true });
    writeFileSync(resolve(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

    expect(findWorkspaceRoot(nested)).toBe(root);
  });

  it("throws when no workspace root can be found", () => {
    const orphan = createTempDir("orphan");
    expect(() => findWorkspaceRoot(orphan)).toThrow(
      `Unable to locate workspace root from "${orphan}".`,
    );
  });
});

describe("run", () => {
  it("builds the vitest env overrides before spawning", async () => {
    const spawnSyncImpl = vi.fn(() => createSpawnResult(0));

    await run(
      {
        $args: ["--coverage"],
        coverageConfig: "vitest.coverage-all.config.ts",
      },
      {
        cwd: resolve(process.cwd(), "packages/kernel/runtime-core"),
        env: { BASE: "1" },
        execPath: "node",
        spawnSyncImpl,
      },
    );

    expect(spawnSyncImpl).toHaveBeenCalledTimes(1);
    const firstCall = spawnSyncImpl.mock.calls[0] as
      | [string, readonly string[], { cwd: string; env: NodeJS.ProcessEnv; stdio: "inherit" }]
      | undefined;
    expect(firstCall).toBeDefined();
    const options = firstCall?.[2];
    expect(options).toBeDefined();
    if (!options) {
      throw new Error("spawnSync options were not captured");
    }
    expect(options).toMatchObject({
      cwd: process.cwd(),
      stdio: "inherit",
    });
    expect(options.env).toMatchObject({
      BASE: "1",
      JUE_VITEST_COVERAGE_INCLUDE: JSON.stringify([
        "packages/kernel/runtime-core/src/**/*.ts",
        "packages/kernel/runtime-core/src/**/*.tsx",
      ]),
      JUE_VITEST_INCLUDE: JSON.stringify([
        "packages/kernel/runtime-core/test/**/*.test.ts",
        "packages/kernel/runtime-core/test/**/*.test.tsx",
      ]),
    });
  });

  it("throws when vitest exits non-zero", async () => {
    await expect(
      run(
        {
          $args: ["--coverage"],
          coverageConfig: "vitest.coverage-all.config.ts",
        },
        {
          cwd: resolve(process.cwd(), "packages/kernel/runtime-core"),
          spawnSyncImpl: () => createSpawnResult(2),
        },
      ),
    ).rejects.toThrow("Vitest exited with status 2.");
  });

  it("clears coverage overrides when the invocation has no filtered files", () => {
    const env = buildVitestEnvironment(
      { BASE: "1" },
      buildVitestInvocation(process.cwd(), {
        $args: ["--coverage"],
        coverageConfig: "vitest.coverage-all.config.ts",
      }),
    );

    expect(env).toMatchObject({
      BASE: "1",
      JUE_VITEST_COVERAGE_INCLUDE: "",
      JUE_VITEST_INCLUDE: "",
    });
  });
});
