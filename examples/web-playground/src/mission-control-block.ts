import {
  attachNestedBlockRegion,
  beginNestedBlockReplace,
  completeNestedBlockReplace,
  detachNestedBlockRegion,
  getConditionalRegionBranchRange,
  getConditionalRegionMountedRange,
  getConditionalRegionMountedBranch,
  getNestedBlockRegionMountedState,
  initializeRegionSlot,
  type FlushBindingsResult
} from "@jue/runtime-core";
import { createBlueprintBuilder } from "@jue/compiler";
import { err, ok, RegionLifecycle, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

const SIGNAL_PHASE_SLOT = 0;
const SIGNAL_SCORE_SLOT = 1;
const SIGNAL_NOTE_SLOT = 2;
const SIGNAL_STATUS_SLOT = 3;
const SIGNAL_PROGRESS_SLOT = 4;
const SIGNAL_PANEL_CLASS_SLOT = 5;
const SIGNAL_STATUS_CLASS_SLOT = 6;
const SIGNAL_NOTE_INPUT_VALUE_SLOT = 7;
const SIGNAL_PROGRESS_WIDTH_SLOT = 8;
const SIGNAL_PROGRESS_TONE_SLOT = 9;
const SIGNAL_PRIMARY_BUTTON_CLASS_SLOT = 10;
const SIGNAL_SECONDARY_BUTTON_CLASS_SLOT = 11;
const SIGNAL_CONDITIONAL_LIFECYCLE_SLOT = 12;
const SIGNAL_CONDITIONAL_ACTIVE_SLOT = 13;
const SIGNAL_CONDITIONAL_MOUNTED_SLOT = 14;
const SIGNAL_CONDITIONAL_RANGE_SLOT = 15;
const SIGNAL_NESTED_LIFECYCLE_SLOT = 16;
const SIGNAL_NESTED_MOUNTED_SLOT = 17;
const SIGNAL_REGION_LOG_SLOT = 18;

const CONDITIONAL_REGION_SLOT = 0;
const NESTED_REGION_SLOT = 1;

const INITIAL_NOTE = "Calibrate the signal table.";
const INITIAL_REGION_LOG = "Region slots initialized. Awaiting branch attach.";

export interface MountedMissionControlBlock {
  advance(): Result<FlushBindingsResult, MissionControlBlockError>;
  reset(): Result<FlushBindingsResult, MissionControlBlockError>;
  setNote(value: string): Result<FlushBindingsResult, MissionControlBlockError>;
  attachBranchA(): Result<FlushBindingsResult, MissionControlBlockError>;
  switchBranch(): Result<FlushBindingsResult, MissionControlBlockError>;
  clearBranch(): Result<FlushBindingsResult, MissionControlBlockError>;
  attachChildBlock(): Result<FlushBindingsResult, MissionControlBlockError>;
  replaceChildBlock(): Result<FlushBindingsResult, MissionControlBlockError>;
  detachChildBlock(): Result<FlushBindingsResult, MissionControlBlockError>;
  dispose(): Result<void, MissionControlBlockError>;
}

export interface MissionControlBlockError {
  readonly code: string;
  readonly message: string;
}

interface MissionState {
  readonly phase: number;
  readonly score: number;
  readonly note: string;
  readonly regionLog: string;
}

type MountedTree = ReturnType<typeof mountTree> extends Result<infer T, unknown> ? T : never;

export function mountMissionControlBlock(root: Node): Result<MountedMissionControlBlock, MissionControlBlockError> {
  let state: MissionState = {
    phase: 1,
    score: 42,
    note: INITIAL_NOTE,
    regionLog: INITIAL_REGION_LOG
  };
  let mountedTreeRef: MountedTree | null = null;
  let nextNestedBlockSlot = 13;
  let nextNestedBlueprintSlot = 17;

  const syncAll = (nextState: MissionState) => {
    state = nextState;
    return writeMissionSignals(mountedTreeRef, state);
  };

  const conditionalRegion = () => mountedTreeRef?.regions.conditional(CONDITIONAL_REGION_SLOT) ?? null;

  const logRegionAction = (message: string) => syncAll({
    ...state,
    regionLog: message
  });

  const advanceHandler = () => {
    void syncAll({
      ...state,
      phase: state.phase + 1,
      score: Math.min(100, state.score + 17)
    });
  };

  const resetHandler = () => {
    void syncAll({
      phase: 1,
      score: 42,
      note: INITIAL_NOTE,
      regionLog: INITIAL_REGION_LOG
    });
  };

  const noteInputHandler = (event: unknown) => {
    const value = readHostEventValue(event);
    if (value === null) {
      return;
    }

    void syncAll({
      ...state,
      note: value
    });
  };

  const attachBranchAHandler = () => {
    if (mountedTreeRef === null) {
      return;
    }

    const okResult = conditionalRegion()?.attach(0) ?? null;
    void logRegionAction(okResult?.ok
      ? "Attached conditional branch A."
      : "Conditional branch A attach rejected by current lifecycle.");
  };

  const switchBranchHandler = () => {
    if (mountedTreeRef === null) {
      return;
    }

    const currentMountedBranch = getConditionalRegionMountedBranch(
      mountedTreeRef.instance,
      CONDITIONAL_REGION_SLOT
    );
    const nextBranch = currentMountedBranch === 0 ? 1 : 0;

    const switched = conditionalRegion()?.switchTo(nextBranch) ?? null;

    void logRegionAction(switched?.ok
      ? `Conditional branch switched to ${nextBranch}.`
      : "Conditional branch switch failed and rolled back.");
  };

  const clearBranchHandler = () => {
    if (mountedTreeRef === null) {
      return;
    }

    const cleared = conditionalRegion()?.clear() ?? null;
    void logRegionAction(cleared?.ok
      ? "Conditional branch cleared."
      : "Conditional branch clear rejected.");
  };

  const attachChildBlockHandler = () => {
    if (mountedTreeRef === null) {
      return;
    }

    const attached = attachNestedBlockRegion(mountedTreeRef.instance, NESTED_REGION_SLOT);
    void logRegionAction(attached
      ? "Nested block attached."
      : "Nested block attach rejected.");
  };

  const replaceChildBlockHandler = () => {
    if (mountedTreeRef === null) {
      return;
    }

    if (!beginNestedBlockReplace(
      mountedTreeRef.instance,
      NESTED_REGION_SLOT,
      nextNestedBlockSlot,
      nextNestedBlueprintSlot
    )) {
      void logRegionAction("Nested block replace rejected.");
      return;
    }

    const replaced = completeNestedBlockReplace(mountedTreeRef.instance, NESTED_REGION_SLOT);
    if (replaced) {
      nextNestedBlockSlot += 2;
      nextNestedBlueprintSlot += 2;
    }

    void logRegionAction(replaced
      ? `Nested block replaced with block ${nextNestedBlockSlot - 2}.`
      : "Nested block replace failed.");
  };

  const detachChildBlockHandler = () => {
    if (mountedTreeRef === null) {
      return;
    }

    const detached = detachNestedBlockRegion(mountedTreeRef.instance, NESTED_REGION_SLOT);
    void logRegionAction(detached
      ? "Nested block detached."
      : "Nested block detach rejected.");
  };

  const builder = createMissionControlBlueprintBuilder({
    advanceHandler,
    resetHandler,
    noteInputHandler,
    attachBranchAHandler,
    switchBranchHandler,
    clearBranchHandler,
    attachChildBlockHandler,
    replaceChildBlockHandler,
    detachChildBlockHandler
  });
  const loweredResult = builder.buildBlueprint();
  if (!loweredResult.ok) {
    return err(loweredResult.error);
  }

  const mountedTreeResult = mountTree({
    blueprint: loweredResult.value.blueprint,
    root,
    signalCount: loweredResult.value.signalCount,
    initialSignalValues: loweredResult.value.initialSignalValues
  });

  if (!mountedTreeResult.ok) {
    return err(mountedTreeResult.error);
  }

  const mountedTree = mountedTreeResult.value;
  mountedTreeRef = mountedTree;

  const initialFlushResult = mountedTree.flushInitialBindings();
  if (!initialFlushResult.ok) {
    return err(initialFlushResult.error);
  }

  if (!initializeRegionSlot(mountedTree.instance, CONDITIONAL_REGION_SLOT)) {
    return err({
      code: "MISSION_REGION_INIT_FAILED",
      message: "Failed to initialize the conditional region slot."
    });
  }

  if (!initializeRegionSlot(mountedTree.instance, NESTED_REGION_SLOT)) {
    return err({
      code: "MISSION_REGION_INIT_FAILED",
      message: "Failed to initialize the nested block region slot."
    });
  }

  const syncResult = writeMissionSignals(mountedTreeRef, state);
  if (!syncResult.ok) {
    return syncResult;
  }

  const branchCount = mountedTree.instance.blueprint.regionBranchRangeCount[CONDITIONAL_REGION_SLOT] ?? 0;
  for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
    const branchRange = getConditionalRegionBranchRange(
      mountedTree.instance,
      CONDITIONAL_REGION_SLOT,
      branchIndex
    );
    if (branchRange === null) {
      continue;
    }

    const disposeResult = mountedTree.disposeRange(branchRange.startNode, branchRange.endNode);
    if (!disposeResult.ok) {
      return err(disposeResult.error);
    }
  }

  return ok({
    advance() {
      return syncAll({
        ...state,
        phase: state.phase + 1,
        score: Math.min(100, state.score + 17)
      });
    },
    reset() {
      return syncAll({
        phase: 1,
        score: 42,
        note: INITIAL_NOTE,
        regionLog: INITIAL_REGION_LOG
      });
    },
    setNote(value) {
      return syncAll({
        ...state,
        note: value
      });
    },
    attachBranchA() {
      if (mountedTreeRef === null) {
        return err({
          code: "MISSION_TREE_NOT_MOUNTED",
          message: "Cannot attach a branch before mountTree() succeeds."
        });
      }

      const attached = mountedTreeRef.regions.conditional(CONDITIONAL_REGION_SLOT).attach(0);
      return logRegionAction(attached.ok
        ? "Attached conditional branch A."
        : "Conditional branch A attach rejected by current lifecycle.");
    },
    switchBranch() {
      if (mountedTreeRef === null) {
        return err({
          code: "MISSION_TREE_NOT_MOUNTED",
          message: "Cannot switch a branch before mountTree() succeeds."
        });
      }

      const currentMountedBranch = getConditionalRegionMountedBranch(
        mountedTreeRef.instance,
        CONDITIONAL_REGION_SLOT
      );
      const nextBranch = currentMountedBranch === 0 ? 1 : 0;

      const switched = mountedTreeRef.regions.conditional(CONDITIONAL_REGION_SLOT).switchTo(nextBranch);

      return logRegionAction(switched.ok
        ? `Conditional branch switched to ${nextBranch}.`
        : "Conditional branch switch failed and rolled back.");
    },
    clearBranch() {
      if (mountedTreeRef === null) {
        return err({
          code: "MISSION_TREE_NOT_MOUNTED",
          message: "Cannot clear a branch before mountTree() succeeds."
        });
      }

      const cleared = mountedTreeRef.regions.conditional(CONDITIONAL_REGION_SLOT).clear();
      return logRegionAction(cleared.ok
        ? "Conditional branch cleared."
        : "Conditional branch clear rejected.");
    },
    attachChildBlock() {
      if (mountedTreeRef === null) {
        return err({
          code: "MISSION_TREE_NOT_MOUNTED",
          message: "Cannot attach nested block before mountTree() succeeds."
        });
      }

      const attached = attachNestedBlockRegion(mountedTreeRef.instance, NESTED_REGION_SLOT);
      return logRegionAction(attached
        ? "Nested block attached."
        : "Nested block attach rejected.");
    },
    replaceChildBlock() {
      if (mountedTreeRef === null) {
        return err({
          code: "MISSION_TREE_NOT_MOUNTED",
          message: "Cannot replace nested block before mountTree() succeeds."
        });
      }

      if (!beginNestedBlockReplace(
        mountedTreeRef.instance,
        NESTED_REGION_SLOT,
        nextNestedBlockSlot,
        nextNestedBlueprintSlot
      )) {
        return logRegionAction("Nested block replace rejected.");
      }

      const replaced = completeNestedBlockReplace(mountedTreeRef.instance, NESTED_REGION_SLOT);
      if (replaced) {
        nextNestedBlockSlot += 2;
        nextNestedBlueprintSlot += 2;
      }

      return logRegionAction(replaced
        ? `Nested block replaced with block ${nextNestedBlockSlot - 2}.`
        : "Nested block replace failed.");
    },
    detachChildBlock() {
      if (mountedTreeRef === null) {
        return err({
          code: "MISSION_TREE_NOT_MOUNTED",
          message: "Cannot detach nested block before mountTree() succeeds."
        });
      }

      const detached = detachNestedBlockRegion(mountedTreeRef.instance, NESTED_REGION_SLOT);
      return logRegionAction(detached
        ? "Nested block detached."
        : "Nested block detach rejected.");
    },
    dispose() {
      return mountedTree.dispose();
    }
  });
}

