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

export function createBlockInstance(
  blueprint: Blueprint,
  options: CreateBlockInstanceOptions = {}
): BlockInstance {
  const signalCount = options.signalCount ?? 0;
  const resourceCount = options.resourceCount ?? 0;
  const nodes = options.nodes ?? [];
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
    resourceStatus: resourceState.status,
    resourceLaneState: resourceState.laneState,
    resourceVersion: resourceState.version,
    resourcePendingCount: resourceState.pendingCount,
    resourceValueRef: resourceState.valueRef,
    resourceErrorRef: resourceState.errorRef,
    dirtyBindingBits: new Uint32Array(Math.ceil(blueprint.bindingCount / 32))
  };
}

export function getSignalState(instance: BlockInstance): SignalState {
  return {
    values: instance.signalValues,
    version: instance.signalVersion,
    flags: instance.signalFlags
  };
}

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

export function getBindingDirtyBitset(instance: BlockInstance): DirtyBitset {
  return createDirtyBitsetView(instance.blueprint.bindingCount, instance.dirtyBindingBits);
}

export function initializeRegionSlot(instance: BlockInstance, regionSlot: number): boolean {
  const current = instance.regionLifecycle[regionSlot];
  if (current === undefined) {
    return false;
  }

  if (current !== RegionLifecycle.UNINITIALIZED) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.INACTIVE;
  return true;
}

export function activateRegionSlot(instance: BlockInstance, regionSlot: number): boolean {
  const current = instance.regionLifecycle[regionSlot];
  if (current === undefined) {
    return false;
  }

  if (current !== RegionLifecycle.INACTIVE) {
    return false;
  }

  instance.regionLifecycle[regionSlot] = RegionLifecycle.ACTIVE;
  return true;
}

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

export function hasConditionalRegionMountedContent(
  instance: BlockInstance,
  regionSlot: number
): boolean {
  return getConditionalRegionMountedBranch(instance, regionSlot) !== null;
}

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

  instance.regionLifecycle[regionSlot] = RegionLifecycle.UPDATING;
  instance.regionKeyedListReconcileStart[regionSlot] = reconcileStart;
  instance.regionKeyedListReconcileCount[regionSlot] = reconcileCount;
  instance.regionKeyedListPayloadStart[regionSlot] = regionSlot * 8;
  instance.regionKeyedListPayloadCount[regionSlot] = payload.length;

  for (let index = 0; index < payload.length; index += 1) {
    const payloadSlot = regionSlot * 8 + index;
    const item = payload[index];
    if (!item || payloadSlot >= instance.regionKeyedListPayloadKind.length) {
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

function clearKeyedListPayload(instance: BlockInstance, regionSlot: number): void {
  const start = instance.regionKeyedListPayloadStart[regionSlot] ?? 0;
  const count = instance.regionKeyedListPayloadCount[regionSlot] ?? 0;

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
