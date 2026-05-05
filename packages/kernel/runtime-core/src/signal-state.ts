import { err, ok, type Result } from "@jue/shared";

export interface SignalState {
  readonly values: unknown[];
  readonly version: Uint32Array;
  readonly flags: Uint8Array;
}

export interface SignalStateError {
  readonly code: string;
  readonly message: string;
}

/**
 * 为 block 的 signal 分配按槽位平铺的状态表。
 *
 * @description
 * `values`、`version` 和 `flags` 都按相同 slot 对齐存放，
 * 这样 signal 的读取、写入和依赖追踪都可以只通过数值索引完成。
 *
 * @param signalCount 要分配的 signal 槽位数。
 * @returns version 与 flags 都已清零的 signal 状态。
 */
export function createSignalState(signalCount: number): SignalState {
  return {
    values: new Array<unknown>(signalCount).fill(null),
    version: new Uint32Array(signalCount),
    flags: new Uint8Array(signalCount)
  };
}

/**
 * 读取一个 signal 槽位的当前值。
 *
 * @description
 * 读取前会先做边界校验，避免上层把错误 slot 继续传到调度或 binding 路径里。
 *
 * @param state 要读取的 signal 状态。
 * @param slot signal 槽位索引。
 * @returns 该槽位当前保存的值。
 */
export function readSignal(state: SignalState, slot: number): Result<unknown, SignalStateError> {
  const range = validateSignalSlot(state, slot);

  if (!range.ok) {
    return range;
  }

  return ok(state.values[slot]);
}

/**
 * 写入一个 signal 槽位，并在值真正变化时推进 version。
 *
 * @description
 * 这里使用 `Object.is` 判断是否变化，因此 `NaN`、`-0` 等边界值
 * 会保持和 JavaScript 本身一致的等价语义。
 *
 * @param state 要写入的 signal 状态。
 * @param slot signal 槽位索引。
 * @param value 要写入的新值。
 * @returns 该槽位是否发生了变化。
 */
export function writeSignal(
  state: SignalState,
  slot: number,
  value: unknown
): Result<boolean, SignalStateError> {
  const range = validateSignalSlot(state, slot);

  if (!range.ok) {
    return range;
  }

  if (Object.is(state.values[slot], value)) {
    return ok(false);
  }

  state.values[slot] = value;
  state.version[slot] = (state.version[slot] ?? 0) + 1;
  return ok(true);
}

/**
 * 校验 signal 槽位是否存在于当前状态表中。
 *
 * @param state 正在访问的 signal 状态。
 * @param slot signal 槽位索引。
 * @returns 槽位在范围内时返回成功。
 */
function validateSignalSlot(state: SignalState, slot: number): Result<void, SignalStateError> {
  if (slot < 0 || slot >= state.values.length) {
    return err({
      code: "SIGNAL_SLOT_OUT_OF_RANGE",
      message: `Signal slot ${slot} is out of range for size ${state.values.length}.`
    });
  }

  return ok(undefined);
}
