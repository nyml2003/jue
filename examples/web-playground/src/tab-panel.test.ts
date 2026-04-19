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
    expect(tabs[1]?.className).toContain("tab-panel-item--active");
    expect(tabs[0]?.className).not.toContain("tab-panel-item--active");

    tabs[2]?.click();
    expect(root.textContent).toContain("Active: Item 3");
    expect(root.querySelectorAll(".tab-panel-content")).toHaveLength(1);
    expect(root.textContent).not.toContain("Component 1");
    expect(root.textContent).not.toContain("Component 2");
    expect(root.textContent).toContain("Component 3");
    expect(tabs[2]?.className).toContain("tab-panel-item--active");

    const selectItemOneResult = mountedResult.value.selectItemOne();
    expect(selectItemOneResult.ok).toBe(true);
    expect(root.textContent).toContain("Active: Item 1");
    expect(root.querySelectorAll(".tab-panel-content")).toHaveLength(1);
    expect(root.textContent).toContain("Component 1");

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});
