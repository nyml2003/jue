import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const workspaceAliases = {
  "@jue/runtime-core/reactivity": resolve(__dirname, "packages/runtime-core/src/reactivity.ts"),
  "@jue/runtime-core/host-contract": resolve(__dirname, "packages/runtime-core/src/host-contract.ts"),
  "@jue/compiler/frontend": resolve(__dirname, "packages/compiler/src/frontend/index.ts"),
  "@jue/compiler/ir": resolve(__dirname, "packages/compiler/src/ir.ts"),
  "@jue/compiler/lowering": resolve(__dirname, "packages/compiler/src/lowering.ts"),
  "@jue/compiler/builder": resolve(__dirname, "packages/compiler/src/builder.ts"),
  "@jue/shared": resolve(__dirname, "packages/shared/src/index.ts"),
  "@jue/runtime-core": resolve(__dirname, "packages/runtime-core/src/index.ts"),
  "@jue/compiler": resolve(__dirname, "packages/compiler/src/index.ts"),
  "@jue/jsx": resolve(__dirname, "packages/jsx/src/index.ts"),
  "@jue/web": resolve(__dirname, "packages/web/src/index.ts"),
  "@jue/native": resolve(__dirname, "packages/native/src/index.ts"),
  "@jue/examples": resolve(__dirname, "packages/examples/src/index.ts"),
  "@jue/inspect": resolve(__dirname, "packages/inspect/src/index.ts"),
  "@jue/testkit": resolve(__dirname, "packages/testkit/src/index.ts"),
  "@jue/bench": resolve(__dirname, "packages/bench/src/index.ts")
};

export default defineConfig({
  resolve: {
    alias: workspaceAliases
  },
  test: {
    alias: workspaceAliases,
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "examples/**/*.test.ts",
      "examples/**/*.test.tsx"
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: [
        "text",
        "json-summary"
      ],
      include: [
        "packages/compiler/src/block-ir.ts",
        "packages/compiler/src/blueprint-builder.ts"
      ],
      exclude: [
        "**/coverage/**",
        "**/dist/**",
        "**/generated/**",
        "**/node_modules/**",
        "**/*.d.ts",
        "**/vite-env.d.ts",
        "examples/**/e2e/**",
        "examples/**/playwright.config.ts",
        "examples/**/scripts/**",
        "scripts/**",
        "packages/**/dist/**"
      ],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80
      }
    }
  }
});
