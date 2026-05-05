import { INVALID_INDEX, INVALID_STATE, RegionLifecycle } from "@jue/shared";

import { createDirtyBitsetView, type DirtyBitset } from "./dirty-bits";
import { createResourceState } from "./resource-state";
import { createSignalState, type SignalState } from "./signal-state";
import type { ResourceState } from "./resource-state";
import type { BlockInstance, Blueprint, HostNode } from "./types";

export interface CreateBlockInstanceOptions {
  readonly signalCount?: number;
  readonly resourceCount?: number;
  readonly nodes?: HostNode[];
}

export interface ConditionalRegionBranchRange {
  readonly startNode: number;
  readonly endNode: number;
}

export interface ConditionalRegionBranchContext extends ConditionalRegionBranchRange {
  readonly regionSlot: number;
  readonly branchIndex: number;
}

export interface ConditionalRegionHooks {
  readonly attachBranch?: (context: ConditionalRegionBranchContext) => boolean;
  readonly disposeBranch?: (context: ConditionalRegionBranchContext) => boolean;
}

export interface ConditionalRegionContentHooks {
  readonly mountBranchContent?: (context: ConditionalRegionBranchContext) => boolean;
  readonly disposeBranchContent?: (context: ConditionalRegionBranchContext) => boolean;
}

export type KeyedListReconcilePayloadItem =
  | {
      readonly kind: "insert";
      readonly index: number;
    }
  | {
      readonly kind: "remove";
      readonly index: number;
    }
  | {
      readonly kind: "move";
      readonly from: number;
      readonly to: number;
    };

export interface KeyedListReconcilePayload {
  readonly start: number;
  readonly count: number;
  readonly items: readonly KeyedListReconcilePayloadItem[];
}

export interface VirtualListRegionState {
  readonly itemCount: number;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly targetWindowStart: number | null;
  readonly targetWindowEnd: number | null;
}

/**
 * 实例化一个 block，并分配它运行时需要的全部槽位表。
 *
 * @description
 * 这个函数是 runtime-core 从静态 blueprint 进入可执行实例的第一步。
 * 它会一次性准备 signal、resource、region 和 dirty bit 所需的全部平铺存储。
 *
 * @param blueprint 描述节点、binding 和 region 的编译产物。
 * @param options 可选的初始容量与预解析节点数组。
 * @returns 可用于 signal、resource 和 region 更新的运行时实例。
 */
export function createBlockInstance(
  blueprint: Blueprint,
  options: CreateBlockInstanceOptions = {}
): BlockInstance {
  const signalCount = options.signalCount ?? 0;
  const resourceCount = options.resourceCount ?? 0;
  const nodes = options.nodes ?? [];
  // Region 运行时状态全部按 slot 平铺存储，后续生命周期函数只读写对应槽位，
  // 这样可以避免 region 切换路径引入额外对象分配。
  const regionLifecycle = new Uint8Array(blueprint.regionCount);
  const regionActiveBranch = new Int32Array(blueprint.regionCount);
  const regionTargetBranch = new Int32Array(blueprint.regionCount);
  const regionMountedBranch = new Int32Array(blueprint.regionCount);
  const regionNestedMountedBlockSlot = new Int32Array(blueprint.regionCount);
  const regionNestedMountedBlueprintSlot = new Int32Array(blueprint.regionCount);
  const regionNestedTargetBlockSlot = new Int32Array(blueprint.regionCount);
  const regionNestedTargetBlueprintSlot = new Int32Array(blueprint.regionCount);
  const regionKeyedListItemCount = new Uint32Array(blueprint.regionCount);
  const regionKeyedListReconcileStart = new Uint32Array(blueprint.regionCount);
  const regionKeyedListReconcileCount = new Uint32Array(blueprint.regionCount);
  const regionKeyedListPayloadStart = new Uint32Array(blueprint.regionCount);
  const regionKeyedListPayloadCount = new Uint32Array(blueprint.regionCount);
  const regionKeyedListPayloadKind = new Uint8Array(blueprint.regionCount * 8);
  const regionKeyedListPayloadIndex = new Uint32Array(blueprint.regionCount * 8);
  const regionKeyedListPayloadToIndex = new Uint32Array(blueprint.regionCount * 8);
  const regionVirtualListItemCount = new Uint32Array(blueprint.regionCount);
  const regionVirtualListWindowStart = new Uint32Array(blueprint.regionCount);
  const regionVirtualListWindowEnd = new Uint32Array(blueprint.regionCount);
  const regionVirtualListTargetWindowStart = new Uint32Array(blueprint.regionCount);
  const regionVirtualListTargetWindowEnd = new Uint32Array(blueprint.regionCount);
  const signalState = createSignalState(signalCount);
  const resourceState = createResourceState(resourceCount);

  regionLifecycle.fill(RegionLifecycle.UNINITIALIZED);
  regionActiveBranch.fill(INVALID_STATE);
  regionTargetBranch.fill(INVALID_STATE);
  regionMountedBranch.fill(INVALID_STATE);
  regionNestedMountedBlockSlot.fill(INVALID_STATE);
  regionNestedMountedBlueprintSlot.fill(INVALID_STATE);
  regionNestedTargetBlockSlot.fill(INVALID_STATE);
  regionNestedTargetBlueprintSlot.fill(INVALID_STATE);
  regionVirtualListTargetWindowStart.fill(INVALID_INDEX);
  regionVirtualListTargetWindowEnd.fill(INVALID_INDEX);

  return {
    blueprint,
    nodes,
    signalValues: signalState.values,
    signalVersion: signalState.version,
    signalFlags: signalState.flags,
    regionLifecycle,
    regionActiveBranch,
    regionTargetBranch,
    regionMountedBranch,
    regionNestedMountedBlockSlot,
    regionNestedMountedBlueprintSlot,
    regionNestedTargetBlockSlot,
    regionNestedTargetBlueprintSlot,
    regionKeyedListItemCount,
    regionKeyedListReconcileStart,
    regionKeyedListReconcileCount,
    regionKeyedListPayloadStart,
    regionKeyedListPayloadCount,
    regionKeyedListPayloadKind,
    regionKeyedListPayloadIndex,
    regionKeyedListPayloadToIndex,
    regionVirtualListItemCount,
    regionVirtualListWindowStart,
    regionVirtualListWindowEnd,
    regionVirtualListTargetWindowStart,
    regionVirtualListTargetWindowEnd,
    resourceStatus: resourceState.status,
    resourceLaneState: resourceState.laneState,
    resourceVersion: resourceState.version,
    resourcePendingCount: resourceState.pendingCount,
    resourceValueRef: resourceState.valueRef,
    resourceErrorRef: resourceState.errorRef,
    dirtyBindingBits: new Uint32Array(Math.ceil(blueprint.bindingCount / 32))
  };
}

