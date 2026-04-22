import {
  attachKeyedListRegion,
  attachVirtualListRegion,
  beginConditionalRegionSwitch,
  beginKeyedListReconcile,
  beginNestedBlockReplace,
  beginVirtualListWindowUpdate,
  cancelKeyedListReconcile,
  cancelNestedBlockReplace,
  cancelVirtualListWindowUpdate,
  attachNestedBlockRegion,
  clearKeyedListRegion,
  clearVirtualListRegion,
  completeKeyedListReconcile,
  completeNestedBlockReplace,
  completeVirtualListWindowUpdate,
  createBlockInstance,
  createSchedulerState,
  completeConditionalRegionContentSwitch,
  detachNestedBlockRegion,
  disposeConditionalRegionContent,
  enqueueSchedulerSlot,
  flushBindingQueue,
  getConditionalRegionMountedBranch,
  getNestedBlockRegionMountedState,
  initializeRegionSlot,
  mountConditionalRegionContent,
  scheduleSignalWrite,
  type BlockInstance,
  type Blueprint,
  type ConditionalRegionContentHooks,
  type FlushBindingsResult,
  type HostNode,
  type HostRoot,
  type KeyedListReconcilePayloadItem
} from "@jue/runtime-core";
import { BindingOpcode, INVALID_INDEX, Lane, RegionType, err, ok, type HostPrimitive, type Result } from "@jue/shared";

import { createWebHostAdapter } from "./adapter";
import { validateHostRoot, type MountBlockError } from "./mount-block";

const NODE_KIND_ELEMENT = 1;
const NODE_KIND_TEXT = 2;

export interface MountTreeInput {
  readonly blueprint: Blueprint;
  readonly root: Node;
  readonly signalCount: number;
  readonly initialSignalValues?: readonly unknown[];
  readonly nestedBlueprints?: readonly TreeBlueprintSpec[];
}

export type SignalWrite = readonly [slot: number, value: unknown, lane?: Lane];

export interface TreeBlueprintSpec {
  readonly blueprint: Blueprint;
  readonly signalCount?: number;
  readonly initialSignalValues?: readonly unknown[];
  readonly nestedBlueprints?: readonly TreeBlueprintSpec[];
}

export interface KeyedListItemSpec extends TreeBlueprintSpec {
  readonly key: string;
}

export interface VirtualListCellSpec extends TreeBlueprintSpec {
  readonly initialSignalValues: readonly unknown[];
}

export interface VirtualListWindowSpec {
  readonly itemCount: number;
  readonly windowStart: number;
  readonly cells: readonly VirtualListCellSpec[];
}

export interface MountedTreeRegions {
  conditional(slot: number): MountedConditionalRegion;
  nested(slot: number): MountedNestedRegion;
  keyedList(slot: number): MountedKeyedListRegion;
  virtualList(slot: number): MountedVirtualListRegion;
}

export interface MountedConditionalRegion {
  attach(branchIndex: number): Result<FlushBindingsResult, MountBlockError>;
  switchTo(branchIndex: number): Result<FlushBindingsResult, MountBlockError>;
  clear(): Result<FlushBindingsResult, MountBlockError>;
}

export interface MountedNestedRegion {
  attach(): Result<FlushBindingsResult, MountBlockError>;
  replace(blockSlot: number, blueprintSlot: number): Result<FlushBindingsResult, MountBlockError>;
  detach(): Result<FlushBindingsResult, MountBlockError>;
}

export interface MountedKeyedListRegion {
  attach(items: readonly KeyedListItemSpec[]): Result<FlushBindingsResult, MountBlockError>;
  reconcile(items: readonly KeyedListItemSpec[]): Result<FlushBindingsResult, MountBlockError>;
  clear(): Result<FlushBindingsResult, MountBlockError>;
}

