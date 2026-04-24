import { err, ok, type HostEventKey, type HostPrimitive, type Result } from "@jue/shared";

import {
  lowerBlockIRToBlueprint,
  type BlockIR,
  type IRBinding,
  type IRNode,
  type IRRegion,
  type LowerBlockIRError,
  type LoweredBlockIR
} from "./block-ir";

export interface BlueprintBuilder {
  readonly signalCount: number;
  setSignalCount(count: number): void;
  setInitialSignalValues(values: readonly unknown[]): void;
  element(type: HostPrimitive): number;
  text(value: string): number;
  append(parent: number, child: number): Result<void, BlueprintBuilderError>;
  defineConditionalRegion(region: ConditionalRegionDefinition): number;
  defineKeyedListRegion(region: KeyedListRegionDefinition): number;
  defineNestedBlockRegion(region: NestedBlockRegionDefinition): number;
  defineVirtualListRegion(region: VirtualListRegionDefinition): number;
  bindText(node: number, signal: number): void;
  bindProp(node: number, key: string, signal: number): void;
  bindStyle(node: number, key: string, signal: number): void;
  bindEvent(node: number, event: HostEventKey, handler: unknown): void;
  buildIR(): Result<BlockIR, BlueprintBuilderError>;
  buildBlueprint(): Result<LoweredBlockIR, BlueprintBuilderError | LowerBlockIRError>;
}

export interface BlueprintBuilderError {
  readonly code: string;
  readonly message: string;
}

export interface ConditionalRegionDefinition {
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
  readonly branches: readonly {
    readonly startNode: number;
    readonly endNode: number;
  }[];
}

export interface NestedBlockRegionDefinition {
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
  readonly childBlockSlot: number;
  readonly childBlueprintSlot: number;
  readonly mountMode: "attach" | "replace";
}

export interface KeyedListRegionDefinition {
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
}

export interface VirtualListRegionDefinition {
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
}

export function createBlueprintBuilder(): BlueprintBuilder {
  let nextNodeId = 0;
  let signalCount = 0;
  let initialSignalValues: readonly unknown[] = [];
  const nodes: IRNode[] = [];
  const bindings: IRBinding[] = [];
  const regions: IRRegion[] = [];

  return {
    get signalCount() {
      return signalCount;
    },
    setSignalCount(count) {
      signalCount = count;
    },
    setInitialSignalValues(values) {
      initialSignalValues = [...values];
    },
    element(type) {
      const id = nextNodeId;
      nextNodeId += 1;
      nodes.push({
        id,
        kind: "element",
        type,
        parent: null
      });
      return id;
    },
    text(value) {
      const id = nextNodeId;
      nextNodeId += 1;
      nodes.push({
        id,
        kind: "text",
        value,
        parent: null
      });
      return id;
    },
    append(parent, child) {
      const node = nodes.find(candidate => candidate.id === child);
      if (!node) {
        return err({
          code: "BUILDER_CHILD_MISSING",
          message: `Cannot append missing node ${child} to parent ${parent}.`
        });
      }

      if (node.parent !== null) {
        return err({
          code: "BUILDER_CHILD_ALREADY_ATTACHED",
          message: `Node ${child} is already attached to parent ${node.parent}.`
        });
      }

      if (!nodes.some(candidate => candidate.id === parent)) {
        return err({
          code: "BUILDER_PARENT_MISSING",
          message: `Cannot append to missing parent node ${parent}.`
        });
      }

      if (parent === child) {
        return err({
          code: "BUILDER_CYCLE_SELF",
          message: `Node ${child} cannot be appended to itself.`
        });
      }

      const nextNode: IRNode = node.kind === "element"
        ? {
          ...node,
          parent
        }
        : {
          ...node,
          parent
        };

      const nodeIndex = nodes.findIndex(candidate => candidate.id === child);
      nodes[nodeIndex] = nextNode;
      return ok(undefined);
    },
    defineConditionalRegion(region) {
      regions.push({
        kind: "conditional",
        anchorStartNode: region.anchorStartNode,
        anchorEndNode: region.anchorEndNode,
        branches: [...region.branches]
      });
      return regions.length - 1;
    },
    defineKeyedListRegion(region) {
      regions.push({
        kind: "keyed-list",
        anchorStartNode: region.anchorStartNode,
        anchorEndNode: region.anchorEndNode
      });
      return regions.length - 1;
    },
    defineNestedBlockRegion(region) {
      regions.push({
        kind: "nested-block",
        anchorStartNode: region.anchorStartNode,
        anchorEndNode: region.anchorEndNode,
        childBlockSlot: region.childBlockSlot,
        childBlueprintSlot: region.childBlueprintSlot,
        mountMode: region.mountMode
      });
      return regions.length - 1;
    },
    defineVirtualListRegion(region) {
      regions.push({
        kind: "virtual-list",
        anchorStartNode: region.anchorStartNode,
        anchorEndNode: region.anchorEndNode
      });
      return regions.length - 1;
    },
    bindText(node, signal) {
      bindings.push({
        kind: "text",
        node,
        signal
      });
    },
    bindProp(node, key, signal) {
      bindings.push({
        kind: "prop",
        node,
        key,
        signal
      });
    },
    bindStyle(node, key, signal) {
      bindings.push({
        kind: "style",
        node,
        key,
        signal
      });
    },
    bindEvent(node, event, handler) {
      bindings.push({
        kind: "event",
        node,
        event,
        handler
      });
    },
    buildIR() {
      const validation = validateBuilderState(signalCount, initialSignalValues, nodes, bindings, regions);
      if (!validation.ok) {
        return validation;
      }

      return ok({
        signalCount,
        initialSignalValues,
        nodes: [...nodes],
        bindings: [...bindings],
        regions: [...regions]
      });
    },
    buildBlueprint() {
      const block = this.buildIR();
      if (!block.ok) {
        return block;
      }

      return lowerBlockIRToBlueprint(block.value);
    }
  };
}