/**
 * 把 block 内部的 signal 表暴露为 `SignalState` 视图。
 *
 * @description
 * 返回值不会复制底层数组，只是把实例内部三张 signal 表重新组织成统一接口，
 * 方便复用 `signal-state.ts` 里的通用读写逻辑。
 *
 * @param instance 要读取 signal 表的 block 实例。
 * @returns 共享实例存储的 signal 视图。
 */
export function getSignalState(instance: BlockInstance): SignalState {
  return {
    values: instance.signalValues,
    version: instance.signalVersion,
    flags: instance.signalFlags
  };
}

/**
 * 把 block 内部的 resource 表暴露为 `ResourceState` 视图。
 *
 * @description
 * 返回值同样只是一个轻量视图层，不会创建新的 typed array，
 * 适合把 block 内部资源状态交给通用 resource helper 处理。
 *
 * @param instance 要读取 resource 表的 block 实例。
 * @returns 共享实例存储的 resource 视图。
 */
export function getResourceState(instance: BlockInstance): ResourceState {
  return {
    status: instance.resourceStatus,
    laneState: instance.resourceLaneState,
    version: instance.resourceVersion,
    pendingCount: instance.resourcePendingCount,
    valueRef: instance.resourceValueRef,
    errorRef: instance.resourceErrorRef
  };
}

/**
 * 把 block 内部的 binding dirty 标记暴露为 `DirtyBitset` 视图。
 *
 * @description
 * 这个视图让上层可以直接复用通用 dirty-bit 工具，
 * 而不需要知道 block 实例内部具体如何保存 `dirtyBindingBits`。
 *
 * @param instance 要读取 dirty 标记的 block 实例。
 * @returns 共享实例存储的 dirty bitset 视图。
 */
export function getBindingDirtyBitset(instance: BlockInstance): DirtyBitset {
  return createDirtyBitsetView(instance.blueprint.bindingCount, instance.dirtyBindingBits);
}

/**
 * 把一个 region 槽位从 `UNINITIALIZED` 迁移到 `INACTIVE`。
 *
 * @description
 * 这个状态表示 slot 已经就绪，但尚未挂载任何内容。
 * 后续 attach、switch 等操作都依赖它先经过这一步显式初始化。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要初始化的 region 槽位。
 * @returns 这次状态迁移是否被接受。
 */
export function initializeRegionSlot(instance: BlockInstance, regionSlot: number): boolean {
  const current = instance.regionLifecycle[regionSlot];
  if (current === undefined) {
    return false;
  }

  // Region 必须先显式初始化成 INACTIVE，避免未分配 slot 被误当成空 region 参与后续切换。
  if (current !== RegionLifecycle.UNINITIALIZED) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.INACTIVE;
  return true;
}

/**
 * 把一个已初始化的 region 槽位从 `INACTIVE` 迁移到 `ACTIVE`。
 *
 * @description
 * 这个入口适合那些不需要完整 attach 流程、但需要显式打开 region
 * 生命周期的场景，例如某些外部驱动的 region 激活过程。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要激活的 region 槽位。
 * @returns 这次状态迁移是否被接受。
 */