export interface MountedVirtualListRegion {
  attach(window: VirtualListWindowSpec): Result<FlushBindingsResult, MountBlockError>;
  updateWindow(window: VirtualListWindowSpec): Result<FlushBindingsResult, MountBlockError>;
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
  const nodes = new Array<HostNode>(input.blueprint.nodeCount);

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
  const nestedTrees = new Map<number, MountedTree>();
  const keyedLists = new Map<number, {
    order: string[];
    trees: Map<string, MountedTree>;
  }>();
  const virtualLists = new Map<number, {
    itemCount: number;
    windowStart: number;
    cells: MountedTree[];
  }>();
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
      },
      nested(slot) {
        return {
          attach() {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot attach a nested region after the mounted tree has been disposed."
              });
            }

            if (!attachNestedBlockRegion(instance, slot)) {
              return err({
                code: "MOUNT_TREE_NESTED_ATTACH_REJECTED",
                message: `Nested region ${slot} rejected attach.`
              });
            }

            const mounted = mountNestedTree(instance, input, nodes, nodeMounted, slot);
            if (!mounted.ok) {
              detachNestedBlockRegion(instance, slot);
              return mounted;
            }

            const moveResult = moveTreeBeforeRegionAnchor(input.blueprint, nodes, mounted.value, slot);
            if (!moveResult.ok) {
              const disposeResult = mounted.value.dispose();
              if (!disposeResult.ok) {
                detachNestedBlockRegion(instance, slot);
                return disposeResult;
              }
              detachNestedBlockRegion(instance, slot);
              return moveResult;
            }

            nestedTrees.set(slot, mounted.value);
            return mountedTree.flushInitialBindings();
          },
          replace(blockSlot, blueprintSlot) {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot replace a nested region after the mounted tree has been disposed."
              });
            }

            if (!beginNestedBlockReplace(instance, slot, blockSlot, blueprintSlot)) {
              return err({
                code: "MOUNT_TREE_NESTED_REPLACE_REJECTED",
                message: `Nested region ${slot} rejected replace.`
              });
            }

            const current = nestedTrees.get(slot);
            const mounted = mountNestedTree(instance, input, nodes, nodeMounted, slot, blueprintSlot);
            if (!mounted.ok) {
              cancelNestedBlockReplace(instance, slot);
              return mounted;
            }

            const moveResult = moveTreeBeforeRegionAnchor(input.blueprint, nodes, mounted.value, slot);
            if (!moveResult.ok) {
              const disposeResult = mounted.value.dispose();
              if (!disposeResult.ok) {
                cancelNestedBlockReplace(instance, slot);
                return disposeResult;
              }
              cancelNestedBlockReplace(instance, slot);
              return moveResult;
            }

            if (current) {
              const disposeResult = current.dispose();
              if (!disposeResult.ok) {
                const nextDisposeResult = mounted.value.dispose();
                if (!nextDisposeResult.ok) {
                  return nextDisposeResult;
                }
                cancelNestedBlockReplace(instance, slot);
                return disposeResult;
              }
              nestedTrees.delete(slot);
            }

            if (!completeNestedBlockReplace(instance, slot)) {
              const disposeResult = mounted.value.dispose();
              if (!disposeResult.ok) {
                return disposeResult;
              }

              return err({
                code: "MOUNT_TREE_NESTED_REPLACE_FAILED",
                message: `Nested region ${slot} failed to complete replace.`
              });
            }

            nestedTrees.set(slot, mounted.value);
            return mountedTree.flushInitialBindings();
          },
          detach() {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot detach a nested region after the mounted tree has been disposed."
              });
            }

            const current = nestedTrees.get(slot);
            if (current) {
              const disposeResult = current.dispose();
              if (!disposeResult.ok) {
                return disposeResult;
              }
              nestedTrees.delete(slot);
            }

            if (!detachNestedBlockRegion(instance, slot)) {
              return err({
                code: "MOUNT_TREE_NESTED_DETACH_REJECTED",
                message: `Nested region ${slot} rejected detach.`
              });
            }

            return mountedTree.flushInitialBindings();
          }
        };
      },
      keyedList(slot) {
        return {
          attach(items) {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot attach a keyed list after the mounted tree has been disposed."
              });
            }

            const duplicateKey = findDuplicateKey(items);
            if (duplicateKey !== null) {
              return err({
                code: "MOUNT_TREE_KEYED_LIST_DUPLICATE_KEY",
                message: `Keyed list region ${slot} received duplicate key ${duplicateKey}.`
              });
            }

            if (!attachKeyedListRegion(instance, slot, items.length)) {
              return err({
                code: "MOUNT_TREE_KEYED_LIST_ATTACH_REJECTED",
                message: `Keyed list region ${slot} rejected attach.`
              });
            }

            const mountResult = mountKeyedListItems(input, nodes, nodeMounted, slot, items);
            if (!mountResult.ok) {
              clearKeyedListRegion(instance, slot);
              return mountResult;
            }

            keyedLists.set(slot, mountResult.value);
            return mountedTree.flushInitialBindings();
          },
          reconcile(items) {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot reconcile a keyed list after the mounted tree has been disposed."
              });
            }

            const current = keyedLists.get(slot) ?? {
              order: [],
              trees: new Map<string, MountedTree>()
            };
            const duplicateKey = findDuplicateKey(items);
            if (duplicateKey !== null) {
              return err({
                code: "MOUNT_TREE_KEYED_LIST_DUPLICATE_KEY",
                message: `Keyed list region ${slot} received duplicate key ${duplicateKey}.`
              });
            }

            const payload = createKeyedListPayload(current.order, items.map(item => item.key));

            if (!beginKeyedListReconcile(instance, slot, 0, payload.length, payload)) {
              return err({
                code: "MOUNT_TREE_KEYED_LIST_RECONCILE_REJECTED",
                message: `Keyed list region ${slot} rejected reconcile.`
              });
            }

            const reconcileResult = reconcileKeyedListItems(
              input,
              nodes,
              nodeMounted,
              slot,
              current,
              items
            );
            if (!reconcileResult.ok) {
              cancelKeyedListReconcile(instance, slot);
              return reconcileResult;
            }

            if (!completeKeyedListReconcile(instance, slot, items.length)) {
              return err({
                code: "MOUNT_TREE_KEYED_LIST_RECONCILE_FAILED",
                message: `Keyed list region ${slot} failed to complete reconcile.`
              });
            }

            keyedLists.set(slot, reconcileResult.value);
            return mountedTree.flushInitialBindings();
          },
          clear() {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot clear a keyed list after the mounted tree has been disposed."
              });
            }

            const current = keyedLists.get(slot);
            if (current) {
              for (const tree of current.trees.values()) {
                const disposeResult = tree.dispose();
                if (!disposeResult.ok) {
                  return disposeResult;
                }
              }
              keyedLists.delete(slot);
            }

            if (!clearKeyedListRegion(instance, slot)) {
              return err({
                code: "MOUNT_TREE_KEYED_LIST_CLEAR_REJECTED",
                message: `Keyed list region ${slot} rejected clear.`
              });
            }

            return mountedTree.flushInitialBindings();
          }
        };
      },
      virtualList(slot) {
        return {
          attach(window) {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot attach a virtual list after the mounted tree has been disposed."
              });
            }

            const windowEnd = window.windowStart + window.cells.length;
            if (!attachVirtualListRegion(instance, slot, window.itemCount, window.windowStart, windowEnd)) {
              return err({
                code: "MOUNT_TREE_VIRTUAL_LIST_ATTACH_REJECTED",
                message: `Virtual list region ${slot} rejected attach.`
              });
            }

            const mountResult = mountVirtualListCells(input, nodes, nodeMounted, slot, window.cells);
            if (!mountResult.ok) {
              clearVirtualListRegion(instance, slot);
              return mountResult;
            }

            virtualLists.set(slot, {
              itemCount: window.itemCount,
              windowStart: window.windowStart,
              cells: mountResult.value
            });

            return mountedTree.flushInitialBindings();
          },
          updateWindow(window) {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot update a virtual list after the mounted tree has been disposed."
              });
            }

            const current = virtualLists.get(slot);
            if (!current) {
              return err({
                code: "MOUNT_TREE_VIRTUAL_LIST_MISSING",
                message: `Virtual list region ${slot} has not been attached.`
              });
            }

            if (current.cells.length !== window.cells.length) {
              return err({
                code: "MOUNT_TREE_VIRTUAL_LIST_WINDOW_SIZE_CHANGED",
                message: "Virtual list minimal controller requires a stable visible cell count."
              });
            }

            const windowEnd = window.windowStart + window.cells.length;
            if (!beginVirtualListWindowUpdate(instance, slot, window.itemCount, window.windowStart, windowEnd)) {
              return err({
                code: "MOUNT_TREE_VIRTUAL_LIST_UPDATE_REJECTED",
                message: `Virtual list region ${slot} rejected window update.`
              });
            }

            const rebindResult = rebindVirtualListCells(current.cells, window.cells);
            if (!rebindResult.ok) {
              cancelVirtualListWindowUpdate(instance, slot);
              return rebindResult;
            }

            if (!completeVirtualListWindowUpdate(instance, slot)) {
              return err({
                code: "MOUNT_TREE_VIRTUAL_LIST_UPDATE_FAILED",
                message: `Virtual list region ${slot} failed to complete window update.`
              });
            }

            virtualLists.set(slot, {
              itemCount: window.itemCount,
              windowStart: window.windowStart,
              cells: current.cells
            });

            return mountedTree.flushInitialBindings();
          },
          clear() {
            if (disposed) {
              return err({
                code: "TREE_MOUNT_DISPOSED",
                message: "Cannot clear a virtual list after the mounted tree has been disposed."
              });
            }

            const current = virtualLists.get(slot);
            if (current) {
              const disposeResult = disposeMountedTrees(current.cells);
              if (!disposeResult.ok) {
                return disposeResult;
              }
              virtualLists.delete(slot);
            }

            if (!clearVirtualListRegion(instance, slot)) {
              return err({
                code: "MOUNT_TREE_VIRTUAL_LIST_CLEAR_REJECTED",
                message: `Virtual list region ${slot} rejected clear.`
              });
            }

            return mountedTree.flushInitialBindings();
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

      for (const tree of nestedTrees.values()) {
        const disposeResult = tree.dispose();
        if (!disposeResult.ok) {
          return disposeResult;
        }
      }
      nestedTrees.clear();

      for (const list of keyedLists.values()) {
        for (const tree of list.trees.values()) {
          const disposeResult = tree.dispose();
          if (!disposeResult.ok) {
            return disposeResult;
          }
        }
      }
      keyedLists.clear();

      for (const list of virtualLists.values()) {
        const disposeResult = disposeMountedTrees(list.cells);
        if (!disposeResult.ok) {
          return disposeResult;
        }
      }
      virtualLists.clear();

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

  const initializeRegionsResult = initializeMountedTreeRegions(input.blueprint, instance, mountedTree);
  if (!initializeRegionsResult.ok) {
    return initializeRegionsResult;
  }

  return ok(mountedTree);
}

