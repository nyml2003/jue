import { LANE_COUNT, type Lane } from "@jue/shared";

export interface SchedulerState {
  batchId: number;
  scheduledLanes: number;
  flushingLanes: number;
  readonly dirtyBindingQueueStart: Uint32Array;
  readonly dirtyBindingQueueCount: Uint32Array;
  readonly dirtyRegionQueueStart: Uint32Array;
  readonly dirtyRegionQueueCount: Uint32Array;
  readonly channelQueueStart: Uint32Array;
  readonly channelQueueCount: Uint32Array;
  readonly resourceQueueStart: Uint32Array;
  readonly resourceQueueCount: Uint32Array;
  readonly bindingQueueData: number[];
  readonly regionQueueData: number[];
  readonly channelQueueData: number[];
  readonly resourceQueueData: number[];
}

export type SchedulerQueueKind = "binding" | "region" | "channel" | "resource";

export function createSchedulerState(): SchedulerState {
  return {
    batchId: 0,
    scheduledLanes: 0,
    flushingLanes: 0,
    dirtyBindingQueueStart: new Uint32Array(LANE_COUNT),
    dirtyBindingQueueCount: new Uint32Array(LANE_COUNT),
    dirtyRegionQueueStart: new Uint32Array(LANE_COUNT),
    dirtyRegionQueueCount: new Uint32Array(LANE_COUNT),
    channelQueueStart: new Uint32Array(LANE_COUNT),
    channelQueueCount: new Uint32Array(LANE_COUNT),
    resourceQueueStart: new Uint32Array(LANE_COUNT),
    resourceQueueCount: new Uint32Array(LANE_COUNT),
    bindingQueueData: [],
    regionQueueData: [],
    channelQueueData: [],
    resourceQueueData: []
  };
}

export function enqueueSchedulerSlot(
  state: SchedulerState,
  lane: Lane,
  kind: SchedulerQueueKind,
  slot: number
): void {
  const queue = getQueueData(state, kind);
  const starts = getQueueStarts(state, kind);
  const counts = getQueueCounts(state, kind);

  if (counts[lane] === 0) {
    starts[lane] = queue.length;
  }

  queue.push(slot);
  counts[lane] = (counts[lane] ?? 0) + 1;
  state.scheduledLanes |= 1 << lane;
}

export function resetSchedulerQueues(state: SchedulerState): void {
  state.scheduledLanes = 0;
  state.flushingLanes = 0;
  state.dirtyBindingQueueStart.fill(0);
  state.dirtyBindingQueueCount.fill(0);
  state.dirtyRegionQueueStart.fill(0);
  state.dirtyRegionQueueCount.fill(0);
  state.channelQueueStart.fill(0);
  state.channelQueueCount.fill(0);
  state.resourceQueueStart.fill(0);
  state.resourceQueueCount.fill(0);
  state.bindingQueueData.length = 0;
  state.regionQueueData.length = 0;
  state.channelQueueData.length = 0;
  state.resourceQueueData.length = 0;
}

function getQueueData(state: SchedulerState, kind: SchedulerQueueKind): number[] {
  switch (kind) {
    case "binding":
      return state.bindingQueueData;
    case "region":
      return state.regionQueueData;
    case "channel":
      return state.channelQueueData;
    case "resource":
      return state.resourceQueueData;
  }
}

function getQueueStarts(state: SchedulerState, kind: SchedulerQueueKind): Uint32Array {
  switch (kind) {
    case "binding":
      return state.dirtyBindingQueueStart;
    case "region":
      return state.dirtyRegionQueueStart;
    case "channel":
      return state.channelQueueStart;
    case "resource":
      return state.resourceQueueStart;
  }
}

function getQueueCounts(state: SchedulerState, kind: SchedulerQueueKind): Uint32Array {
  switch (kind) {
    case "binding":
      return state.dirtyBindingQueueCount;
    case "region":
      return state.dirtyRegionQueueCount;
    case "channel":
      return state.channelQueueCount;
    case "resource":
      return state.resourceQueueCount;
  }
}
