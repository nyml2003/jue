import { BindingOpcode, INVALID_INDEX, ok } from "@jue/shared";
import { describe, expect, it, vi } from "vitest";

import { createBlockInstance, createBlueprint, dispatchBinding } from "../src/index";
import type { HostAdapter, HostAdapterError, HostNode } from "../src/types";

function createHostNode(): HostNode {
  return {} as HostNode;
}

function createAdapter(overrides: Partial<HostAdapter> = {}): HostAdapter {
  return {
    createNode: vi.fn(),
    createText: vi.fn(),
    insert: vi.fn(),
    remove: vi.fn(),
    setText: vi.fn(() => ok(undefined)),
    setProp: vi.fn(() => ok(undefined)),
    setStyle: vi.fn(() => ok(undefined)),
    setEvent: vi.fn(() => ok(undefined)),
    ...overrides
  };
}

describe("@jue/runtime-core dispatchBinding", () => {
  it("dispatches prop, style, text, and event bindings through the host adapter", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 4,
      bindingOpcode: new Uint8Array([
        BindingOpcode.TEXT,
        BindingOpcode.PROP,
        BindingOpcode.STYLE,
        BindingOpcode.EVENT
      ]),
      bindingNodeIndex: new Uint32Array([0, 1, 2, 3]),
      bindingDataIndex: new Uint32Array([0, 0, 2, 4]),
      bindingArgU32: new Uint32Array([1, 0, 2, 1, 2, 3]),
      bindingArgRef: ["title", "width", "onPress", () => {}],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const nodes = [createHostNode(), createHostNode(), createHostNode(), createHostNode()];
    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 3,
      nodes
    });
    instance.signalValues[0] = "text";
    instance.signalValues[1] = "prop";
    instance.signalValues[2] = "style";

    const adapter = createAdapter();

    expect(dispatchBinding(instance, adapter, 0).ok).toBe(true);
    expect(dispatchBinding(instance, adapter, 1).ok).toBe(true);
    expect(dispatchBinding(instance, adapter, 2).ok).toBe(true);
    expect(dispatchBinding(instance, adapter, 3).ok).toBe(true);

    expect((adapter.setText as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([nodes[0], "text"]);
    expect((adapter.setProp as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([nodes[1], "title", "prop"]);
    expect((adapter.setStyle as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([nodes[2], "width", "style"]);
    expect((adapter.setEvent as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("reports unsupported opcodes and missing binding slots", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([99]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 0,
      nodes: [createHostNode()]
    });
    const adapter = createAdapter();

    expect(dispatchBinding(instance, adapter, 1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BINDING_SLOT_MISSING",
        message: "Binding slot 1 is missing from the blueprint."
      }
    });

    expect(dispatchBinding(instance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_BINDING_OPCODE",
        message: "Binding opcode 99 is not supported yet."
      }
    });
  });

  it("reports prop binding metadata errors", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.PROP]),
      bindingNodeIndex: new Uint32Array([INVALID_INDEX]),
      bindingDataIndex: new Uint32Array([0]),
      bindingArgU32: new Uint32Array([0, 0]),
      bindingArgRef: ["title"],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 1,
      nodes: [createHostNode()]
    });
    const adapter = createAdapter();

    expect(dispatchBinding(instance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "PROP_BINDING_NODE_MISSING",
        message: "Prop binding 0 has no concrete node target."
      }
    });
  });

  it("reports text binding node and signal errors", () => {
    const missingNodeBlueprint = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT]),
      bindingNodeIndex: new Uint32Array([INVALID_INDEX]),
      bindingDataIndex: new Uint32Array([0]),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });
    expect(missingNodeBlueprint.ok).toBe(true);
    if (!missingNodeBlueprint.ok) {
      return;
    }

    const missingNodeInstance = createBlockInstance(missingNodeBlueprint.value, {
      signalCount: 1,
      nodes: [createHostNode()]
    });
    const adapter = createAdapter();

    expect(dispatchBinding(missingNodeInstance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TEXT_BINDING_NODE_MISSING",
        message: "Text binding 0 has no concrete node target."
      }
    });

    const missingSignalBlueprint = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([7]),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });
    expect(missingSignalBlueprint.ok).toBe(true);
    if (!missingSignalBlueprint.ok) {
      return;
    }

    const missingSignalInstance = createBlockInstance(missingSignalBlueprint.value, {
      signalCount: 1,
      nodes: [createHostNode()]
    });

    expect(dispatchBinding(missingSignalInstance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TEXT_BINDING_SIGNAL_MISSING",
        message: "Text binding 0 references missing signal slot 7."
      }
    });
  });

  it("reports unresolved prop nodes and adapter failures", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 2,
      bindingOpcode: new Uint8Array([BindingOpcode.PROP, BindingOpcode.PROP]),
      bindingNodeIndex: new Uint32Array([1, 0]),
      bindingDataIndex: new Uint32Array([0, 2]),
      bindingArgU32: new Uint32Array([0, 0, 0, 0]),
      bindingArgRef: ["title"],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });
    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 1,
      nodes: [createHostNode()]
    });

    const brokenSetProp: HostAdapter["setProp"] = () => ({
      ok: false,
      value: null,
      error: {
        code: "BROKEN_PROP_ADAPTER",
        message: "broken"
      }
    });
    const brokenAdapter = createAdapter({
      setProp: vi.fn(brokenSetProp)
    });

    expect(dispatchBinding(instance, brokenAdapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "PROP_BINDING_NODE_UNRESOLVED",
        message: "Prop binding 0 references missing node index 1."
      }
    });

    expect(dispatchBinding(instance, brokenAdapter, 1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BROKEN_PROP_ADAPTER",
        message: "broken"
      }
    });
  });

  it("reports style binding signal/key errors", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.STYLE, BindingOpcode.STYLE]),
      bindingNodeIndex: new Uint32Array([0, 0]),
      bindingDataIndex: new Uint32Array([0, 2]),
      bindingArgU32: new Uint32Array([4, 0, 0, 9]),
      bindingArgRef: ["width"],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 1,
      nodes: [createHostNode()]
    });
    const adapter = createAdapter();

    expect(dispatchBinding(instance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "STYLE_BINDING_SIGNAL_MISSING",
        message: "Style binding 0 references missing signal slot 4."
      }
    });

    expect(dispatchBinding(instance, adapter, 1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "STYLE_BINDING_KEY_MISSING",
        message: "Style binding 1 references missing style key at ref slot 9."
      }
    });
  });

  it("reports event binding key/handler errors and host adapter failures", () => {
    const invalidAdapterError: HostAdapterError = {
      code: "BROKEN_EVENT_ADAPTER",
      message: "broken"
    };

    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.EVENT, BindingOpcode.EVENT, BindingOpcode.EVENT]),
      bindingNodeIndex: new Uint32Array([0, 0, 0]),
      bindingDataIndex: new Uint32Array([0, 2, 4]),
      bindingArgU32: new Uint32Array([0, 1, 2, 3, 0, 1]),
      bindingArgRef: ["onPress", "not-a-handler", "missing-key", null],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 0,
      nodes: [createHostNode()]
    });

    const brokenSetEvent: HostAdapter["setEvent"] = () => ({
      ok: false,
      value: null,
      error: invalidAdapterError
    });
    const adapter = createAdapter({
      setEvent: vi.fn(brokenSetEvent)
    });

    expect(dispatchBinding(instance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "EVENT_BINDING_HANDLER_MISSING",
        message: "Event binding 0 references missing handler at ref slot 1."
      }
    });

    expect(dispatchBinding(instance, adapter, 1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "EVENT_BINDING_KEY_MISSING",
        message: "Event binding 1 references missing event key at ref slot 2."
      }
    });

    const validBlueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.EVENT]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      bindingArgU32: new Uint32Array([0, 1]),
      bindingArgRef: ["onPress", () => {}],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });
    expect(validBlueprintResult.ok).toBe(true);
    if (!validBlueprintResult.ok) {
      return;
    }

    const validInstance = createBlockInstance(validBlueprintResult.value, {
      signalCount: 0,
      nodes: [createHostNode()]
    });

    expect(dispatchBinding(validInstance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: invalidAdapterError
    });
  });

  it("reports event binding metadata and node resolution errors", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 2,
      bindingOpcode: new Uint8Array([BindingOpcode.EVENT, BindingOpcode.EVENT, BindingOpcode.EVENT]),
      bindingNodeIndex: new Uint32Array([INVALID_INDEX, 1, 0]),
      bindingDataIndex: new Uint32Array([0, 0, 99]),
      bindingArgU32: new Uint32Array([0, 1]),
      bindingArgRef: ["onPress", () => {}],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 0,
      nodes: [createHostNode()]
    });
    const adapter = createAdapter();

    expect(dispatchBinding(instance, adapter, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "EVENT_BINDING_NODE_MISSING",
        message: "Event binding 0 has no concrete node target."
      }
    });

    expect(dispatchBinding(instance, adapter, 1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "EVENT_BINDING_NODE_UNRESOLVED",
        message: "Event binding 1 references missing node index 1."
      }
    });

    expect(dispatchBinding(instance, adapter, 2)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "EVENT_BINDING_KEY_INDEX_MISSING",
        message: "Event binding 2 is missing an event key reference index."
      }
    });
  });
});
