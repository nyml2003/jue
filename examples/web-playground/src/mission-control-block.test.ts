// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountMissionControlBlock } from "./mission-control-block";

describe("@jue/web-playground mission-control-block", () => {
  it("mounts a multi-binding dashboard and updates through runtime-owned events", () => {
    const root = document.createElement("div");
    const mountedResult = mountMissionControlBlock(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    const panel = root.querySelector(".mission-panel");
    const buttons = root.querySelectorAll("button");
    const input = root.querySelector("input");
    const progress = root.querySelector<HTMLElement>(".mission-panel > div:nth-of-type(2) > div");

    expect(panel).not.toBeNull();
    expect(root.textContent).toContain("Runtime mission");
    expect(root.textContent).toContain("Signal dispatch console");
    expect(root.textContent).toContain("Phase 1");
    expect(root.textContent).toContain("42");
    expect(root.textContent).toContain("Tracking");
    expect(root.textContent).toContain("Calibrate the signal table.");
    expect(input?.value).toBe("Calibrate the signal table.");
    expect(progress?.textContent).toBe("42%");
    expect(progress?.style.width).toBe("42%");

    buttons[0]?.click();
    expect(root.textContent).toContain("Phase 2");
    expect(root.textContent).toContain("59");
    expect(root.textContent).toContain("Tracking");
    expect(progress?.style.width).toBe("59%");

    buttons[0]?.click();
    expect(root.textContent).toContain("Phase 3");
    expect(root.textContent).toContain("76");
    expect(root.textContent).toContain("Nominal");
    expect(root.querySelector(".mission-pill--nominal")?.textContent).toBe("Nominal");
    expect(progress?.style.width).toBe("76%");

    if (input) {
      input.value = "Route async resources through scheduler.";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    expect(root.textContent).toContain("Route async resources through scheduler.");
    expect(input?.value).toBe("Route async resources through scheduler.");

    buttons[1]?.click();
    expect(root.textContent).toContain("Phase 1");
    expect(root.textContent).toContain("42");
    expect(root.textContent).toContain("Tracking");
    expect(root.textContent).toContain("Calibrate the signal table.");
    expect(input?.value).toBe("Calibrate the signal table.");
    expect(progress?.style.width).toBe("42%");

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});
