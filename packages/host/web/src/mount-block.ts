import {
  createBlockInstance,
  createSchedulerState,
  flushBindingQueue,
  scheduleSignalWrite,
  type BlockInstance,
  type Blueprint,
  type FlushBindingsResult,
  type HostNode,
  type HostRoot
} from "@jue/runtime-core";
import { Lane, err, ok, type Result } from "@jue/shared";

import { createWebHostAdapter } from "./adapter";

export interface MountBlockInput {
  readonly blueprint: Blueprint;
  readonly signalCount: number;
  readonly createNode: () => Result<HostNode, MountBlockError>;
  readonly root: Node;
  readonly lane?: Lane;
}

export interface MountedBlock {
  readonly instance: BlockInstance;
  readonly node: HostNode;
  setSignal(slot: number, value: unknown, lane?: Lane): Result<FlushBindingsResult, MountBlockError>;
  dispose(): Result<void, MountBlockError>;
}

export interface MountBlockError {
  readonly code: string;
  readonly message: string;
}

export function mountBlock(input: MountBlockInput): Result<MountedBlock, MountBlockError> {
  const hostRootResult = validateHostRoot(input.root);
  if (!hostRootResult.ok) {
    return hostRootResult;
  }

  const adapter = createWebHostAdapter();
  const nodeResult = input.createNode();
  if (!nodeResult.ok) {
    return err(nodeResult.error);
  }

  const instance = createBlockInstance(input.blueprint, {
    signalCount: input.signalCount,
    nodes: [nodeResult.value]
  });
  const scheduler = createSchedulerState();
  const hostRoot = hostRootResult.value;
  const insertResult = adapter.insert(hostRoot, nodeResult.value, null);

  if (!insertResult.ok) {
    return err(insertResult.error);
  }

  let disposed = false;

  return ok({
    instance,
    node: nodeResult.value,
    setSignal(slot, value, lane = input.lane ?? Lane.VISIBLE_UPDATE) {
      if (disposed) {
        return err({
          code: "BLOCK_MOUNT_DISPOSED",
          message: "Cannot update a mounted block after it has been disposed."
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

      const flushResult = flushBindingQueue(instance, scheduler, adapter);
      if (!flushResult.ok) {
        return err(flushResult.error);
      }

      return ok(flushResult.value);
    },
    dispose() {
      if (disposed) {
        return ok(undefined);
      }

      const removeResult = adapter.remove(hostRoot, nodeResult.value);
      if (!removeResult.ok) {
        return err(removeResult.error);
      }

      disposed = true;
      return ok(undefined);
    }
  });
}

export function validateHostRoot(root: Node): Result<HostRoot, MountBlockError> {
  if (!(root instanceof Node)) {
    return err({
      code: "INVALID_HOST_ROOT",
      message: "mount() expected a DOM Node-compatible root."
    });
  }

  const documentNode: Document | null = root.nodeType === Node.DOCUMENT_NODE
    ? root as Document
    : root.ownerDocument;

  if (!documentNode?.defaultView) {
    return err({
      code: "INVALID_HOST_ROOT",
      message: "mount() expected a DOM root attached to a live document window."
    });
  }

  return ok(root as unknown as HostRoot);
}
