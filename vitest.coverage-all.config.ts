import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const workspaceAliases = {
  "@jue/shared": resolve(__dirname, "packages/shared/src/index.ts"),
  "@jue/runtime-core": resolve(__dirname, "packages/runtime-core/src/index.ts"),
  "@jue/compiler": resolve(__dirname, "packages/compiler/src/index.ts"),
  "@jue/jsx": resolve(__dirname, "packages/jsx/src/index.ts"),
  "@jue/web": resolve(__dirname, "packages/web/src/index.ts"),
  "@jue/native": resolve(__dirname, "packages/native/src/index.ts")
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
        "packages/jsx/src/index.ts",
        "packages/native/src/index.ts",
        "packages/runtime-core/src/types.ts",
        "scripts/**"
      ]
    }
  }
});
