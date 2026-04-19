// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountTabPanel } from "./tab-panel";

describe("@jue/web-playground tab-panel", () => {
  it("switches between three static component panels through tab item clicks", () => {
    const root = document.createElement("div");
    const mountedResult = mountTabPanel(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    const tabs = root.querySelectorAll("button");

    expect(root.querySelector(".tab-panel")).not.toBeNull();
    expect(tabs).toHaveLength(3);
    expect(root.querySelectorAll(".tab-panel-content")).toHaveLength(1);
    expect(root.textContent).toContain("Active: Item 1");
    expect(root.textContent).toContain("Component 1");
    expect(root.textContent).not.toContain("Component 2");
    expect(root.textContent).not.toContain("Component 3");
    expect(tabs[0]?.className).toContain("tab-panel-item--active");

    tabs[1]?.click();
    expect(root.textContent).toContain("Active: Item 2");
    expect(root.querySelectorAll(".tab-panel-content")).toHaveLength(1);
    expect(root.textContent).not.toContain("Component 1");
    expect(root.textContent).toContain("Component 2");
    expect(root.textContent).not.toContain("Component 3");
    expect(root.textContent).toContain("Virtual list: 1000 items, 12 visible cells.");
    expect(root.textContent).toContain("Showing 1-12 of 1000");
    expect(root.querySelectorAll(".tab-panel-list-row")).toHaveLength(12);
    expect(root.textContent).toContain("Row 0001 / 1000");
    expect(root.textContent).toContain("Row 0012 / 1000");
    expect(root.textContent).not.toContain("Row 0013 / 1000");
    expect(tabs[1]?.className).toContain("tab-panel-item--active");
    expect(tabs[0]?.className).not.toContain("tab-panel-item--active");
    const firstVirtualRow = root.querySelector(".tab-panel-list-row");
    const viewport = root.querySelector(".tab-panel-content > div");
    expect(viewport).not.toBeNull();

    const showWindowResult = mountedResult.value.showListWindow(120);
    expect(showWindowResult.ok).toBe(true);
    expect(root.querySelectorAll(".tab-panel-list-row")).toHaveLength(12);
    expect(root.textContent).toContain("Showing 121-132 of 1000");
    expect(root.textContent).toContain("Row 0121 / 1000");
    expect(root.textContent).toContain("Row 0132 / 1000");
    expect(root.textContent).not.toContain("Row 0001 / 1000");
    expect(root.querySelector(".tab-panel-list-row")).toBe(firstVirtualRow);

    if (viewport instanceof HTMLDivElement) {
      viewport.scrollTop = 44 * 200;
      viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    }

    expect(root.textContent).toContain("Showing 201-212 of 1000");
    expect(root.textContent).toContain("Row 0201 / 1000");
    expect(root.textContent).toContain("Row 0212 / 1000");
    expect(root.querySelector(".tab-panel-list-row")).toBe(firstVirtualRow);

    tabs[2]?.click();
    expect(root.textContent).toContain("Active: Item 3");
    expect(root.querySelectorAll(".tab-panel-content")).toHaveLength(1);
    expect(root.textContent).not.toContain("Component 1");
    expect(root.textContent).not.toContain("Component 2");
    expect(root.textContent).toContain("Component 3");
    expect(root.querySelectorAll(".tab-panel-list-row")).toHaveLength(0);
    expect(tabs[2]?.className).toContain("tab-panel-item--active");

    const selectItemOneResult = mountedResult.value.selectItemOne();
    expect(selectItemOneResult.ok).toBe(true);
    expect(root.textContent).toContain("Active: Item 1");
    expect(root.querySelectorAll(".tab-panel-content")).toHaveLength(1);
    expect(root.textContent).toContain("Component 1");
    expect(root.querySelectorAll(".tab-panel-list-row")).toHaveLength(0);

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});
