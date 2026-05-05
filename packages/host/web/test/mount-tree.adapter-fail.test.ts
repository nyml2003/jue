// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { createBlueprint } from "@jue/runtime-core";
import { INVALID_INDEX } from "@jue/shared";

afterEach(() => {
  vi.resetModules();
  vi.unmock("../src/adapter");
});

describe("@jue/web mountTree adapter failures", () => {
  it("surfaces host adapter createNode failures", async () => {
    vi.doMock("../src/adapter", () => ({
      createWebHostAdapter() {
        return {
          createNode() {
            return {
              ok: false,
              value: null,
              error: {
                code: "BROKEN_CREATE_NODE",
                message: "createNode failed"
              }
            };
          },
          createText: vi.fn(),
          insert: vi.fn(),
          remove: vi.fn(),
          setText: vi.fn(),
          setProp: vi.fn(),
          setStyle: vi.fn(),
          setEvent: vi.fn()
        };
      }
    }));

    const { mountTree } = await import("../src/index");
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      nodeKind: new Uint8Array([1]),
      nodePrimitiveRefIndex: new Uint32Array([0]),
      nodeTextRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeParentIndex: new Uint32Array([INVALID_INDEX]),
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      bindingArgRef: ["View"],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });
    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    expect(mountTree({
      blueprint: blueprintResult.value,
      root: document.createElement("div"),
      signalCount: 0
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BROKEN_CREATE_NODE",
        message: "createNode failed"
      }
    });
  });

  it("surfaces host adapter createText failures", async () => {
    vi.doMock("../src/adapter", () => ({
      createWebHostAdapter() {
        return {
          createNode: vi.fn(),
          createText() {
            return {
              ok: false,
              value: null,
              error: {
                code: "BROKEN_CREATE_TEXT",
                message: "createText failed"
              }
            };
          },
          insert: vi.fn(),
          remove: vi.fn(),
          setText: vi.fn(),
          setProp: vi.fn(),
          setStyle: vi.fn(),
          setEvent: vi.fn()
        };
      }
    }));

    const { mountTree } = await import("../src/index");
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      nodeKind: new Uint8Array([2]),
      nodePrimitiveRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeTextRefIndex: new Uint32Array([0]),
      nodeParentIndex: new Uint32Array([INVALID_INDEX]),
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      bindingArgRef: ["hello"],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });
    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    expect(mountTree({
      blueprint: blueprintResult.value,
      root: document.createElement("div"),
      signalCount: 0
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BROKEN_CREATE_TEXT",
        message: "createText failed"
      }
    });
  });
});
