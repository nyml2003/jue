import { defineConfig } from "@playwright/test";

const EDGE_EXECUTABLE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

export default defineConfig({
  testDir: "./apps",
  testMatch: "**/e2e/*.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: EDGE_EXECUTABLE_PATH
    }
  },
  webServer: {
    command: "pnpm exec tsx ./scripts/serve-built-example-apps.ts",
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000
  }
});
