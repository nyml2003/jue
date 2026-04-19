import {
  beginConditionalRegionSwitch,
  createBlockInstance,
  createSchedulerState,
  completeConditionalRegionContentSwitch,
  disposeConditionalRegionContent,
  enqueueSchedulerSlot,
  flushBindingQueue,
  getConditionalRegionMountedBranch,
  mountConditionalRegionContent,
  scheduleSignalWrite,
  type BlockInstance,
  type Blueprint,
  type ConditionalRegionContentHooks,
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

export type SignalWrite = readonly [slot: number, value: unknown, lane?: Lane];

export interface MountedTreeRegions {
  conditional(slot: number): MountedConditionalRegion;
}

export interface MountedConditionalRegion {
  attach(branchIndex: number): Result<FlushBindingsResult, MountBlockError>;
  switchTo(branchIndex: number): Result<FlushBindingsResult, MountBlockError>;
  clear(): Result<FlushBindingsResult, MountBlockError>;
}

export interface MountedTree {
  readonly instance: BlockInstance;
  readonly nodes: readonly HostNode[];
  readonly regions: MountedTreeRegions;
  flushInitialBindings(): Result<FlushBindingsResult, MountBlockError>;
  setSignal(slot: number, value: unknown, lane?: Lane): Result<FlushBindingsResult, MountBlockError>;
  setSignals(writes: readonly SignalWrite[], lane?: Lane): Result<FlushBindingsResult, MountBlockError>;
  mountRange(startNode: number, endNode: number): Result<void, MountBlockError>;
  disposeRange(startNode: number, endNode: number): Result<void, MountBlockError>;
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
  const nodeMounted = new Array<boolean>(nodes.length).fill(true);
  let disposed = false;

  const conditionalContentHooks: ConditionalRegionContentHooks = {
    mountBranchContent(context) {
      return mountedTree.mountRange(context.startNode, context.endNode).ok;
    },
    disposeBranchContent(context) {
      return mountedTree.disposeRange(context.startNode, context.endNode).ok;
    }
  };

  const mountedTree: MountedTree = {
    instance,
    nodes,
    regions: {
      conditional(slot) {
        return {
          attach(branchIndex) {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot attach a conditional region after the mounted tree has been disposed."
              });
            }

            const attached = mountConditionalRegionContent(
              instance,
              slot,
              branchIndex,
              conditionalContentHooks
            );

            return attached
              ? mountedTree.flushInitialBindings()
              : err({
                code: "MOUNT_TREE_CONDITIONAL_ATTACH_REJECTED",
                message: `Conditional region ${slot} rejected attach for branch ${branchIndex}.`
              });
          },
          switchTo(branchIndex) {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot switch a conditional region after the mounted tree has been disposed."
              });
            }

            const currentBranch = getConditionalRegionMountedBranch(instance, slot);
            if (currentBranch === branchIndex) {
              return ok({
                batchId: scheduler.batchId,
                flushedBindingCount: 0
              });
            }

            if (!beginConditionalRegionSwitch(instance, slot, branchIndex)) {
              return err({
                code: "MOUNT_TREE_CONDITIONAL_SWITCH_REJECTED",
                message: `Conditional region ${slot} rejected switch to branch ${branchIndex}.`
              });
            }

            const switched = completeConditionalRegionContentSwitch(
              instance,
              slot,
              conditionalContentHooks
            );

            return switched
              ? mountedTree.flushInitialBindings()
              : err({
                code: "MOUNT_TREE_CONDITIONAL_SWITCH_FAILED",
                message: `Conditional region ${slot} failed while switching to branch ${branchIndex}.`
              });
          },
          clear() {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot clear a conditional region after the mounted tree has been disposed."
              });
            }

            const cleared = disposeConditionalRegionContent(
              instance,
              slot,
              conditionalContentHooks
            );

            return cleared
              ? mountedTree.flushInitialBindings()
              : err({
                code: "MOUNT_TREE_CONDITIONAL_CLEAR_REJECTED",
                message: `Conditional region ${slot} rejected clear.`
              });
          }
        };
      }
    },
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
    setSignals(writes, lane = Lane.VISIBLE_UPDATE) {
      if (disposed) {
        return err({
          code: "TREE_MOUNT_DISPOSED",
          message: "Cannot write signals after the mounted tree has been disposed."
        });
      }

      let changed = false;

      for (const [slot, value, writeLane] of writes) {
        const scheduleResult = scheduleSignalWrite(
          instance,
          scheduler,
          writeLane ?? lane,
          slot,
          value
        );

        if (!scheduleResult.ok) {
          return err(scheduleResult.error);
        }

        changed = changed || scheduleResult.value.changed;
      }

      if (!changed) {
        return ok({
          batchId: scheduler.batchId,
          flushedBindingCount: 0
        });
      }

      return flushBindingQueue(instance, scheduler, adapter);
    },
    mountRange(startNode, endNode) {
      if (disposed) {
        return err({
          code: "TREE_MOUNT_DISPOSED",
          message: "Cannot mount a node range after the mounted tree has been disposed."
        });
      }

      if (startNode < 0 || endNode < startNode || endNode >= nodes.length) {
        return err({
          code: "MOUNT_TREE_RANGE_INVALID",
          message: `Node range ${startNode}-${endNode} is out of bounds.`
        });
      }

      for (const index of getRangeRootNodeIndexes(input.blueprint, startNode, endNode)) {
        if (nodeMounted[index]) {
          continue;
        }

        const node = nodes[index];
        if (!node) {
          return err({
            code: "MOUNT_TREE_NODE_MISSING",
            message: `Blueprint node ${index} was not created.`
          });
        }

        const parentResult = resolveParent(input.blueprint, hostRoot, nodes, nodeMounted, index);
        if (!parentResult.ok) {
          return parentResult;
        }

        const anchor = findMountedAnchor(input.blueprint, nodes, nodeMounted, index);
        const insertResult = adapter.insert(parentResult.value, node, anchor);
        if (!insertResult.ok) {
          return err(insertResult.error);
        }

        nodeMounted[index] = true;
      }

      for (let index = startNode; index <= endNode; index += 1) {
        nodeMounted[index] = true;
      }

      return ok(undefined);
    },
    disposeRange(startNode, endNode) {
      if (disposed) {
        return err({
          code: "TREE_MOUNT_DISPOSED",
          message: "Cannot dispose a node range after the mounted tree has been disposed."
        });
      }

      if (startNode < 0 || endNode < startNode || endNode >= nodes.length) {
        return err({
          code: "MOUNT_TREE_RANGE_INVALID",
          message: `Node range ${startNode}-${endNode} is out of bounds.`
        });
      }

      const rootIndexes = getRangeRootNodeIndexes(input.blueprint, startNode, endNode)
        .sort((left, right) => right - left);

      for (const index of rootIndexes) {
        if (!nodeMounted[index]) {
          continue;
        }

        const node = nodes[index];
        if (!node) {
          return err({
            code: "MOUNT_TREE_NODE_MISSING",
            message: `Blueprint node ${index} was not created.`
          });
        }

        const parentResult = resolveParent(input.blueprint, hostRoot, nodes, nodeMounted, index);
        if (!parentResult.ok) {
          return parentResult;
        }

        const removeResult = adapter.remove(parentResult.value, node);
        if (!removeResult.ok) {
          return err(removeResult.error);
        }

        nodeMounted[index] = false;
      }

      for (let index = startNode; index <= endNode; index += 1) {
        nodeMounted[index] = false;
      }

      return ok(undefined);
    },
    dispose() {
      if (disposed) {
        return ok(undefined);
      }

      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (!node || !nodeMounted[index]) {
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

        nodeMounted[index] = false;
      }

      disposed = true;
      return ok(undefined);
    }
  };

  return ok(mountedTree);
}

