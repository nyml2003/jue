// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountMissionControlBlock } from "./mission-control-block";

describe("@jue/web-playground mission-control-block", () => {
  it("mounts a multi-binding dashboard and exposes region diagnostics through runtime-owned events", () => {
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
    expect(root.textContent).toContain("42");
    expect(root.textContent).toContain("Calibrate the signal table.");
    expect(root.textContent).toContain("conditional: inactive");
    expect(root.textContent).toContain("active branch: none");
    expect(root.textContent).toContain("mounted branch: none");
    expect(root.textContent).toContain("branch range: none");
    expect(root.textContent).toContain("nested lifecycle: inactive");
    expect(input?.value).toBe("Calibrate the signal table.");
    expect(progress?.textContent).toBe("42%");
    expect(progress?.style.width).toBe("42%");
    expect(root.textContent).not.toContain("Phase 1");
    expect(root.textContent).not.toContain("Tracking");

    buttons[0]?.click();
    expect(root.textContent).toContain("59");
    expect(progress?.style.width).toBe("59%");

    buttons[2]?.click();
    expect(root.textContent).toContain("Attached conditional branch A.");
    expect(root.textContent).toContain("conditional: active");
    expect(root.textContent).toContain("active branch: 0");
    expect(root.textContent).toContain("mounted branch: 0");
    expect(root.textContent).toContain("branch range:");
    expect(root.textContent).toContain("Phase 2");
    expect(root.textContent).toContain("59");
    expect(root.textContent).not.toContain("StatusTracking");

    buttons[3]?.click();
    expect(root.textContent).toContain("Conditional branch switched to 1.");
    expect(root.textContent).toContain("active branch: 1");
    expect(root.textContent).toContain("mounted branch: 1");
    expect(root.textContent).toContain("StatusTracking");
    expect(root.textContent).not.toContain("Phase 2");

    buttons[5]?.click();
    expect(root.textContent).toContain("Nested block attached.");
    expect(root.textContent).toContain("nested lifecycle: active");
    expect(root.textContent).toContain("nested mounted: block 7 / blueprint 0");
    expect(root.textContent).toContain("Child block A");
    expect(root.textContent).toContain("Mounted through web region controller.");

    buttons[6]?.click();
    expect(root.textContent).toContain("Nested block replaced with block 13.");
    expect(root.textContent).toContain("nested mounted: block 13 / blueprint 1");
    expect(root.textContent).toContain("Child block B");
    expect(root.textContent).toContain("Replacement disposes the old child tree.");
    expect(root.textContent).not.toContain("Child block A");

    if (input) {
      input.value = "Route async resources through scheduler.";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    expect(root.textContent).toContain("Route async resources through scheduler.");
    expect(input?.value).toBe("Route async resources through scheduler.");

    buttons[4]?.click();
    expect(root.textContent).toContain("Conditional branch cleared.");
    expect(root.textContent).toContain("mounted branch: none");
    expect(root.textContent).toContain("branch range: none");
    expect(root.textContent).not.toContain("Phase 3");
    expect(root.textContent).not.toContain("76");
    expect(root.textContent).not.toContain("Nominal");

    buttons[7]?.click();
    expect(root.textContent).toContain("Nested block detached.");
    expect(root.textContent).toContain("nested lifecycle: inactive");
    expect(root.textContent).toContain("nested mounted: none");
    expect(root.textContent).not.toContain("Child block B");

    buttons[1]?.click();
    expect(root.textContent).toContain("42");
    expect(root.textContent).toContain("Calibrate the signal table.");
    expect(root.textContent).toContain("conditional: inactive");
    expect(root.textContent).toContain("Region slots initialized. Awaiting branch attach.");
    expect(input?.value).toBe("Calibrate the signal table.");
    expect(progress?.style.width).toBe("42%");

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});
