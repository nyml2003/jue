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

/**
 * 为运行时资源分配按槽位平铺的状态表。
 *
 * @description
 * 资源状态把请求状态、所属 lane、版本号和结果引用拆开放在多张表里，
 * 这样异步资源更新可以和 signal 一样沿着 slot 直接定位。
 *
 * @param resourceCount 要分配的资源槽位数。
 * @returns status 与 version 都已清零的资源状态。
 */
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

/**
 * 为一个资源槽位启动新的请求周期。
 *
 * @description
 * 这个调用会推进 version、增加 pending 计数，并把状态切到 `PENDING`。
 * 后续成功或失败提交都必须携带这里返回的 version token。
 *
 * @param state 要写入的资源状态。
 * @param slot 资源槽位索引。
 * @param lane 这次请求所属的调度 lane。
 * @returns 请求完成时必须匹配的 version token。
 */
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

/**
 * 为匹配 version 的请求提交成功结果。
 *
 * @description
 * 如果提交版本落后于当前版本，函数会拒绝写入，避免旧请求覆盖新请求结果。
 *
 * @param state 要写入的资源状态。
 * @param slot 资源槽位索引。
 * @param version 正在完成的请求 version。
 * @param value 请求成功返回的值。
 * @returns 提交被接受时返回 `true`。
 */
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

/**
 * 为匹配 version 的请求提交失败结果。
 *
 * @description
 * 失败提交与成功提交遵循同一套版本门控，防止过期错误把更新中的资源重新打回错误态。
 *
 * @param state 要写入的资源状态。
 * @param slot 资源槽位索引。
 * @param version 正在完成的请求 version。
 * @param errorValue 要保存到槽位中的错误值。
 * @returns 提交被接受时返回 `true`。
 */
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

/**
 * 校验资源槽位是否存在于当前状态表中。
 *
 * @param state 正在访问的资源状态。
 * @param slot 资源槽位索引。
 * @returns 槽位在范围内时返回成功。
 */
function validateResourceSlot(state: ResourceState, slot: number): Result<void, ResourceStateError> {
  if (slot < 0 || slot >= state.status.length) {
    return err({
      code: "RESOURCE_SLOT_OUT_OF_RANGE",
      message: `Resource slot ${slot} is out of range for size ${state.status.length}.`
    });
  }

  return ok(undefined);
}