function resolveParent(
  blueprint: Blueprint,
  hostRoot: HostRoot,
  nodes: HostNode[],
  nodeMounted: boolean[],
  index: number
): Result<HostNode | HostRoot, MountBlockError> {
  const parentIndex = blueprint.nodeParentIndex[index];
  if (parentIndex === undefined || parentIndex === INVALID_INDEX) {
    return ok(hostRoot);
  }

  if (!nodeMounted[parentIndex]) {
    return err({
      code: "MOUNT_TREE_PARENT_UNMOUNTED",
      message: `Blueprint node ${index} references parent ${parentIndex}, but that parent is not mounted.`
    });
  }

  const parent = nodes[parentIndex];
  if (!parent) {
    return err({
      code: "MOUNT_TREE_PARENT_MISSING",
      message: `Blueprint node ${index} references missing parent index ${parentIndex}.`
    });
  }

  return ok(parent);
}

function findMountedAnchor(
  blueprint: Blueprint,
  nodes: HostNode[],
  nodeMounted: boolean[],
  index: number
): HostNode | null {
  const parentIndex = blueprint.nodeParentIndex[index] ?? INVALID_INDEX;

  for (let candidateIndex = index + 1; candidateIndex < nodes.length; candidateIndex += 1) {
    if ((blueprint.nodeParentIndex[candidateIndex] ?? INVALID_INDEX) !== parentIndex) {
      continue;
    }

    if (!nodeMounted[candidateIndex]) {
      continue;
    }

    const anchor = nodes[candidateIndex];
    if (anchor) {
      return anchor;
    }
  }

  return null;
}

function getRangeRootNodeIndexes(
  blueprint: Blueprint,
  startNode: number,
  endNode: number
): number[] {
  const roots: number[] = [];

  for (let index = startNode; index <= endNode; index += 1) {
    const parentIndex = blueprint.nodeParentIndex[index];
    if (parentIndex === undefined || parentIndex === INVALID_INDEX || parentIndex < startNode || parentIndex > endNode) {
      roots.push(index);
    }
  }

  return roots;
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