function initializeMountedTreeRegions(
  blueprint: Blueprint,
  instance: BlockInstance,
  mountedTree: MountedTree
): Result<void, MountBlockError> {
  for (let regionSlot = 0; regionSlot < blueprint.regionCount; regionSlot += 1) {
    if (!initializeRegionSlot(instance, regionSlot)) {
      return err({
        code: "MOUNT_TREE_REGION_INIT_FAILED",
        message: `Region ${regionSlot} failed to initialize.`
      });
    }

    if (blueprint.regionType[regionSlot] !== RegionType.CONDITIONAL) {
      continue;
    }

    const rangeStart = blueprint.regionBranchRangeStart[regionSlot] ?? 0;
    const rangeCount = blueprint.regionBranchRangeCount[regionSlot] ?? 0;

    for (let offset = 0; offset < rangeCount; offset += 1) {
      const rangeSlot = rangeStart + offset;
      const startNode = blueprint.regionBranchNodeStart[rangeSlot];
      const endNode = blueprint.regionBranchNodeEnd[rangeSlot];

      if (startNode === undefined || endNode === undefined) {
        return err({
          code: "MOUNT_TREE_REGION_BRANCH_RANGE_MISSING",
          message: `Conditional region ${regionSlot} has an invalid branch range at ${rangeSlot}.`
        });
      }

      const disposeResult = mountedTree.disposeRange(startNode, endNode);
      if (!disposeResult.ok) {
        return disposeResult;
      }
    }
  }

  return ok(undefined);
}