function writeMissionSignals(
  mountedTree: MountedTree | null,
  state: MissionState
): Result<FlushBindingsResult, MissionControlBlockError> {
  if (mountedTree === null) {
    return err({
      code: "MISSION_TREE_NOT_MOUNTED",
      message: "Mission control signals cannot be written before mountTree() succeeds."
    });
  }

  const diagnostics = readRegionDiagnostics(mountedTree);

  const result = mountedTree.setSignals([
    [SIGNAL_PHASE_SLOT, `Phase ${state.phase}`],
    [SIGNAL_SCORE_SLOT, String(state.score)],
    [SIGNAL_NOTE_SLOT, state.note],
    [SIGNAL_STATUS_SLOT, getMissionStatus(state.score)],
    [SIGNAL_PROGRESS_SLOT, `${state.score}%`],
    [SIGNAL_NOTE_INPUT_VALUE_SLOT, state.note],
    [SIGNAL_PROGRESS_WIDTH_SLOT, `${state.score}%`],
    [SIGNAL_PROGRESS_TONE_SLOT, getProgressTone(state.score)],
    [SIGNAL_STATUS_CLASS_SLOT, getStatusClassName(state.score)],
    [SIGNAL_CONDITIONAL_LIFECYCLE_SLOT, diagnostics.conditionalLifecycle],
    [SIGNAL_CONDITIONAL_ACTIVE_SLOT, diagnostics.conditionalActive],
    [SIGNAL_CONDITIONAL_MOUNTED_SLOT, diagnostics.conditionalMounted],
    [SIGNAL_CONDITIONAL_RANGE_SLOT, diagnostics.conditionalRange],
    [SIGNAL_NESTED_LIFECYCLE_SLOT, diagnostics.nestedLifecycle],
    [SIGNAL_NESTED_MOUNTED_SLOT, diagnostics.nestedMounted],
    [SIGNAL_REGION_LOG_SLOT, state.regionLog]
  ]);

  return result.ok ? result : err(result.error);
}

