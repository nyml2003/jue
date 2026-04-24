// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { readCompiledItems, type CompiledVirtualListDescriptor } from "../../runtime/compiled-structures";
import { initialSignalValues, virtualListDescriptors } from "./generated/page.generated";
import { mountVirtualListLab } from "./page";

describe("@jue/example-app virtual-list-lab", () => {
  it("mounts the virtual list canary and reuses visible cells across window updates", () => {
    const root = document.createElement("div");
    const mountedResult = mountVirtualListLab(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("Virtual List Lab");
    expect(mountedResult.value.readVisibleLabels()).toEqual(["Row 0", "Row 1", "Row 2", "Row 3", "Row 4"]);
    expect(mountedResult.value.readReuseIds()).toEqual(["0", "1", "2", "3", "4"]);

    const viewport = root.querySelector<HTMLElement>(".virtual-lab-viewport");
    expect(viewport).not.toBeNull();
    if (!viewport) {
      return;
    }

    viewport.scrollTop = 48 * 4;
    viewport.dispatchEvent(new Event("scroll"));
    expect(mountedResult.value.readVisibleLabels()).toEqual(["Row 3", "Row 4", "Row 5", "Row 6", "Row 7"]);
    expect(mountedResult.value.readReuseIds()).toEqual(["0", "1", "2", "3", "4"]);

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });

  it("returns empty snapshots when mounted on a non-element root", () => {
    const root = document.createDocumentFragment();
    const mountedResult = mountVirtualListLab(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.readVisibleLabels()).toEqual([]);
    expect(mountedResult.value.readReuseIds()).toEqual([]);
    expect(mountedResult.value.dispose().ok).toBe(true);
  });

  it("keeps the visible-label canary aligned with generated seed data", () => {
    const descriptor = virtualListDescriptors[0] as CompiledVirtualListDescriptor | undefined;
    expect(descriptor).toBeDefined();
    if (!descriptor) {
      return;
    }

    const items = readCompiledItems<{ readonly label: string }>(descriptor, initialSignalValues);
    expect(items.slice(0, 5).map(item => item.label)).toEqual(["Row 0", "Row 1", "Row 2", "Row 3", "Row 4"]);
  });
});