function mountNestedTree(
  instance: BlockInstance,
  input: MountTreeInput,
  nodes: HostNode[],
  nodeMounted: boolean[],
  regionSlot: number,
  blueprintSlotOverride?: number
): Result<MountedTree, MountBlockError> {
  const mountedState = getNestedBlockRegionMountedState(instance, regionSlot);
  const blueprintSlot = blueprintSlotOverride ?? mountedState?.blueprintSlot ?? input.blueprint.regionNestedBlueprintSlot[regionSlot];

  if (blueprintSlot === undefined || blueprintSlot === INVALID_INDEX) {
    return err({
      code: "MOUNT_TREE_NESTED_BLUEPRINT_MISSING",
      message: `Nested region ${regionSlot} does not reference a child blueprint.`
    });
  }

  const child = input.nestedBlueprints?.[blueprintSlot];
  if (!child) {
    return err({
      code: "MOUNT_TREE_NESTED_BLUEPRINT_MISSING",
      message: `Nested region ${regionSlot} references missing child blueprint ${blueprintSlot}.`
    });
  }

  const root = getRegionHostRoot(input.blueprint, nodes, nodeMounted, regionSlot);
  if (!root.ok) {
    return root;
  }

  return mountTree({
    ...createChildMountInput(child),
    root: root.value
  });
}