function createMissionControlBlueprintBuilder(handlers: {
  readonly advanceHandler: () => void;
  readonly resetHandler: () => void;
  readonly noteInputHandler: (event: unknown) => void;
  readonly attachBranchAHandler: () => void;
  readonly switchBranchHandler: () => void;
  readonly clearBranchHandler: () => void;
  readonly attachChildBlockHandler: () => void;
  readonly replaceChildBlockHandler: () => void;
  readonly detachChildBlockHandler: () => void;
}) {
  const builder = createBlueprintBuilder();
  builder.setSignalCount(19);
  builder.setInitialSignalValues([
    "Phase 1",
    "42",
    INITIAL_NOTE,
    "Tracking",
    "42%",
    "mission-panel",
    "mission-pill mission-pill--tracking",
    INITIAL_NOTE,
    "42%",
    "#2f7d5b",
    "mission-button mission-button--primary",
    "mission-button mission-button--secondary",
    "conditional: inactive",
    "active branch: none",
    "mounted branch: none",
    "branch range: none",
    "nested lifecycle: inactive",
    "nested mounted: none",
    INITIAL_REGION_LOG
  ]);

  const panel = builder.element("View");
  appendTextElement(builder, panel, "Runtime mission");
  appendTextElement(builder, panel, "Signal dispatch console");
  appendTextElement(builder, panel, "A static tree with dynamic text, props, styles, events, and region diagnostics.");

  const metrics = builder.element("View");
  ensureBuilderAppend(builder.append(panel, metrics));

  const phaseMetric = appendMetric(builder, metrics, "Phase", "");
  const scoreMetric = appendMetric(builder, metrics, "Score", "");
  const statusMetric = appendMetric(builder, metrics, "Status", "");

  const progressTrack = builder.element("View");
  const progressFill = builder.element("View");
  ensureBuilderAppend(builder.append(panel, progressTrack));
  ensureBuilderAppend(builder.append(progressTrack, progressFill));

  const form = builder.element("View");
  appendTextElement(builder, form, "Mission note");
  const input = builder.element("Input");
  const notePreview = appendTextElement(builder, form, "");
  ensureBuilderAppend(builder.append(panel, form));
  ensureBuilderAppend(builder.append(form, input));

  const actions = builder.element("View");
  const advanceButton = appendButton(builder, actions, "Advance phase");
  const resetButton = appendButton(builder, actions, "Reset");
  ensureBuilderAppend(builder.append(panel, actions));

  const diagnostics = builder.element("View");
  ensureBuilderAppend(builder.append(panel, diagnostics));
  appendTextElement(builder, diagnostics, "Region diagnostics");

  const conditionalLifecycle = appendMetric(builder, diagnostics, "Conditional lifecycle", "");
  const conditionalActive = appendMetric(builder, diagnostics, "Conditional active", "");
  const conditionalMounted = appendMetric(builder, diagnostics, "Conditional mounted", "");
  const conditionalRange = appendMetric(builder, diagnostics, "Conditional range", "");
  const nestedLifecycle = appendMetric(builder, diagnostics, "Nested lifecycle", "");
  const nestedMounted = appendMetric(builder, diagnostics, "Nested mounted", "");

  const regionActions = builder.element("View");
  const attachBranchButton = appendButton(builder, regionActions, "Attach branch A");
  const switchBranchButton = appendButton(builder, regionActions, "Switch branch");
  const clearBranchButton = appendButton(builder, regionActions, "Clear branch");
  const attachChildButton = appendButton(builder, regionActions, "Attach child block");
  const replaceChildButton = appendButton(builder, regionActions, "Replace child block");
  const detachChildButton = appendButton(builder, regionActions, "Detach child block");
  ensureBuilderAppend(builder.append(diagnostics, regionActions));

  const regionLog = appendTextElement(builder, diagnostics, "");

  builder.bindProp(panel, "className", SIGNAL_PANEL_CLASS_SLOT);
  builder.bindProp(statusMetric.valueText, "className", SIGNAL_STATUS_CLASS_SLOT);
  builder.bindProp(advanceButton, "className", SIGNAL_PRIMARY_BUTTON_CLASS_SLOT);
  builder.bindProp(resetButton, "className", SIGNAL_SECONDARY_BUTTON_CLASS_SLOT);
  builder.bindProp(input, "value", SIGNAL_NOTE_INPUT_VALUE_SLOT);

  builder.bindStyle(progressFill, "width", SIGNAL_PROGRESS_WIDTH_SLOT);
  builder.bindStyle(progressFill, "backgroundColor", SIGNAL_PROGRESS_TONE_SLOT);

  builder.bindText(phaseMetric.valueTextNode, SIGNAL_PHASE_SLOT);
  builder.bindText(scoreMetric.valueTextNode, SIGNAL_SCORE_SLOT);
  builder.bindText(statusMetric.valueTextNode, SIGNAL_STATUS_SLOT);
  builder.bindText(notePreview.textNode, SIGNAL_NOTE_SLOT);
  builder.bindText(progressFillText(builder, progressFill), SIGNAL_PROGRESS_SLOT);
  builder.bindText(conditionalLifecycle.valueTextNode, SIGNAL_CONDITIONAL_LIFECYCLE_SLOT);
  builder.bindText(conditionalActive.valueTextNode, SIGNAL_CONDITIONAL_ACTIVE_SLOT);
  builder.bindText(conditionalMounted.valueTextNode, SIGNAL_CONDITIONAL_MOUNTED_SLOT);
  builder.bindText(conditionalRange.valueTextNode, SIGNAL_CONDITIONAL_RANGE_SLOT);
  builder.bindText(nestedLifecycle.valueTextNode, SIGNAL_NESTED_LIFECYCLE_SLOT);
  builder.bindText(nestedMounted.valueTextNode, SIGNAL_NESTED_MOUNTED_SLOT);
  builder.bindText(regionLog.textNode, SIGNAL_REGION_LOG_SLOT);

  builder.bindEvent(advanceButton, "onPress", handlers.advanceHandler);
  builder.bindEvent(resetButton, "onPress", handlers.resetHandler);
  builder.bindEvent(input, "onInput", handlers.noteInputHandler);
  builder.bindEvent(attachBranchButton, "onPress", handlers.attachBranchAHandler);
  builder.bindEvent(switchBranchButton, "onPress", handlers.switchBranchHandler);
  builder.bindEvent(clearBranchButton, "onPress", handlers.clearBranchHandler);
  builder.bindEvent(attachChildButton, "onPress", handlers.attachChildBlockHandler);
  builder.bindEvent(replaceChildButton, "onPress", handlers.replaceChildBlockHandler);
  builder.bindEvent(detachChildButton, "onPress", handlers.detachChildBlockHandler);

  builder.defineConditionalRegion({
    anchorStartNode: phaseMetric.item,
    anchorEndNode: statusMetric.valueTextNode,
    branches: [
      { startNode: phaseMetric.item, endNode: scoreMetric.valueTextNode },
      { startNode: statusMetric.item, endNode: statusMetric.valueTextNode }
    ]
  });

  builder.defineNestedBlockRegion({
    anchorStartNode: nestedLifecycle.item,
    anchorEndNode: nestedMounted.item,
    childBlockSlot: 7,
    childBlueprintSlot: 11,
    mountMode: "attach"
  });

  return builder;
}

