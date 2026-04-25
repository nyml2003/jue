// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { mountRouterQueryLab } from "./page";

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("@jue/example-app router-query-lab", () => {
  it("drives route params, query tabs, cache reuse, and invalidation through one mounted app", async () => {
    window.history.replaceState({}, "", "/router-query-lab");

    const root = document.createElement("div");
    const mountedResult = mountRouterQueryLab(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    await settle();
    expect(root.textContent).toContain("Router Query Lab");
    expect(mountedResult.value.currentHref()).toContain("/projects/alpha?tab=overview");
    expect(mountedResult.value.readVisibleText()).toContain("Escalation is still blocking launch.");
    expect(mountedResult.value.readVisibleText()).toContain("alpha/overview loaded 1x.");

    mountedResult.value.clickActivity();
    await settle();
    expect(mountedResult.value.currentHref()).toContain("/projects/alpha?tab=activity");
    expect(mountedResult.value.readVisibleText()).toContain("Activity feed looks healthy.");

    mountedResult.value.clickBravo();
    await settle();
    expect(mountedResult.value.currentHref()).toContain("/projects/bravo?tab=overview");
    expect(mountedResult.value.readVisibleText()).toContain("Bravo overview currently renders the Show fallback branch.");

    mountedResult.value.clickInvalidate();
    expect(mountedResult.value.readVisibleText()).toContain("marked stale");

    mountedResult.value.clickReload();
    await settle();
    expect(mountedResult.value.readVisibleText()).toContain("bravo/overview loaded 2x.");

    expect(mountedResult.value.dispose().ok).toBe(true);
  });

  it("keeps the latest route visible when a slower prior route resolves after a faster navigation", async () => {
    window.history.replaceState({}, "", "/router-query-lab");

    const root = document.createElement("div");
    const mountedResult = mountRouterQueryLab(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    mountedResult.value.clickBravo();
    await settle(40);

    expect(mountedResult.value.currentHref()).toContain("/projects/bravo?tab=overview");
    expect(mountedResult.value.readVisibleText()).toContain("Bravo overview currently renders the Show fallback branch.");
    expect(mountedResult.value.readVisibleText()).not.toContain("Route params pick the project while @jue/query reuses the cached overview if you come back later.");

    expect(mountedResult.value.dispose().ok).toBe(true);
  });
});

async function settle(ms: number = 35): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}
