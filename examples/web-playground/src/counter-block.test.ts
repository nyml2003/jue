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
    const card = root.querySelector(".card");
    const title = root.querySelector("span");
    const summary = root.querySelectorAll("span")[1];
    const label = root.querySelector(".label");

    expect(button).not.toBeNull();
    expect(card).not.toBeNull();
    expect(title?.textContent).toBe("jue counter block");
    expect(summary?.textContent).toBe("This demo is mounted from a runtime-owned static node table.");
    expect(label?.textContent).toBe("Count:");
    expect(value?.textContent).toBe("0");
    expect(button?.textContent).toBe("Increment");

    button?.click();
    expect(value?.textContent).toBe("1");

    button?.click();
    expect(value?.textContent).toBe("2");
  });
});