function appendTextElement(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number,
  text: string
): { readonly element: number; readonly textNode: number } {
  const element = builder.element("Text");
  const childText = builder.text(text);
  ensureBuilderAppend(builder.append(parent, element));
  ensureBuilderAppend(builder.append(element, childText));
  return {
    element,
    textNode: childText
  };
}

function appendMetric(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number,
  label: string,
  value: string
) {
  const item = builder.element("View");
  const labelElement = builder.element("Text");
  const labelText = builder.text(label);
  const valueElement = builder.element("Text");
  const valueTextNode = builder.text(value);
  ensureBuilderAppend(builder.append(parent, item));
  ensureBuilderAppend(builder.append(item, labelElement));
  ensureBuilderAppend(builder.append(labelElement, labelText));
  ensureBuilderAppend(builder.append(item, valueElement));
  ensureBuilderAppend(builder.append(valueElement, valueTextNode));
  return {
    item,
    labelElement,
    valueText: valueElement,
    valueTextNode
  };
}

function appendButton(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number,
  text: string
): number {
  const button = builder.element("Button");
  const buttonText = builder.text(text);
  ensureBuilderAppend(builder.append(parent, button));
  ensureBuilderAppend(builder.append(button, buttonText));
  return button;
}

function progressFillText(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number
): number {
  const text = builder.text("");
  ensureBuilderAppend(builder.append(parent, text));
  return text;
}

