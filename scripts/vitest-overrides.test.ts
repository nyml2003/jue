import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readVitestCoverageIncludeOverride,
  readVitestIncludeOverride,
} from "./vitest-overrides";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("vitest override readers", () => {
  it("returns undefined when no override is present", () => {
    expect(readVitestIncludeOverride()).toBeUndefined();
    expect(readVitestCoverageIncludeOverride()).toBeUndefined();
  });

  it("reads JSON encoded string arrays", () => {
    vi.stubEnv("JUE_VITEST_INCLUDE", JSON.stringify(["scripts/**/*.test.ts"]));
    vi.stubEnv(
      "JUE_VITEST_COVERAGE_INCLUDE",
      JSON.stringify(["scripts/cli.ts"]),
    );

    expect(readVitestIncludeOverride()).toEqual(["scripts/**/*.test.ts"]);
    expect(readVitestCoverageIncludeOverride()).toEqual(["scripts/cli.ts"]);
  });

  it("rejects malformed override values", () => {
    vi.stubEnv("JUE_VITEST_INCLUDE", JSON.stringify(["ok", 1]));
    expect(() => readVitestIncludeOverride()).toThrow(
      "JUE_VITEST_INCLUDE must be a JSON-encoded string array.",
    );
  });
});
