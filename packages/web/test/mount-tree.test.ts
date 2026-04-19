// @vitest-environment jsdom

import { BindingOpcode, INVALID_INDEX } from "@jue/shared";
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
});
