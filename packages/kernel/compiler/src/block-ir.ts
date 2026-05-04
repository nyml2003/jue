import type { Blueprint } from "@jue/runtime-core";
import { createBlueprint } from "@jue/runtime-core";
import {
  BindingOpcode,
  INVALID_INDEX,
  RegionType,
  err,
  ok,
  type HostEventKey,
  type HostPrimitive,
  type Result
} from "@jue/shared";

const NODE_KIND_ELEMENT = 1;
const NODE_KIND_TEXT = 2;

export interface BlockIR {
  readonly signalCount: number;
  readonly initialSignalValues?: readonly unknown[];
  readonly nodes: readonly IRNode[];
  readonly bindings: readonly IRBinding[];
  readonly regions?: readonly IRRegion[];
}

export type IRNode =
  | {
      readonly id: number;
      readonly kind: "element";
      readonly type: HostPrimitive;
      readonly parent: number | null;
    }
  | {
      readonly id: number;
      readonly kind: "text";
      readonly value: string;
      readonly parent: number | null;
    };

export type IRBinding =
  | {
      readonly kind: "text";
      readonly node: number;
      readonly signal: number;
    }
  | {
      readonly kind: "prop";
      readonly node: number;
      readonly key: string;
      readonly signal: number;
    }
  | {
      readonly kind: "style";
      readonly node: number;
      readonly key: string;
      readonly signal: number;
    }
  | {
      readonly kind: "event";
      readonly node: number;
      readonly event: HostEventKey;
      readonly handler: unknown;
    }
  | {
      readonly kind: "region-switch";
      readonly signal: number;
      readonly region: number;
      readonly truthyBranch: number;
      readonly falsyBranch: number;
    };

export type IRRegion =
  | {
      readonly kind: "conditional";
      readonly anchorStartNode: number;
      readonly anchorEndNode: number;
      readonly branches: readonly {
        readonly startNode: number;
        readonly endNode: number;
      }[];
    }
  | {
      readonly kind: "nested-block";
      readonly anchorStartNode: number;
      readonly anchorEndNode: number;
      readonly childBlockSlot: number;
      readonly childBlueprintSlot: number;
      readonly mountMode: "attach" | "replace";
    }
  | {
      readonly kind: "keyed-list";
      readonly anchorStartNode: number;
      readonly anchorEndNode: number;
    }
  | {
      readonly kind: "virtual-list";
      readonly anchorStartNode: number;
      readonly anchorEndNode: number;
    };

export interface LowerBlockIRError {
  readonly code: string;
  readonly message: string;
}

export interface LoweredBlockIR {
  readonly blueprint: Blueprint;
  readonly signalCount: number;
  readonly initialSignalValues: readonly unknown[];
}

