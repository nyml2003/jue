import { RegionLifecycle } from "@jue/shared";

import type { BlockInstance, Blueprint, HostNode } from "./types";

export interface CreateBlockInstanceOptions {
  readonly signalCount?: number;
  readonly nodes?: HostNode[];
}

export function createBlockInstance(
  blueprint: Blueprint,
  options: CreateBlockInstanceOptions = {}
): BlockInstance {
  const signalCount = options.signalCount ?? 0;
  const nodes = options.nodes ?? [];
  const regionLifecycle = new Uint8Array(blueprint.regionCount);

  regionLifecycle.fill(RegionLifecycle.UNINITIALIZED);

  return {
    blueprint,
    nodes,
    signalValues: new Array<unknown>(signalCount).fill(null),
    regionLifecycle,
    dirtyBindingBits: new Uint32Array(Math.ceil(blueprint.bindingCount / 32))
  };
}
