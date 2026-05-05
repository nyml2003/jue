import { err, ok, LANE_COUNT, type Lane, type Result } from "@jue/shared";

import type { DirtyBitError, DirtyBitset } from "./dirty-bits";
import { markDirty } from "./dirty-bits";

export interface SchedulerState {
  batchId: number;
  scheduledLanes: number;
  flushingLanes: number;
  // 每条 lane 都只记录自己在共享 backing array 里的切片范围；
  // flush 结束前不能重排这些数组，否则 start/count 索引会失效。
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

export interface SchedulerStateError {
  readonly code: string;
  readonly message: string;
}

/**
 * 创建一个空调度器，并为每种 queue kind 按 lane 准备独立切片。
 *
 * @description
 * 调度器把 binding、region、channel 和 resource 的待处理 slot
 * 都压平到共享数组里，再用 start/count 表示每条 lane 的切片范围。
 *
 * @returns 没有任何待调度工作的全新调度状态。
 */
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

/**
 * 向指定 lane 和队列类型的切片末尾追加一个 slot。
 *
 * @description
 * 这个函数只负责记录切片范围和追加数据，不做去重；
 * 同批次去重由上层 dirty bitset 驱动的唯一入队路径负责。
 *
 * @param state 要写入的调度状态。
 * @param lane 接收该 slot 的 lane。
 * @param kind 要追加到的队列类型。
 * @param slot 要入队的槽位索引。
 */
export function enqueueSchedulerSlot(
  state: SchedulerState,
  lane: Lane,
  kind: SchedulerQueueKind,
  slot: number
): void {
  const queue = getQueueData(state, kind);
  const starts = getQueueStarts(state, kind);
  const counts = getQueueCounts(state, kind);

  // 首次向某个 lane 追加时记录切片起点，后续只追加 count，保持入队 O(1)。
  if (counts[lane] === 0) {
    starts[lane] = queue.length;
  }

  queue.push(slot);
  counts[lane] = (counts[lane] ?? 0) + 1;
  state.scheduledLanes |= 1 << lane;
}

/**
 * 仅在当前批次里尚未标记为 dirty 时才把 slot 入队。
 *
 * @description
 * 这是调度器避免重复副作用的关键入口。
 * 只有 slot 第一次从 clean 变成 dirty 时，才会真正生成队列项。
 *
 * @param state 要写入的调度状态。
 * @param bitset 用于去重的 dirty bitset。
 * @param lane 接收该 slot 的 lane。
 * @param kind 要追加到的队列类型。
 * @param slot 要入队的槽位索引。
 * @returns 该 slot 是否是本批次第一次入队。
 */
export function enqueueUniqueSchedulerSlot(
  state: SchedulerState,
  bitset: DirtyBitset,
  lane: Lane,
  kind: SchedulerQueueKind,
  slot: number
): Result<boolean, DirtyBitError> {
  const dirty = markDirty(bitset, slot);

  if (!dirty.ok) {
    return dirty;
  }

  if (!dirty.value) {
    return ok(false);
  }

  // 同一批次里只允许一个 queue 项代表同一个 slot，避免 flush 重复触发宿主副作用。
  enqueueSchedulerSlot(state, lane, kind, slot);
  return ok(true);
}

/**
 * 基于当前已调度的 lanes 启动一个新的 flush 批次。
 *
 * @description
 * 启动时会把 `scheduledLanes` 快照到 `flushingLanes`，
 * 因此 flush 期间新入队的工作会自然落到下一批次。
 *
 * @param state 要切换到 flushing 状态的调度器。
 * @returns 新分配的 batch id。
 */
export function beginSchedulerFlush(state: SchedulerState): Result<number, SchedulerStateError> {
  if (state.scheduledLanes === 0) {
    return err({
      code: "NO_SCHEDULED_LANES",
      message: "Cannot begin a flush when no lanes are scheduled."
    });
  }

  // begin 阶段把“待处理 lanes”快照到 flushingLanes。
  // flush 期间新入队的数据会留在 scheduledLanes，进入下一批，不能混入当前 batch。
  state.batchId += 1;
  state.flushingLanes = state.scheduledLanes;
  state.scheduledLanes = 0;

  return ok(state.batchId);
}

/**
 * 结束当前 flush，并清空这批次的队列账本。
 *
 * @param state 完成批次后要重置的调度器。
 */
export function completeSchedulerFlush(state: SchedulerState): void {
  state.flushingLanes = 0;
  resetSchedulerQueues(state);
}

/**
 * 清空调度器上的所有队列切片和 lane 标记。
 *
 * @param state 要原地重置的调度状态。
 */
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

/**
 * 解析某种队列类型对应的共享 backing array。
 *
 * @param state 持有队列的调度状态。
 * @param kind 要访问的队列类型。
 * @returns 该队列类型使用的 backing array。
 */
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

/**
 * 解析某种队列类型对应的 per-lane 起始偏移表。
 *
 * @param state 持有队列的调度状态。
 * @param kind 要访问的队列类型。
 * @returns 该队列类型的起始偏移表。
 */
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

/**
 * 解析某种队列类型对应的 per-lane 数量表。
 *
 * @param state 持有队列的调度状态。
 * @param kind 要访问的队列类型。
 * @returns 该队列类型的数量表。
 */
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