function readRegionDiagnostics(mountedTree: MountedTree) {
  const conditionalLifecycle = getLifecycleName(
    mountedTree.instance.regionLifecycle[CONDITIONAL_REGION_SLOT]
  );
  const conditionalActiveBranch = getConditionalRegionMountedBranch(
    mountedTree.instance,
    CONDITIONAL_REGION_SLOT
  );
  const conditionalMountedRange = getConditionalRegionMountedRange(
    mountedTree.instance,
    CONDITIONAL_REGION_SLOT
  );
  const nestedLifecycle = getLifecycleName(
    mountedTree.instance.regionLifecycle[NESTED_REGION_SLOT]
  );
  const nestedMounted = getNestedBlockRegionMountedState(
    mountedTree.instance,
    NESTED_REGION_SLOT
  );

  return {
    conditionalLifecycle: `conditional: ${conditionalLifecycle}`,
    conditionalActive: `active branch: ${formatBranch(conditionalActiveBranch)}`,
    conditionalMounted: `mounted branch: ${formatBranch(conditionalActiveBranch)}`,
    conditionalRange: conditionalMountedRange === null
      ? "branch range: none"
      : `branch range: ${conditionalMountedRange.startNode}-${conditionalMountedRange.endNode}`,
    nestedLifecycle: `nested lifecycle: ${nestedLifecycle}`,
    nestedMounted: nestedMounted === null
      ? "nested mounted: none"
      : `nested mounted: block ${nestedMounted.blockSlot} / blueprint ${nestedMounted.blueprintSlot}`
  };
}

