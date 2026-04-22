// @vitest-environment jsdom

import { BindingOpcode, INVALID_INDEX, RegionLifecycle } from "@jue/shared";
import { createBlueprintBuilder } from "@jue/compiler";
import { createBlueprint } from "@jue/runtime-core";
import { describe, expect, it } from "vitest";

import { mountTree } from "../src/index";

describe("@jue/web mountTree", () => {
  it("mounts a static node tree and applies initial event/prop/style bindings", () => {
    let pressCount = 0;
    const root = document.createElement("div");
    const blueprintResult = createBlueprint({
      nodeCount: 2,
      nodeKind: new Uint8Array([1, 1]),
      nodePrimitiveRefIndex: new Uint32Array([0, 1]),
      nodeTextRefIndex: new Uint32Array([INVALID_INDEX, INVALID_INDEX]),
      nodeParentIndex: new Uint32Array([INVALID_INDEX, 0]),
      bindingOpcode: new Uint8Array([BindingOpcode.PROP, BindingOpcode.EVENT]),
      bindingNodeIndex: new Uint32Array([0, 1]),
      bindingDataIndex: new Uint32Array([0, 2]),
      bindingArgU32: new Uint32Array([0, 2, 3, 5]),
      bindingArgRef: ["View", "Button", "className", "onPress", "card", () => {
        pressCount += 1;
      }],
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

    const mountedResult = mountTree({
      blueprint: blueprintResult.value,
      root,
      signalCount: 1,
      initialSignalValues: ["card"]
    });

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.flushInitialBindings()).toEqual({
      ok: true,
      value: {
        batchId: 1,
        flushedBindingCount: 2
      },
      error: null
    });

    const card = root.firstChild as HTMLDivElement | null;
    const button = card?.firstChild as HTMLButtonElement | null;
    expect(card?.className).toBe("card");

    button?.click();
    expect(pressCount).toBe(1);
  });

  it("mounts, replaces, and detaches nested block content inside region anchors", () => {
    const root = document.createElement("div");
    const parentBuilder = createBlueprintBuilder();
    const parent = parentBuilder.element("View");
    const before = parentBuilder.text("before[");
    const end = parentBuilder.text("]after");
    expect(parentBuilder.append(parent, before).ok).toBe(true);
    expect(parentBuilder.append(parent, end).ok).toBe(true);
    parentBuilder.defineNestedBlockRegion({
      anchorStartNode: before,
      anchorEndNode: end,
      childBlockSlot: 0,
      childBlueprintSlot: 0,
      mountMode: "attach"
    });

    const parentLowered = parentBuilder.buildBlueprint();
    const childA = createTextBlockBlueprint("child A");
    const childB = createTextBlockBlueprint("child B");

    expect(parentLowered.ok).toBe(true);
    expect(childA.ok).toBe(true);
    expect(childB.ok).toBe(true);
    if (!parentLowered.ok || !childA.ok || !childB.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: parentLowered.value.blueprint,
      root,
      signalCount: parentLowered.value.signalCount,
      nestedBlueprints: [
        childA.value,
        childB.value
      ]
    });

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toBe("before[]after");

    const attachResult = mountedResult.value.regions.nested(0).attach();
    expect(attachResult.ok).toBe(true);
    expect(root.textContent).toBe("before[child A]after");

    const replaceResult = mountedResult.value.regions.nested(0).replace(1, 1);
    expect(replaceResult.ok).toBe(true);
    expect(root.textContent).toBe("before[child B]after");

    const detachResult = mountedResult.value.regions.nested(0).detach();
    expect(detachResult.ok).toBe(true);
    expect(root.textContent).toBe("before[]after");
  });

  it("attaches, reconciles, moves, and clears keyed list items inside region anchors", () => {
    const root = document.createElement("div");
    const parentBuilder = createBlueprintBuilder();
    const parent = parentBuilder.element("View");
    const before = parentBuilder.text("before(");
    const end = parentBuilder.text(")after");
    expect(parentBuilder.append(parent, before).ok).toBe(true);
    expect(parentBuilder.append(parent, end).ok).toBe(true);
    parentBuilder.defineKeyedListRegion({
      anchorStartNode: before,
      anchorEndNode: end
    });

    const parentLowered = parentBuilder.buildBlueprint();
    expect(parentLowered.ok).toBe(true);
    if (!parentLowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: parentLowered.value.blueprint,
      root,
      signalCount: parentLowered.value.signalCount
    });

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    const list = mountedResult.value.regions.keyedList(0);
    const attachResult = list.attach([
      keyedTextItem("a", "A"),
      keyedTextItem("b", "B")
    ]);

    expect(attachResult.ok).toBe(true);
    expect(root.textContent).toBe("before(AB)after");

    const reconcileResult = list.reconcile([
      keyedTextItem("b", "B"),
      keyedTextItem("c", "C"),
      keyedTextItem("a", "A")
    ]);

    expect(reconcileResult.ok).toBe(true);
    expect(root.textContent).toBe("before(BCA)after");

    const removeResult = list.reconcile([
      keyedTextItem("c", "C")
    ]);

    expect(removeResult.ok).toBe(true);
    expect(root.textContent).toBe("before(C)after");

    const clearResult = list.clear();
    expect(clearResult.ok).toBe(true);
    expect(root.textContent).toBe("before()after");
  });

  it("rejects duplicate keyed list keys before mutating region state", () => {
    const root = document.createElement("div");
    const parentBuilder = createBlueprintBuilder();
    const parent = parentBuilder.element("View");
    const before = parentBuilder.text("[");
    const end = parentBuilder.text("]");
    expect(parentBuilder.append(parent, before).ok).toBe(true);
    expect(parentBuilder.append(parent, end).ok).toBe(true);
    parentBuilder.defineKeyedListRegion({
      anchorStartNode: before,
      anchorEndNode: end
    });

    const parentLowered = parentBuilder.buildBlueprint();
    expect(parentLowered.ok).toBe(true);
    if (!parentLowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: parentLowered.value.blueprint,
      root,
      signalCount: parentLowered.value.signalCount
    });

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    const attachResult = mountedResult.value.regions.keyedList(0).attach([
      keyedTextItem("same", "A"),
      keyedTextItem("same", "B")
    ]);

    expect(attachResult.ok).toBe(false);
    expect(root.textContent).toBe("[]");
    expect(mountedResult.value.instance.regionLifecycle[0]).toBe(RegionLifecycle.INACTIVE);
  });

  it("rebinds a virtual list window through stable visible cells", () => {
    const root = document.createElement("div");
    const parentBuilder = createBlueprintBuilder();
    const parent = parentBuilder.element("View");
    const before = parentBuilder.text("items:");
    const end = parentBuilder.text(":end");
    expect(parentBuilder.append(parent, before).ok).toBe(true);
    expect(parentBuilder.append(parent, end).ok).toBe(true);
    parentBuilder.defineVirtualListRegion({
      anchorStartNode: before,
      anchorEndNode: end
    });

    const parentLowered = parentBuilder.buildBlueprint();
    expect(parentLowered.ok).toBe(true);
    if (!parentLowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: parentLowered.value.blueprint,
      root,
      signalCount: parentLowered.value.signalCount
    });

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    const list = mountedResult.value.regions.virtualList(0);
    const attachResult = list.attach({
      itemCount: 6,
      windowStart: 0,
      cells: [
        virtualTextCell("A0"),
        virtualTextCell("A1"),
        virtualTextCell("A2")
      ]
    });

    expect(attachResult.ok).toBe(true);
    expect(root.textContent).toBe("items:A0A1A2:end");
    const firstCellNode = root.querySelector("div > div");

    const updateResult = list.updateWindow({
      itemCount: 6,
      windowStart: 2,
      cells: [
        virtualTextCell("A2"),
        virtualTextCell("A3"),
        virtualTextCell("A4")
      ]
    });

    expect(updateResult.ok).toBe(true);
    expect(root.textContent).toBe("items:A2A3A4:end");
    expect(root.querySelector("div > div")).toBe(firstCellNode);

    const clearResult = list.clear();
    expect(clearResult.ok).toBe(true);
    expect(root.textContent).toBe("items::end");
  });

  it("rejects conditional region attach after the tree is disposed", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(parent, a).ok).toBe(true);
    expect(builder.append(parent, b).ok).toBe(true);
    builder.defineConditionalRegion({
      anchorStartNode: a,
      anchorEndNode: b,
      branches: [
        { startNode: a, endNode: a },
        { startNode: b, endNode: b }
      ]
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(mountedResult.value.regions.conditional(0).attach(0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot attach a conditional region after the mounted tree has been disposed."
      }
    });
  });

  it("rejects clearing an inactive conditional region", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(parent, a).ok).toBe(true);
    expect(builder.append(parent, b).ok).toBe(true);
    builder.defineConditionalRegion({
      anchorStartNode: a,
      anchorEndNode: b,
      branches: [
        { startNode: a, endNode: a },
        { startNode: b, endNode: b }
      ]
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.conditional(0).clear()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_CONDITIONAL_CLEAR_REJECTED",
        message: "Conditional region 0 rejected clear."
      }
    });
  });

  it("returns a no-op result when switching a conditional region to its current branch", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(parent, a).ok).toBe(true);
    expect(builder.append(parent, b).ok).toBe(true);
    builder.defineConditionalRegion({
      anchorStartNode: a,
      anchorEndNode: b,
      branches: [
        { startNode: a, endNode: a },
        { startNode: b, endNode: b }
      ]
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.conditional(0).attach(0).ok).toBe(true);
    expect(mountedResult.value.regions.conditional(0).switchTo(0)).toEqual({
      ok: true,
      value: {
        batchId: 0,
        flushedBindingCount: 0
      },
      error: null
    });
  });

  it("rejects virtual list window updates before attach and after dispose", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const before = builder.text("items:");
    const end = builder.text(":end");
    expect(builder.append(parent, before).ok).toBe(true);
    expect(builder.append(parent, end).ok).toBe(true);
    builder.defineVirtualListRegion({
      anchorStartNode: before,
      anchorEndNode: end
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.virtualList(0).updateWindow({
      itemCount: 3,
      windowStart: 0,
      cells: [virtualTextCell("A0")]
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_VIRTUAL_LIST_MISSING",
        message: "Virtual list region 0 has not been attached."
      }
    });

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(mountedResult.value.regions.virtualList(0).clear()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot clear a virtual list after the mounted tree has been disposed."
      }
    });
  });

  it("rejects invalid mount and dispose ranges", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const child = builder.text("A");
    expect(builder.append(parent, child).ok).toBe(true);

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.mountRange(2, 1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_RANGE_INVALID",
        message: "Node range 2-1 is out of bounds."
      }
    });

    expect(mountedResult.value.disposeRange(3, 3)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_RANGE_INVALID",
        message: "Node range 3-3 is out of bounds."
      }
    });
  });

  it("rejects signal initialization that exceeds signalCount", () => {
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

    const root = document.createElement("div");
    expect(mountTree({
      blueprint: blueprintResult.value,
      root,
      signalCount: 0,
      initialSignalValues: ["oops"]
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_SIGNAL_INIT_OUT_OF_RANGE",
        message: "Initial signal values exceed the declared signalCount."
      }
    });
  });

  it("rejects malformed branch metadata while initializing conditional regions", () => {
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
      regionType: new Uint8Array([0]),
      regionAnchorStart: new Uint32Array([0]),
      regionAnchorEnd: new Uint32Array([0]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([1]),
      regionBranchNodeStart: new Uint32Array(0),
      regionBranchNodeEnd: new Uint32Array(0)
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const root = document.createElement("div");
    expect(mountTree({
      blueprint: blueprintResult.value,
      root,
      signalCount: 0
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_REGION_BRANCH_RANGE_MISSING",
        message: "Conditional region 0 has an invalid branch range at 0."
      }
    });
  });

  it("rejects nested region attach without a nested blueprint", () => {
    const root = document.createElement("div");
    const parentBuilder = createBlueprintBuilder();
    const parent = parentBuilder.element("View");
    const before = parentBuilder.text("[");
    const end = parentBuilder.text("]");
    expect(parentBuilder.append(parent, before).ok).toBe(true);
    expect(parentBuilder.append(parent, end).ok).toBe(true);
    parentBuilder.defineNestedBlockRegion({
      anchorStartNode: before,
      anchorEndNode: end,
      childBlockSlot: 0,
      childBlueprintSlot: 0,
      mountMode: "attach"
    });

    const parentLowered = parentBuilder.buildBlueprint();
    expect(parentLowered.ok).toBe(true);
    if (!parentLowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: parentLowered.value.blueprint,
      root,
      signalCount: parentLowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.nested(0).attach()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_NESTED_BLUEPRINT_MISSING",
        message: "Nested region 0 references missing child blueprint 0."
      }
    });
  });

  it("rejects flushes and signal writes after dispose", () => {
    const root = document.createElement("div");
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      nodeKind: new Uint8Array([2]),
      nodePrimitiveRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeTextRefIndex: new Uint32Array([0]),
      nodeParentIndex: new Uint32Array([INVALID_INDEX]),
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      bindingArgRef: [""],
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

    const mountedResult = mountTree({
      blueprint: blueprintResult.value,
      root,
      signalCount: 1
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(mountedResult.value.flushInitialBindings()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot flush bindings after the mounted tree has been disposed."
      }
    });
    expect(mountedResult.value.setSignal(0, "x")).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot write a signal after the mounted tree has been disposed."
      }
    });
    expect(mountedResult.value.setSignals([[0, "x"]])).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot write signals after the mounted tree has been disposed."
      }
    });
    expect(mountedResult.value.mountRange(0, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot mount a node range after the mounted tree has been disposed."
      }
    });
    expect(mountedResult.value.disposeRange(0, 0)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot dispose a node range after the mounted tree has been disposed."
      }
    });
  });

  it("rejects malformed primitive and text node references during mount", () => {
    const root = document.createElement("div");

    const missingPrimitive = createBlueprint({
      nodeCount: 1,
      nodeKind: new Uint8Array([1]),
      nodePrimitiveRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeTextRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeParentIndex: new Uint32Array([INVALID_INDEX]),
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(missingPrimitive.ok).toBe(true);
    if (!missingPrimitive.ok) {
      return;
    }

    expect(mountTree({
      blueprint: missingPrimitive.value,
      root,
      signalCount: 0
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_PRIMITIVE_MISSING",
        message: "Blueprint node 0 is missing its primitive reference index."
      }
    });

    const missingText = createBlueprint({
      nodeCount: 1,
      nodeKind: new Uint8Array([2]),
      nodePrimitiveRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeTextRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeParentIndex: new Uint32Array([INVALID_INDEX]),
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0)
    });

    expect(missingText.ok).toBe(true);
    if (!missingText.ok) {
      return;
    }

    expect(mountTree({
      blueprint: missingText.value,
      root,
      signalCount: 0
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_TEXT_MISSING",
        message: "Blueprint node 0 is missing its text reference index."
      }
    });
  });

  it("rejects malformed node kinds during mount", () => {
    const root = document.createElement("div");
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      nodeKind: new Uint8Array([99]),
      nodePrimitiveRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeTextRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeParentIndex: new Uint32Array([INVALID_INDEX]),
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

    expect(mountTree({
      blueprint: blueprintResult.value,
      root,
      signalCount: 0
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_NODE_KIND_UNSUPPORTED",
        message: "Blueprint node 0 uses unsupported node kind 99."
      }
    });
  });

  it("rejects malformed parent references during initial mount", () => {
    const root = document.createElement("div");
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      nodeKind: new Uint8Array([1]),
      nodePrimitiveRefIndex: new Uint32Array([0]),
      nodeTextRefIndex: new Uint32Array([INVALID_INDEX]),
      nodeParentIndex: new Uint32Array([2]),
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
      root,
      signalCount: 0
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_PARENT_MISSING",
        message: "Blueprint node 0 references missing parent index 2."
      }
    });
  });

  it("rejects nested replace before attach and keyed clear after dispose", () => {
    const root = document.createElement("div");
    const nestedBuilder = createBlueprintBuilder();
    const parent = nestedBuilder.element("View");
    const before = nestedBuilder.text("[");
    const end = nestedBuilder.text("]");
    expect(nestedBuilder.append(parent, before).ok).toBe(true);
    expect(nestedBuilder.append(parent, end).ok).toBe(true);
    nestedBuilder.defineNestedBlockRegion({
      anchorStartNode: before,
      anchorEndNode: end,
      childBlockSlot: 0,
      childBlueprintSlot: 0,
      mountMode: "attach"
    });

    const nestedLowered = nestedBuilder.buildBlueprint();
    expect(nestedLowered.ok).toBe(true);
    if (!nestedLowered.ok) {
      return;
    }

    const nestedMounted = mountTree({
      blueprint: nestedLowered.value.blueprint,
      root,
      signalCount: nestedLowered.value.signalCount
    });
    expect(nestedMounted.ok).toBe(true);
    if (!nestedMounted.ok) {
      return;
    }

    expect(nestedMounted.value.regions.nested(0).replace(1, 1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_NESTED_REPLACE_REJECTED",
        message: "Nested region 0 rejected replace."
      }
    });

    const keyedBuilder = createBlueprintBuilder();
    const keyedRoot = keyedBuilder.element("View");
    const keyedBefore = keyedBuilder.text("(");
    const keyedEnd = keyedBuilder.text(")");
    expect(keyedBuilder.append(keyedRoot, keyedBefore).ok).toBe(true);
    expect(keyedBuilder.append(keyedRoot, keyedEnd).ok).toBe(true);
    keyedBuilder.defineKeyedListRegion({
      anchorStartNode: keyedBefore,
      anchorEndNode: keyedEnd
    });

    const keyedLowered = keyedBuilder.buildBlueprint();
    expect(keyedLowered.ok).toBe(true);
    if (!keyedLowered.ok) {
      return;
    }

    const keyedMounted = mountTree({
      blueprint: keyedLowered.value.blueprint,
      root,
      signalCount: keyedLowered.value.signalCount
    });
    expect(keyedMounted.ok).toBe(true);
    if (!keyedMounted.ok) {
      return;
    }

    expect(keyedMounted.value.dispose().ok).toBe(true);
    expect(keyedMounted.value.regions.keyedList(0).clear()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot clear a keyed list after the mounted tree has been disposed."
      }
    });
  });

  it("rejects nested detach before attach and nested attach after dispose", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const before = builder.text("[");
    const end = builder.text("]");
    expect(builder.append(parent, before).ok).toBe(true);
    expect(builder.append(parent, end).ok).toBe(true);
    builder.defineNestedBlockRegion({
      anchorStartNode: before,
      anchorEndNode: end,
      childBlockSlot: 0,
      childBlueprintSlot: 0,
      mountMode: "attach"
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.nested(0).detach()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_NESTED_DETACH_REJECTED",
        message: "Nested region 0 rejected detach."
      }
    });

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(mountedResult.value.regions.nested(0).attach()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot attach a nested region after the mounted tree has been disposed."
      }
    });
  });

  it("rejects keyed list reconcile before attach and attach after dispose", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const before = builder.text("(");
    const end = builder.text(")");
    expect(builder.append(parent, before).ok).toBe(true);
    expect(builder.append(parent, end).ok).toBe(true);
    builder.defineKeyedListRegion({
      anchorStartNode: before,
      anchorEndNode: end
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.keyedList(0).reconcile([
      keyedTextItem("a", "A")
    ])).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_KEYED_LIST_RECONCILE_REJECTED",
        message: "Keyed list region 0 rejected reconcile."
      }
    });

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(mountedResult.value.regions.keyedList(0).attach([
      keyedTextItem("a", "A")
    ])).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot attach a keyed list after the mounted tree has been disposed."
      }
    });
  });

  it("rejects invalid virtual list attach and window-size changes", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const before = builder.text("items:");
    const end = builder.text(":end");
    expect(builder.append(parent, before).ok).toBe(true);
    expect(builder.append(parent, end).ok).toBe(true);
    builder.defineVirtualListRegion({
      anchorStartNode: before,
      anchorEndNode: end
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.virtualList(0).attach({
      itemCount: 2,
      windowStart: 3,
      cells: [virtualTextCell("A")]
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_VIRTUAL_LIST_ATTACH_REJECTED",
        message: "Virtual list region 0 rejected attach."
      }
    });

    expect(mountedResult.value.regions.virtualList(0).attach({
      itemCount: 4,
      windowStart: 0,
      cells: [virtualTextCell("A0"), virtualTextCell("A1")]
    }).ok).toBe(true);

    expect(mountedResult.value.regions.virtualList(0).updateWindow({
      itemCount: 4,
      windowStart: 1,
      cells: [virtualTextCell("A1")]
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_VIRTUAL_LIST_WINDOW_SIZE_CHANGED",
        message: "Virtual list minimal controller requires a stable visible cell count."
      }
    });
  });

  it("rejects clearing an inactive virtual list and attaching after dispose", () => {
    const root = document.createElement("div");
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const before = builder.text("items:");
    const end = builder.text(":end");
    expect(builder.append(parent, before).ok).toBe(true);
    expect(builder.append(parent, end).ok).toBe(true);
    builder.defineVirtualListRegion({
      anchorStartNode: before,
      anchorEndNode: end
    });

    const lowered = builder.buildBlueprint();
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    const mountedResult = mountTree({
      blueprint: lowered.value.blueprint,
      root,
      signalCount: lowered.value.signalCount
    });
    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(mountedResult.value.regions.virtualList(0).clear()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "MOUNT_TREE_VIRTUAL_LIST_CLEAR_REJECTED",
        message: "Virtual list region 0 rejected clear."
      }
    });

    expect(mountedResult.value.dispose().ok).toBe(true);
    expect(mountedResult.value.regions.virtualList(0).attach({
      itemCount: 1,
      windowStart: 0,
      cells: [virtualTextCell("A0")]
    })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "TREE_MOUNT_DISPOSED",
        message: "Cannot attach a virtual list after the mounted tree has been disposed."
      }
    });
  });
});

function keyedTextItem(key: string, text: string) {
  const block = createTextBlockBlueprint(text);
  if (!block.ok) {
    throw new Error(block.error.message);
  }

  return {
    key,
    ...block.value
  };
}

function createTextBlockBlueprint(text: string) {
  const builder = createBlueprintBuilder();
  const root = builder.element("View");
  const textNode = builder.text(text);
  expect(builder.append(root, textNode).ok).toBe(true);
  return builder.buildBlueprint();
}

function virtualTextCell(value: string) {
  const builder = createBlueprintBuilder();
  builder.setSignalCount(1);
  builder.setInitialSignalValues([value]);

  const root = builder.element("View");
  const textNode = builder.text("");
  expect(builder.append(root, textNode).ok).toBe(true);
  builder.bindText(textNode, 0);

  const lowered = builder.buildBlueprint();
  if (!lowered.ok) {
    throw new Error(lowered.error.message);
  }

  return {
    blueprint: lowered.value.blueprint,
    signalCount: lowered.value.signalCount,
    initialSignalValues: lowered.value.initialSignalValues
  };
}
