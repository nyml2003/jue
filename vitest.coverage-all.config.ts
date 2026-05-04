import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const workspaceAliases = {
  "@jue/runtime-core/reactivity": resolve(__dirname, "packages/kernel/runtime-core/src/reactivity.ts"),
  "@jue/runtime-core/host-contract": resolve(__dirname, "packages/kernel/runtime-core/src/host-contract.ts"),
  "@jue/runtime-core/channel": resolve(__dirname, "packages/kernel/runtime-core/src/channel.ts"),
  "@jue/compiler/frontend": resolve(__dirname, "packages/kernel/compiler/src/frontend/index.ts"),
  "@jue/compiler/ir": resolve(__dirname, "packages/kernel/compiler/src/ir.ts"),
  "@jue/compiler/lowering": resolve(__dirname, "packages/kernel/compiler/src/lowering.ts"),
  "@jue/compiler/builder": resolve(__dirname, "packages/kernel/compiler/src/builder.ts"),
  "@jue/shared": resolve(__dirname, "packages/kernel/shared/src/index.ts"),
  "@jue/runtime-core": resolve(__dirname, "packages/kernel/runtime-core/src/index.ts"),
  "@jue/compiler": resolve(__dirname, "packages/kernel/compiler/src/index.ts"),
  "@jue/jsx": resolve(__dirname, "packages/authoring/jsx/src/index.ts"),
  "@jue/primitives": resolve(__dirname, "packages/authoring/primitives/src/index.ts"),
  "@jue/authoring-check": resolve(__dirname, "packages/authoring/authoring-check/src/index.ts"),
  "@jue/stream": resolve(__dirname, "packages/stdlib/stream/src/index.ts"),
  "@jue/router": resolve(__dirname, "packages/stdlib/router/src/index.ts"),
  "@jue/query": resolve(__dirname, "packages/stdlib/query/src/index.ts"),
  "@jue/devtrace": resolve(__dirname, "packages/tooling/devtrace/src/index.ts"),
  "@jue/docsgen": resolve(__dirname, "packages/tooling/docsgen/src/index.ts"),
  "@jue/web": resolve(__dirname, "packages/host/web/src/index.ts"),
  "@jue/native": resolve(__dirname, "packages/host/native/src/index.ts"),
  "@jue/examples": resolve(__dirname, "packages/tooling/examples/src/index.ts"),
  "@jue/inspect": resolve(__dirname, "packages/tooling/inspect/src/index.ts"),
  "@jue/testkit": resolve(__dirname, "packages/tooling/testkit/src/index.ts"),
  "@jue/bench": resolve(__dirname, "packages/tooling/bench/src/index.ts")
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
      exclude: [
        "**/coverage/**",
        "**/dist/**",
        "**/generated/**",
        "**/node_modules/**",
        "**/*.d.ts",
        "**/vite-env.d.ts",
        "eslint.config.mjs",
        "vitest.config.ts",
        "vitest.coverage-all.config.ts",
        "examples/**/e2e/**",
        "examples/**/playwright.config.ts",
        "examples/**/scripts/**",
        "examples/**/main.ts",
        "examples/**/*.component.tsx",
        "packages/**/dist/**",
        "packages/authoring/jsx/src/index.ts",
        "packages/host/native/src/index.ts",
        "packages/kernel/runtime-core/src/types.ts",
        "scripts/**"
      ]
    }
  }
});
