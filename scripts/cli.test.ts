import { describe, expect, it, vi } from "vitest";

import { collectAvailableModes, main } from "./cli";

function createExitSpy(): {
  calls: number[];
  exit: (code: number) => never;
} {
  const calls: number[] = [];

  return {
    calls,
    exit(code: number): never {
      calls.push(code);
      throw new Error(`exit:${code}`);
    },
  };
}

describe("collectAvailableModes", () => {
  it("keeps only runtime mode files", () => {
    expect(
      [...collectAvailableModes(["custom.ts", "custom.test.ts", "README.md"])],
    ).toEqual(["custom"]);
  });
});

describe("main", () => {
  it("exits when no phase can be resolved", async () => {
    const errors: string[] = [];
    const exitSpy = createExitSpy();

    await expect(
      main({
        argv: [],
        error: (...args) => errors.push(args.join(" ")),
        exit: exitSpy.exit,
        lifecycleEvent: "",
      }),
    ).rejects.toThrow("exit:1");

    expect(exitSpy.calls).toEqual([1]);
    expect(errors).toEqual([
      "Usage: jue-cli <phase>",
      "Or run via npm script (phase inferred from npm_lifecycle_event).",
    ]);
  });

  it("exits when no task matches the phase", async () => {
    const errors: string[] = [];
    const exitSpy = createExitSpy();

    await expect(
      main({
        argv: ["test"],
        error: (...args) => errors.push(args.join(" ")),
        exit: exitSpy.exit,
        lifecycleEvent: undefined,
        modeFiles: ["custom.ts"],
        pkgText: JSON.stringify({
          jueCli: [{ phase: "build", mode: "custom" }],
        }),
      }),
    ).rejects.toThrow("exit:1");

    expect(errors).toEqual([
      'No jueCli task found for phase: "test".',
      "Configured phases: build.",
    ]);
  });

  it("loads only the handlers needed by the active phase", async () => {
    const handledConfigs: Array<Record<string, unknown>> = [];
    const importedModules: string[] = [];

    await main({
      argv: ["test", "--coverage"],
      fileExists: () => true,
      importModule: async (specifier) => {
        importedModules.push(specifier);
        return {
          async run(config) {
            handledConfigs.push(config as Record<string, unknown>);
          },
        };
      },
      lifecycleEvent: undefined,
      modeFiles: ["custom.ts", "custom.test.ts", "other.ts"],
      modesDir: "/virtual/modes",
      pkgText: JSON.stringify({
        jueCli: [
          { phase: "test", mode: "custom", label: "run-test" },
          { phase: "build", mode: "other", label: "run-build" },
        ],
      }),
    });

    expect(importedModules).toEqual(["file:///C:/virtual/modes/custom.ts"]);
    expect(handledConfigs).toEqual([
      {
        $args: ["--coverage"],
        $phase: "test",
        label: "run-test",
        mode: "custom",
        phase: "test",
      },
    ]);
  });

  it("uses the default process.exit path when no exit override is provided", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process-exit:${code ?? 0}`);
      }) as typeof process.exit);

    await expect(
      main({
        argv: ["test"],
        lifecycleEvent: "",
        modeFiles: ["custom.ts"],
        pkgText: JSON.stringify({ jueCli: [] }),
      }),
    ).rejects.toThrow("process-exit:1");

    expect(errorSpy).toHaveBeenCalledWith(
      'No jueCli task found for phase: "test".',
    );

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("can use the built-in importer for bundled modes", async () => {
    await expect(
      main({
        argv: ["test"],
        lifecycleEvent: "",
        modeFiles: ["custom.ts"],
        pkgText: JSON.stringify({
          jueCli: [
            {
              command: 'node -e ""',
              mode: "custom",
              phase: "test",
            },
          ],
        }),
      }),
    ).resolves.toBeUndefined();
  });

  it("exits when a task is missing its mode", async () => {
    const errors: string[] = [];
    const exitSpy = createExitSpy();

    await expect(
      main({
        argv: ["test"],
        error: (...args) => errors.push(args.join(" ")),
        exit: exitSpy.exit,
        lifecycleEvent: undefined,
        modeFiles: ["custom.ts"],
        pkgText: JSON.stringify({
          jueCli: [{ phase: "test" }],
        }),
      }),
    ).rejects.toThrow("exit:1");

    expect(errors).toEqual([
      'jueCli task for phase "test" is missing required "mode" field.',
    ]);
  });

  it("exits when a configured mode is unavailable", async () => {
    const errors: string[] = [];
    const exitSpy = createExitSpy();

    await expect(
      main({
        argv: ["test"],
        error: (...args) => errors.push(args.join(" ")),
        exit: exitSpy.exit,
        fileExists: () => false,
        importModule: vi.fn(),
        lifecycleEvent: undefined,
        modeFiles: ["custom.ts", "other.ts"],
        modesDir: "/virtual/modes",
        pkgText: JSON.stringify({
          jueCli: [{ phase: "test", mode: "custom" }],
        }),
      }),
    ).rejects.toThrow("exit:1");

    expect(errors).toEqual([
      'Unknown mode: "custom" for phase "test". Available modes: custom, other.',
    ]);
  });
});
