import { describe, expect, it } from "vitest";

import { inspectCompiledModule, inspectExampleApp } from "../src/index";

describe("@jue/inspect", () => {
  it("inspects compiled example apps through the compiler frontend", async () => {
    const inspected = await inspectExampleApp("virtual-list-lab");

    expect(inspected.ok).toBe(true);
    if (!inspected.ok) {
      return;
    }

    expect(inspected.value.summary.nodeCount).toBeGreaterThan(0);
    expect(inspected.value.summary.virtualListDescriptorCount).toBe(1);
  });

  it("summarizes compiled module metadata", async () => {
    const inspected = await inspectExampleApp("account-overview");

    expect(inspected.ok).toBe(true);
    if (!inspected.ok) {
      return;
    }

    const summary = inspectCompiledModule(inspected.value.module);
    expect(summary.bindingCount).toBeGreaterThan(0);
    expect(summary.handlerCount).toBeGreaterThan(0);
  });
});
