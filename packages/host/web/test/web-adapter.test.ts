// @vitest-environment jsdom

import { BindingOpcode, Lane } from "@jue/shared";
import { describe, expect, it } from "vitest";
import {
  createBlockInstance,
  createBlueprint,
  createSchedulerState,
  enqueueSchedulerSlot,
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

  it("flushes a prop binding to a DOM element", () => {
    const adapter = createWebHostAdapter();
    const elementResult = adapter.createNode("View", 0);

    expect(elementResult.ok).toBe(true);
    if (!elementResult.ok) {
      return;
    }

    const root = document.createElement("div");
    const insertResult = adapter.insert(root as unknown as HostNode, elementResult.value, null);
    expect(insertResult).toEqual({
      ok: true,
      value: undefined,
      error: null
    });

    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.PROP]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      bindingArgU32: new Uint32Array([0, 0]),
      bindingArgRef: ["title"],
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
      nodes: [elementResult.value]
    });
    const scheduler = createSchedulerState();

    expect(scheduleSignalWrite(instance, scheduler, Lane.VISIBLE_UPDATE, 0, "hello-title")).toEqual({
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

    const domElement = root.firstChild as HTMLDivElement | null;
    expect(domElement?.title).toBe("hello-title");
  });

  it("flushes a style binding to a DOM element", () => {
    const adapter = createWebHostAdapter();
    const elementResult = adapter.createNode("View", 0);

    expect(elementResult.ok).toBe(true);
    if (!elementResult.ok) {
      return;
    }

    const root = document.createElement("div");
    const insertResult = adapter.insert(root as unknown as HostNode, elementResult.value, null);
    expect(insertResult).toEqual({
      ok: true,
      value: undefined,
      error: null
    });

    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.STYLE]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      bindingArgU32: new Uint32Array([0, 0]),
      bindingArgRef: ["backgroundColor"],
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
      nodes: [elementResult.value]
    });
    const scheduler = createSchedulerState();

    expect(scheduleSignalWrite(instance, scheduler, Lane.VISIBLE_UPDATE, 0, "rgb(255, 0, 0)")).toEqual({
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

    const domElement = root.firstChild as HTMLDivElement | null;
    expect(domElement?.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("flushes an event binding and routes clicks through the web adapter", () => {
    const adapter = createWebHostAdapter();
    const elementResult = adapter.createNode("Button", 0);

    expect(elementResult.ok).toBe(true);
    if (!elementResult.ok) {
      return;
    }

    const root = document.createElement("div");
    const insertResult = adapter.insert(root as unknown as HostNode, elementResult.value, null);
    expect(insertResult).toEqual({
      ok: true,
      value: undefined,
      error: null
    });

    let pressed = 0;
    let observedEventType = "";

    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.EVENT]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      bindingArgU32: new Uint32Array([0, 1]),
      bindingArgRef: [
        "onPress",
        (event: { type: string }) => {
          pressed += 1;
          observedEventType = event.type;
        }
      ],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0),
      signalToBindingStart: new Uint32Array(0),
      signalToBindingCount: new Uint32Array(0),
      signalToBindings: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 0,
      nodes: [elementResult.value]
    });
    const scheduler = createSchedulerState();

    enqueueSchedulerSlot(scheduler, Lane.VISIBLE_UPDATE, "binding", 0);

    expect(flushBindingQueue(instance, scheduler, adapter)).toEqual({
      ok: true,
      value: {
        batchId: 1,
        flushedBindingCount: 1
      },
      error: null
    });

    const domElement = root.firstChild as HTMLButtonElement | null;
    domElement?.click();

    expect(pressed).toBe(1);
    expect(observedEventType).toBe("click");
  });

  it("rejects invalid prop/style targets and unsupported event keys", () => {
    const adapter = createWebHostAdapter();
    const textNode = document.createTextNode("hello") as unknown as HostNode;

    expect(adapter.setProp(textNode, "title", "x")).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_PROP_TARGET",
        message: "WebHostAdapter.setProp() expected an Element-compatible host node."
      }
    });

    expect(adapter.setStyle(textNode, "width", "10px")).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_STYLE_TARGET",
        message: "WebHostAdapter.setStyle() expected an HTMLElement-compatible host node."
      }
    });

    const button = document.createElement("button") as unknown as HostNode;
    expect(adapter.setEvent(button, "onMadeUp" as never, null)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_EVENT_KEY",
        message: "WebHostAdapter.setEvent() does not support event key onMadeUp."
      }
    });
  });

  it("clears prop/style values and can remove event listeners", () => {
    const adapter = createWebHostAdapter();
    const input = document.createElement("input");
    input.value = "before";
    const element = input as unknown as HostNode;

    expect(adapter.setProp(element, "value", null)).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    expect(input.value).toBe("");

    expect(adapter.setStyle(element, "width", false)).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    expect(input.style.width).toBe("");

    let presses = 0;
    expect(adapter.setEvent(element, "onPress", () => {
      presses += 1;
    }).ok).toBe(true);
    input.click();
    expect(presses).toBe(1);

    expect(adapter.setEvent(element, "onPress", null)).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    input.click();
    expect(presses).toBe(1);
  });

  it("creates image and scroll primitives and rejects invalid host references", () => {
    const adapter = createWebHostAdapter();

    const imageResult = adapter.createNode("Image", 0);
    const scrollResult = adapter.createNode("ScrollView", 0);
    expect(imageResult.ok).toBe(true);
    expect(scrollResult.ok).toBe(true);
    if (!imageResult.ok || !scrollResult.ok) {
      return;
    }

    expect((imageResult.value as unknown as HTMLImageElement).tagName).toBe("IMG");
    expect((scrollResult.value as unknown as HTMLDivElement).style.overflow).toBe("auto");

    const invalid = {} as HostNode;

    expect(adapter.insert(invalid, imageResult.value, null)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_HOST_NODE",
        message: "WebHostAdapter.insert.parent() expected a DOM Node-compatible host reference."
      }
    });

    expect(adapter.remove(invalid, imageResult.value)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_HOST_NODE",
        message: "WebHostAdapter.remove.parent() expected a DOM Node-compatible host reference."
      }
    });

    expect(adapter.setText(invalid, "x")).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_HOST_NODE",
        message: "WebHostAdapter.setText.node() expected a DOM Node-compatible host reference."
      }
    });
  });

  it("normalizes onInput events with current target values", () => {
    const adapter = createWebHostAdapter();
    const input = document.createElement("input");
    const hostInput = input as unknown as HostNode;
    let observedValue = "";
    let observedType = "";

    expect(adapter.setEvent(hostInput, "onInput", (event) => {
      const normalizedEvent = event as { value: string; type: string };
      observedValue = normalizedEvent.value;
      observedType = normalizedEvent.type;
    }).ok).toBe(true);

    input.value = "typed";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(observedValue).toBe("typed");
    expect(observedType).toBe("input");
  });
});
