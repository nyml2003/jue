import { RegionLifecycle } from "@jue/shared";

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

export function createBlockInstance(
  blueprint: Blueprint,
  options: CreateBlockInstanceOptions = {}
): BlockInstance {
  const signalCount = options.signalCount ?? 0;
  const resourceCount = options.resourceCount ?? 0;
  const nodes = options.nodes ?? [];
  const regionLifecycle = new Uint8Array(blueprint.regionCount);
  const signalState = createSignalState(signalCount);
  const resourceState = createResourceState(resourceCount);

  regionLifecycle.fill(RegionLifecycle.UNINITIALIZED);

  return {
    blueprint,
    nodes,
    signalValues: signalState.values,
    signalVersion: signalState.version,
    signalFlags: signalState.flags,
    regionLifecycle,
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
