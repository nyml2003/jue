// @vitest-environment jsdom

import { BindingOpcode, Lane } from "@jue/shared";
import { createBlueprint } from "@jue/runtime-core";
import { describe, expect, it } from "vitest";

import { mountBlock } from "../src/mount-block";

describe("@jue/web mountBlock", () => {
  it("rejects detached host roots before mounting", () => {
    const detachedRoot = document.implementation.createHTMLDocument("detached").createElement("div");

    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });
    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    expect(mountBlock({
      blueprint: blueprintResult.value,
      signalCount: 0,
      root: detachedRoot,
      createNode() {
        throw new Error("should not run");
      }
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_HOST_ROOT",
        message: "mount() expected a DOM root attached to a live document window."
      }
    });
  });

  it("propagates createNode failures and no-op signal writes", () => {
    const root = document.createElement("div");
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0),
      signalToBindingStart: new Uint32Array([0]),
      signalToBindingCount: new Uint32Array([1]),
      signalToBindings: new Uint32Array([0])
    });
    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    expect(mountBlock({
      blueprint: blueprintResult.value,
      signalCount: 1,
      root,
      createNode() {
        return {
          ok: false,
          value: null,
          error: {
            code: "BROKEN_NODE_FACTORY",
            message: "broken"
          }
        };
      }
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BROKEN_NODE_FACTORY",
        message: "broken"
      }
    });

    const mountedResult = mountBlock({
      blueprint: blueprintResult.value,
      signalCount: 1,
      root,
      lane: Lane.DEFERRED,
      createNode() {
        return {
          ok: true,
          value: document.createTextNode("") as never,
          error: null
        };
      }
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.setSignal(0, null)).toEqual({
      ok: true,
      value: {
        batchId: 0,
        flushedBindingCount: 0
      },
      error: null
    });
  });

  it("rejects updates after dispose and allows repeated dispose", () => {
    const root = document.createElement("div");
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0),
      signalToBindingStart: new Uint32Array([0]),
      signalToBindingCount: new Uint32Array([1]),
      signalToBindings: new Uint32Array([0])
    });
    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const mountedResult = mountBlock({
      blueprint: blueprintResult.value,
      signalCount: 1,
      root,
      createNode() {
        return {
          ok: true,
          value: document.createTextNode("") as never,
          error: null
        };
      }
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.dispose()).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    expect(mountedResult.value.setSignal(0, "x")).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BLOCK_MOUNT_DISPOSED",
        message: "Cannot update a mounted block after it has been disposed."
      }
    });
    expect(mountedResult.value.dispose()).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
  });
});