function mountKeyedListItems(
  input: MountTreeInput,
  nodes: HostNode[],
  nodeMounted: boolean[],
  regionSlot: number,
  items: readonly KeyedListItemSpec[]
): Result<{ order: string[]; trees: Map<string, MountedTree> }, MountBlockError> {
  const root = getRegionHostRoot(input.blueprint, nodes, nodeMounted, regionSlot);
  if (!root.ok) {
    return root;
  }

  const trees = new Map<string, MountedTree>();
  const order: string[] = [];

  for (const item of items) {
    const mounted = mountTree({
      ...createChildMountInput(item),
      root: root.value
    });

    if (!mounted.ok) {
      const disposeResult = disposeMountedTrees(trees.values());
      if (!disposeResult.ok) {
        return disposeResult;
      }
      return mounted;
    }

    const moveResult = moveTreeBeforeRegionAnchor(input.blueprint, nodes, mounted.value, regionSlot);
    if (!moveResult.ok) {
      const disposeResult = mounted.value.dispose();
      if (!disposeResult.ok) {
        return disposeResult;
      }
      const partialDisposeResult = disposeMountedTrees(trees.values());
      if (!partialDisposeResult.ok) {
        return partialDisposeResult;
      }
      return moveResult;
    }

    trees.set(item.key, mounted.value);
    order.push(item.key);
  }

  return ok({ order, trees });
}

function reconcileKeyedListItems(
  input: MountTreeInput,
  nodes: HostNode[],
  nodeMounted: boolean[],
  regionSlot: number,
  current: { order: string[]; trees: Map<string, MountedTree> },
  nextItems: readonly KeyedListItemSpec[]
): Result<{ order: string[]; trees: Map<string, MountedTree> }, MountBlockError> {
  const root = getRegionHostRoot(input.blueprint, nodes, nodeMounted, regionSlot);
  if (!root.ok) {
    return root;
  }

  const nextTrees = new Map<string, MountedTree>();

  for (const item of nextItems) {
    const existing = current.trees.get(item.key);
    if (existing) {
      nextTrees.set(item.key, existing);
      continue;
    }

    const mounted = mountTree({
      ...createChildMountInput(item),
      root: root.value
    });

    if (!mounted.ok) {
      const disposeResult = disposeNewKeyedListTrees(nextTrees, current.trees);
      if (!disposeResult.ok) {
        return disposeResult;
      }
      return mounted;
    }

    const moveResult = moveTreeBeforeRegionAnchor(input.blueprint, nodes, mounted.value, regionSlot);
    if (!moveResult.ok) {
      const disposeResult = mounted.value.dispose();
      if (!disposeResult.ok) {
        return disposeResult;
      }
      const partialDisposeResult = disposeNewKeyedListTrees(nextTrees, current.trees);
      if (!partialDisposeResult.ok) {
        return partialDisposeResult;
      }
      return moveResult;
    }

    nextTrees.set(item.key, mounted.value);
  }

  const reorderResult = reorderKeyedListDom(input.blueprint, nodes, regionSlot, root.value, nextItems, nextTrees);
  if (!reorderResult.ok) {
    const disposeResult = disposeNewKeyedListTrees(nextTrees, current.trees);
    if (!disposeResult.ok) {
      return disposeResult;
    }
    return reorderResult;
  }

  const nextKeys = new Set(nextItems.map(item => item.key));
  for (const [key, tree] of current.trees) {
    if (nextKeys.has(key)) {
      continue;
    }

    const disposeResult = tree.dispose();
    if (!disposeResult.ok) {
      return disposeResult;
    }
  }

  return ok({
    order: nextItems.map(item => item.key),
    trees: nextTrees
  });
}

