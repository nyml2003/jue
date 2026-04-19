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
