import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "scripts/**/*.test.ts",
      "scripts/**/*.test.tsx",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: [
        "text",
        "json-summary",
      ],
      all: true,
      include: [
        "scripts/cli.ts",
        "scripts/cli-argv.ts",
        "scripts/cli-modes/test.ts",
        "scripts/vitest-overrides.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
      thresholds: {
        perFile: true,
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