export function lowerBlockIRToBlueprint(
  block: BlockIR
): Result<LoweredBlockIR, LowerBlockIRError> {
  if (block.signalCount < 0) {
    return err({
      code: "INVALID_SIGNAL_COUNT",
      message: "signalCount must be greater than or equal to zero."
    });
  }

  if ((block.initialSignalValues?.length ?? 0) > block.signalCount) {
    return err({
      code: "INVALID_INITIAL_SIGNAL_VALUES",
      message: "Initial signal values exceed signalCount."
    });
  }

  const orderedNodes = [...block.nodes].sort((left, right) => left.id - right.id);
  const nodeCount = orderedNodes.length;
  const nodeKind = new Uint8Array(nodeCount);
  const nodePrimitiveRefIndex = createInvalidIndexTable(nodeCount);
  const nodeTextRefIndex = createInvalidIndexTable(nodeCount);
  const nodeParentIndex = createInvalidIndexTable(nodeCount);

  const bindingOpcode = new Uint8Array(block.bindings.length);
  const bindingNodeIndex = new Uint32Array(block.bindings.length);
  const bindingDataIndex = new Uint32Array(block.bindings.length);
  const bindingArgU32: number[] = [];
  const bindingArgRef: unknown[] = [];
  const signalToBindings = new Map<number, number[]>();
  const regions = block.regions ?? [];
  const regionType = new Uint8Array(regions.length);
  const regionAnchorStart = new Uint32Array(regions.length);
  const regionAnchorEnd = new Uint32Array(regions.length);
  const regionBranchRangeStart = new Uint32Array(regions.length);
  const regionBranchRangeCount = new Uint32Array(regions.length);
  const regionBranchNodeStart: number[] = [];
  const regionBranchNodeEnd: number[] = [];
  const regionNestedBlockSlot = createInvalidIndexTable(regions.length);
  const regionNestedBlueprintSlot = createInvalidIndexTable(regions.length);
  const regionNestedMountMode = new Uint8Array(regions.length);

  const nodeSlotById = new Map<number, number>();
  orderedNodes.forEach((node, index) => {
    nodeSlotById.set(node.id, index);
  });

  for (let index = 0; index < orderedNodes.length; index += 1) {
    const node = orderedNodes[index];
    if (!node) {
      continue;
    }

    if (node.parent === null) {
      nodeParentIndex[index] = INVALID_INDEX;
    } else {
      // 原始 BlockIR 允许外部直接构造，所以这里不能像 Builder 一样假设 parent 一定合法。
      // 一旦静默退成 INVALID_INDEX，后面的 Blueprint 就会把坏结构当成根节点继续跑下去。
      const parentSlotResult = getNodeSlot(nodeSlotById, node.parent, "parent", node.id);
      if (!parentSlotResult.ok) {
        return parentSlotResult;
      }

      nodeParentIndex[index] = parentSlotResult.value;
    }

    if (node.kind === "element") {
      nodeKind[index] = NODE_KIND_ELEMENT;
      nodePrimitiveRefIndex[index] = pushRef(bindingArgRef, node.type);
      continue;
    }

    nodeKind[index] = NODE_KIND_TEXT;
    nodeTextRefIndex[index] = pushRef(bindingArgRef, node.value);
  }

  for (let bindingSlot = 0; bindingSlot < block.bindings.length; bindingSlot += 1) {
    const binding = block.bindings[bindingSlot];
    if (!binding) {
      continue;
    }

    switch (binding.kind) {
      case "text":
        {
          const nodeSlotResult = getNodeSlot(nodeSlotById, binding.node, "binding node", bindingSlot);
          if (!nodeSlotResult.ok) {
            return nodeSlotResult;
          }

          bindingNodeIndex[bindingSlot] = nodeSlotResult.value;
        }
        bindingOpcode[bindingSlot] = BindingOpcode.TEXT;
        bindingDataIndex[bindingSlot] = binding.signal;
        addSignalDependency(signalToBindings, binding.signal, bindingSlot);
        break;
      case "prop":
        {
          const nodeSlotResult = getNodeSlot(nodeSlotById, binding.node, "binding node", bindingSlot);
          if (!nodeSlotResult.ok) {
            return nodeSlotResult;
          }

          bindingNodeIndex[bindingSlot] = nodeSlotResult.value;
        }
        bindingOpcode[bindingSlot] = BindingOpcode.PROP;
        bindingDataIndex[bindingSlot] = bindingArgU32.length;
        bindingArgU32.push(binding.signal, pushRef(bindingArgRef, binding.key));
        addSignalDependency(signalToBindings, binding.signal, bindingSlot);
        break;
      case "style":
        {
          const nodeSlotResult = getNodeSlot(nodeSlotById, binding.node, "binding node", bindingSlot);
          if (!nodeSlotResult.ok) {
            return nodeSlotResult;
          }

          bindingNodeIndex[bindingSlot] = nodeSlotResult.value;
        }
        bindingOpcode[bindingSlot] = BindingOpcode.STYLE;
        bindingDataIndex[bindingSlot] = bindingArgU32.length;
        bindingArgU32.push(binding.signal, pushRef(bindingArgRef, binding.key));
        addSignalDependency(signalToBindings, binding.signal, bindingSlot);
        break;
      case "event":
        {
          const nodeSlotResult = getNodeSlot(nodeSlotById, binding.node, "binding node", bindingSlot);
          if (!nodeSlotResult.ok) {
            return nodeSlotResult;
          }

          bindingNodeIndex[bindingSlot] = nodeSlotResult.value;
        }
        bindingOpcode[bindingSlot] = BindingOpcode.EVENT;
        bindingDataIndex[bindingSlot] = bindingArgU32.length;
        bindingArgU32.push(
          pushRef(bindingArgRef, binding.event),
          pushRef(bindingArgRef, binding.handler)
        );
        break;
      case "region-switch":
        bindingOpcode[bindingSlot] = BindingOpcode.REGION_SWITCH;
        bindingNodeIndex[bindingSlot] = INVALID_INDEX;
        bindingDataIndex[bindingSlot] = bindingArgU32.length;
        bindingArgU32.push(
          binding.signal,
          binding.region,
          binding.truthyBranch,
          binding.falsyBranch
        );
        addSignalDependency(signalToBindings, binding.signal, bindingSlot);
        break;
    }
  }

  for (let regionSlot = 0; regionSlot < regions.length; regionSlot += 1) {
    const region = regions[regionSlot];
    if (!region) {
      continue;
    }

    switch (region.kind) {
      case "conditional": {
        const startNode = getNodeSlot(nodeSlotById, region.anchorStartNode, "region anchor start", regionSlot);
        if (!startNode.ok) {
          return startNode;
        }

        const endNode = getNodeSlot(nodeSlotById, region.anchorEndNode, "region anchor end", regionSlot);
        if (!endNode.ok) {
          return endNode;
        }

        regionType[regionSlot] = RegionType.CONDITIONAL;
        regionAnchorStart[regionSlot] = startNode.value;
        regionAnchorEnd[regionSlot] = endNode.value;
        regionBranchRangeStart[regionSlot] = regionBranchNodeStart.length;
        regionBranchRangeCount[regionSlot] = region.branches.length;

        for (const branch of region.branches) {
          const branchStartNode = getNodeSlot(
            nodeSlotById,
            branch.startNode,
            "conditional branch start",
            regionSlot
          );
          if (!branchStartNode.ok) {
            return branchStartNode;
          }

          const branchEndNode = getNodeSlot(
            nodeSlotById,
            branch.endNode,
            "conditional branch end",
            regionSlot
          );
          if (!branchEndNode.ok) {
            return branchEndNode;
          }

          regionBranchNodeStart.push(branchStartNode.value);
          regionBranchNodeEnd.push(branchEndNode.value);
        }
        break;
      }
      case "nested-block": {
        const startNode = getNodeSlot(nodeSlotById, region.anchorStartNode, "region anchor start", regionSlot);
        if (!startNode.ok) {
          return startNode;
        }

        const endNode = getNodeSlot(nodeSlotById, region.anchorEndNode, "region anchor end", regionSlot);
        if (!endNode.ok) {
          return endNode;
        }

        regionType[regionSlot] = RegionType.NESTED_BLOCK;
        regionAnchorStart[regionSlot] = startNode.value;
        regionAnchorEnd[regionSlot] = endNode.value;
        regionNestedBlockSlot[regionSlot] = region.childBlockSlot;
        regionNestedBlueprintSlot[regionSlot] = region.childBlueprintSlot;
        regionNestedMountMode[regionSlot] = region.mountMode === "replace" ? 1 : 0;
        break;
      }
      case "keyed-list": {
        const startNode = getNodeSlot(nodeSlotById, region.anchorStartNode, "region anchor start", regionSlot);
        if (!startNode.ok) {
          return startNode;
        }

        const endNode = getNodeSlot(nodeSlotById, region.anchorEndNode, "region anchor end", regionSlot);
        if (!endNode.ok) {
          return endNode;
        }

        regionType[regionSlot] = RegionType.KEYED_LIST;
        regionAnchorStart[regionSlot] = startNode.value;
        regionAnchorEnd[regionSlot] = endNode.value;
        break;
      }
      case "virtual-list": {
        const startNode = getNodeSlot(nodeSlotById, region.anchorStartNode, "region anchor start", regionSlot);
        if (!startNode.ok) {
          return startNode;
        }

        const endNode = getNodeSlot(nodeSlotById, region.anchorEndNode, "region anchor end", regionSlot);
        if (!endNode.ok) {
          return endNode;
        }

        regionType[regionSlot] = RegionType.VIRTUAL_LIST;
        regionAnchorStart[regionSlot] = startNode.value;
        regionAnchorEnd[regionSlot] = endNode.value;
        break;
      }
    }
  }

  const {
    signalToBindingStart,
    signalToBindingCount,
    signalToBindingsTable
  } = buildSignalToBindings(signalToBindings, block.signalCount);

  const blueprintResult = createBlueprint({
    nodeCount,
    nodeKind,
    nodePrimitiveRefIndex,
    nodeTextRefIndex,
    nodeParentIndex,
    bindingOpcode,
    bindingNodeIndex,
    bindingDataIndex,
    bindingArgU32: Uint32Array.from(bindingArgU32),
    bindingArgRef,
    regionType,
    regionAnchorStart,
    regionAnchorEnd,
    regionBranchRangeStart,
    regionBranchRangeCount,
    regionBranchNodeStart: Uint32Array.from(regionBranchNodeStart),
    regionBranchNodeEnd: Uint32Array.from(regionBranchNodeEnd),
    regionNestedBlockSlot,
    regionNestedBlueprintSlot,
    regionNestedMountMode,
    signalToBindingStart,
    signalToBindingCount,
    signalToBindings: signalToBindingsTable
  });

  if (!blueprintResult.ok) {
    return err(blueprintResult.error);
  }

  return ok({
    blueprint: blueprintResult.value,
    signalCount: block.signalCount,
    initialSignalValues: block.initialSignalValues ?? []
  });
}

