import {
  createBlockInstance,
  createSchedulerState,
  enqueueSchedulerSlot,
  flushBindingQueue,
  scheduleSignalWrite,
  type BlockInstance,
  type Blueprint,
  type FlushBindingsResult,
  type HostNode,
  type HostRoot
} from "@jue/runtime-core";
import { BindingOpcode, INVALID_INDEX, Lane, err, ok, type HostPrimitive, type Result } from "@jue/shared";

import { createWebHostAdapter } from "./adapter";
import { validateHostRoot, type MountBlockError } from "./mount-block";

const NODE_KIND_ELEMENT = 1;
const NODE_KIND_TEXT = 2;

export interface MountTreeInput {
  readonly blueprint: Blueprint;
  readonly root: Node;
  readonly signalCount: number;
  readonly initialSignalValues?: readonly unknown[];
}

export interface MountedTree {
  readonly instance: BlockInstance;
  readonly nodes: readonly HostNode[];
  flushInitialBindings(): Result<FlushBindingsResult, MountBlockError>;
  setSignal(slot: number, value: unknown, lane?: Lane): Result<FlushBindingsResult, MountBlockError>;
  dispose(): Result<void, MountBlockError>;
}

export function mountTree(input: MountTreeInput): Result<MountedTree, MountBlockError> {
  const hostRootResult = validateHostRoot(input.root);
  if (!hostRootResult.ok) {
    return hostRootResult;
  }

  if ((input.initialSignalValues?.length ?? 0) > input.signalCount) {
    return err({
      code: "MOUNT_TREE_SIGNAL_INIT_OUT_OF_RANGE",
      message: "Initial signal values exceed the declared signalCount."
    });
  }

  const adapter = createWebHostAdapter();
  const hostRoot = hostRootResult.value;
  const nodes: HostNode[] = new Array(input.blueprint.nodeCount);

  for (let index = 0; index < input.blueprint.nodeCount; index += 1) {
    const nodeResult = createBlueprintNode(input.blueprint, adapter, index);
    if (!nodeResult.ok) {
      return nodeResult;
    }

    nodes[index] = nodeResult.value;
  }

  for (let index = 0; index < input.blueprint.nodeCount; index += 1) {
    const node = nodes[index];
    if (node === undefined) {
      return err({
        code: "MOUNT_TREE_NODE_MISSING",
        message: `Blueprint node ${index} was not created.`
      });
    }

    const parentIndex = input.blueprint.nodeParentIndex[index];
    const parent = parentIndex === undefined || parentIndex === INVALID_INDEX
      ? hostRoot
      : nodes[parentIndex];

    if (parent === undefined) {
      return err({
        code: "MOUNT_TREE_PARENT_MISSING",
        message: `Blueprint node ${index} references missing parent index ${parentIndex}.`
      });
    }

    const insertResult = adapter.insert(parent, node, null);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }
  }

  const instance = createBlockInstance(input.blueprint, {
    signalCount: input.signalCount,
    nodes
  });

  for (let index = 0; index < (input.initialSignalValues?.length ?? 0); index += 1) {
    instance.signalValues[index] = input.initialSignalValues?.[index];
  }

  const scheduler = createSchedulerState();
  let disposed = false;

  return ok({
    instance,
    nodes,
    flushInitialBindings() {
      if (disposed) {
        return err({
          code: "TREE_MOUNT_DISPOSED",
          message: "Cannot flush bindings after the mounted tree has been disposed."
        });
      }

      for (let bindingSlot = 0; bindingSlot < input.blueprint.bindingCount; bindingSlot += 1) {
        const opcode = input.blueprint.bindingOpcode[bindingSlot];
        if (
          opcode === BindingOpcode.TEXT ||
          opcode === BindingOpcode.PROP ||
          opcode === BindingOpcode.STYLE ||
          opcode === BindingOpcode.EVENT
        ) {
          enqueueSchedulerSlot(scheduler, 1, "binding", bindingSlot);
        }
      }

      return flushBindingQueue(instance, scheduler, adapter);
    },
    setSignal(slot, value, lane = Lane.VISIBLE_UPDATE) {
      if (disposed) {
        return err({
          code: "TREE_MOUNT_DISPOSED",
          message: "Cannot write a signal after the mounted tree has been disposed."
        });
      }

      const scheduleResult = scheduleSignalWrite(instance, scheduler, lane, slot, value);
      if (!scheduleResult.ok) {
        return err(scheduleResult.error);
      }

      if (!scheduleResult.value.changed) {
        return ok({
          batchId: scheduler.batchId,
          flushedBindingCount: 0
        });
      }

      return flushBindingQueue(instance, scheduler, adapter);
    },
    dispose() {
      if (disposed) {
        return ok(undefined);
      }

      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (!node) {
          continue;
        }

        const parentIndex = input.blueprint.nodeParentIndex[index];
        const parent = parentIndex === undefined || parentIndex === INVALID_INDEX
          ? hostRoot
          : nodes[parentIndex];

        if (parent === undefined) {
          return err({
            code: "MOUNT_TREE_PARENT_MISSING",
            message: `Blueprint node ${index} references missing parent index ${parentIndex}.`
          });
        }

        const removeResult = adapter.remove(parent, node);
        if (!removeResult.ok) {
          return err(removeResult.error);
        }
      }

      disposed = true;
      return ok(undefined);
    }
  });
}

