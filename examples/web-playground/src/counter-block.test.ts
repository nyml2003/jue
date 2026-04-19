// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountCounterBlock } from "./counter-block";

describe("@jue/web-playground counter-block", () => {
  it("mounts the counter block and increments through runtime-owned event wiring", () => {
    const root = document.createElement("div");
    const mountedResult = mountCounterBlock(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    const button = root.querySelector("button");
    const value = root.querySelector(".value");

    expect(button).not.toBeNull();
    expect(value?.textContent).toBe("0");

    button?.click();
    expect(value?.textContent).toBe("1");

    button?.click();
    expect(value?.textContent).toBe("2");
  });
});
