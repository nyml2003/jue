// @vitest-environment jsdom

import { BindingOpcode, Lane } from "@jue/shared";
import { describe, expect, it } from "vitest";
import {
  createBlockInstance,
  createBlueprint,
  createSchedulerState,
  flushBindingQueue,
  type HostNode,
  scheduleSignalWrite
} from "@jue/runtime-core";

import { createWebHostAdapter, mountBlock, mountText } from "../src/index";

describe("@jue/web", () => {
  it("flushes a text binding to a DOM text node", () => {
    const adapter = createWebHostAdapter();
    const textNodeResult = adapter.createText("");

    expect(textNodeResult.ok).toBe(true);
    if (!textNodeResult.ok) {
      return;
    }

    const root = document.createElement("div");
    const insertResult = adapter.insert(root as unknown as HostNode, textNodeResult.value, null);
    expect(insertResult).toEqual({
      ok: true,
      value: undefined,
      error: null
    });

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

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 1,
      nodes: [textNodeResult.value]
    });
    const scheduler = createSchedulerState();

    expect(scheduleSignalWrite(instance, scheduler, Lane.VISIBLE_UPDATE, 0, "hello world")).toEqual({
      ok: true,
      value: {
        changed: true,
        enqueuedBindingCount: 1
      },
      error: null
    });

    expect(flushBindingQueue(instance, scheduler, adapter)).toEqual({
      ok: true,
      value: {
        batchId: 1,
        flushedBindingCount: 1
      },
      error: null
    });
    expect(root.textContent).toBe("hello world");
  });

  it("mounts, updates, and disposes a text node through the web runtime helper", () => {
    const root = document.createElement("div");
    const mountedResult = mountText(root, "0");

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toBe("0");
    expect(mountedResult.value.set(1)).toEqual({
      ok: true,
      value: {
        batchId: 2,
        flushedBindingCount: 1
      },
      error: null
    });
    expect(root.textContent).toBe("1");

    expect(mountedResult.value.set(1)).toEqual({
      ok: true,
      value: {
        batchId: 2,
        flushedBindingCount: 0
      },
      error: null
    });

    expect(mountedResult.value.dispose()).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    expect(root.textContent).toBe("");
  });

  it("mounts a generic block and updates its text binding through setSignal", () => {
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
        return createWebHostAdapter().createText("");
      }
    });

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.setSignal(0, "generic")).toEqual({
      ok: true,
      value: {
        batchId: 1,
        flushedBindingCount: 1
      },
      error: null
    });
    expect(root.textContent).toBe("generic");
  });

  it("rejects an invalid host root before mounting", () => {
    const invalidRoot = {} as Node;
    const mountedResult = mountText(invalidRoot, "hello");

    expect(mountedResult).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_HOST_ROOT",
        message: "mount() expected a DOM Node-compatible root."
      }
    });
  });
});
