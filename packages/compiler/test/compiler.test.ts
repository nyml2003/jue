import { describe, expect, it } from "vitest";

import { createBlueprintBuilder, lowerBlockIRToBlueprint, type BlockIR } from "../src/index";

describe("@jue/compiler", () => {
  it("lowers a minimal BlockIR into an executable blueprint", () => {
    const block: BlockIR = {
      signalCount: 1,
      initialSignalValues: ["card"],
      nodes: [
        { id: 0, kind: "element", type: "View", parent: null },
        { id: 1, kind: "text", value: "hello", parent: 0 }
      ],
      bindings: [
        { kind: "prop", node: 0, key: "className", signal: 0 }
      ]
    };

    const lowered = lowerBlockIRToBlueprint(block);

    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    expect(lowered.value.signalCount).toBe(1);
    expect(lowered.value.initialSignalValues).toEqual(["card"]);
    expect(lowered.value.blueprint.nodeCount).toBe(2);
    expect(Array.from(lowered.value.blueprint.signalToBindings)).toEqual([0]);
  });

  it("builds BlockIR through the builder and lowers it to a blueprint", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);
    builder.setInitialSignalValues(["card"]);

    const card = builder.element("View");
    const text = builder.text("hello");
    expect(builder.append(card, text)).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    builder.bindProp(card, "className", 0);

    const block = builder.buildIR();
    const lowered = builder.buildBlueprint();

    expect(block.ok).toBe(true);
    if (!block.ok) {
      return;
    }

    expect(block.value.nodes).toHaveLength(2);
    expect(block.value.bindings).toHaveLength(1);
    expect(block.value.nodes[1]?.parent).toBe(card);
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    expect(lowered.value.initialSignalValues).toEqual(["card"]);
    expect(lowered.value.blueprint.nodeCount).toBe(2);
  });

  it("throws when appending a node that is already attached", () => {
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const child = builder.text("hello");

    expect(builder.append(parent, child).ok).toBe(true);
    expect(builder.append(parent, child)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_CHILD_ALREADY_ATTACHED",
        message: `Node ${child} is already attached to parent ${parent}.`
      }
    });
  });

  it("reports builder validation errors before lowering", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);

    const a = builder.element("View");
    const b = builder.element("View");

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_INVALID_ROOT_COUNT",
        message: "A block must contain exactly one root node, got 2."
      }
    });

    expect(a).toBe(0);
    expect(b).toBe(1);
  });
});
