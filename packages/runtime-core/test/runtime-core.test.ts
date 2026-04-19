import { BindingOpcode, Lane, RegionType } from "@jue/shared";
import { describe, expect, it } from "vitest";

import {
  clearDirty,
  createBlockInstance,
  createBlueprint,
  createDirtyBitset,
  createSchedulerState,
  enqueueSchedulerSlot,
  isDirty,
  markDirty,
  resetSchedulerQueues
} from "../src/index";

describe("@jue/runtime-core", () => {
  it("creates a validated blueprint", () => {
    const result = createBlueprint({
      nodeCount: 2,
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT]),
      bindingNodeIndex: new Uint32Array([1]),
      bindingDataIndex: new Uint32Array([0]),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([0]),
      regionAnchorEnd: new Uint32Array([1])
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.bindingCount).toBe(1);
      expect(result.value.regionCount).toBe(1);
    }
  });

  it("marks and clears dirty bits", () => {
    const bitset = createDirtyBitset(64);

    expect(markDirty(bitset, 5)).toEqual({
      ok: true,
      value: true,
      error: null
    });
    expect(markDirty(bitset, 5)).toEqual({
      ok: true,
      value: false,
      error: null
    });
    expect(isDirty(bitset, 5)).toEqual({
      ok: true,
      value: true,
      error: null
    });

    expect(clearDirty(bitset, 5)).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    expect(isDirty(bitset, 5)).toEqual({
      ok: true,
      value: false,
      error: null
    });
  });

  it("creates scheduler queues by lane", () => {
    const state = createSchedulerState();

    enqueueSchedulerSlot(state, Lane.VISIBLE_UPDATE, "binding", 12);
    enqueueSchedulerSlot(state, Lane.VISIBLE_UPDATE, "binding", 13);
    enqueueSchedulerSlot(state, Lane.DEFERRED, "region", 3);

    expect(state.bindingQueueData).toEqual([12, 13]);
    expect(state.dirtyBindingQueueStart[Lane.VISIBLE_UPDATE]).toBe(0);
    expect(state.dirtyBindingQueueCount[Lane.VISIBLE_UPDATE]).toBe(2);
    expect(state.regionQueueData).toEqual([3]);
    expect(state.dirtyRegionQueueCount[Lane.DEFERRED]).toBe(1);

    resetSchedulerQueues(state);
    expect(state.bindingQueueData).toEqual([]);
    expect(state.regionQueueData).toEqual([]);
    expect(state.scheduledLanes).toBe(0);
  });

  it("creates a block instance from a blueprint", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT, BindingOpcode.PROP]),
      bindingNodeIndex: new Uint32Array([0xffffffff, 0xffffffff]),
      bindingDataIndex: new Uint32Array([0, 1]),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([0xffffffff]),
      regionAnchorEnd: new Uint32Array([0xffffffff])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 3
    });

    expect(instance.signalValues).toHaveLength(3);
    expect(instance.regionLifecycle).toHaveLength(1);
    expect(instance.dirtyBindingBits).toHaveLength(1);
  });
});