function getMissionStatus(score: number): string {
  if (score >= 90) {
    return "Locked";
  }

  if (score >= 70) {
    return "Nominal";
  }

  return "Tracking";
}

function getStatusClassName(score: number): string {
  if (score >= 90) {
    return "mission-pill mission-pill--locked";
  }

  if (score >= 70) {
    return "mission-pill mission-pill--nominal";
  }

  return "mission-pill mission-pill--tracking";
}

function getProgressTone(score: number): string {
  if (score >= 90) {
    return "#cf5d3f";
  }

  if (score >= 70) {
    return "#b98d2c";
  }

  return "#2f7d5b";
}

function readHostEventValue(event: unknown): string | null {
  if (
    typeof event === "object" &&
    event !== null &&
    "value" in event &&
    typeof event.value === "string"
  ) {
    return event.value;
  }

  return null;
}

function getLifecycleName(value: number | undefined): string {
  switch (value) {
    case RegionLifecycle.UNINITIALIZED:
      return "uninitialized";
    case RegionLifecycle.INACTIVE:
      return "inactive";
    case RegionLifecycle.ACTIVE:
      return "active";
    case RegionLifecycle.UPDATING:
      return "updating";
    case RegionLifecycle.DISPOSING:
      return "disposing";
    case RegionLifecycle.DISPOSED:
      return "disposed";
    default:
      return "unknown";
  }
}

function formatBranch(branch: number | null): string {
  return branch === null ? "none" : String(branch);
}

function ensureBuilderAppend(result: Result<void, { code: string; message: string }>): void {
  if (result.ok) {
    return;
  }

  throw new Error(`[mission-control-block] ${result.error.code}: ${result.error.message}`);
}