function buildSignalToBindings(
  signalMap: Map<number, number[]>,
  signalCount: number
) {
  const signalToBindingStart = new Uint32Array(signalCount);
  const signalToBindingCount = new Uint32Array(signalCount);
  const flattened: number[] = [];

  for (let signalSlot = 0; signalSlot < signalCount; signalSlot += 1) {
    const bindings = signalMap.get(signalSlot) ?? [];
    signalToBindingStart[signalSlot] = flattened.length;
    signalToBindingCount[signalSlot] = bindings.length;
    flattened.push(...bindings);
  }

  return {
    signalToBindingStart,
    signalToBindingCount,
    signalToBindingsTable: Uint32Array.from(flattened)
  };
}

function addSignalDependency(
  signalMap: Map<number, number[]>,
  signalSlot: number,
  bindingSlot: number
) {
  const current = signalMap.get(signalSlot);
  if (current) {
    current.push(bindingSlot);
    return;
  }

  signalMap.set(signalSlot, [bindingSlot]);
}

function createInvalidIndexTable(size: number): Uint32Array {
  const table = new Uint32Array(size);
  table.fill(INVALID_INDEX);
  return table;
}

function pushRef(refs: unknown[], value: unknown): number {
  refs.push(value);
  return refs.length - 1;
}

function getNodeSlot(
  nodeSlotById: Map<number, number>,
  nodeId: number,
  label: string,
  owner: number
): Result<number, LowerBlockIRError> {
  const nodeSlot = nodeSlotById.get(nodeId);
  if (nodeSlot === undefined) {
    return err({
      code: "IR_NODE_REFERENCE_MISSING",
      message: `Missing ${label} reference for ${owner}: node id ${nodeId} does not exist.`
    });
  }

  return ok(nodeSlot);
}
