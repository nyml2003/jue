import { err, ok, type HostEventKey, type HostPrimitive, type Result } from "@jue/shared";

import { lowerBlockIRToBlueprint, type BlockIR, type IRBinding, type IRNode, type LowerBlockIRError, type LoweredBlockIR } from "./block-ir";

export interface BlueprintBuilder {
  readonly signalCount: number;
  setSignalCount(count: number): void;
  setInitialSignalValues(values: readonly unknown[]): void;
  element(type: HostPrimitive): number;
  text(value: string): number;
  append(parent: number, child: number): Result<void, BlueprintBuilderError>;
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

export function createBlueprintBuilder(): BlueprintBuilder {
  let nextNodeId = 0;
  let signalCount = 0;
  let initialSignalValues: readonly unknown[] = [];
  const nodes: IRNode[] = [];
  const bindings: IRBinding[] = [];

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
      const validation = validateBuilderState(signalCount, initialSignalValues, nodes, bindings);
      if (!validation.ok) {
        return validation;
      }

      return ok({
        signalCount,
        initialSignalValues,
        nodes: [...nodes],
        bindings: [...bindings]
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
  bindings: readonly IRBinding[]
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

    switch (binding.kind) {
      case "text":
      case "prop":
      case "style":
        if (binding.signal < 0 || binding.signal >= signalCount) {
          return err({
            code: "BUILDER_SIGNAL_OUT_OF_RANGE",
            message: `Binding references signal slot ${binding.signal}, but signalCount is ${signalCount}.`
          });
        }
        break;
      case "event":
        break;
    }
  }

  return ok(undefined);
}
