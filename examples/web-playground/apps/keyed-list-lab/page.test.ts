// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountKeyedListLab } from "./page";

describe("@jue/example-app keyed-list-lab", () => {
  it("mounts the keyed list canary and reconciles deterministic scenarios", () => {
    const root = document.createElement("div");
    const mountedResult = mountKeyedListLab(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("Keyed List Lab");
    expect(mountedResult.value.readOrder()).toEqual(["Alpha", "Bravo", "Charlie"]);

    expect(mountedResult.value.applyScenario("reordered").ok).toBe(true);
    expect(mountedResult.value.readOrder()).toEqual(["Bravo", "Delta", "Alpha"]);

    expect(mountedResult.value.applyScenario("trimmed").ok).toBe(true);
    expect(mountedResult.value.readOrder()).toEqual(["Delta"]);

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });

  it("returns an empty order snapshot when mounted on a non-element root", () => {
    const root = document.createDocumentFragment();
    const mountedResult = mountKeyedListLab(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.readOrder()).toEqual([]);
    expect(mountedResult.value.dispose().ok).toBe(true);
  });
});
