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
  readonly regionBranchRangeStart?: Uint32Array;
  readonly regionBranchRangeCount?: Uint32Array;
  readonly regionBranchNodeStart?: Uint32Array;
  readonly regionBranchNodeEnd?: Uint32Array;
  readonly regionNestedBlockSlot?: Uint32Array;
  readonly regionNestedBlueprintSlot?: Uint32Array;
  readonly regionNestedMountMode?: Uint8Array;
  readonly signalToBindingStart?: Uint32Array;
  readonly signalToBindingCount?: Uint32Array;
  readonly signalToBindings?: Uint32Array;
}

export interface BlueprintError {
  readonly code: string;
  readonly message: string;
}

/**
 * 校验并规范化编译器产物，生成运行时使用的 blueprint。
 *
 * @description
 * 这个函数会补齐可选表的默认值，并在返回前校验表长、
 * 节点索引和 region 元数据之间的基本一致性。
 *
 * @param input 编译器或测试构造出的原始 blueprint 表。
 * @returns 已补齐可选表默认值的 blueprint。
 */
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
    regionAnchorEnd,
    regionBranchRangeStart,
    regionBranchRangeCount,
    regionBranchNodeStart,
    regionBranchNodeEnd,
    regionNestedBlockSlot,
    regionNestedBlueprintSlot,
    regionNestedMountMode
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

  const resolvedRegionBranchRangeStart = regionBranchRangeStart ?? new Uint32Array(regionType.length);
  const resolvedRegionBranchRangeCount = regionBranchRangeCount ?? new Uint32Array(regionType.length);
  const resolvedRegionBranchNodeStart = regionBranchNodeStart ?? new Uint32Array(0);
  const resolvedRegionBranchNodeEnd = regionBranchNodeEnd ?? new Uint32Array(0);

  if (
    resolvedRegionBranchRangeStart.length !== regionType.length ||
    resolvedRegionBranchRangeCount.length !== regionType.length
  ) {
    return err({
      code: "INVALID_REGION_BRANCH_TABLE",
      message: "region branch range tables must have the same length as regionType."
    });
  }

  if (resolvedRegionBranchNodeStart.length !== resolvedRegionBranchNodeEnd.length) {
    return err({
      code: "INVALID_REGION_BRANCH_NODE_TABLE",
      message: "region branch node start and end tables must have the same length."
    });
  }

  const resolvedRegionNestedBlockSlot = regionNestedBlockSlot ?? fillInvalidNodeTable(regionType.length);
  const resolvedRegionNestedBlueprintSlot = regionNestedBlueprintSlot ?? fillInvalidNodeTable(regionType.length);
  const resolvedRegionNestedMountMode = regionNestedMountMode ?? new Uint8Array(regionType.length);

  if (
    resolvedRegionNestedBlockSlot.length !== regionType.length ||
    resolvedRegionNestedBlueprintSlot.length !== regionType.length ||
    resolvedRegionNestedMountMode.length !== regionType.length
  ) {
    return err({
      code: "INVALID_REGION_NESTED_TABLE",
      message: "nested block region tables must have the same length as regionType."
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
    regionBranchRangeStart: resolvedRegionBranchRangeStart,
    regionBranchRangeCount: resolvedRegionBranchRangeCount,
    regionBranchNodeStart: resolvedRegionBranchNodeStart,
    regionBranchNodeEnd: resolvedRegionBranchNodeEnd,
    regionNestedBlockSlot: resolvedRegionNestedBlockSlot,
    regionNestedBlueprintSlot: resolvedRegionNestedBlueprintSlot,
    regionNestedMountMode: resolvedRegionNestedMountMode,
    signalToBindingStart: input.signalToBindingStart ?? new Uint32Array(0),
    signalToBindingCount: input.signalToBindingCount ?? new Uint32Array(0),
    signalToBindings: input.signalToBindings ?? new Uint32Array(0)
  });
}

/**
 * 创建一个零尺寸的空 blueprint，适合测试或哨兵值场景。
 *
 * @description
 * 返回值里的所有 typed array 都会被显式分配成长度 0，
 * 这样上层不需要为“字段是否存在”再写额外分支。
 *
 * @returns 所有表长度都为 0 的空 blueprint。
 */
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
    regionBranchRangeStart: new Uint32Array(0),
    regionBranchRangeCount: new Uint32Array(0),
    regionBranchNodeStart: new Uint32Array(0),
    regionBranchNodeEnd: new Uint32Array(0),
    regionNestedBlockSlot: new Uint32Array(0),
    regionNestedBlueprintSlot: new Uint32Array(0),
    regionNestedMountMode: new Uint8Array(0),
    signalToBindingStart: new Uint32Array(0),
    signalToBindingCount: new Uint32Array(0),
    signalToBindings: new Uint32Array(0)
  };
}

/**
 * 创建一个按节点数分配、并填充为无效索引哨兵值的表。
 *
 * @param nodeCount 要分配的槽位数。
 * @returns 所有项都初始化为 `INVALID_INDEX` 的表。
 */
function fillInvalidNodeTable(nodeCount: number): Uint32Array {
  const table = new Uint32Array(nodeCount);
  table.fill(INVALID_INDEX);
  return table;
}
