import { LANE_COUNT, ok, type Result } from "@jue/shared";

import { beginSchedulerFlush, completeSchedulerFlush, type SchedulerState } from "./scheduler-state";
import { dispatchBinding, type BindingDispatchError, type BindingDispatchHooks } from "./binding-dispatch";
import type { BlockInstance, HostAdapter } from "./types";

export interface FlushBindingsResult {
  readonly batchId: number;
  readonly flushedBindingCount: number;
}

/**
 * 刷新当前调度批次里所有已排队的 binding 工作。
 *
 * @description
 * 这个函数按 lane 顺序遍历 binding 队列，把编译后的 binding slot
 * 交给 `dispatchBinding` 执行，并在整批完成后推进调度器批次状态。
 *
 * @param instance 持有 binding 状态的 block 实例。
 * @param scheduler 持有 lane 队列和 batch 状态的调度器。
 * @param adapter 用于落宿主副作用的 host adapter。
 * @param hooks 供特殊 binding opcode 使用的 region 生命周期钩子。
 * @returns batch id 与已刷新 binding 数，或首个分发错误。
 */
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
