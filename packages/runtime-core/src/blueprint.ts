import {
  err,
  INVALID_INDEX,
  ok,
  type Result
} from "@jue/shared";

import type { Blueprint } from "./types";

export interface CreateBlueprintInput {
  readonly nodeCount: number;
  readonly nodeKind?: Uint8Array;
  readonly nodePrimitiveRefIndex?: Uint32Array;
  readonly nodeTextRefIndex?: Uint32Array;
  readonly nodeParentIndex?: Uint32Array;
  readonly bindingOpcode: Uint8Array;
  readonly bindingNodeIndex: Uint32Array;
  readonly bindingDataIndex: Uint32Array;
  readonly bindingArgU32?: Uint32Array;
  readonly bindingArgRef?: readonly unknown[];
  readonly regionType: Uint8Array;
  readonly regionAnchorStart: Uint32Array;
  readonly regionAnchorEnd: Uint32Array;
  readonly signalToBindingStart?: Uint32Array;
  readonly signalToBindingCount?: Uint32Array;
  readonly signalToBindings?: Uint32Array;
}

export interface BlueprintError {
  readonly code: string;
  readonly message: string;
}

export function createBlueprint(input: CreateBlueprintInput): Result<Blueprint, BlueprintError> {
  const {
    nodeCount,
    nodeKind,
    nodePrimitiveRefIndex,
    nodeTextRefIndex,
    nodeParentIndex,
    bindingOpcode,
    bindingNodeIndex,
    bindingDataIndex,
    regionType,
    regionAnchorStart,
    regionAnchorEnd
  } = input;

  if (bindingOpcode.length !== bindingNodeIndex.length || bindingOpcode.length !== bindingDataIndex.length) {
    return err({
      code: "INVALID_BINDING_TABLE",
      message: "binding opcode, node index, and data index tables must have the same length."
    });
  }

  if (regionType.length !== regionAnchorStart.length || regionType.length !== regionAnchorEnd.length) {
    return err({
      code: "INVALID_REGION_TABLE",
      message: "region type and anchor tables must have the same length."
    });
  }

  const resolvedNodeKind = nodeKind ?? new Uint8Array(nodeCount);
  const resolvedNodePrimitiveRefIndex = nodePrimitiveRefIndex ?? fillInvalidNodeTable(nodeCount);
  const resolvedNodeTextRefIndex = nodeTextRefIndex ?? fillInvalidNodeTable(nodeCount);
  const resolvedNodeParentIndex = nodeParentIndex ?? fillInvalidNodeTable(nodeCount);

  if (
    resolvedNodeKind.length !== nodeCount ||
    resolvedNodePrimitiveRefIndex.length !== nodeCount ||
    resolvedNodeTextRefIndex.length !== nodeCount ||
    resolvedNodeParentIndex.length !== nodeCount
  ) {
    return err({
      code: "INVALID_NODE_TABLE",
      message: "node tables must have the same length as nodeCount."
    });
  }

  for (const nodeIndex of bindingNodeIndex) {
    if (nodeIndex !== INVALID_INDEX && nodeIndex >= nodeCount) {
      return err({
        code: "BINDING_NODE_OUT_OF_RANGE",
        message: `Binding node index ${nodeIndex} is out of range for nodeCount ${nodeCount}.`
      });
    }
  }

  return ok({
    nodeCount,
    bindingCount: bindingOpcode.length,
    regionCount: regionType.length,
    nodeKind: resolvedNodeKind,
    nodePrimitiveRefIndex: resolvedNodePrimitiveRefIndex,
    nodeTextRefIndex: resolvedNodeTextRefIndex,
    nodeParentIndex: resolvedNodeParentIndex,
    bindingOpcode,
    bindingNodeIndex,
    bindingDataIndex,
    bindingArgU32: input.bindingArgU32 ?? new Uint32Array(0),
    bindingArgRef: input.bindingArgRef ?? [],
    regionType,
    regionAnchorStart,
    regionAnchorEnd,
    signalToBindingStart: input.signalToBindingStart ?? new Uint32Array(0),
    signalToBindingCount: input.signalToBindingCount ?? new Uint32Array(0),
    signalToBindings: input.signalToBindings ?? new Uint32Array(0)
  });
}

export function createEmptyBlueprint(): Blueprint {
  return {
    nodeCount: 0,
    bindingCount: 0,
    regionCount: 0,
    nodeKind: new Uint8Array(0),
    nodePrimitiveRefIndex: new Uint32Array(0),
    nodeTextRefIndex: new Uint32Array(0),
    nodeParentIndex: new Uint32Array(0),
    bindingOpcode: new Uint8Array(0),
    bindingNodeIndex: new Uint32Array(0),
    bindingDataIndex: new Uint32Array(0),
    bindingArgU32: new Uint32Array(0),
    bindingArgRef: [],
    regionType: new Uint8Array(0),
    regionAnchorStart: new Uint32Array(0),
    regionAnchorEnd: new Uint32Array(0),
    signalToBindingStart: new Uint32Array(0),
    signalToBindingCount: new Uint32Array(0),
    signalToBindings: new Uint32Array(0)
  };
}

function fillInvalidNodeTable(nodeCount: number): Uint32Array {
  const table = new Uint32Array(nodeCount);
  table.fill(INVALID_INDEX);
  return table;
}
