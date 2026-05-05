import { describe, expect, it } from "vitest";

import { buildBlockIR, createBlueprintBuilder, lowerBlockIRToBlueprint, type BlockIR } from "../src/index";
import { compile, compileSourceToBlockIR } from "../src/frontend/index";

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

  it("reports missing parent references when lowering raw BlockIR", () => {
    const block: BlockIR = {
      signalCount: 0,
      nodes: [
        { id: 0, kind: "element", type: "View", parent: 99 }
      ],
      bindings: []
    };

    expect(lowerBlockIRToBlueprint(block)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "IR_NODE_REFERENCE_MISSING",
        message: "Missing parent reference for 0: node id 99 does not exist."
      }
    });
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

  it("builds a virtual list region through the builder and lowers virtual-list metadata", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const start = builder.text("[");
    const end = builder.text("]");
    expect(builder.append(root, start).ok).toBe(true);
    expect(builder.append(root, end).ok).toBe(true);

    builder.defineVirtualListRegion({
      anchorStartNode: start,
      anchorEndNode: end
    });

    const block = builder.buildIR();
    const lowered = builder.buildBlueprint();

    expect(block.ok).toBe(true);
    if (!block.ok) {
      return;
    }

    expect(block.value.regions).toEqual([
      {
        kind: "virtual-list",
        anchorStartNode: start,
        anchorEndNode: end
      }
    ]);

    expect(lowered.ok).toBe(true);
    if (!lowered.ok) {
      return;
    }

    expect(Array.from(lowered.value.blueprint.regionType)).toEqual([3]);
    expect(Array.from(lowered.value.blueprint.regionAnchorStart)).toEqual([1]);
    expect(Array.from(lowered.value.blueprint.regionAnchorEnd)).toEqual([2]);
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

  it("reports missing child, missing parent, and self-cycle append attempts", () => {
    const builder = createBlueprintBuilder();
    const parent = builder.element("View");
    const child = builder.text("hello");

    expect(builder.append(parent, 99)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_CHILD_MISSING",
        message: "Cannot append missing node 99 to parent 0."
      }
    });

    expect(builder.append(42, child)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_PARENT_MISSING",
        message: "Cannot append to missing parent node 42."
      }
    });

    expect(builder.append(parent, parent)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_CYCLE_SELF",
        message: "Node 0 cannot be appended to itself."
      }
    });
  });

  it("throws from buildBlockIR when the builder callback leaves an invalid tree", () => {
    expect(() => buildBlockIR((builder) => {
      builder.defineConditionalRegion({
        anchorStartNode: 9,
        anchorEndNode: 9,
        branches: [
          { startNode: 9, endNode: 9 }
        ]
      });
    })).toThrow("[buildBlockIR] BUILDER_EMPTY_BLOCK: A block must contain at least one node.");
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

  it("rejects negative signal counts in the builder", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(-1);
    builder.element("View");

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_INVALID_SIGNAL_COUNT",
        message: "signalCount must be greater than or equal to zero."
      }
    });
  });

  it("rejects initial signal values that exceed signalCount in the builder", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);
    builder.setInitialSignalValues(["a", "b"]);
    builder.element("View");

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_INVALID_INITIAL_SIGNAL_VALUES",
        message: "Initial signal values exceed signalCount."
      }
    });
  });

  it("rejects empty builder blocks", () => {
    const builder = createBlueprintBuilder();

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_EMPTY_BLOCK",
        message: "A block must contain at least one node."
      }
    });
  });

  it("rejects text bindings that target non-text nodes", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);

    const root = builder.element("View");
    builder.bindText(root, 0);

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_BINDING_TARGET_KIND_INVALID",
        message: "Text binding must target a text node, got element node 0."
      }
    });
  });

  it("rejects prop bindings that target text nodes", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);

    const text = builder.text("hello");
    builder.bindProp(text, "className", 0);

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_BINDING_TARGET_KIND_INVALID",
        message: "Prop binding must target an element node, got text node 0."
      }
    });
  });

  it("rejects style bindings that target text nodes", () => {
    const builder = createBlueprintBuilder();
    builder.setSignalCount(1);

    const text = builder.text("hello");
    builder.bindStyle(text, "width", 0);

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_BINDING_TARGET_KIND_INVALID",
        message: "Style binding must target an element node, got text node 0."
      }
    });
  });

  it("rejects event bindings that target text nodes", () => {
    const builder = createBlueprintBuilder();

    const text = builder.text("hello");
    builder.bindEvent(text, "onPress", () => {});

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_BINDING_TARGET_KIND_INVALID",
        message: "Event binding must target an element node, got text node 0."
      }
    });
  });

  it("rejects conditional regions without branches", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    expect(builder.append(root, a).ok).toBe(true);

    builder.defineConditionalRegion({
      anchorStartNode: a,
      anchorEndNode: a,
      branches: []
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BRANCH_INVALID",
        message: "Conditional region must define at least one branch."
      }
    });
  });

  it("rejects conditional regions with reversed branch ranges", () => {
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
        { startNode: b, endNode: a }
      ]
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BRANCH_INVALID",
        message: "Conditional region branch range 2-1 is reversed."
      }
    });
  });

  it("rejects conditional regions whose branch range escapes the anchor range", () => {
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
        { startNode: root, endNode: b }
      ]
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BRANCH_INVALID",
        message: "Conditional region branch range 0-2 must stay within anchor range 1-2."
      }
    });
  });

  it("rejects nested block regions with reversed anchor ranges", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(root, b).ok).toBe(true);

    builder.defineNestedBlockRegion({
      anchorStartNode: b,
      anchorEndNode: a,
      childBlockSlot: 1,
      childBlueprintSlot: 2,
      mountMode: "attach"
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_ANCHOR_INVALID",
        message: "Nested block region anchor range 2-1 is reversed."
      }
    });
  });

  it("rejects keyed list regions with reversed anchor ranges", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(root, b).ok).toBe(true);

    builder.defineKeyedListRegion({
      anchorStartNode: b,
      anchorEndNode: a
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_ANCHOR_INVALID",
        message: "Keyed list region anchor range 2-1 is reversed."
      }
    });
  });

  it("rejects virtual list regions with reversed anchor ranges", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(root, b).ok).toBe(true);

    builder.defineVirtualListRegion({
      anchorStartNode: b,
      anchorEndNode: a
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_ANCHOR_INVALID",
        message: "Virtual list region anchor range 2-1 is reversed."
      }
    });
  });

  it("rejects conditional regions whose anchors do not share the same parent boundary", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const group = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(root, group).ok).toBe(true);
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(group, b).ok).toBe(true);

    builder.defineConditionalRegion({
      anchorStartNode: a,
      anchorEndNode: b,
      branches: [
        { startNode: a, endNode: a }
      ]
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BOUNDARY_INVALID",
        message: "Conditional region anchor nodes 2 and 3 must share the same parent boundary."
      }
    });
  });

  it("rejects conditional regions with missing anchors", () => {
    const builder = createBlueprintBuilder();
    builder.element("View");

    builder.defineConditionalRegion({
      anchorStartNode: 4,
      anchorEndNode: 4,
      branches: [
        { startNode: 4, endNode: 4 }
      ]
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_ANCHOR_MISSING",
        message: "Conditional region references missing anchorStartNode 4."
      }
    });
  });

  it("rejects conditional regions whose branch range does not share the anchor parent boundary", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    const group = builder.element("View");
    const b = builder.text("B");
    const c = builder.text("C");
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(root, group).ok).toBe(true);
    expect(builder.append(group, b).ok).toBe(true);
    expect(builder.append(root, c).ok).toBe(true);

    builder.defineConditionalRegion({
      anchorStartNode: a,
      anchorEndNode: c,
      branches: [
        { startNode: b, endNode: b }
      ]
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BOUNDARY_INVALID",
        message: "Conditional region branch range 3-3 must share the same parent boundary as anchor range 1-4."
      }
    });
  });

  it("rejects keyed list regions whose anchors do not share the same parent boundary", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const group = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(root, group).ok).toBe(true);
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(group, b).ok).toBe(true);

    builder.defineKeyedListRegion({
      anchorStartNode: a,
      anchorEndNode: b
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BOUNDARY_INVALID",
        message: "Keyed list region anchor nodes 2 and 3 must share the same parent boundary."
      }
    });
  });

  it("rejects keyed list regions with missing anchors", () => {
    const builder = createBlueprintBuilder();
    builder.element("View");

    builder.defineKeyedListRegion({
      anchorStartNode: 5,
      anchorEndNode: 5
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_ANCHOR_MISSING",
        message: "Keyed list region references missing anchorStartNode 5."
      }
    });
  });

  it("rejects virtual list regions whose anchors do not share the same parent boundary", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const group = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(root, group).ok).toBe(true);
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(group, b).ok).toBe(true);

    builder.defineVirtualListRegion({
      anchorStartNode: a,
      anchorEndNode: b
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BOUNDARY_INVALID",
        message: "Virtual list region anchor nodes 2 and 3 must share the same parent boundary."
      }
    });
  });

  it("rejects virtual list regions with missing anchors", () => {
    const builder = createBlueprintBuilder();
    builder.element("View");

    builder.defineVirtualListRegion({
      anchorStartNode: 9,
      anchorEndNode: 9
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_ANCHOR_MISSING",
        message: "Virtual list region references missing anchorStartNode 9."
      }
    });
  });

  it("rejects nested block regions whose anchors do not share the same parent boundary", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const group = builder.element("View");
    const a = builder.text("A");
    const b = builder.text("B");
    expect(builder.append(root, group).ok).toBe(true);
    expect(builder.append(root, a).ok).toBe(true);
    expect(builder.append(group, b).ok).toBe(true);

    builder.defineNestedBlockRegion({
      anchorStartNode: a,
      anchorEndNode: b,
      childBlockSlot: 1,
      childBlueprintSlot: 2,
      mountMode: "attach"
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_BOUNDARY_INVALID",
        message: "Nested block region anchor nodes 2 and 3 must share the same parent boundary."
      }
    });
  });

  it("rejects nested block regions with negative child block slots", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    expect(builder.append(root, a).ok).toBe(true);

    builder.defineNestedBlockRegion({
      anchorStartNode: a,
      anchorEndNode: a,
      childBlockSlot: -1,
      childBlueprintSlot: 2,
      mountMode: "attach"
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_NESTED_SLOT_INVALID",
        message: "Nested block region childBlockSlot -1 must be >= 0."
      }
    });
  });

  it("rejects nested block regions with negative child blueprint slots", () => {
    const builder = createBlueprintBuilder();

    const root = builder.element("View");
    const a = builder.text("A");
    expect(builder.append(root, a).ok).toBe(true);

    builder.defineNestedBlockRegion({
      anchorStartNode: a,
      anchorEndNode: a,
      childBlockSlot: 1,
      childBlueprintSlot: -2,
      mountMode: "attach"
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_NESTED_SLOT_INVALID",
        message: "Nested block region childBlueprintSlot -2 must be >= 0."
      }
    });
  });

  it("rejects nested block regions with missing anchors", () => {
    const builder = createBlueprintBuilder();
    builder.element("View");

    builder.defineNestedBlockRegion({
      anchorStartNode: 7,
      anchorEndNode: 7,
      childBlockSlot: 1,
      childBlueprintSlot: 2,
      mountMode: "attach"
    });

    expect(builder.buildIR()).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BUILDER_REGION_ANCHOR_MISSING",
        message: "Nested block region references missing anchorStartNode 7."
      }
    });
  });

  it("rejects raw BlockIR with invalid initial signal values", () => {
    const block: BlockIR = {
      signalCount: 1,
      initialSignalValues: ["a", "b"],
      nodes: [
        { id: 0, kind: "element", type: "View", parent: null }
      ],
      bindings: []
    };

    expect(lowerBlockIRToBlueprint(block)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_INITIAL_SIGNAL_VALUES",
        message: "Initial signal values exceed signalCount."
      }
    });
  });

  it("rejects raw BlockIR with invalid signal counts", () => {
    const block: BlockIR = {
      signalCount: -1,
      nodes: [
        { id: 0, kind: "element", type: "View", parent: null }
      ],
      bindings: []
    };

    expect(lowerBlockIRToBlueprint(block)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "INVALID_SIGNAL_COUNT",
        message: "signalCount must be greater than or equal to zero."
      }
    });
  });

  it("compiles a minimal JSX block through the Babel frontend", () => {
    const result = compile(`
      import { View, Text } from "@jue/jsx";

      function render() {
        return <View><Text>hello</Text></View>;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.nodeCount).toBe(3);
    expect(result.value.bindingCount).toBe(0);
  });

  it("compiles identifier-based text and prop bindings through the Babel frontend", () => {
    const result = compile(`
      import { View, Text, Button, signal } from "@jue/jsx";

      function handleClick() {}
      function render() {
        const panelClass = signal("panel");
        const label = signal("hello");
        return (
          <View className={panelClass.get()}>
            <Text>{label.get()}</Text>
            <Button onClick={handleClick}>press</Button>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bindingCount).toBe(3);
    expect(Array.from(result.value.bindingOpcode)).toEqual([2, 0, 5]);
  });

  it("compiles literal expression children and static prop/style attributes", () => {
    const result = compile(`
      import { View, Text } from "@jue/jsx";

      function render() {
        return (
          <View className={"panel"} style:width={"320px"}>
            <Text>{42}</Text>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bindingCount).toBe(3);
    expect(Array.from(result.value.bindingOpcode)).toEqual([2, 3, 0]);
    expect(result.value.bindingArgRef).toContain("className");
    expect(result.value.bindingArgRef).toContain("width");
    expect(Array.from(result.value.signalToBindingCount)).toEqual([1, 1, 1]);
  });

  it("compiles implicit boolean attributes as static prop bindings", () => {
    const result = compile(`
      import { Input } from "@jue/jsx";

      function render() {
        return <Input disabled />;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bindingCount).toBe(1);
    expect(Array.from(result.value.bindingOpcode)).toEqual([2]);
    expect(result.value.bindingArgRef).toContain("disabled");
    expect(Array.from(result.value.signalToBindingCount)).toEqual([1]);
  });

  it("compiles style object expressions with mixed signal and literal values", () => {
    const result = compile(`
      import { View, signal } from "@jue/jsx";

      function render() {
        const panelWidth = signal("100%");
        return <View style={{ width: panelWidth.get(), opacity: 0.85 }} />;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bindingCount).toBe(2);
    expect(Array.from(result.value.bindingOpcode)).toEqual([3, 3]);
    expect(result.value.bindingArgRef).toContain("width");
    expect(result.value.bindingArgRef).toContain("opacity");
    expect(Array.from(result.value.signalToBindingCount)).toEqual([1, 1]);
  });

  it("compiles a conditional JSX expression into a conditional region", () => {
    const result = compile(`
      import { View, Text, signal } from "@jue/jsx";

      function render() {
        const visible = signal(true);
        return <View>{visible.get() ? <Text>on</Text> : <Text>off</Text>}</View>;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.regionType)).toEqual([0]);
    expect(Array.from(result.value.regionBranchRangeCount)).toEqual([2]);
  });

  it("compiles a Show primitive into a conditional region", () => {
    const result = compile(`
      import { Show, Text, View, signal } from "@jue/jsx";

      export function render() {
        const visible = signal(true);
        return (
          <View>
            <Show when={visible.get()} fallback={<Text>off</Text>}>
              <Text>on</Text>
            </Show>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.regionType)).toEqual([0]);
    expect(Array.from(result.value.regionBranchRangeCount)).toEqual([2]);
  });

  it("compiles a List JSX primitive into a keyed list region", () => {
    const result = compile(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([
          { id: "a", label: "Alpha" },
          { id: "b", label: "Bravo" }
        ]);

        return (
          <View>
            <List each={items.get()} by={item => item.id}>
              {item => <Text>{item.label}</Text>}
            </List>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.regionType)).toEqual([1]);
  });

  it("compiles a VirtualList JSX primitive into a virtual list region", () => {
    const result = compile(`
      import { Text, View, VirtualList, signal } from "@jue/jsx";

      export function render() {
        const rows = signal([
          { id: "0", label: "Row 00" },
          { id: "1", label: "Row 01" },
          { id: "2", label: "Row 02" }
        ]);

        return (
          <View>
            <VirtualList each={rows.get()} by={row => row.id} estimateSize={() => 44} overscan={1}>
              {row => <Text>{row.label}</Text>}
            </VirtualList>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.regionType)).toEqual([3]);
  });

  it("rejects structure primitives as the render root", () => {
    const result = compile(`
      import { List, Text, signal } from "@jue/jsx";

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        return (
          <List each={items.get()} by={item => item.id}>
            {item => <Text>{item.label}</Text>}
          </List>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_ROOT_SHAPE",
        message: "compile() currently requires JSX tag <List> to appear inside a host element."
      }
    });
  });

  it("rejects Portal primitives until portal support exists", () => {
    const result = compile(`
      import { Portal, Text, View, signal } from "@jue/jsx";

      export function render() {
        const target = signal("overlay");
        return (
          <View>
            <Portal target={target.get()}>
              <Text>overlay</Text>
            </Portal>
          </View>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() does not support <Portal> yet."
      }
    });
  });

  it("compiles signal declarations into signal slots and initial values", () => {
    const result = compile(`
      import { View, Text, signal } from "@jue/jsx";

      export function render() {
        const aaa = signal("123");
        return <View><Text>{aaa.get()}</Text></View>;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.signalToBindingCount).toEqual(new Uint32Array([1]));
    expect(Array.from(result.value.bindingOpcode)).toEqual([0]);
  });

  it("rejects bare signal reads and requires .get()", () => {
    const result = compile(`
      import { View, Text, signal } from "@jue/jsx";

      export function render() {
        const title = signal("hello");
        return <View><Text>{title}</Text></View>;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_EXPRESSION",
        message: "compile() requires signal reads to use .get(), got identifier title."
      }
    });
  });

  it("supports aliased signal imports", () => {
    const result = compile(`
      import { View, Text, signal as signal } from "@jue/jsx";

      export function render() {
        const aaa = signal("123");
        return <View><Text>{aaa.get()}</Text></View>;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.signalToBindingCount).toEqual(new Uint32Array([1]));
  });

  it("supports signal initializers referenced through local const aliases", () => {
    const result = compile(`
      import { Text, View, signal } from "@jue/jsx";

      export function render() {
        const rowsSeed = [
          { id: "row-00", label: "Row 00" },
          { id: "row-01", label: "Row 01" }
        ];
        const rows = signal(rowsSeed);

        return (
          <View>
            <Text>{rows.get()}</Text>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.signalToBindingCount)).toEqual([1]);
  });

  it("supports static Array.from signal initializers", () => {
    const result = compile(`
      import { Text, View, signal } from "@jue/jsx";

      export function render() {
        const rows = signal(Array.from({ length: 3 }, (_, i) => ({
          id: \`row-\${i}\`,
          label: \`Row \${i}\`
        })));

        return (
          <View>
            <Text>{rows.get()}</Text>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.signalToBindingCount)).toEqual([1]);
  });

  it("supports negative numeric and mapper-free Array.from signal initializers", () => {
    const result = compile(`
      import { Text, View, signal } from "@jue/jsx";

      export function render() {
        const offset = signal(-2);
        const rows = signal(Array.from(["a", "b"]));
        return <View><Text>{offset.get()}</Text><Text>{rows.get()}</Text></View>;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.signalToBindingCount)).toEqual([1, 1]);
  });

  it("rejects signal declarations with invalid arity and sparse array initializers", () => {
    expect(compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const value = signal();
        return <View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_DECLARATION",
        message: "Signal value must call signal() with exactly one initial value."
      }
    });

    expect(compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const value = signal([, "x"]);
        return <View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() does not support sparse or spread array signal() initializers."
      }
    });
  });

  it("rejects unsupported Array.from mapper shapes in signal initializers", () => {
    expect(compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const value = signal(Array.from({ length: 1 }, (...args) => args.length));
        return <View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() only supports identifier params in Array.from() signal() mappers."
      }
    });

    expect(compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const value = signal(Array.from({ length: 1 }, item => { return item; }));
        return <View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() only supports expression-bodied arrow mappers in Array.from() signal() initializers."
      }
    });
  });

  it("rejects unsupported object and Array.from signal initializer shapes", () => {
    expect(compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const field = "key";
        const value = signal({ [field]: "x" });
        return <View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() only supports plain object signal() initializers."
      }
    });

    expect(compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const value = signal(Array.from({}));
        return <View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() requires Array.from() object sources to define a static length."
      }
    });

    expect(compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const value = signal(Array.from({ length: -1 }));
        return <View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() requires Array.from() length to be a non-negative integer."
      }
    });
  });

  it("rejects conditional children that do not lower to JSX branches", () => {
    const result = compile(`
      import { View, Text, signal } from "@jue/jsx";

      export function render() {
        const visible = signal(true);
        return <View>{visible.get() ? <Text>on</Text> : "off"}</View>;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_REGION_PATTERN",
        message: "compile() currently only supports conditional JSX of the form cond ? <A /> : <B />."
      }
    });
  });

  it("rejects unsupported structure primitives and malformed Show usage", () => {
    expect(compile(`
      import { Boundary, View } from "@jue/jsx";

      export function render() {
        return <View><Boundary /></View>;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() does not support <Boundary> yet."
      }
    });

    expect(compile(`
      import { Show, Text, View, signal } from "@jue/jsx";

      export function render() {
        const visible = signal(true);
        return (
          <View>
            <Show when={visible.get()}>
              <Text>on</Text>
              <Text>extra</Text>
            </Show>
          </View>
        );
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() requires <Show> to define a single JSX element child."
      }
    });

    expect(compile(`
      import { Show, Text, View, signal } from "@jue/jsx";

      export function render() {
        const visible = signal(true);
        return (
          <View>
            <Show when={visible.get()} fallback={"off"}>
              <Text>on</Text>
            </Show>
          </View>
        );
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() requires <Show>.fallback to be a JSX element or null."
      }
    });
  });

  it("normalizes onClick handlers and ignores nullish static JSX children", () => {
    const result = compile(`
      import { Button, View } from "@jue/jsx";

      function handlePress() {}

      export function render() {
        return <View>{null}{false}<Button onClick={handlePress}>go</Button></View>;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bindingArgRef).toContain("onPress");
  });

  it("supports template item property paths with string and numeric segments", () => {
    const result = compileSourceToBlockIR(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([
          { id: "a", labels: [{ value: "Alpha" }] }
        ]);

        return (
          <View>
            <List each={items.get()} by={item => item.id}>
              {item => <Text>{item["labels"][0].value}</Text>}
            </List>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const listDescriptor = result.value.structures[0];
    expect(listDescriptor?.kind).toBe("keyed-list");
    expect(listDescriptor?.template.signalPaths).toEqual([["labels", "0", "value"]]);
  });

  it("rejects malformed template callback paths and nested structure primitives", () => {
    expect(compile(`
      import { List, Show, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        return (
          <View>
            <List each={items.get()} by={item => item.id}>
              {item => (
                <Show when={true}>
                  <Text>{item.label}</Text>
                </Show>
              )}
            </List>
          </View>
        );
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_ROOT_SHAPE",
        message: "compile() currently requires JSX tag <Show> to appear inside a host element."
      }
    });

    expect(compile(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        const segment = "label";
        return (
          <View>
            <List each={items.get()} by={item => item.id}>
              {item => <Text>{item[segment]}</Text>}
            </List>
          </View>
        );
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_EXPRESSION",
        message: "compile() currently only supports signal.get() reads or literal expressions, got MemberExpression."
      }
    });
  });

  it("rejects unsupported style object values and keys", () => {
    expect(compile(`
      import { View } from "@jue/jsx";

      export function render() {
        return <View style={{ width: null }} />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_STYLE_OBJECT",
        message: "compile() does not support style.width with null value."
      }
    });

    expect(compile(`
      import { View } from "@jue/jsx";

      export function render() {
        return <View style={{ 1: "x" }} />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_STYLE_OBJECT",
        message: "compile() only supports identifier or string style property keys."
      }
    });
  });

  it("rejects template literal expressions in JSX text children", () => {
    expect(compile(`
      import { Text, View, signal } from "@jue/jsx";

      export function render() {
        const label = signal("hello");
        return <View><Text>{\`row \${label.get()}\`}</Text></View>;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_EXPRESSION",
        message: "compile() does not support template literals with expressions yet."
      }
    });
  });

  it("rejects member and namespaced JSX tags", () => {
    expect(compile(`
      import { View } from "@jue/jsx";

      const UI = { View };

      export function render() {
        return <UI.View />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() does not support component/member JSX tags yet."
      }
    });

    expect(compile(`
      export function render() {
        return <svg:path />;
      }
    `)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() does not support component/member JSX tags yet."
      }
    });
  });

  it("supports template literal signal initializers with static interpolation", () => {
    const result = compile(`
      import { Text, View, signal } from "@jue/jsx";

      export function render() {
        const label = signal(\`Row \${2}\`);

        return (
          <View>
            <Text>{label.get()}</Text>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.signalToBindingCount)).toEqual([1]);
  });

  it("rejects identifier bindings that are not declared with signal", () => {
    const result = compile(`
      import { View, Text } from "@jue/jsx";

      export function render() {
        return <View><Text>{aaa.get()}</Text></View>;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "SIGNAL_REFERENCE_MISSING",
        message: "Signal aaa is not declared with signal()."
      }
    });
  });

  it("rejects unsupported JSX tags through the Babel frontend", () => {
    const result = compile(`
      import { View, Text } from "@jue/jsx";

      function render() {
        return <div>hello</div>;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() requires JSX tag <div> to be imported from @jue/jsx."
      }
    });
  });

  it("rejects unsupported spread props through the Babel frontend", () => {
    const result = compile(`
      import { View } from "@jue/jsx";

      function render() {
        return <View {...props} />;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_JSX_SPREAD",
        message: "compile() does not support JSX spread attributes yet."
      }
    });
  });

  it("rejects List primitives that omit by selectors", () => {
    const result = compile(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        return (
          <View>
            <List each={items.get()}>
              {item => <Text>{item.label}</Text>}
            </List>
          </View>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() requires structure primitive attribute by."
      }
    });
  });

  it("rejects List primitives that omit each sources", () => {
    const result = compile(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        return (
          <View>
            <List by={item => item.id}>
              {item => <Text>{item.label}</Text>}
            </List>
          </View>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() requires structure primitive attribute each."
      }
    });
  });

  it("rejects VirtualList primitives with non-static overscan values", () => {
    const result = compile(`
      import { Text, View, VirtualList, signal } from "@jue/jsx";

      export function render() {
        const rows = signal([{ id: "0", label: "Row 00" }]);
        const overscan = signal(2);
        return (
          <View>
            <VirtualList each={rows.get()} by={row => row.id} estimateSize={() => 44} overscan={overscan.get()}>
              {row => <Text>{row.label}</Text>}
            </VirtualList>
          </View>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() requires <VirtualList>.overscan to be a static numeric literal or arrow function returning one."
      }
    });
  });

  it("rejects List selectors that are not direct property paths", () => {
    const result = compile(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        return (
          <View>
            <List each={items.get()} by={item => item.id.toUpperCase()}>
              {item => <Text>{item.label}</Text>}
            </List>
          </View>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() only supports <List>.by selectors of the form item => item.id or item => item.meta.id."
      }
    });
  });

  it("rejects List primitives whose children are not render callbacks", () => {
    const result = compile(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        return (
          <View>
            <List each={items.get()} by={item => item.id}>
              <Text>bad</Text>
            </List>
          </View>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: "compile() requires <List> children to be a single arrow-function render callback."
      }
    });
  });

  it("rejects event handlers inside List template callbacks", () => {
    const result = compile(`
      import { Button, List, Text, View, signal } from "@jue/jsx";

      function handlePress() {}

      export function render() {
        const items = signal([{ id: "a", label: "Alpha" }]);
        return (
          <View>
            <List each={items.get()} by={item => item.id}>
              {item => (
                <Button onPress={handlePress}>
                  <Text>{item.label}</Text>
                </Button>
              )}
            </List>
          </View>
        );
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_EVENT_HANDLER",
        message: "compile() does not support event handlers inside List or VirtualList template callbacks yet."
      }
    });
  });

  it("rejects render roots that are not JSX elements", () => {
    const result = compile(`
      export function render() {
        return "hello";
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_ROOT_SHAPE",
        message: "compile() requires root component render to return a single JSX element."
      }
    });
  });

  it("rejects missing render functions", () => {
    const result = compile(`
      export function notRender() {
        return null;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_ROOT_SHAPE",
        message: "compile() could not find root component render."
      }
    });
  });

  it("compiles a named root component when rootSymbol is provided", () => {
    const result = compile(`
      import { View, Text, signal } from "@jue/jsx";

      export function App() {
        const title = signal("hello");
        return <View><Text>{title.get()}</Text></View>;
      }
    `, { rootSymbol: "App" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.bindingOpcode)).toEqual([0]);
  });

  it("reports the requested root component when it cannot be found", () => {
    const result = compile(`
      import { View } from "@jue/jsx";

      export function App() {
        return <View />;
      }
    `, { rootSymbol: "Page" });

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_ROOT_SHAPE",
        message: "compile() could not find root component Page."
      }
    });
  });

  it("compiles an exported const arrow root when rootSymbol is provided", () => {
    const result = compile(`
      import { View, Text, signal } from "@jue/jsx";

      export const App = () => {
        const title = signal("hello");
        return <View><Text>{title.get()}</Text></View>;
      };
    `, { rootSymbol: "App" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.from(result.value.bindingOpcode)).toEqual([0]);
  });

  it("rejects using the selected root symbol as an event handler", () => {
    const result = compile(`
      import { Button, View } from "@jue/jsx";

      export function App() {
        return <View><Button onPress={App}>go</Button></View>;
      }
    `, { rootSymbol: "App" });

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_EVENT_HANDLER",
        message: "compile() could not resolve event handler App."
      }
    });
  });

  it("rejects non-const signal declarations", () => {
    const result = compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        let flag = signal(true);
        return <View />;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_DECLARATION",
        message: "compile() only supports const signal declarations."
      }
    });
  });

  it("rejects unsupported signal initializers", () => {
    const result = compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const value = signal(new Map());
        return <View />;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() only supports literal signal() initializers, got NewExpression."
      }
    });
  });

  it("rejects unsupported style object expressions", () => {
    const result = compile(`
      import { View, signal } from "@jue/jsx";

      export function render() {
        const width = signal("100%");
        return <View style={{ [width]: width }} />;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_STYLE_OBJECT",
        message: "compile() does not support computed or spread style properties yet."
      }
    });
  });

  it("rejects event handlers that are not identifiers", () => {
    const result = compile(`
      import { Button } from "@jue/jsx";

      export function render() {
        return <Button onPress={() => {}}>go</Button>;
      }
    `);

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "UNSUPPORTED_EVENT_HANDLER",
        message: "compile() requires event onPress to reference a named function."
      }
    });
  });
});
