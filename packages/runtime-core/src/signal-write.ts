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