function mountVirtualListCells(
  input: MountTreeInput,
  nodes: HostNode[],
  nodeMounted: boolean[],
  regionSlot: number,
  cells: readonly VirtualListCellSpec[]
): Result<MountedTree[], MountBlockError> {
  const root = getRegionHostRoot(input.blueprint, nodes, nodeMounted, regionSlot);
  if (!root.ok) {
    return root;
  }

  const mountedCells: MountedTree[] = [];

  for (const cell of cells) {
    const mounted = mountTree({
      ...createChildMountInput(cell),
      root: root.value
    });

    if (!mounted.ok) {
      const disposeResult = disposeMountedTrees(mountedCells);
      if (!disposeResult.ok) {
        return disposeResult;
      }
      return mounted;
    }

    const moveResult = moveTreeBeforeRegionAnchor(input.blueprint, nodes, mounted.value, regionSlot);
    if (!moveResult.ok) {
      const mountedDisposeResult = mounted.value.dispose();
      if (!mountedDisposeResult.ok) {
        return mountedDisposeResult;
      }

      const partialDisposeResult = disposeMountedTrees(mountedCells);
      if (!partialDisposeResult.ok) {
        return partialDisposeResult;
      }
      return moveResult;
    }

    const flushResult = mounted.value.flushInitialBindings();
    if (!flushResult.ok) {
      const mountedDisposeResult = mounted.value.dispose();
      if (!mountedDisposeResult.ok) {
        return mountedDisposeResult;
      }

      const partialDisposeResult = disposeMountedTrees(mountedCells);
      if (!partialDisposeResult.ok) {
        return partialDisposeResult;
      }
      return flushResult;
    }

    mountedCells.push(mounted.value);
  }

  return ok(mountedCells);
}

function rebindVirtualListCells(
  mountedCells: readonly MountedTree[],
  nextCells: readonly VirtualListCellSpec[]
): Result<void, MountBlockError> {
  for (let index = 0; index < nextCells.length; index += 1) {
    const mountedCell = mountedCells[index];
    const nextCell = nextCells[index];
    if (!mountedCell || !nextCell) {
      return err({
        code: "MOUNT_TREE_VIRTUAL_LIST_CELL_MISSING",
        message: `Virtual list cell ${index} is missing.`
      });
    }

    const writes = nextCell.initialSignalValues.map((value, signalSlot) => [
      signalSlot,
      value
    ] as const);
    const writeResult = mountedCell.setSignals(writes);
    if (!writeResult.ok) {
      return writeResult;
    }
  }

  return ok(undefined);
}

function disposeNewKeyedListTrees(
  nextTrees: Map<string, MountedTree>,
  currentTrees: Map<string, MountedTree>
): Result<void, MountBlockError> {
  const trees: MountedTree[] = [];

  for (const [key, tree] of nextTrees) {
    if (!currentTrees.has(key)) {
      trees.push(tree);
    }
  }

  return disposeMountedTrees(trees);
}

function disposeMountedTrees(trees: Iterable<MountedTree>): Result<void, MountBlockError> {
  for (const tree of trees) {
    const disposeResult = tree.dispose();
    if (!disposeResult.ok) {
      return disposeResult;
    }
  }

  return ok(undefined);
}

function reorderKeyedListDom(
  blueprint: Blueprint,
  nodes: HostNode[],
  regionSlot: number,
  root: Node,
  nextItems: readonly KeyedListItemSpec[],
  nextTrees: Map<string, MountedTree>
): Result<void, MountBlockError> {
  const anchorResult = getRegionAnchorEndNode(blueprint, nodes, regionSlot);
  if (!anchorResult.ok) {
    return anchorResult;
  }

  for (const item of nextItems) {
    const tree = nextTrees.get(item.key);
    const firstNode = tree?.nodes[0] as unknown as Node | undefined;
    if (!firstNode) {
      continue;
    }

    root.insertBefore(firstNode, anchorResult.value);
  }

  return ok(undefined);
}

