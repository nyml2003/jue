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

  it("lowers conditional region metadata into the blueprint", () => {
    const block: BlockIR = {
      signalCount: 0,
      nodes: [
        { id: 0, kind: "element", type: "View", parent: null },
        { id: 1, kind: "text", value: "A", parent: 0 },
        { id: 2, kind: "text", value: "B", parent: 0 }
      ],
      bindings: [],
      regions: [
        {
          kind: "conditional",
          anchorStartNode: 1,
          anchorEndNode: 2,
          branches: [
            { startNode: 1, endNode: 1 },
            { startNode: 2, endNode: 2 }
          ]
        }
      ]
    };

    const lowered = lowerBlockIRToBlueprint(block);
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    expect(Array.from(lowered.value.blueprint.regionType)).toEqual([0]);
    expect(Array.from(lowered.value.blueprint.regionAnchorStart)).toEqual([1]);
    expect(Array.from(lowered.value.blueprint.regionAnchorEnd)).toEqual([2]);
    expect(Array.from(lowered.value.blueprint.regionBranchRangeStart)).toEqual([0]);
    expect(Array.from(lowered.value.blueprint.regionBranchRangeCount)).toEqual([2]);
    expect(Array.from(lowered.value.blueprint.regionBranchNodeStart)).toEqual([1, 2]);
    expect(Array.from(lowered.value.blueprint.regionBranchNodeEnd)).toEqual([1, 2]);
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

  it("builds a conditional region through the builder and lowers branch ranges", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");

    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(root, b).ok).toBe(true);

    builder.defineConditionalRegion({
      anchorStartNode: a,
      anchorEndNode: b,
      branches: [
        { startNode: a, endNode: a },
        { startNode: b, endNode: b }
      ]
    });

    const block = builder.buildIR();
    const lowered = builder.buildBlueprint();

    expect(block.ok).toBe(true);
    if (!block.ok) {
      return;
    }

    expect(block.value.regions).toEqual([
      {
        kind: "conditional",
        anchorStartNode: a,
        anchorEndNode: b,
        branches: [
          { startNode: a, endNode: a },
          { startNode: b, endNode: b }
        ]
      }
    ]);

    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    expect(Array.from(lowered.value.blueprint.regionType)).toEqual([0]);
    expect(Array.from(lowered.value.blueprint.regionBranchRangeStart)).toEqual([0]);
    expect(Array.from(lowered.value.blueprint.regionBranchRangeCount)).toEqual([2]);
    expect(Array.from(lowered.value.blueprint.regionBranchNodeStart)).toEqual([1, 2]);
    expect(Array.from(lowered.value.blueprint.regionBranchNodeEnd)).toEqual([1, 2]);
  });

  it("builds a nested block region through the builder and lowers nested metadata", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const anchor = builder.text("anchor");
    expect(builder.append(root, anchor).ok).toBe(true);

    builder.defineNestedBlockRegion({
      anchorStartNode: anchor,
      anchorEndNode: anchor,
      childBlockSlot: 7,
      childBlueprintSlot: 11,
      mountMode: "attach"
    });

    const block = builder.buildIR();
    const lowered = builder.buildBlueprint();

    expect(block.ok).toBe(true);
    if (!block.ok) {
      return;
    }

    expect(block.value.regions).toEqual([
      {
        kind: "nested-block",
        anchorStartNode: anchor,
        anchorEndNode: anchor,
        childBlockSlot: 7,
        childBlueprintSlot: 11,
        mountMode: "attach"
      }
    ]);

    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    expect(Array.from(lowered.value.blueprint.regionType)).toEqual([2]);
    expect(Array.from(lowered.value.blueprint.regionNestedBlockSlot)).toEqual([7]);
    expect(Array.from(lowered.value.blueprint.regionNestedBlueprintSlot)).toEqual([11]);
    expect(Array.from(lowered.value.blueprint.regionNestedMountMode)).toEqual([0]);
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

  it("reports unreachable nodes in a split tree", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);

    const root = builder.element("View");
    const reachable = builder.element("View");
    const orphan = builder.text("orphan");

    expect(builder.append(root, reachable).ok).toBe(true);

    const block = builder.buildIR();
    expect(block).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_INVALID_ROOT_COUNT",
        message: "A block must contain exactly one root node, got 2."
      }
    });

    expect(root).toBe(0);
    expect(reachable).toBe(1);
    expect(orphan).toBe(2);
  });

  it("reports signal slots that exceed the configured signal count", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);

    const root = builder.element("View");
    builder.bindProp(root, "className", 2);

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_SIGNAL_OUT_OF_RANGE",
        message: "Binding references signal slot 2, but signalCount is 1."
      }
    });
  });
});