export function activateRegionSlot(instance: BlockInstance, regionSlot: number): boolean {
  const current = instance.regionLifecycle[regionSlot];
  if (current === undefined) {
    return false;
  }

  // 只有已经完成初始化但尚未挂载内容的 region 才能进入 ACTIVE。
  if (current !== RegionLifecycle.INACTIVE) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 把一个分支挂载为条件 region 的当前内容。
 *
 * @description
 * 这个函数既会写入 active/mounted 分支索引，也会在需要时调用宿主 attach hook。
 * 它假设当前 region 还没有活动内容，因此只接受 `INACTIVE` 状态。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要挂载的条件 region 槽位。
 * @param branchIndex 要变成 active 的分支索引。
 * @param hooks 委托给宿主层的可选挂载/销毁钩子。
 * @returns 分支是否挂载成功。
 */
export function attachConditionalRegion(
  instance: BlockInstance,
  regionSlot: number,
  branchIndex: number,
  hooks: ConditionalRegionHooks = {}
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.INACTIVE) {
    return false;
  }

  if (branchIndex < 0) {
    return false;
  }

  const branchRange = getConditionalRegionBranchRange(instance, regionSlot, branchIndex);
  if (branchRange === null) {
    return false;
  }

  if (hooks.attachBranch && !hooks.attachBranch({
    regionSlot,
    branchIndex,
    ...branchRange
  })) {
    return false;
  }

  instance.regionActiveBranch[regionSlot] = branchIndex;
  instance.regionMountedBranch[regionSlot] = branchIndex;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 清空条件 region 当前已挂载的分支。
 *
 * @description
 * 清理流程会先把生命周期切到 `DISPOSING`，在 hook 成功后再恢复到 `INACTIVE`，
 * 这样外部可以从状态机上区分“正在销毁”和“已经空闲”。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要清空的条件 region 槽位。
 * @param hooks 委托给宿主层的可选销毁钩子。
 * @returns 当前分支是否销毁成功。
 */
export function clearConditionalRegion(
  instance: BlockInstance,
  regionSlot: number,
  hooks: ConditionalRegionHooks = {}
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  const activeBranch = instance.regionActiveBranch[regionSlot];
  if (activeBranch === undefined || activeBranch === INVALID_STATE) {
    return false;
  }

  const branchRange = getConditionalRegionBranchRange(instance, regionSlot, activeBranch);
  if (branchRange === null) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.DISPOSING;

  if (hooks.disposeBranch && !hooks.disposeBranch({
    regionSlot,
    branchIndex: activeBranch,
    ...branchRange
  })) {
    instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.INACTIVE;
  instance.regionActiveBranch[regionSlot] = INVALID_STATE;
  instance.regionTargetBranch[regionSlot] = INVALID_STATE;
  instance.regionMountedBranch[regionSlot] = INVALID_STATE;
  return true;
}

/**
 * 开始把条件 region 从当前 active 分支切到目标分支。
 *
 * @description
 * 这个阶段只记录 target branch 并进入 `UPDATING`，
 * 不会立即执行 attach/dispose，真正副作用发生在 complete 阶段。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要更新的条件 region 槽位。
 * @param targetBranch 目标分支索引。
 * @returns 这次更新迁移是否被接受。
 */
export function beginConditionalRegionSwitch(
  instance: BlockInstance,
  regionSlot: number,
  targetBranch: number
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  const activeBranch = instance.regionActiveBranch[regionSlot];

  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  if (targetBranch < 0 || targetBranch === activeBranch) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.UPDATING;
  instance.regionTargetBranch[regionSlot] = targetBranch;
  return true;
}

/**
 * 使用已保存的目标分支完成一次待决的条件 region 切换。
 *
 * @description
 * 它会从实例里读出 active/target branch，再把真实切换工作委托给
 * `completeConditionalRegionSwitchWithHooks`，因此适合默认切换路径复用。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要完成切换的条件 region 槽位。
 * @returns 切换是否成功完成。
 */
export function completeConditionalRegionSwitch(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  const targetBranch = instance.regionTargetBranch[regionSlot];
  const activeBranch = instance.regionActiveBranch[regionSlot];

  if (lifecycle !== RegionLifecycle.UPDATING) {
    return false;
  }

  if (
    targetBranch === undefined ||
    targetBranch === INVALID_STATE ||
    activeBranch === undefined ||
    activeBranch === INVALID_STATE
  ) {
    return false;
  }

  return completeConditionalRegionSwitchWithHooks(
    instance,
    regionSlot,
    activeBranch,
    targetBranch
  );
}

/**
 * 使用显式分支索引和 hooks 完成一次条件 region 切换。
 *
 * @description
 * 这是条件 region 切换的核心提交路径。它负责校验分支范围、按顺序调用
 * dispose/attach hooks，并在成功后同步 active、mounted 和 target 状态。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要完成切换的条件 region 槽位。
 * @param activeBranch 当前已挂载的分支索引。
 * @param targetBranch 下一步要挂载的分支索引。
 * @param hooks 委托给宿主层的可选挂载/销毁钩子。
 * @returns 切换是否成功完成。
 */
export function completeConditionalRegionSwitchWithHooks(
  instance: BlockInstance,
  regionSlot: number,
  activeBranch: number,
  targetBranch: number,
  hooks: ConditionalRegionHooks = {}
): boolean {
  const activeBranchRange = getConditionalRegionBranchRange(instance, regionSlot, activeBranch);
  const targetBranchRange = getConditionalRegionBranchRange(instance, regionSlot, targetBranch);

  if (activeBranchRange === null || targetBranchRange === null) {
    instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
    instance.regionTargetBranch[regionSlot] = INVALID_STATE;
    return false;
  }

  // 条件分支切换顺序固定为先 dispose 当前分支，再 attach 目标分支。
  // 这里的回滚只恢复 region 状态位，不假设宿主 hook 对副作用具备事务回滚能力。
  if (hooks.disposeBranch && !hooks.disposeBranch({
    regionSlot,
    branchIndex: activeBranch,
    ...activeBranchRange
  })) {
    instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
    instance.regionTargetBranch[regionSlot] = INVALID_STATE;
    return false;
  }

  if (hooks.attachBranch && !hooks.attachBranch({
    regionSlot,
    branchIndex: targetBranch,
    ...targetBranchRange
  })) {
    instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
    instance.regionTargetBranch[regionSlot] = INVALID_STATE;
    return false;
  }

  instance.regionActiveBranch[regionSlot] = targetBranch;
  instance.regionTargetBranch[regionSlot] = INVALID_STATE;
  instance.regionMountedBranch[regionSlot] = targetBranch;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 解析条件 region 内某个分支对应的节点范围。
 *
 * @description
 * 编译产物会把每个 region 的 branch range 压平到 blueprint 表里，
 * 这个 helper 负责把 region slot 和 branch index 解码成可直接使用的节点区间。
 *
 * @param instance 持有 region 元数据的 block 实例。
 * @param regionSlot 要查询的条件 region 槽位。
 * @param branchIndex 要解析的分支索引。
 * @returns 分支的起止节点索引；无效时返回 `null`。
 */
export function getConditionalRegionBranchRange(
  instance: BlockInstance,
  regionSlot: number,
  branchIndex: number
): ConditionalRegionBranchRange | null {
  const rangeStart = instance.blueprint.regionBranchRangeStart[regionSlot];
  const rangeCount = instance.blueprint.regionBranchRangeCount[regionSlot];

  if (
    rangeStart === undefined ||
    rangeCount === undefined ||
    branchIndex < 0 ||
    branchIndex >= rangeCount
  ) {
    return null;
  }

  const tableIndex = rangeStart + branchIndex;
  const startNode = instance.blueprint.regionBranchNodeStart[tableIndex];
  const endNode = instance.blueprint.regionBranchNodeEnd[tableIndex];

  if (startNode === undefined || endNode === undefined) {
    return null;
  }

  return {
    startNode,
    endNode
  };
}

/**
 * 读取条件 region 当前已挂载的是哪个分支。
 *
 * @description
 * 这里读取的是 mounted branch，而不是 target branch，
 * 因此它描述的是当前真正已经生效的内容。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要查询的条件 region 槽位。
 * @returns 当前挂载的分支索引；没有内容时返回 `null`。
 */
export function getConditionalRegionMountedBranch(
  instance: BlockInstance,
  regionSlot: number
): number | null {
  const mountedBranch = instance.regionMountedBranch[regionSlot];
  if (mountedBranch === undefined || mountedBranch === INVALID_STATE) {
    return null;
  }

  return mountedBranch;
}

/**
 * 判断条件 region 当前是否存在已挂载内容。
 *
 * @description
 * 这是对 `getConditionalRegionMountedBranch` 的布尔语义封装，
 * 方便上层在不关心具体分支索引时直接判断内容存在性。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要查询的条件 region 槽位。
 * @returns 该 region 是否已有挂载分支。
 */
export function hasConditionalRegionMountedContent(
  instance: BlockInstance,
  regionSlot: number
): boolean {
  return getConditionalRegionMountedBranch(instance, regionSlot) !== null;
}

/**
 * 解析条件 region 当前已挂载分支及其节点范围。
 *
 * @description
 * 返回值把 region slot、branch index 和节点范围打包到一个上下文对象里，
 * 便于宿主层一次性拿到挂载内容相关的全部定位信息。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要查询的条件 region 槽位。
 * @returns 已挂载分支上下文；没有内容时返回 `null`。
 */
export function getConditionalRegionMountedRange(
  instance: BlockInstance,
  regionSlot: number
): ConditionalRegionBranchContext | null {
  const mountedBranch = getConditionalRegionMountedBranch(instance, regionSlot);
  if (mountedBranch === null) {
    return null;
  }

  const branchRange = getConditionalRegionBranchRange(instance, regionSlot, mountedBranch);
  if (branchRange === null) {
    return null;
  }

  return {
    regionSlot,
    branchIndex: mountedBranch,
    ...branchRange
  };
}

/**
 * 使用内容级 hooks 挂载条件 region 内容。
 *
 * @description
 * 这是 `attachConditionalRegion` 的内容语义包装层，
 * 用来把 `mountBranchContent` 这种更面向宿主内容的 hook 适配到底层接口。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要挂载的条件 region 槽位。
 * @param branchIndex 要变成 active 的分支索引。
 * @param hooks 委托给宿主层的可选内容钩子。
 * @returns 内容是否挂载成功。
 */
export function mountConditionalRegionContent(
  instance: BlockInstance,
  regionSlot: number,
  branchIndex: number,
  hooks: ConditionalRegionContentHooks = {}
): boolean {
  return hooks.mountBranchContent
    ? attachConditionalRegion(instance, regionSlot, branchIndex, {
      attachBranch: hooks.mountBranchContent
    })
    : attachConditionalRegion(instance, regionSlot, branchIndex);
}

/**
 * 使用内容级 hooks 销毁条件 region 内容。
 *
 * @description
 * 这是 `clearConditionalRegion` 的内容语义包装层，
 * 用来把 `disposeBranchContent` 这种更面向宿主内容的 hook 适配到底层接口。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要清空的条件 region 槽位。
 * @param hooks 委托给宿主层的可选内容钩子。
 * @returns 内容是否销毁成功。
 */
export function disposeConditionalRegionContent(
  instance: BlockInstance,
  regionSlot: number,
  hooks: ConditionalRegionContentHooks = {}
): boolean {
  return hooks.disposeBranchContent
    ? clearConditionalRegion(instance, regionSlot, {
      disposeBranch: hooks.disposeBranchContent
    })
    : clearConditionalRegion(instance, regionSlot);
}

/**
 * 使用内容级 hooks 完成一次待决的条件 region 内容切换。
 *
 * @description
 * 如果没有传内容级 hooks，它会直接走默认切换路径；
 * 否则会先把内容 hooks 适配成底层 `ConditionalRegionHooks` 再提交。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要完成切换的条件 region 槽位。
 * @param hooks 委托给宿主层的可选内容钩子。
 * @returns 内容切换是否成功完成。
 */
export function completeConditionalRegionContentSwitch(
  instance: BlockInstance,
  regionSlot: number,
  hooks: ConditionalRegionContentHooks = {}
): boolean {
  const activeBranch = instance.regionActiveBranch[regionSlot];
  const targetBranch = instance.regionTargetBranch[regionSlot];

  if (
    activeBranch === undefined ||
    activeBranch === INVALID_STATE ||
    targetBranch === undefined ||
    targetBranch === INVALID_STATE
  ) {
    return false;
  }

  if (!hooks.mountBranchContent && !hooks.disposeBranchContent) {
    return completeConditionalRegionSwitchWithHooks(instance, regionSlot, activeBranch, targetBranch);
  }

  const hookInput: ConditionalRegionHooks = {
    ...(hooks.mountBranchContent
      ? { attachBranch: hooks.mountBranchContent }
      : {}),
    ...(hooks.disposeBranchContent
      ? { disposeBranch: hooks.disposeBranchContent }
      : {})
  };

  return completeConditionalRegionSwitchWithHooks(instance, regionSlot, activeBranch, targetBranch, hookInput);
}

/**
 * 挂载一个 region 槽位上配置好的 nested block 元数据。
 *
 * @description
 * nested block region 不直接挂真实实例对象，只记录 block slot 和 blueprint slot，
 * 让外部可以根据这些索引去解析和驱动真正的嵌套 block 生命周期。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要挂载的 nested-block region 槽位。
 * @returns 该 region 是否成功进入 active。
 */
export function attachNestedBlockRegion(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  const blockSlot = instance.blueprint.regionNestedBlockSlot[regionSlot];
  const blueprintSlot = instance.blueprint.regionNestedBlueprintSlot[regionSlot];

  if (lifecycle !== RegionLifecycle.INACTIVE) {
    return false;
  }

  if (
    blockSlot === undefined ||
    blockSlot === INVALID_INDEX ||
    blueprintSlot === undefined ||
    blueprintSlot === INVALID_INDEX
  ) {
    return false;
  }

  instance.regionNestedMountedBlockSlot[regionSlot] = blockSlot;
  instance.regionNestedMountedBlueprintSlot[regionSlot] = blueprintSlot;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 卸载一个 region 槽位当前已挂载的 nested block。
 *
 * @description
 * 这个操作会同时清空 mounted 和 target 相关的 slot，
 * 保证 nested block region 从 active 回到一个干净的 inactive 状态。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要卸载的 nested-block region 槽位。
 * @returns 该 region 是否成功卸载。
 */
export function detachNestedBlockRegion(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.DISPOSING;
  instance.regionNestedMountedBlockSlot[regionSlot] = INVALID_STATE;
  instance.regionNestedMountedBlueprintSlot[regionSlot] = INVALID_STATE;
  instance.regionNestedTargetBlockSlot[regionSlot] = INVALID_STATE;
  instance.regionNestedTargetBlueprintSlot[regionSlot] = INVALID_STATE;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.INACTIVE;
  return true;
}

/**
 * 开始替换一个 region 槽位当前挂载的 nested block。
 *
 * @description
 * 开始阶段只记录 target block / blueprint slot，并把 region 切到 `UPDATING`。
 * 真正的挂载完成语义在 complete 阶段才会生效。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要更新的 nested-block region 槽位。
 * @param nextBlockSlot 下一步要挂载的 block 槽位。
 * @param nextBlueprintSlot 下一步要挂载的 blueprint 槽位。
 * @returns 这次更新迁移是否被接受。
 */
export function beginNestedBlockReplace(
  instance: BlockInstance,
  regionSlot: number,
  nextBlockSlot: number,
  nextBlueprintSlot: number
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  if (nextBlockSlot < 0 || nextBlueprintSlot < 0) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.UPDATING;
  instance.regionNestedTargetBlockSlot[regionSlot] = nextBlockSlot;
  instance.regionNestedTargetBlueprintSlot[regionSlot] = nextBlueprintSlot;
  return true;
}

/**
 * 提交一个 region 槽位待决的 nested block 替换。
 *
 * @description
 * 提交后 target slot 会成为新的 mounted slot，
 * 同时待决字段被清空，region 生命周期回到 `ACTIVE`。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要完成更新的 nested-block region 槽位。
 * @returns 替换是否成功完成。
 */
export function completeNestedBlockReplace(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  const targetBlockSlot = instance.regionNestedTargetBlockSlot[regionSlot];
  const targetBlueprintSlot = instance.regionNestedTargetBlueprintSlot[regionSlot];

  if (lifecycle !== RegionLifecycle.UPDATING) {
    return false;
  }

  if (
    targetBlockSlot === undefined ||
    targetBlockSlot === INVALID_STATE ||
    targetBlueprintSlot === undefined ||
    targetBlueprintSlot === INVALID_STATE
  ) {
    return false;
  }

  instance.regionNestedMountedBlockSlot[regionSlot] = targetBlockSlot;
  instance.regionNestedMountedBlueprintSlot[regionSlot] = targetBlueprintSlot;
  instance.regionNestedTargetBlockSlot[regionSlot] = INVALID_STATE;
  instance.regionNestedTargetBlueprintSlot[regionSlot] = INVALID_STATE;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 取消一个待决的 nested block 替换，并恢复 active 状态。
 *
 * @description
 * 取消不会影响当前已挂载的 nested block，只会丢弃尚未提交的 target slot 信息。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要恢复的 nested-block region 槽位。
 * @returns 待决更新是否成功取消。
 */
export function cancelNestedBlockReplace(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.UPDATING) {
    return false;
  }

  instance.regionNestedTargetBlockSlot[regionSlot] = INVALID_STATE;
  instance.regionNestedTargetBlueprintSlot[regionSlot] = INVALID_STATE;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 读取 nested-block region 当前挂载的 block 槽位和 blueprint 槽位。
 *
 * @description
 * 返回值只表达“当前挂载的是谁”，不会暴露待决 target slot；
 * 因此它适合给已经生效的宿主树或上层调度逻辑做读取。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要查询的 nested-block region 槽位。
 * @returns 当前挂载的 nested block 元数据；没有内容时返回 `null`。
 */
export function getNestedBlockRegionMountedState(
  instance: BlockInstance,
  regionSlot: number
): { blockSlot: number; blueprintSlot: number } | null {
  const blockSlot = instance.regionNestedMountedBlockSlot[regionSlot];
  const blueprintSlot = instance.regionNestedMountedBlueprintSlot[regionSlot];

  if (
    blockSlot === undefined ||
    blockSlot === INVALID_STATE ||
    blueprintSlot === undefined ||
    blueprintSlot === INVALID_STATE
  ) {
    return null;
  }

  return {
    blockSlot,
    blueprintSlot
  };
}

/**
 * 初始化 keyed-list region 的运行时状态。
 *
 * @description
 * 这个阶段只建立 item 数量和 reconcile 游标，不执行任何列表差量动作。
 * 真正的插入、删除和移动描述会在后续 reconcile 阶段写入 payload。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要初始化的 keyed-list region 槽位。
 * @param itemCount 当前列表项数量。
 * @returns 该 region 是否成功进入 active。
 */
export function attachKeyedListRegion(
  instance: BlockInstance,
  regionSlot: number,
  itemCount: number
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.INACTIVE) {
    return false;
  }

  if (itemCount < 0) {
    return false;
  }

  instance.regionKeyedListItemCount[regionSlot] = itemCount;
  instance.regionKeyedListReconcileStart[regionSlot] = 0;
  instance.regionKeyedListReconcileCount[regionSlot] = 0;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 为 keyed-list region 启动一次 reconcile 过程。
 *
 * @description
 * 这个调用会记录本轮差量更新影响的范围，并把插入、删除、移动操作
 * 序列化到平铺 payload 表中，供后续宿主层或上层调和流程消费。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要更新的 keyed-list region 槽位。
 * @param reconcileStart 本轮调和的起始索引。
 * @param reconcileCount 本轮调和覆盖的元素数量。
 * @param payload 描述插入、删除、移动的差量操作列表。
 * @returns 这次 reconcile 是否成功进入 updating。
 */
export function beginKeyedListReconcile(
  instance: BlockInstance,
  regionSlot: number,
  reconcileStart: number,
  reconcileCount: number,
  payload: readonly KeyedListReconcilePayloadItem[] = []
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  if (reconcileStart < 0 || reconcileCount < 0) {
    return false;
  }

  // keyed-list payload 采用按 regionSlot 切片的平铺布局。
  // 当前实现给每个 region 预留固定 8 个操作槽位，超出容量必须由上层拆批。
  const payloadStart = regionSlot * 8;
  const payloadCapacity = instance.regionKeyedListPayloadKind.length - payloadStart;
  if (payload.length > payloadCapacity) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.UPDATING;
  instance.regionKeyedListReconcileStart[regionSlot] = reconcileStart;
  instance.regionKeyedListReconcileCount[regionSlot] = reconcileCount;
  instance.regionKeyedListPayloadStart[regionSlot] = payloadStart;
  instance.regionKeyedListPayloadCount[regionSlot] = payload.length;

  for (let index = 0; index < payload.length; index += 1) {
    const payloadSlot = payloadStart + index;
    const item = payload[index];
    if (!item) {
      return false;
    }

    switch (item.kind) {
      case "insert":
        instance.regionKeyedListPayloadKind[payloadSlot] = 1;
        instance.regionKeyedListPayloadIndex[payloadSlot] = item.index;
        instance.regionKeyedListPayloadToIndex[payloadSlot] = 0;
        break;
      case "remove":
        instance.regionKeyedListPayloadKind[payloadSlot] = 2;
        instance.regionKeyedListPayloadIndex[payloadSlot] = item.index;
        instance.regionKeyedListPayloadToIndex[payloadSlot] = 0;
        break;
      case "move":
        instance.regionKeyedListPayloadKind[payloadSlot] = 3;
        instance.regionKeyedListPayloadIndex[payloadSlot] = item.from;
        instance.regionKeyedListPayloadToIndex[payloadSlot] = item.to;
        break;
    }
  }

  return true;
}

/**
 * 提交 keyed-list region 当前待决的 reconcile 结果。
 *
 * @description
 * 提交时会更新最终 item 数量，并清空本轮 reconcile 区间与 payload，
 * 让 region 回到可接收下一轮调和的 active 状态。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要完成调和的 keyed-list region 槽位。
 * @param nextItemCount 调和完成后的列表项数量。
 * @returns 调和是否成功完成。
 */
export function completeKeyedListReconcile(
  instance: BlockInstance,
  regionSlot: number,
  nextItemCount: number
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.UPDATING) {
    return false;
  }

  if (nextItemCount < 0) {
    return false;
  }

  instance.regionKeyedListItemCount[regionSlot] = nextItemCount;
  instance.regionKeyedListReconcileStart[regionSlot] = 0;
  instance.regionKeyedListReconcileCount[regionSlot] = 0;
  clearKeyedListPayload(instance, regionSlot);
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 取消 keyed-list region 当前待决的 reconcile。
 *
 * @description
 * 取消不会回滚已经发生的宿主副作用；它只负责清理运行时里尚未提交的
 * reconcile 元数据和 payload 缓冲区。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要取消调和的 keyed-list region 槽位。
 * @returns 待决 reconcile 是否成功取消。
 */
export function cancelKeyedListReconcile(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.UPDATING) {
    return false;
  }

  instance.regionKeyedListReconcileStart[regionSlot] = 0;
  instance.regionKeyedListReconcileCount[regionSlot] = 0;
  clearKeyedListPayload(instance, regionSlot);
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 清空 keyed-list region 的当前运行时状态。
 *
 * @description
 * 这个操作会把列表项数量、调和区间和 payload 一并重置，
 * 适合在整个 keyed-list region 被卸载时调用。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要清空的 keyed-list region 槽位。
 * @returns 该 region 是否成功回到 inactive。
 */
export function clearKeyedListRegion(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.DISPOSING;
  instance.regionKeyedListItemCount[regionSlot] = 0;
  instance.regionKeyedListReconcileStart[regionSlot] = 0;
  instance.regionKeyedListReconcileCount[regionSlot] = 0;
  clearKeyedListPayload(instance, regionSlot);
  instance.regionLifecycle[regionSlot] = RegionLifecycle.INACTIVE;
  return true;
}

/**
 * 读取 keyed-list region 当前保存的调和状态摘要。
 *
 * @description
 * 返回值只包含 item 数量、reconcile 区间和 payload 数量，
 * 不会把完整 payload 内容反序列化出来。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要查询的 keyed-list region 槽位。
 * @returns keyed-list region 的当前状态摘要。
 */
export function getKeyedListRegionState(
  instance: BlockInstance,
  regionSlot: number
): { itemCount: number; reconcileStart: number; reconcileCount: number; payloadCount: number } {
  return {
    itemCount: instance.regionKeyedListItemCount[regionSlot] ?? 0,
    reconcileStart: instance.regionKeyedListReconcileStart[regionSlot] ?? 0,
    reconcileCount: instance.regionKeyedListReconcileCount[regionSlot] ?? 0,
    payloadCount: instance.regionKeyedListPayloadCount[regionSlot] ?? 0
  };
}

/**
 * 反序列化 keyed-list region 当前记录的 reconcile payload。
 *
 * @description
 * 运行时内部把 payload 存在平铺 typed-array 结构里，
 * 这个函数负责把它还原成更容易被上层消费的对象数组。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要读取 payload 的 keyed-list region 槽位。
 * @returns 反序列化后的 reconcile 操作列表。
 */
export function getKeyedListReconcilePayload(
  instance: BlockInstance,
  regionSlot: number
): KeyedListReconcilePayloadItem[] {
  const start = instance.regionKeyedListPayloadStart[regionSlot] ?? 0;
  const count = instance.regionKeyedListPayloadCount[regionSlot] ?? 0;
  const payload: KeyedListReconcilePayloadItem[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const slot = start + offset;
    const kind = instance.regionKeyedListPayloadKind[slot];
    const index = instance.regionKeyedListPayloadIndex[slot] ?? 0;
    const toIndex = instance.regionKeyedListPayloadToIndex[slot] ?? 0;

    switch (kind) {
      case 1:
        payload.push({ kind: "insert", index });
        break;
      case 2:
        payload.push({ kind: "remove", index });
        break;
      case 3:
        payload.push({ kind: "move", from: index, to: toIndex });
        break;
    }
  }

  return payload;
}

/**
 * 初始化 virtual-list region 的运行时窗口状态。
 *
 * @description
 * 初始化阶段会同时记录总 item 数和当前可见窗口区间，
 * 但不会写入 target window，因为此时还没有待决更新。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要初始化的 virtual-list region 槽位。
 * @param itemCount 当前列表总项数。
 * @param windowStart 当前窗口起点。
 * @param windowEnd 当前窗口终点。
 * @returns 该 region 是否成功进入 active。
 */
export function attachVirtualListRegion(
  instance: BlockInstance,
  regionSlot: number,
  itemCount: number,
  windowStart: number,
  windowEnd: number
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.INACTIVE) {
    return false;
  }

  if (!isValidVirtualListWindow(itemCount, windowStart, windowEnd)) {
    return false;
  }

  instance.regionVirtualListItemCount[regionSlot] = itemCount;
  instance.regionVirtualListWindowStart[regionSlot] = windowStart;
  instance.regionVirtualListWindowEnd[regionSlot] = windowEnd;
  instance.regionVirtualListTargetWindowStart[regionSlot] = INVALID_INDEX;
  instance.regionVirtualListTargetWindowEnd[regionSlot] = INVALID_INDEX;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 为 virtual-list region 启动一次窗口更新。
 *
 * @description
 * 更新开始后，当前窗口仍然保留在 mounted 状态，
 * 目标窗口则暂存在 target 字段里，等待后续提交或取消。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要更新的 virtual-list region 槽位。
 * @param itemCount 更新后的总项数。
 * @param windowStart 目标窗口起点。
 * @param windowEnd 目标窗口终点。
 * @returns 这次窗口更新是否成功进入 updating。
 */
export function beginVirtualListWindowUpdate(
  instance: BlockInstance,
  regionSlot: number,
  itemCount: number,
  windowStart: number,
  windowEnd: number
): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  if (!isValidVirtualListWindow(itemCount, windowStart, windowEnd)) {
    return false;
  }

  const currentItemCount = instance.regionVirtualListItemCount[regionSlot] ?? 0;
  const currentStart = instance.regionVirtualListWindowStart[regionSlot] ?? 0;
  const currentEnd = instance.regionVirtualListWindowEnd[regionSlot] ?? 0;
  if (currentItemCount === itemCount && currentStart === windowStart && currentEnd === windowEnd) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.UPDATING;
  instance.regionVirtualListItemCount[regionSlot] = itemCount;
  instance.regionVirtualListTargetWindowStart[regionSlot] = windowStart;
  instance.regionVirtualListTargetWindowEnd[regionSlot] = windowEnd;
  return true;
}

/**
 * 提交 virtual-list region 当前待决的窗口更新。
 *
 * @description
 * 提交后，target window 会覆盖当前窗口并被清空，
 * region 生命周期也会从 updating 回到 active。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要完成更新的 virtual-list region 槽位。
 * @returns 窗口更新是否成功完成。
 */
export function completeVirtualListWindowUpdate(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  const targetStart = instance.regionVirtualListTargetWindowStart[regionSlot];
  const targetEnd = instance.regionVirtualListTargetWindowEnd[regionSlot];

  if (lifecycle !== RegionLifecycle.UPDATING) {
    return false;
  }

  if (
    targetStart === undefined ||
    targetEnd === undefined ||
    targetStart === INVALID_INDEX ||
    targetEnd === INVALID_INDEX
  ) {
    return false;
  }

  instance.regionVirtualListWindowStart[regionSlot] = targetStart;
  instance.regionVirtualListWindowEnd[regionSlot] = targetEnd;
  instance.regionVirtualListTargetWindowStart[regionSlot] = INVALID_INDEX;
  instance.regionVirtualListTargetWindowEnd[regionSlot] = INVALID_INDEX;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 取消 virtual-list region 当前待决的窗口更新。
 *
 * @description
 * 取消只会丢弃 target window，不会回滚当前已经生效的窗口状态。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要取消更新的 virtual-list region 槽位。
 * @returns 待决窗口更新是否成功取消。
 */
export function cancelVirtualListWindowUpdate(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.UPDATING) {
    return false;
  }

  instance.regionVirtualListTargetWindowStart[regionSlot] = INVALID_INDEX;
  instance.regionVirtualListTargetWindowEnd[regionSlot] = INVALID_INDEX;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

/**
 * 清空 virtual-list region 的当前运行时状态。
 *
 * @description
 * 这个操作会同时重置 item 数、当前窗口和 target window，
 * 适合在整个 virtual-list region 被卸载时调用。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要清空的 virtual-list region 槽位。
 * @returns 该 region 是否成功回到 inactive。
 */
export function clearVirtualListRegion(instance: BlockInstance, regionSlot: number): boolean {
  const lifecycle = instance.regionLifecycle[regionSlot];
  if (lifecycle !== RegionLifecycle.ACTIVE) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.DISPOSING;
  instance.regionVirtualListItemCount[regionSlot] = 0;
  instance.regionVirtualListWindowStart[regionSlot] = 0;
  instance.regionVirtualListWindowEnd[regionSlot] = 0;
  instance.regionVirtualListTargetWindowStart[regionSlot] = INVALID_INDEX;
  instance.regionVirtualListTargetWindowEnd[regionSlot] = INVALID_INDEX;
  instance.regionLifecycle[regionSlot] = RegionLifecycle.INACTIVE;
  return true;
}

/**
 * 读取 virtual-list region 当前保存的窗口状态。
 *
 * @description
 * 返回值会把 `INVALID_INDEX` 规范化成 `null`，
 * 方便上层直接判断当前是否存在待决 target window。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要查询的 virtual-list region 槽位。
 * @returns 当前窗口与目标窗口状态。
 */
export function getVirtualListRegionState(
  instance: BlockInstance,
  regionSlot: number
): VirtualListRegionState {
  const targetStart = instance.regionVirtualListTargetWindowStart[regionSlot] ?? INVALID_INDEX;
  const targetEnd = instance.regionVirtualListTargetWindowEnd[regionSlot] ?? INVALID_INDEX;

  return {
    itemCount: instance.regionVirtualListItemCount[regionSlot] ?? 0,
    windowStart: instance.regionVirtualListWindowStart[regionSlot] ?? 0,
    windowEnd: instance.regionVirtualListWindowEnd[regionSlot] ?? 0,
    targetWindowStart: targetStart === INVALID_INDEX ? null : targetStart,
    targetWindowEnd: targetEnd === INVALID_INDEX ? null : targetEnd
  };
}

/**
 * 清空 keyed-list region 当前记录的 payload 切片。
 *
 * @description
 * payload 数据按 region slot 平铺存储，这个 helper 只会擦除当前 region
 * 实际占用的那一小段区间，并同步把 start/count 元数据重置。
 *
 * @param instance 持有该 region 槽位的 block 实例。
 * @param regionSlot 要清理 payload 的 keyed-list region 槽位。
 */
function clearKeyedListPayload(instance: BlockInstance, regionSlot: number): void {
  const start = instance.regionKeyedListPayloadStart[regionSlot] ?? 0;
  const count = instance.regionKeyedListPayloadCount[regionSlot] ?? 0;

  // 只清理当前 region 记录过的 payload 切片，避免误伤相邻 region 的平铺数据。
  for (let offset = 0; offset < count; offset += 1) {
    const slot = start + offset;
    if (slot >= instance.regionKeyedListPayloadKind.length) {
      continue;
    }

    instance.regionKeyedListPayloadKind[slot] = 0;
    instance.regionKeyedListPayloadIndex[slot] = 0;
    instance.regionKeyedListPayloadToIndex[slot] = 0;
  }

  instance.regionKeyedListPayloadStart[regionSlot] = 0;
  instance.regionKeyedListPayloadCount[regionSlot] = 0;
}

/**
 * 校验 virtual-list 窗口区间是否满足基本边界约束。
 *
 * @description
 * 合法窗口必须满足非负、`end >= start`，并且终点不能越过总 item 数。
 *
 * @param itemCount 列表总项数。
 * @param windowStart 窗口起点。
 * @param windowEnd 窗口终点。
 * @returns 这组窗口参数是否有效。
 */
function isValidVirtualListWindow(
  itemCount: number,
  windowStart: number,
  windowEnd: number
): boolean {
  return itemCount >= 0 &&
    windowStart >= 0 &&
    windowEnd >= windowStart &&
    windowEnd <= itemCount;
}