function createBlueprintNode(
  blueprint: Blueprint,
  adapter: ReturnType<typeof createWebHostAdapter>,
  index: number
): Result<HostNode, MountBlockError> {
  const kind = blueprint.nodeKind[index];

  switch (kind) {
    case NODE_KIND_ELEMENT: {
      const primitiveRefIndex = blueprint.nodePrimitiveRefIndex[index];
      if (primitiveRefIndex === undefined || primitiveRefIndex === INVALID_INDEX) {
        return err({
          code: "MOUNT_TREE_PRIMITIVE_MISSING",
          message: `Blueprint node ${index} is missing its primitive reference index.`
        });
      }

      const primitive = blueprint.bindingArgRef[primitiveRefIndex];

      if (!isHostPrimitive(primitive)) {
        return err({
          code: "MOUNT_TREE_PRIMITIVE_MISSING",
          message: `Blueprint node ${index} references missing primitive at ref slot ${primitiveRefIndex}.`
        });
      }

      const nodeResult = adapter.createNode(primitive, 0);
      if (!nodeResult.ok) {
        return err(nodeResult.error);
      }

      return ok(nodeResult.value);
    }
    case NODE_KIND_TEXT: {
      const textRefIndex = blueprint.nodeTextRefIndex[index];
      if (textRefIndex === undefined || textRefIndex === INVALID_INDEX) {
        return err({
          code: "MOUNT_TREE_TEXT_MISSING",
          message: `Blueprint node ${index} is missing its text reference index.`
        });
      }

      const textValue = blueprint.bindingArgRef[textRefIndex];

      if (typeof textValue !== "string") {
        return err({
          code: "MOUNT_TREE_TEXT_MISSING",
          message: `Blueprint node ${index} references missing text at ref slot ${textRefIndex}.`
        });
      }

      const nodeResult = adapter.createText(textValue);
      if (!nodeResult.ok) {
        return err(nodeResult.error);
      }

      return ok(nodeResult.value);
    }
    default:
      return err({
        code: "MOUNT_TREE_NODE_KIND_UNSUPPORTED",
        message: `Blueprint node ${index} uses unsupported node kind ${kind}.`
      });
  }
}

function isHostPrimitive(value: unknown): value is HostPrimitive {
  return value === "View" ||
    value === "Text" ||
    value === "Button" ||
    value === "Input" ||
    value === "Image" ||
    value === "ScrollView";
}
