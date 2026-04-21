// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountCompilerCanary } from "./compiler-canary";

describe("@jue/web-playground compiler-canary", () => {
  it("mounts a .tsx-authored canary through compile() and the web runtime", () => {
    const root = document.createElement("div");
    const mountedResult = mountCompilerCanary(root);
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("1Compiled from a");
    expect(root.textContent).toContain("Signal value:xxx1");
    const button = root.querySelector("button");
    expect(button?.textContent).toBe("Click 11me");

    button?.click();
    expect(mountedResult.value.getPressCount()).toBe(1);

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});
