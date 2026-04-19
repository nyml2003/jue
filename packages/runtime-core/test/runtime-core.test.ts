import { BindingOpcode, Lane, RegionLifecycle, RegionType, ResourceStatus } from "@jue/shared";
import { describe, expect, it } from "vitest";

import {
  beginResourceRequest,
  beginSchedulerFlush,
  commitResourceValue,
  clearDirty,
  createBlockInstance,
  createBlueprint,
  createDirtyBitset,
  createResourceState,
  createSchedulerState,
  createSignalState,
  enqueueSchedulerSlot,
  enqueueUniqueSchedulerSlot,
  isDirty,
  markDirty,
  readSignal,
  resetSchedulerQueues,
  scheduleSignalWrite,
  writeSignal
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
      expect(result.value.bindingArgU32).toEqual(new Uint32Array(0));
      expect(result.value.bindingArgRef).toEqual([]);
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

  it("deduplicates scheduler slots through dirty bits", () => {
    const state = createSchedulerState();
    const dirty = createDirtyBitset(16);

    expect(enqueueUniqueSchedulerSlot(state, dirty, Lane.VISIBLE_UPDATE, "binding", 4)).toEqual({
      ok: true,
      value: true,
      error: null
    });
    expect(enqueueUniqueSchedulerSlot(state, dirty, Lane.VISIBLE_UPDATE, "binding", 4)).toEqual({
      ok: true,
      value: false,
      error: null
    });
    expect(state.bindingQueueData).toEqual([4]);

    expect(beginSchedulerFlush(state)).toEqual({
      ok: true,
      value: 1,
      error: null
    });
  });

  it("reads and writes signal state with version tracking", () => {
    const state = createSignalState(2);

    expect(readSignal(state, 0)).toEqual({
      ok: true,
      value: null,
      error: null
    });
    expect(writeSignal(state, 0, "next")).toEqual({
      ok: true,
      value: true,
      error: null
    });
    expect(readSignal(state, 0)).toEqual({
      ok: true,
      value: "next",
      error: null
    });
    expect(state.version[0]).toBe(1);
  });

  it("tracks resource versions and commits values", () => {
    const state = createResourceState(1);
    const begin = beginResourceRequest(state, 0, Lane.VISIBLE_UPDATE);

    expect(begin.ok).toBe(true);
    if (!begin.ok) {
      return;
    }

    expect(state.status[0]).toBe(ResourceStatus.PENDING);
    expect(commitResourceValue(state, 0, begin.value, { id: 1 })).toEqual({
      ok: true,
      value: true,
      error: null
    });
    expect(state.status[0]).toBe(ResourceStatus.READY);
    expect(state.valueRef[0]).toEqual({ id: 1 });
  });

  it("schedules binding slots from signal dependencies", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.TEXT, BindingOpcode.PROP, BindingOpcode.STYLE]),
      bindingNodeIndex: new Uint32Array([0, 0, 0]),
      bindingDataIndex: new Uint32Array([0, 1, 2]),
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0),
      signalToBindingStart: new Uint32Array([0, 2]),
      signalToBindingCount: new Uint32Array([2, 1]),
      signalToBindings: new Uint32Array([0, 2, 1])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value, {
      signalCount: 2
    });
    const scheduler = createSchedulerState();

    expect(scheduleSignalWrite(instance, scheduler, Lane.VISIBLE_UPDATE, 0, "hello")).toEqual({
      ok: true,
      value: {
        changed: true,
        enqueuedBindingCount: 2
      },
      error: null
    });
    expect(scheduler.bindingQueueData).toEqual([0, 2]);

    expect(scheduleSignalWrite(instance, scheduler, Lane.VISIBLE_UPDATE, 0, "world")).toEqual({
      ok: true,
      value: {
        changed: true,
        enqueuedBindingCount: 0
      },
      error: null
    });
    expect(scheduler.bindingQueueData).toEqual([0, 2]);

    expect(scheduleSignalWrite(instance, scheduler, Lane.DEFERRED, 1, 9)).toEqual({
      ok: true,
      value: {
        changed: true,
        enqueuedBindingCount: 1
      },
      error: null
    });
    expect(scheduler.bindingQueueData).toEqual([0, 2, 1]);
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
      signalCount: 3,
      resourceCount: 2
    });

    expect(instance.signalValues).toHaveLength(3);
    expect(instance.signalVersion).toHaveLength(3);
    expect(instance.regionLifecycle).toHaveLength(1);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.UNINITIALIZED);
    expect(instance.resourceStatus).toHaveLength(2);
    expect(instance.dirtyBindingBits).toHaveLength(1);
  });

  it("stores binding argument tables for prop-like bindings", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 1,
      bindingOpcode: new Uint8Array([BindingOpcode.PROP]),
      bindingNodeIndex: new Uint32Array([0]),
      bindingDataIndex: new Uint32Array([0]),
      bindingArgU32: new Uint32Array([0, 0]),
      bindingArgRef: ["title"],
      regionType: new Uint8Array(0),
      regionAnchorStart: new Uint32Array(0),
      regionAnchorEnd: new Uint32Array(0),
      signalToBindingStart: new Uint32Array([0]),
      signalToBindingCount: new Uint32Array([1]),
      signalToBindings: new Uint32Array([0])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    expect(blueprintResult.value.bindingArgU32).toEqual(new Uint32Array([0, 0]));
    expect(blueprintResult.value.bindingArgRef).toEqual(["title"]);
  });
});
