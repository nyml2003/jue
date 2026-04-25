// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountStreamLab } from "./page";

describe("@jue/example-app stream-lab", () => {
  it("mounts the stream demo and lets authored handlers drive signal updates", () => {
    const root = document.createElement("div");
    const mountedResult = mountStreamLab(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("Stream Lab");

    mountedResult.value.recordWin();
    expect(mountedResult.value.readSnapshot()).toEqual({
      momentum: "3",
      wins: "1",
      followUps: "0",
      risks: "0",
      headline: "Steady delivery rhythm",
      recommendation: "Convert the win into visible progress before momentum cools down."
    });

    mountedResult.value.recordFollowUp();
    expect(mountedResult.value.readSnapshot().followUps).toBe("1");

    mountedResult.value.recordRisk();
    expect(mountedResult.value.readSnapshot().risks).toBe("1");
    expect(mountedResult.value.readSnapshot().recommendation).toContain("customer-facing note");

    expect(mountedResult.value.dispose().ok).toBe(true);
  });
});
