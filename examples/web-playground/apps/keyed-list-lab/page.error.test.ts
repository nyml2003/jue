// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

describe("@jue/example-app keyed-list-lab errors", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./generated/page.generated");
  });

  it("reports missing generated keyed list descriptors", async () => {
    vi.doMock("./generated/page.generated", () => ({
      blueprint: {},
      initialSignalValues: [],
      keyedListDescriptors: [],
      signalCount: 0
    }));

    const { mountKeyedListLab } = await import("./page");
    expect(mountKeyedListLab(document.createElement("div"))).toEqual({
      ok: false,
      value: null,
      error: {
        code: "KEYED_LIST_DESCRIPTOR_MISSING",
        message: "Generated keyed list descriptor is missing."
      }
    });
  });
});
