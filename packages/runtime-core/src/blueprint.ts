import {
  err,
  INVALID_INDEX,
  ok,
  type Result
} from "@jue/shared";

import type { Blueprint } from "./types";

export interface CreateBlueprintInput {
  readonly nodeCount: number;
  readonly bindingOpcode: Uint8Array;
  readonly bindingNodeIndex: Uint32Array;
  readonly bindingDataIndex: Uint32Array;
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
    bindingOpcode,
    bindingNodeIndex,
    bindingDataIndex,
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
    bindingOpcode: new Uint8Array(0),
    bindingNodeIndex: new Uint32Array(0),
    bindingDataIndex: new Uint32Array(0),
    regionType: new Uint8Array(0),
    regionAnchorStart: new Uint32Array(0),
    regionAnchorEnd: new Uint32Array(0),
    signalToBindingStart: new Uint32Array(0),
    signalToBindingCount: new Uint32Array(0),
    signalToBindings: new Uint32Array(0)
  };
}
