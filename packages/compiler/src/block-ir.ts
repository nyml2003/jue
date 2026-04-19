import type { Blueprint } from "@jue/runtime-core";
import { createBlueprint } from "@jue/runtime-core";
import {
  BindingOpcode,
  INVALID_INDEX,
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

  const nodeSlotById = new Map<number, number>();
  orderedNodes.forEach((node, index) => {
    nodeSlotById.set(node.id, index);
  });

  for (let index = 0; index < orderedNodes.length; index += 1) {
    const node = orderedNodes[index];
    if (!node) {
      continue;
    }

    nodeParentIndex[index] = node.parent === null
      ? INVALID_INDEX
      : getNodeSlot(nodeSlotById, node.parent, "parent", node.id).value ?? INVALID_INDEX;

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

    const nodeSlotResult = getNodeSlot(nodeSlotById, binding.node, "binding node", bindingSlot);
    if (!nodeSlotResult.ok) {
      return nodeSlotResult;
    }

    bindingNodeIndex[bindingSlot] = nodeSlotResult.value;

    switch (binding.kind) {
      case "text":
        bindingOpcode[bindingSlot] = BindingOpcode.TEXT;
        bindingDataIndex[bindingSlot] = binding.signal;
        addSignalDependency(signalToBindings, binding.signal, bindingSlot);
        break;
      case "prop":
        bindingOpcode[bindingSlot] = BindingOpcode.PROP;
        bindingDataIndex[bindingSlot] = bindingArgU32.length;
        bindingArgU32.push(binding.signal, pushRef(bindingArgRef, binding.key));
        addSignalDependency(signalToBindings, binding.signal, bindingSlot);
        break;
      case "style":
        bindingOpcode[bindingSlot] = BindingOpcode.STYLE;
        bindingDataIndex[bindingSlot] = bindingArgU32.length;
        bindingArgU32.push(binding.signal, pushRef(bindingArgRef, binding.key));
        addSignalDependency(signalToBindings, binding.signal, bindingSlot);
        break;
      case "event":
        bindingOpcode[bindingSlot] = BindingOpcode.EVENT;
        bindingDataIndex[bindingSlot] = bindingArgU32.length;
        bindingArgU32.push(
          pushRef(bindingArgRef, binding.event),
          pushRef(bindingArgRef, binding.handler)
        );
        break;
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
    regionType: new Uint8Array(0),
    regionAnchorStart: new Uint32Array(0),
    regionAnchorEnd: new Uint32Array(0),
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
