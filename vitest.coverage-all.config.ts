import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

import {
  readVitestCoverageIncludeOverride,
  readVitestIncludeOverride,
} from "./scripts/vitest-overrides";

const workspaceAliases = {
  "@jue/runtime-core/reactivity": resolve(__dirname, "packages/kernel/runtime-core/src/reactivity.ts"),
  "@jue/runtime-core/host-contract": resolve(__dirname, "packages/kernel/runtime-core/src/host-contract.ts"),
  "@jue/runtime-core/channel": resolve(__dirname, "packages/kernel/runtime-core/src/channel.ts"),
  "@jue/compiler/frontend": resolve(__dirname, "packages/kernel/compiler/src/frontend/index.ts"),
  "@jue/compiler/ir": resolve(__dirname, "packages/kernel/compiler/src/block-ir.ts"),
  "@jue/compiler/lowering": resolve(__dirname, "packages/kernel/compiler/src/block-ir.ts"),
  "@jue/compiler/builder": resolve(__dirname, "packages/kernel/compiler/src/blueprint-builder.ts"),
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
  "@jue/lab/examples": resolve(__dirname, "packages/tooling/lab/src/examples.ts"),
  "@jue/lab/inspect": resolve(__dirname, "packages/tooling/lab/src/inspect.ts"),
  "@jue/lab/testkit": resolve(__dirname, "packages/tooling/lab/src/testkit.ts"),
  "@jue/lab/bench": resolve(__dirname, "packages/tooling/lab/src/bench.ts"),
  "@jue/lab": resolve(__dirname, "packages/tooling/lab/src/index.ts")
};

const coverageIncludeOverride = readVitestCoverageIncludeOverride();
const defaultCoverageInclude = [
  "scripts/cli.ts",
  "scripts/cli-argv.ts",
  "scripts/cli-modes/test.ts",
  "scripts/vitest-overrides.ts",
  "packages/authoring/authoring-check/src/index.ts",
  "packages/authoring/primitives/src/index.ts",
  "packages/examples/web-playground/apps/**/page.ts",
  "packages/examples/web-playground/runtime/**/*.ts",
  "packages/host/web/src/**/*.ts",
  "packages/host-target/skyline/src/index.ts",
  "packages/kernel/compiler/src/**/*.ts",
  "packages/kernel/runtime-core/src/**/*.ts",
  "packages/kernel/shared/src/**/*.ts",
  "packages/stdlib/query/src/index.ts",
  "packages/stdlib/router/src/index.ts",
  "packages/stdlib/stream/src/index.ts",
  "packages/tooling/devtrace/src/index.ts",
  "packages/tooling/docsgen/src/index.ts",
  "packages/tooling/docsgen/src/status/**/*.ts",
  "packages/tooling/lab/src/bench.ts",
  "packages/tooling/lab/src/examples.ts",
  "packages/tooling/lab/src/index.ts",
  "packages/tooling/lab/src/inspect.ts",
  "packages/tooling/lab/src/testkit.ts",
];

export default defineConfig({
  resolve: {
    alias: workspaceAliases
  },
  test: {
    alias: workspaceAliases,
    include: readVitestIncludeOverride() ?? [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "scripts/**/*.test.ts",
      "scripts/**/*.test.tsx",
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
      include: coverageIncludeOverride ?? defaultCoverageInclude,
      exclude: [
        "**/coverage/**",
        "**/dist/**",
        "**/generated/**",
        "**/node_modules/**",
        "**/*.d.ts",
        "**/vite-env.d.ts",
        "eslint.config.mjs",
        "vitest.scripts.config.ts",
        "vitest.config.ts",
        "vitest.coverage-all.config.ts",
        "examples/**/e2e/**",
        "examples/**/playwright.config.ts",
        "examples/**/scripts/**",
        "examples/**/main.ts",
        "examples/**/*.component.tsx",
        "packages/examples/**/e2e/**",
        "packages/examples/**/playwright.config.ts",
        "packages/examples/**/scripts/**",
        "packages/examples/**/main.ts",
        "packages/examples/**/*.component.tsx",
        "packages/examples/jue-current-app/**",
        "packages/examples/jue-mobile-showcase/**",
        "packages/**/dist/**",
        "packages/kernel/compiler/src/cli.ts",
        "packages/authoring/jsx/src/index.ts",
        "packages/host/native/src/index.ts",
        "packages/kernel/runtime-core/src/types.ts",
        "packages/tooling/docsgen/src/cli.ts",
        "packages/tooling/docsgen/src/sizes/**",
        "packages/tooling/docsgen/src/topology/**",
        "packages/tooling/lab/src/cli.ts",
        "packages/tooling/lab/src/compile-examples.ts"
      ],
      thresholds: {
        perFile: true,
        statements: 80,
        lines: 80,
        functions: 80
      }
    }
  }
});
