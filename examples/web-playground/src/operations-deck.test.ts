// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountOperationsDeck } from "./operations-deck";

describe("@jue/web-playground operations-deck", () => {
  it("mounts a complex TSX-authored operations page and keeps button handlers executable", () => {
    const root = document.createElement("div");
    const mountedResult = mountOperationsDeck(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("Fleet Readiness Deck");
    expect(root.textContent).toContain("Nominal orbit");
    expect(root.textContent).toContain("Active missions");
    expect(root.textContent).toContain("128");
    expect(root.textContent).toContain("Compiled from .tsx to executable module output.");

    const buttons = root.querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.textContent).toBe("Arm response");
    expect(buttons[1]?.textContent).toBe("Sync convoy");
    expect(buttons[2]?.textContent).toBe("Escalate lane");

    buttons[0]?.click();
    buttons[1]?.click();
    buttons[2]?.click();

    expect(mountedResult.value.getPrimaryActionCount()).toBe(1);
    expect(mountedResult.value.getSyncActionCount()).toBe(1);
    expect(mountedResult.value.getEscalateActionCount()).toBe(1);

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});
