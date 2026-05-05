import { err, ok, type Lane, type Result } from "@jue/shared";

import { getBindingDirtyBitset, getSignalState } from "./block-instance";
import { enqueueUniqueSchedulerSlot, type SchedulerState } from "./scheduler-state";
import { writeSignal } from "./signal-state";
import type { BlockInstance } from "./types";

export interface SignalWriteScheduleResult {
  readonly changed: boolean;
  readonly enqueuedBindingCount: number;
}

export interface SignalWriteScheduleError {
  readonly code: string;
  readonly message: string;
}

/**
 * 写入一个 signal，并把所有依赖它的 binding 推入调度器。
 *
 * @description
 * 它把“signal 值变更”和“依赖 binding 入队”打包成一次原子流程。
 * 如果值没变，函数会直接短路，避免制造空 flush。
 *
 * @param instance 持有 signal 与依赖映射表的 block 实例。
 * @param scheduler 接收后续 binding 工作的调度器。
 * @param lane 本次写入使用的调度 lane。
 * @param signalSlot 要写入的 signal 槽位。
 * @param value 要写入的新值。
 * @returns signal 是否变化，以及新入队的 binding 数量。
 */
export function scheduleSignalWrite(
  instance: BlockInstance,
  scheduler: SchedulerState,
  lane: Lane,
  signalSlot: number,
  value: unknown
): Result<SignalWriteScheduleResult, SignalWriteScheduleError> {
  const signalState = getSignalState(instance);
  const writeResult = writeSignal(signalState, signalSlot, value);

  if (!writeResult.ok) {
    return err(writeResult.error);
  }

  // 值未变化时不能推进 version，也不能调度 binding，否则会制造空 flush。
  if (!writeResult.value) {
    return ok({
      changed: false,
      enqueuedBindingCount: 0
    });
  }

  const start = instance.blueprint.signalToBindingStart[signalSlot];
  const count = instance.blueprint.signalToBindingCount[signalSlot];

  if (start === undefined || count === undefined) {
    return err({
      code: "SIGNAL_BINDING_RANGE_MISSING",
      message: `Signal slot ${signalSlot} has no binding range metadata.`
    });
  }

  const dirtyBitset = getBindingDirtyBitset(instance);
  let enqueuedBindingCount = 0;

  // signal -> binding 是扇出关系，真正的“同批去重”交给 dirty bitset，
  // 这样连续写同一个 signal 时只会保留一份 binding queue 项。
  for (let offset = 0; offset < count; offset += 1) {
    const bindingSlot = instance.blueprint.signalToBindings[start + offset];

    if (bindingSlot === undefined) {
      return err({
        code: "SIGNAL_BINDING_SLOT_MISSING",
        message: `Signal slot ${signalSlot} references a missing binding slot at offset ${offset}.`
      });
    }

    const enqueueResult = enqueueUniqueSchedulerSlot(
      scheduler,
      dirtyBitset,
      lane,
      "binding",
      bindingSlot
    );

    if (!enqueueResult.ok) {
      return err(enqueueResult.error);
    }

    if (enqueueResult.value) {
      enqueuedBindingCount += 1;
    }
  }

  return ok({
    changed: true,
    enqueuedBindingCount
  });
}