export interface BuiltBlockIRResult {
  readonly block: BlockIR;
}

export function buildBlockIR(
  configure: (builder: BlueprintBuilder) => void
): Result<BuiltBlockIRResult, never> {
  const builder = createBlueprintBuilder();
  configure(builder);
  const block = builder.buildIR();

  if (!block.ok) {
    throw new Error(`[buildBlockIR] ${block.error.code}: ${block.error.message}`);
  }

  return ok({
    block: block.value
  });
}

function validateBuilderState(
  signalCount: number,
  initialSignalValues: readonly unknown[],
  nodes: readonly IRNode[],
  bindings: readonly IRBinding[],
  regions: readonly IRRegion[]
): Result<void, BlueprintBuilderError> {
  if (signalCount < 0) {
    return err({
      code: "BUILDER_INVALID_SIGNAL_COUNT",
      message: "signalCount must be greater than or equal to zero."
    });
  }

  if (initialSignalValues.length > signalCount) {
    return err({
      code: "BUILDER_INVALID_INITIAL_SIGNAL_VALUES",
      message: "Initial signal values exceed signalCount."
    });
  }

  if (nodes.length === 0) {
    return err({
      code: "BUILDER_EMPTY_BLOCK",
      message: "A block must contain at least one node."
    });
  }

  const nodeIds = new Set<number>();
  const rootIds: number[] = [];
  const nodeById = new Map<number, IRNode>();

  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      return err({
        code: "BUILDER_DUPLICATE_NODE_ID",
        message: `Node id ${node.id} is duplicated.`
      });
    }

    nodeIds.add(node.id);
    nodeById.set(node.id, node);
    if (node.parent === null) {
      rootIds.push(node.id);
      continue;
    }

    if (!nodes.some(candidate => candidate.id === node.parent)) {
      return err({
        code: "BUILDER_PARENT_REFERENCE_MISSING",
        message: `Node ${node.id} references missing parent ${node.parent}.`
      });
    }
  }

  if (rootIds.length !== 1) {
    return err({
      code: "BUILDER_INVALID_ROOT_COUNT",
      message: `A block must contain exactly one root node, got ${rootIds.length}.`
    });
  }

  const rootId = rootIds[0];
  if (rootId === undefined) {
    return err({
      code: "BUILDER_INVALID_ROOT_COUNT",
      message: "A block must contain exactly one root node, got 0."
    });
  }

  for (const node of nodes) {
    const visited = new Set<number>([node.id]);
    let cursor = node.parent;

    while (cursor !== null) {
      if (visited.has(cursor)) {
        return err({
          code: "BUILDER_CYCLE_DETECTED",
          message: `Node ${node.id} participates in a parent cycle through node ${cursor}.`
        });
      }

      visited.add(cursor);
      const parentNode = nodeById.get(cursor);
      if (!parentNode) {
        return err({
          code: "BUILDER_PARENT_REFERENCE_MISSING",
          message: `Node ${node.id} references missing parent ${cursor}.`
        });
      }

      cursor = parentNode.parent;
    }
  }

  const reachable = new Set<number>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }

    for (const node of nodes) {
      if (node.parent !== current || reachable.has(node.id)) {
        continue;
      }

      reachable.add(node.id);
      queue.push(node.id);
    }
  }

  if (reachable.size !== nodes.length) {
    const unreachableIds = nodes
      .filter(node => !reachable.has(node.id))
      .map(node => node.id)
      .sort((left, right) => left - right);

    return err({
      code: "BUILDER_UNREACHABLE_NODE",
      message: `Nodes ${unreachableIds.join(", ")} are not reachable from root ${rootId}.`
    });
  }

  for (const binding of bindings) {
    if (!nodeIds.has(binding.node)) {
      return err({
        code: "BUILDER_BINDING_NODE_MISSING",
        message: `Binding references missing node ${binding.node}.`
      });
    }

    const bindingNode = nodeById.get(binding.node);
    if (!bindingNode) {
      return err({
        code: "BUILDER_BINDING_NODE_MISSING",
        message: `Binding references missing node ${binding.node}.`
      });
    }

    switch (binding.kind) {
      case "text":
        // Text binding 只能命中文本节点；如果把它绑到 element，上层 authoring 看起来能过，
        // 但 runtime 最终只会在错误节点类型上兜底，问题会被拖得更晚才暴露。
        if (bindingNode.kind !== "text") {
          return err({
            code: "BUILDER_BINDING_TARGET_KIND_INVALID",
            message: `Text binding must target a text node, got ${bindingNode.kind} node ${binding.node}.`
          });
        }

        if (binding.signal < 0 || binding.signal >= signalCount) {
          return err({
            code: "BUILDER_SIGNAL_OUT_OF_RANGE",
            message: `Binding references signal slot ${binding.signal}, but signalCount is ${signalCount}.`
          });
        }
        break;
      case "prop":
      case "style":
        // prop / style 都依赖宿主 element 语义；如果目标是 text node，Web adapter 只会在更后面失败。
        if (bindingNode.kind !== "element") {
          return err({
            code: "BUILDER_BINDING_TARGET_KIND_INVALID",
            message: `${binding.kind === "prop" ? "Prop" : "Style"} binding must target an element node, got ${bindingNode.kind} node ${binding.node}.`
          });
        }

        if (binding.signal < 0 || binding.signal >= signalCount) {
          return err({
            code: "BUILDER_SIGNAL_OUT_OF_RANGE",
            message: `Binding references signal slot ${binding.signal}, but signalCount is ${signalCount}.`
          });
        }
        break;
      case "event":
        // 事件绑定也必须提前卡在 element 上，避免把“不可能挂事件”的节点送进 adapter。
        if (bindingNode.kind !== "element") {
          return err({
            code: "BUILDER_BINDING_TARGET_KIND_INVALID",
            message: `Event binding must target an element node, got ${bindingNode.kind} node ${binding.node}.`
          });
        }
        break;
    }
  }

  for (const region of regions) {
    switch (region.kind) {
      case "conditional": {
        if (!nodeIds.has(region.anchorStartNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Conditional region references missing anchorStartNode ${region.anchorStartNode}.`
          });
        }

        if (!nodeIds.has(region.anchorEndNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Conditional region references missing anchorEndNode ${region.anchorEndNode}.`
          });
        }

        if (region.branches.length === 0) {
          return err({
            code: "BUILDER_REGION_BRANCH_INVALID",
            message: "Conditional region must define at least one branch."
          });
        }

        const conditionalAnchorRange = validateRegionAnchorRange(
          "Conditional region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!conditionalAnchorRange.ok) {
          return conditionalAnchorRange;
        }

        const conditionalAnchorBoundary = validateSharedParentBoundary(
          nodeById,
          "Conditional region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!conditionalAnchorBoundary.ok) {
          return conditionalAnchorBoundary;
        }

        for (const branch of region.branches) {
          if (!nodeIds.has(branch.startNode)) {
            return err({
              code: "BUILDER_REGION_BRANCH_MISSING",
              message: `Conditional region references missing branch startNode ${branch.startNode}.`
            });
          }

          if (!nodeIds.has(branch.endNode)) {
            return err({
              code: "BUILDER_REGION_BRANCH_MISSING",
              message: `Conditional region references missing branch endNode ${branch.endNode}.`
            });
          }

          const branchRange = validateConditionalBranchRange(
            region.anchorStartNode,
            region.anchorEndNode,
            branch.startNode,
            branch.endNode
          );
          if (!branchRange.ok) {
            return branchRange;
          }

          const branchBoundary = validateConditionalBranchBoundary(
            nodeById,
            region.anchorStartNode,
            region.anchorEndNode,
            branch.startNode,
            branch.endNode
          );
          if (!branchBoundary.ok) {
            return branchBoundary;
          }
        }
        break;
      }
      case "nested-block": {
        if (!nodeIds.has(region.anchorStartNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Nested block region references missing anchorStartNode ${region.anchorStartNode}.`
          });
        }

        if (!nodeIds.has(region.anchorEndNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Nested block region references missing anchorEndNode ${region.anchorEndNode}.`
          });
        }

        const nestedAnchorRange = validateRegionAnchorRange(
          "Nested block region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!nestedAnchorRange.ok) {
          return nestedAnchorRange;
        }

        const nestedAnchorBoundary = validateSharedParentBoundary(
          nodeById,
          "Nested block region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!nestedAnchorBoundary.ok) {
          return nestedAnchorBoundary;
        }

        if (region.childBlockSlot < 0) {
          return err({
            code: "BUILDER_REGION_NESTED_SLOT_INVALID",
            message: `Nested block region childBlockSlot ${region.childBlockSlot} must be >= 0.`
          });
        }

        if (region.childBlueprintSlot < 0) {
          return err({
            code: "BUILDER_REGION_NESTED_SLOT_INVALID",
            message: `Nested block region childBlueprintSlot ${region.childBlueprintSlot} must be >= 0.`
          });
        }
        break;
      }
      case "keyed-list": {
        if (!nodeIds.has(region.anchorStartNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Keyed list region references missing anchorStartNode ${region.anchorStartNode}.`
          });
        }

        if (!nodeIds.has(region.anchorEndNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Keyed list region references missing anchorEndNode ${region.anchorEndNode}.`
          });
        }

        const keyedAnchorRange = validateRegionAnchorRange(
          "Keyed list region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!keyedAnchorRange.ok) {
          return keyedAnchorRange;
        }

        const keyedAnchorBoundary = validateSharedParentBoundary(
          nodeById,
          "Keyed list region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!keyedAnchorBoundary.ok) {
          return keyedAnchorBoundary;
        }
        break;
      }
      case "virtual-list": {
        if (!nodeIds.has(region.anchorStartNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Virtual list region references missing anchorStartNode ${region.anchorStartNode}.`
          });
        }

        if (!nodeIds.has(region.anchorEndNode)) {
          return err({
            code: "BUILDER_REGION_ANCHOR_MISSING",
            message: `Virtual list region references missing anchorEndNode ${region.anchorEndNode}.`
          });
        }

        const virtualAnchorRange = validateRegionAnchorRange(
          "Virtual list region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!virtualAnchorRange.ok) {
          return virtualAnchorRange;
        }

        const virtualAnchorBoundary = validateSharedParentBoundary(
          nodeById,
          "Virtual list region",
          region.anchorStartNode,
          region.anchorEndNode
        );
        if (!virtualAnchorBoundary.ok) {
          return virtualAnchorBoundary;
        }
        break;
      }
    }
  }

  return ok(undefined);
}

function validateRegionAnchorRange(
  label: string,
  startNode: number,
  endNode: number
): Result<void, BlueprintBuilderError> {
  // lowering/runtime 都把 region 当成有序 node-slot 区间来消费。
  // 一旦 anchor 自己都是倒的，后续所有 branch / child / window 推导都会建立在坏范围上。
  if (startNode <= endNode) {
    return ok(undefined);
  }

  return err({
    code: "BUILDER_REGION_ANCHOR_INVALID",
    message: `${label} anchor range ${startNode}-${endNode} is reversed.`
  });
}

function validateConditionalBranchRange(
  anchorStartNode: number,
  anchorEndNode: number,
  branchStartNode: number,
  branchEndNode: number
): Result<void, BlueprintBuilderError> {
  if (branchStartNode > branchEndNode) {
    return err({
      code: "BUILDER_REGION_BRANCH_INVALID",
      message: `Conditional region branch range ${branchStartNode}-${branchEndNode} is reversed.`
    });
  }

  // conditional branch 最终会被当成 anchor 内的一段连续范围处理。
  // 如果 branch 跑到 anchor 外面，builder 和 runtime 对“这个 region 管哪一段节点”的边界会直接不一致。
  if (branchStartNode < anchorStartNode || branchEndNode > anchorEndNode) {
    return err({
      code: "BUILDER_REGION_BRANCH_INVALID",
      message: `Conditional region branch range ${branchStartNode}-${branchEndNode} must stay within anchor range ${anchorStartNode}-${anchorEndNode}.`
    });
  }

  return ok(undefined);
}

function validateSharedParentBoundary(
  nodeById: ReadonlyMap<number, IRNode>,
  label: string,
  startNode: number,
  endNode: number
): Result<void, BlueprintBuilderError> {
  const start = nodeById.get(startNode);
  const end = nodeById.get(endNode);
  if (!start || !end) {
    return ok(undefined);
  }

  // mountRange()/disposeRange() 会把 region range 当成同一父边界下的一段连续节点来处理。
  // 如果 anchor 自己都不在同一级 parent 下，runtime 根本没有稳定的“这段范围属于谁”解释。
  if (start.parent === end.parent) {
    return ok(undefined);
  }

  return err({
    code: "BUILDER_REGION_BOUNDARY_INVALID",
    message: `${label} anchor nodes ${startNode} and ${endNode} must share the same parent boundary.`
  });
}

function validateConditionalBranchBoundary(
  nodeById: ReadonlyMap<number, IRNode>,
  anchorStartNode: number,
  anchorEndNode: number,
  branchStartNode: number,
  branchEndNode: number
): Result<void, BlueprintBuilderError> {
  const anchorStart = nodeById.get(anchorStartNode);
  const anchorEnd = nodeById.get(anchorEndNode);
  const branchStart = nodeById.get(branchStartNode);
  const branchEnd = nodeById.get(branchEndNode);
  if (!anchorStart || !anchorEnd || !branchStart || !branchEnd) {
    return ok(undefined);
  }

  if (
    branchStart.parent === branchEnd.parent &&
    branchStart.parent === anchorStart.parent &&
    branchEnd.parent === anchorEnd.parent
  ) {
    return ok(undefined);
  }

  return err({
    code: "BUILDER_REGION_BOUNDARY_INVALID",
    message: `Conditional region branch range ${branchStartNode}-${branchEndNode} must share the same parent boundary as anchor range ${anchorStartNode}-${anchorEndNode}.`
  });
}
