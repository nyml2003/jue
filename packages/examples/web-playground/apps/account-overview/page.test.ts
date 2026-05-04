// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountAccountOverview } from "./page";

describe("@jue/example-app account-overview", () => {
  it("mounts the account overview app and keeps actions executable", () => {
    const root = document.createElement("div");
    const mountedResult = mountAccountOverview(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("Account Overview");
    expect(root.textContent).toContain("Healthy renewal posture");
    expect(root.textContent).toContain("Monthly revenue");
    expect(root.textContent).toContain("Days to renewal");
    expect(root.textContent).toContain("24");

    const detailRow = root.querySelector(".account-detail-row");
    expect(detailRow).not.toBeNull();
    expect(detailRow).toHaveProperty("style.width", "100%");
    expect(detailRow).toHaveProperty("style.opacity", "0.96");

    const detailInput = root.querySelector("input");
    expect(detailInput).not.toBeNull();
    if (detailInput instanceof HTMLInputElement) {
      expect(detailInput.disabled).toBe(true);
      expect(detailInput.value).toBe("Auto-billed");
    }

    const buttons = root.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    buttons[0]?.click();
    buttons[1]?.click();

    expect(mountedResult.value.getOpenInvoicesCount()).toBe(1);
    expect(mountedResult.value.getScheduleReviewCount()).toBe(1);

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});
