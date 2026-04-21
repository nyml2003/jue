// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountReleaseChecklist } from "./page";

describe("@jue/example-app release-checklist", () => {
  it("mounts the release checklist app and keeps rollout actions executable", () => {
    const root = document.createElement("div");
    const mountedResult = mountReleaseChecklist(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("Release Checklist");
    expect(root.textContent).toContain("Ready for rollout");
    expect(root.textContent).toContain("All blocking checks are green. Proceed with staged rollout.");

    const buttons = root.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    buttons[0]?.click();
    buttons[1]?.click();

    expect(mountedResult.value.getOpenRunbookCount()).toBe(1);
    expect(mountedResult.value.getNotifyOpsCount()).toBe(1);

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});

