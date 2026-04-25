import { LANE_COUNT, ok, type Result } from "@jue/shared";

import { beginSchedulerFlush, completeSchedulerFlush, type SchedulerState } from "./scheduler-state";
import { dispatchBinding, type BindingDispatchError, type BindingDispatchHooks } from "./binding-dispatch";
import type { BlockInstance, HostAdapter } from "./types";

export interface FlushBindingsResult {
  readonly batchId: number;
  readonly flushedBindingCount: number;
}

export function flushBindingQueue(
  instance: BlockInstance,
  scheduler: SchedulerState,
  adapter: HostAdapter,
  hooks: BindingDispatchHooks = {}
): Result<FlushBindingsResult, BindingDispatchError> {
  if (scheduler.scheduledLanes === 0 && scheduler.flushingLanes === 0) {
    return ok({
      batchId: scheduler.batchId,
      flushedBindingCount: 0
    });
  }

  const batchResult = scheduler.flushingLanes === 0
    ? beginSchedulerFlush(scheduler)
    : ok(scheduler.batchId);

  if (!batchResult.ok) {
    return ok({
      batchId: scheduler.batchId,
      flushedBindingCount: 0
    });
  }

  let flushedBindingCount = 0;

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    if ((scheduler.flushingLanes & (1 << lane)) === 0) {
      continue;
    }

    const start = scheduler.dirtyBindingQueueStart[lane] ?? 0;
    const count = scheduler.dirtyBindingQueueCount[lane] ?? 0;

    for (let offset = 0; offset < count; offset += 1) {
      const bindingSlot = scheduler.bindingQueueData[start + offset];

      if (bindingSlot === undefined) {
        continue;
      }

      const dispatchResult = dispatchBinding(instance, adapter, bindingSlot, hooks);

      if (!dispatchResult.ok) {
        return dispatchResult;
      }

      flushedBindingCount += 1;
    }
  }

  const batchId = batchResult.value;
  completeSchedulerFlush(scheduler);

  return ok({
    batchId,
    flushedBindingCount
  });
}
