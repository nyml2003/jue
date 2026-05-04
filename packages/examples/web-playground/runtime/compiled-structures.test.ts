import { describe, expect, it } from "vitest";

import {
  createKeyedListItems,
  createVirtualListWindow,
  readCompiledItems,
  resolveVirtualWindowMetrics,
  type CompiledKeyedListDescriptor,
  type CompiledVirtualListDescriptor
} from "./compiled-structures";

const template = {
  blueprint: { nodeCount: 0 } as never,
  signalCount: 3,
  initialSignalValues: ["row", null],
  signalPaths: [null, ["label"], ["meta", "state"]] as const
};

describe("@jue/web-playground compiled structures", () => {
  it("reads compiled item sources and maps keyed item specs", () => {
    const descriptor: CompiledKeyedListDescriptor = {
      regionSlot: 0,
      sourceSignalSlot: 1,
      keyPath: ["id"],
      template
    };

    expect(readCompiledItems(descriptor, ["skip", [{ id: "a" }]])).toEqual([{ id: "a" }]);
    expect(readCompiledItems(descriptor, ["skip", "not-an-array"])).toEqual([]);

    expect(createKeyedListItems(descriptor, [
      { id: "a", label: "Alpha", meta: { state: "warm" } }
    ])).toEqual([
      {
        key: "a",
        blueprint: template.blueprint,
        signalCount: 3,
        initialSignalValues: ["row", "Alpha", "warm"]
      }
    ]);

    expect(createKeyedListItems(descriptor, [
      { id: "b", label: "Bravo" }
    ])).toEqual([
      {
        key: "b",
        blueprint: template.blueprint,
        signalCount: 3,
        initialSignalValues: ["row", "Bravo", undefined]
      }
    ]);
  });

  it("creates stable virtual windows and clamps edges", () => {
    const descriptor: CompiledVirtualListDescriptor = {
      regionSlot: 0,
      sourceSignalSlot: 0,
      keyPath: ["id"],
      estimateSize: 20,
      overscan: 1,
      template
    };
    const items = [
      { id: "0", label: "Row 00", meta: { state: "cold" } },
      { id: "1", label: "Row 01", meta: { state: "cold" } },
      { id: "2", label: "Row 02", meta: { state: "cold" } },
      { id: "3", label: "Row 03", meta: { state: "cold" } }
    ];

    expect(createVirtualListWindow(descriptor, items, 2, 3)).toEqual({
      itemCount: 4,
      windowStart: 0,
      cells: [
        {
          blueprint: template.blueprint,
          signalCount: 3,
          initialSignalValues: ["row", "Row 00", "cold"]
        },
        {
          blueprint: template.blueprint,
          signalCount: 3,
          initialSignalValues: ["row", "Row 01", "cold"]
        },
        {
          blueprint: template.blueprint,
          signalCount: 3,
          initialSignalValues: ["row", "Row 02", "cold"]
        },
        {
          blueprint: template.blueprint,
          signalCount: 3,
          initialSignalValues: ["row", "Row 03", "cold"]
        }
      ]
    });

    expect(resolveVirtualWindowMetrics(descriptor, 2, 3, 8)).toEqual({
      cellCount: 2,
      windowStart: 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0
    });
  });
});
