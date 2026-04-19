import { ResourceStatus, err, ok, type Lane, type Result } from "@jue/shared";

export interface ResourceState {
  readonly status: Uint8Array;
  readonly laneState: Uint8Array;
  readonly version: Uint32Array;
  readonly pendingCount: Uint16Array;
  readonly valueRef: unknown[];
  readonly errorRef: unknown[];
}

export interface ResourceStateError {
  readonly code: string;
  readonly message: string;
}

export function createResourceState(resourceCount: number): ResourceState {
  return {
    status: new Uint8Array(resourceCount),
    laneState: new Uint8Array(resourceCount),
    version: new Uint32Array(resourceCount),
    pendingCount: new Uint16Array(resourceCount),
    valueRef: new Array<unknown>(resourceCount).fill(null),
    errorRef: new Array<unknown>(resourceCount).fill(null)
  };
}

export function beginResourceRequest(
  state: ResourceState,
  slot: number,
  lane: Lane
): Result<number, ResourceStateError> {
  const range = validateResourceSlot(state, slot);

  if (!range.ok) {
    return range;
  }

  const nextVersion = (state.version[slot] ?? 0) + 1;

  state.version[slot] = nextVersion;
  state.pendingCount[slot] = (state.pendingCount[slot] ?? 0) + 1;
  state.status[slot] = ResourceStatus.PENDING;
  state.laneState[slot] = lane;

  return ok(nextVersion);
}

export function commitResourceValue(
  state: ResourceState,
  slot: number,
  version: number,
  value: unknown
): Result<boolean, ResourceStateError> {
  const range = validateResourceSlot(state, slot);

  if (!range.ok) {
    return range;
  }

  if (state.version[slot] !== version) {
    return err({
      code: "STALE_RESOURCE_VERSION",
      message: `Resource slot ${slot} expected version ${state.version[slot]}, got ${version}.`
    });
  }

  state.status[slot] = ResourceStatus.READY;
  state.pendingCount[slot] = Math.max(0, (state.pendingCount[slot] ?? 0) - 1);
  state.valueRef[slot] = value;
  state.errorRef[slot] = null;

  return ok(true);
}

export function commitResourceError(
  state: ResourceState,
  slot: number,
  version: number,
  errorValue: unknown
): Result<boolean, ResourceStateError> {
  const range = validateResourceSlot(state, slot);

  if (!range.ok) {
    return range;
  }

  if (state.version[slot] !== version) {
    return err({
      code: "STALE_RESOURCE_VERSION",
      message: `Resource slot ${slot} expected version ${state.version[slot]}, got ${version}.`
    });
  }

  state.status[slot] = ResourceStatus.ERROR;
  state.pendingCount[slot] = Math.max(0, (state.pendingCount[slot] ?? 0) - 1);
  state.errorRef[slot] = errorValue;

  return ok(true);
}

function validateResourceSlot(state: ResourceState, slot: number): Result<void, ResourceStateError> {
  if (slot < 0 || slot >= state.status.length) {
    return err({
      code: "RESOURCE_SLOT_OUT_OF_RANGE",
      message: `Resource slot ${slot} is out of range for size ${state.status.length}.`
    });
  }

  return ok(undefined);
}
