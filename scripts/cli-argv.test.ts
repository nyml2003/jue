import { describe, expect, it } from "vitest";

import { parsePhaseInvocation } from "./cli-argv";

describe("parsePhaseInvocation", () => {
  it("uses an explicit phase argument when one is provided", () => {
    expect(parsePhaseInvocation(["test", "--coverage"], "lint")).toEqual({
      forwardedArgs: ["--coverage"],
      phase: "test",
    });
  });

  it("falls back to npm_lifecycle_event for npm script invocations", () => {
    expect(parsePhaseInvocation(["--coverage"], "test")).toEqual({
      forwardedArgs: ["--coverage"],
      phase: "test",
    });
  });

  it("returns an undefined phase when no signal is available", () => {
    expect(parsePhaseInvocation([], undefined)).toEqual({
      forwardedArgs: [],
      phase: undefined,
    });
  });
});
