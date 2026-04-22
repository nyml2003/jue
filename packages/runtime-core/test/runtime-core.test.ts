import { BindingOpcode, INVALID_INDEX, Lane, RegionLifecycle, RegionType, ResourceStatus } from "@jue/shared";
import { describe, expect, it } from "vitest";

import {
  attachConditionalRegion,
  attachKeyedListRegion,
  attachNestedBlockRegion,
  attachVirtualListRegion,
  activateRegionSlot,
  beginConditionalRegionSwitch,
  beginKeyedListReconcile,
  beginNestedBlockReplace,
  beginVirtualListWindowUpdate,
  beginResourceRequest,
  beginSchedulerFlush,
  clearConditionalRegion,
  clearKeyedListRegion,
  clearVirtualListRegion,
  completeConditionalRegionContentSwitch,
  completeConditionalRegionSwitchWithHooks,
  completeConditionalRegionSwitch,
  completeKeyedListReconcile,
  completeNestedBlockReplace,
  completeVirtualListWindowUpdate,
  commitResourceError,
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
  getConditionalRegionBranchRange,
  getConditionalRegionMountedBranch,
  getConditionalRegionMountedRange,
  getKeyedListReconcilePayload,
  getKeyedListRegionState,
  getNestedBlockRegionMountedState,
  getVirtualListRegionState,
  hasConditionalRegionMountedContent,
  initializeRegionSlot,
  isDirty,
  markDirty,
  mountConditionalRegionContent,
  detachNestedBlockRegion,
  disposeConditionalRegionContent,
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

  it("commits resource errors and rejects stale or out-of-range resource operations", () => {
    const state = createResourceState(1);

    expect(beginResourceRequest(state, 4, Lane.VISIBLE_UPDATE)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "RESOURCE_SLOT_OUT_OF_RANGE",
        message: "Resource slot 4 is out of range for size 1."
      }
    });

    const begin = beginResourceRequest(state, 0, Lane.VISIBLE_UPDATE);
    expect(begin.ok).toBe(true);
    if (!begin.ok) {
      return;
    }

    expect(commitResourceValue(state, 0, begin.value + 1, { stale: true })).toEqual({
      ok: false,
      value: null,
      error: {
        code: "STALE_RESOURCE_VERSION",
        message: `Resource slot 0 expected version ${begin.value}, got ${begin.value + 1}.`
      }
    });

    expect(commitResourceError(state, 0, begin.value, new Error("boom"))).toEqual({
      ok: true,
      value: true,
      error: null
    });
    expect(state.status[0]).toBe(ResourceStatus.ERROR);
    expect(state.errorRef[0]).toBeInstanceOf(Error);
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

  it("initializes and activates a region slot through the runtime lifecycle helpers", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);

    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.INACTIVE);
    expect(activateRegionSlot(instance, 0)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.ACTIVE);
  });

  it("attaches and clears a conditional region branch", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([2]),
      regionBranchNodeStart: new Uint32Array([3, 7]),
      regionBranchNodeEnd: new Uint32Array([5, 9])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);

    expect(attachConditionalRegion(instance, 0, 1)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.ACTIVE);
    expect(instance.regionActiveBranch[0]).toBe(1);
    expect(getConditionalRegionMountedBranch(instance, 0)).toBe(1);
    expect(hasConditionalRegionMountedContent(instance, 0)).toBe(true);
    expect(getConditionalRegionMountedRange(instance, 0)).toEqual({
      regionSlot: 0,
      branchIndex: 1,
      startNode: 7,
      endNode: 9
    });
    expect(getConditionalRegionBranchRange(instance, 0, 0)).toEqual({
      startNode: 3,
      endNode: 5
    });
    expect(getConditionalRegionBranchRange(instance, 0, 1)).toEqual({
      startNode: 7,
      endNode: 9
    });

    expect(clearConditionalRegion(instance, 0)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.INACTIVE);
    expect(instance.regionActiveBranch[0]).toBe(-1);
    expect(getConditionalRegionMountedBranch(instance, 0)).toBeNull();
    expect(hasConditionalRegionMountedContent(instance, 0)).toBe(false);
    expect(getConditionalRegionMountedRange(instance, 0)).toBeNull();
  });

  it("mounts and disposes conditional region content through content hooks", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([2]),
      regionBranchNodeStart: new Uint32Array([3, 7]),
      regionBranchNodeEnd: new Uint32Array([5, 9])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    const calls: string[] = [];

    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(mountConditionalRegionContent(instance, 0, 0, {
      mountBranchContent(context) {
        calls.push(`mount:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      }
    })).toBe(true);
    expect(disposeConditionalRegionContent(instance, 0, {
      disposeBranchContent(context) {
        calls.push(`dispose:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      }
    })).toBe(true);

    expect(calls).toEqual(["mount:0:3-5", "dispose:0:3-5"]);
  });

  it("calls conditional region attach and dispose hooks", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([2]),
      regionBranchNodeStart: new Uint32Array([3, 7]),
      regionBranchNodeEnd: new Uint32Array([5, 9])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    const calls: string[] = [];

    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(attachConditionalRegion(instance, 0, 1, {
      attachBranch(context) {
        calls.push(`attach:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      }
    })).toBe(true);

    expect(clearConditionalRegion(instance, 0, {
      disposeBranch(context) {
        calls.push(`dispose:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      }
    })).toBe(true);

    expect(calls).toEqual(["attach:1:7-9", "dispose:1:7-9"]);
  });

  it("switches a conditional region branch through updating back to active", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([2]),
      regionBranchNodeStart: new Uint32Array([3, 7]),
      regionBranchNodeEnd: new Uint32Array([5, 9])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(attachConditionalRegion(instance, 0, 0)).toBe(true);

    expect(beginConditionalRegionSwitch(instance, 0, 1)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.UPDATING);
    expect(instance.regionActiveBranch[0]).toBe(0);
    expect(instance.regionTargetBranch[0]).toBe(1);

    expect(completeConditionalRegionSwitch(instance, 0)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.ACTIVE);
    expect(instance.regionActiveBranch[0]).toBe(1);
    expect(instance.regionTargetBranch[0]).toBe(-1);
    expect(getConditionalRegionMountedBranch(instance, 0)).toBe(1);
  });

  it("switches a conditional region branch through dispose and attach hooks", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([3]),
      regionBranchNodeStart: new Uint32Array([3, 7, 11]),
      regionBranchNodeEnd: new Uint32Array([5, 9, 13])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    const calls: string[] = [];

    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(attachConditionalRegion(instance, 0, 0)).toBe(true);
    expect(beginConditionalRegionSwitch(instance, 0, 2)).toBe(true);

    expect(completeConditionalRegionSwitchWithHooks(instance, 0, 0, 2, {
      disposeBranch(context) {
        calls.push(`dispose:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      },
      attachBranch(context) {
        calls.push(`attach:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      }
    })).toBe(true);

    expect(calls).toEqual(["dispose:0:3-5", "attach:2:11-13"]);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.ACTIVE);
    expect(instance.regionActiveBranch[0]).toBe(2);
    expect(instance.regionTargetBranch[0]).toBe(-1);
    expect(getConditionalRegionMountedBranch(instance, 0)).toBe(2);
  });

  it("switches conditional region content through the content hook surface", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([2]),
      regionBranchNodeStart: new Uint32Array([3, 7]),
      regionBranchNodeEnd: new Uint32Array([5, 9])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    const calls: string[] = [];

    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(mountConditionalRegionContent(instance, 0, 0)).toBe(true);
    expect(beginConditionalRegionSwitch(instance, 0, 1)).toBe(true);

    expect(completeConditionalRegionContentSwitch(instance, 0, {
      disposeBranchContent(context) {
        calls.push(`dispose:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      },
      mountBranchContent(context) {
        calls.push(`mount:${context.branchIndex}:${context.startNode}-${context.endNode}`);
        return true;
      }
    })).toBe(true);

    expect(calls).toEqual(["dispose:0:3-5", "mount:1:7-9"]);
    expect(getConditionalRegionMountedBranch(instance, 0)).toBe(1);
  });

  it("refuses invalid conditional region switch transitions", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([3]),
      regionBranchNodeStart: new Uint32Array([3, 7, 11]),
      regionBranchNodeEnd: new Uint32Array([5, 9, 13])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(attachConditionalRegion(instance, 0, 2)).toBe(true);

    expect(beginConditionalRegionSwitch(instance, 0, 2)).toBe(false);
    expect(completeConditionalRegionSwitch(instance, 0)).toBe(false);

    expect(clearConditionalRegion(instance, 0)).toBe(true);
    expect(beginConditionalRegionSwitch(instance, 0, 1)).toBe(false);
  });

  it("rolls back conditional region switch state when hooks fail", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.CONDITIONAL]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionBranchRangeStart: new Uint32Array([0]),
      regionBranchRangeCount: new Uint32Array([5]),
      regionBranchNodeStart: new Uint32Array([3, 7, 11, 15, 19]),
      regionBranchNodeEnd: new Uint32Array([5, 9, 13, 17, 21])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(attachConditionalRegion(instance, 0, 3)).toBe(true);
    expect(beginConditionalRegionSwitch(instance, 0, 4)).toBe(true);

    expect(completeConditionalRegionSwitchWithHooks(instance, 0, 3, 4, {
      disposeBranch() {
        return false;
      }
    })).toBe(false);

    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.ACTIVE);
    expect(instance.regionActiveBranch[0]).toBe(3);
    expect(instance.regionTargetBranch[0]).toBe(-1);
    expect(getConditionalRegionMountedBranch(instance, 0)).toBe(3);
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

  it("attaches, replaces and detaches a nested block region", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.NESTED_BLOCK]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX]),
      regionNestedBlockSlot: new Uint32Array([7]),
      regionNestedBlueprintSlot: new Uint32Array([11]),
      regionNestedMountMode: new Uint8Array([0])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);

    expect(attachNestedBlockRegion(instance, 0)).toBe(true);
    expect(getNestedBlockRegionMountedState(instance, 0)).toEqual({
      blockSlot: 7,
      blueprintSlot: 11
    });

    expect(beginNestedBlockReplace(instance, 0, 13, 17)).toBe(true);
    expect(completeNestedBlockReplace(instance, 0)).toBe(true);
    expect(getNestedBlockRegionMountedState(instance, 0)).toEqual({
      blockSlot: 13,
      blueprintSlot: 17
    });

    expect(detachNestedBlockRegion(instance, 0)).toBe(true);
    expect(getNestedBlockRegionMountedState(instance, 0)).toBeNull();
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.INACTIVE);
  });

  it("attaches, reconciles and clears a keyed list region", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.KEYED_LIST]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);

    expect(attachKeyedListRegion(instance, 0, 4)).toBe(true);
    expect(getKeyedListRegionState(instance, 0)).toEqual({
      itemCount: 4,
      reconcileStart: 0,
      reconcileCount: 0,
      payloadCount: 0
    });

    expect(beginKeyedListReconcile(instance, 0, 1, 2, [
      { kind: "remove", index: 1 },
      { kind: "insert", index: 2 },
      { kind: "move", from: 3, to: 0 }
    ])).toBe(true);
    expect(getKeyedListRegionState(instance, 0)).toEqual({
      itemCount: 4,
      reconcileStart: 1,
      reconcileCount: 2,
      payloadCount: 3
    });
    expect(getKeyedListReconcilePayload(instance, 0)).toEqual([
      { kind: "remove", index: 1 },
      { kind: "insert", index: 2 },
      { kind: "move", from: 3, to: 0 }
    ]);

    expect(completeKeyedListReconcile(instance, 0, 5)).toBe(true);
    expect(getKeyedListRegionState(instance, 0)).toEqual({
      itemCount: 5,
      reconcileStart: 0,
      reconcileCount: 0,
      payloadCount: 0
    });
    expect(getKeyedListReconcilePayload(instance, 0)).toEqual([]);

    expect(clearKeyedListRegion(instance, 0)).toBe(true);
    expect(getKeyedListRegionState(instance, 0)).toEqual({
      itemCount: 0,
      reconcileStart: 0,
      reconcileCount: 0,
      payloadCount: 0
    });
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.INACTIVE);
  });

  it("rejects keyed list reconcile payload overflow without entering updating state", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.KEYED_LIST]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);
    expect(attachKeyedListRegion(instance, 0, 1)).toBe(true);

    const payload = Array.from({ length: 9 }, (_, index) => ({
      kind: "insert" as const,
      index
    }));

    expect(beginKeyedListReconcile(instance, 0, 0, payload.length, payload)).toBe(false);
    expect(getKeyedListRegionState(instance, 0)).toEqual({
      itemCount: 1,
      reconcileStart: 0,
      reconcileCount: 0,
      payloadCount: 0
    });
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.ACTIVE);
  });

  it("attaches, updates and clears a virtual list region window", () => {
    const blueprintResult = createBlueprint({
      nodeCount: 0,
      bindingOpcode: new Uint8Array(0),
      bindingNodeIndex: new Uint32Array(0),
      bindingDataIndex: new Uint32Array(0),
      regionType: new Uint8Array([RegionType.VIRTUAL_LIST]),
      regionAnchorStart: new Uint32Array([INVALID_INDEX]),
      regionAnchorEnd: new Uint32Array([INVALID_INDEX])
    });

    expect(blueprintResult.ok).toBe(true);
    if (!blueprintResult.ok) {
      return;
    }

    const instance = createBlockInstance(blueprintResult.value);
    expect(initializeRegionSlot(instance, 0)).toBe(true);

    expect(attachVirtualListRegion(instance, 0, 100, 10, 14)).toBe(true);
    expect(getVirtualListRegionState(instance, 0)).toEqual({
      itemCount: 100,
      windowStart: 10,
      windowEnd: 14,
      targetWindowStart: null,
      targetWindowEnd: null
    });

    expect(beginVirtualListWindowUpdate(instance, 0, 100, 12, 16)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.UPDATING);
    expect(getVirtualListRegionState(instance, 0)).toEqual({
      itemCount: 100,
      windowStart: 10,
      windowEnd: 14,
      targetWindowStart: 12,
      targetWindowEnd: 16
    });

    expect(completeVirtualListWindowUpdate(instance, 0)).toBe(true);
    expect(getVirtualListRegionState(instance, 0)).toEqual({
      itemCount: 100,
      windowStart: 12,
      windowEnd: 16,
      targetWindowStart: null,
      targetWindowEnd: null
    });

    expect(beginVirtualListWindowUpdate(instance, 0, 100, 99, 101)).toBe(false);
    expect(clearVirtualListRegion(instance, 0)).toBe(true);
    expect(instance.regionLifecycle[0]).toBe(RegionLifecycle.INACTIVE);
    expect(getVirtualListRegionState(instance, 0)).toEqual({
      itemCount: 0,
      windowStart: 0,
      windowEnd: 0,
      targetWindowStart: null,
      targetWindowEnd: null
    });
  });
});