function createKeyedListPayload(
  previous: readonly string[],
  next: readonly string[]
): KeyedListReconcilePayloadItem[] {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  const payload: KeyedListReconcilePayloadItem[] = [];

  previous.forEach((key, index) => {
    if (!nextSet.has(key)) {
      payload.push({ kind: "remove", index });
    }
  });

  next.forEach((key, index) => {
    if (!previousSet.has(key)) {
      payload.push({ kind: "insert", index });
      return;
    }

    const previousIndex = previous.indexOf(key);
    if (previousIndex !== index) {
      payload.push({ kind: "move", from: previousIndex, to: index });
    }
  });

  return payload;
}

function findDuplicateKey(items: readonly KeyedListItemSpec[]): string | null {
  const keys = new Set<string>();

  for (const item of items) {
    if (keys.has(item.key)) {
      return item.key;
    }

    keys.add(item.key);
  }

  return null;
}

function getRegionHostRoot(
  blueprint: Blueprint,
  nodes: HostNode[],
  nodeMounted: boolean[],
  regionSlot: number
): Result<Node, MountBlockError> {
  const anchorEnd = blueprint.regionAnchorEnd[regionSlot];
  if (anchorEnd === undefined || anchorEnd === INVALID_INDEX) {
    return err({
      code: "MOUNT_TREE_REGION_ANCHOR_MISSING",
      message: `Region ${regionSlot} does not have a concrete anchor end.`
    });
  }

  const parentIndex = blueprint.nodeParentIndex[anchorEnd];
  const parent = parentIndex === undefined || parentIndex === INVALID_INDEX
    ? null
    : nodes[parentIndex] as unknown as Node | undefined;

  if (parent) {
    return ok(parent);
  }

  const anchor = nodes[anchorEnd] as unknown as Node | undefined;
  const root = anchor?.parentNode ?? null;

  if (!root || !nodeMounted[anchorEnd]) {
    return err({
      code: "MOUNT_TREE_REGION_ROOT_MISSING",
      message: `Region ${regionSlot} could not resolve a mounted host root.`
    });
  }

  return ok(root);
}

function moveTreeBeforeRegionAnchor(
  blueprint: Blueprint,
  nodes: HostNode[],
  tree: MountedTree,
  regionSlot: number
): Result<void, MountBlockError> {
  const anchor = getRegionAnchorEndNode(blueprint, nodes, regionSlot);
  if (!anchor.ok) {
    return anchor;
  }

  const root = anchor.value.parentNode;
  if (!root) {
    return err({
      code: "MOUNT_TREE_REGION_ROOT_MISSING",
      message: `Region ${regionSlot} could not resolve a mounted host root.`
    });
  }

  const firstNode = tree.nodes[0] as unknown as Node | undefined;
  if (!firstNode) {
    return err({
      code: "MOUNT_TREE_CHILD_ROOT_MISSING",
      message: `Region ${regionSlot} mounted child tree does not have a concrete root node.`
    });
  }

  root.insertBefore(firstNode, anchor.value);
  return ok(undefined);
}

function getRegionAnchorEndNode(
  blueprint: Blueprint,
  nodes: HostNode[],
  regionSlot: number
): Result<Node, MountBlockError> {
  const anchorEnd = blueprint.regionAnchorEnd[regionSlot];
  if (anchorEnd === undefined || anchorEnd === INVALID_INDEX) {
    return err({
      code: "MOUNT_TREE_REGION_ANCHOR_MISSING",
      message: `Region ${regionSlot} does not have a concrete anchor end.`
    });
  }

  const anchor = nodes[anchorEnd] as unknown as Node | undefined;
  if (!anchor) {
    return err({
      code: "MOUNT_TREE_REGION_ANCHOR_MISSING",
      message: `Region ${regionSlot} references missing anchor end node ${anchorEnd}.`
    });
  }

  return ok(anchor);
}

function createChildMountInput(spec: TreeBlueprintSpec): Omit<MountTreeInput, "root"> {
  return {
    blueprint: spec.blueprint,
    signalCount: spec.signalCount ?? 0,
    ...(spec.initialSignalValues === undefined
      ? {}
      : { initialSignalValues: spec.initialSignalValues }),
    ...(spec.nestedBlueprints === undefined
      ? {}
      : { nestedBlueprints: spec.nestedBlueprints })
  };
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
