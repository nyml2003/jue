// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

describe("@jue/example-app virtual-list-lab errors", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./generated/page.generated");
  });

  it("reports missing generated virtual list descriptors", async () => {
    vi.doMock("./generated/page.generated", () => ({
      blueprint: {},
      initialSignalValues: [],
      signalCount: 0,
      virtualListDescriptors: []
    }));

    const { mountVirtualListLab } = await import("./page");
    expect(mountVirtualListLab(document.createElement("div"))).toEqual({
      ok: false,
      value: null,
      error: {
        code: "VIRTUAL_LIST_DESCRIPTOR_MISSING",
        message: "Generated virtual list descriptor is missing."
      }
    });
  });
});
