import { type FlushBindingsResult } from "@jue/runtime-core";
import { createBlueprintBuilder } from "@jue/compiler";
import { err, ok, type Result } from "@jue/shared";
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

const INITIAL_NOTE = "Calibrate the signal table.";

export interface MountedMissionControlBlock {
  advance(): Result<FlushBindingsResult, MissionControlBlockError>;
  reset(): Result<FlushBindingsResult, MissionControlBlockError>;
  setNote(value: string): Result<FlushBindingsResult, MissionControlBlockError>;
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
}

export function mountMissionControlBlock(root: Node): Result<MountedMissionControlBlock, MissionControlBlockError> {
  let state: MissionState = {
    phase: 1,
    score: 42,
    note: INITIAL_NOTE
  };
  let mountedTreeRef: ReturnType<typeof mountTree> extends Result<infer T, unknown> ? T | null : never = null;

  const applyState = (nextState: MissionState) => {
    state = nextState;
    return writeMissionSignals(mountedTreeRef, state);
  };

  const advanceHandler = () => {
    void applyState({
      phase: state.phase + 1,
      score: Math.min(100, state.score + 17),
      note: state.note
    });
  };

  const resetHandler = () => {
    void applyState({
      phase: 1,
      score: 42,
      note: INITIAL_NOTE
    });
  };

  const noteInputHandler = (event: unknown) => {
    const value = readHostEventValue(event);
    if (value === null) {
      return;
    }

    void applyState({
      phase: state.phase,
      score: state.score,
      note: value
    });
  };

  const builder = createMissionControlBlueprintBuilder({
    advanceHandler,
    resetHandler,
    noteInputHandler
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

  return ok({
    advance() {
      return applyState({
        phase: state.phase + 1,
        score: Math.min(100, state.score + 17),
        note: state.note
      });
    },
    reset() {
      return applyState({
        phase: 1,
        score: 42,
        note: INITIAL_NOTE
      });
    },
    setNote(value) {
      return applyState({
        phase: state.phase,
        score: state.score,
        note: value
      });
    },
    dispose() {
      return mountedTree.dispose();
    }
  });
}

function writeMissionSignals(
  mountedTree: ReturnType<typeof mountTree> extends Result<infer T, unknown> ? T | null : never,
  state: MissionState
): Result<FlushBindingsResult, MissionControlBlockError> {
  if (mountedTree === null) {
    return err({
      code: "MISSION_TREE_NOT_MOUNTED",
      message: "Mission control signals cannot be written before mountTree() succeeds."
    });
  }

  let result = mountedTree.setSignal(SIGNAL_PHASE_SLOT, `Phase ${state.phase}`);
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_SCORE_SLOT, String(state.score));
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_NOTE_SLOT, state.note);
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_STATUS_SLOT, getMissionStatus(state.score));
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_PROGRESS_SLOT, `${state.score}%`);
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_NOTE_INPUT_VALUE_SLOT, state.note);
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_PROGRESS_WIDTH_SLOT, `${state.score}%`);
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_PROGRESS_TONE_SLOT, getProgressTone(state.score));
  if (!result.ok) {
    return err(result.error);
  }

  result = mountedTree.setSignal(SIGNAL_STATUS_CLASS_SLOT, getStatusClassName(state.score));
  if (!result.ok) {
    return err(result.error);
  }

  return result;
}

function createMissionControlBlueprintBuilder(handlers: {
  readonly advanceHandler: () => void;
  readonly resetHandler: () => void;
  readonly noteInputHandler: (event: unknown) => void;
}) {
  const builder = createBlueprintBuilder();
  builder.setSignalCount(12);
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
    "mission-button mission-button--secondary"
  ]);

  const panel = builder.element("View");
  appendTextElement(builder, panel, "Runtime mission");
  appendTextElement(builder, panel, "Signal dispatch console");
  appendTextElement(builder, panel, "A static tree with dynamic text, props, styles, and event wiring.");

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

  builder.bindEvent(advanceButton, "onPress", handlers.advanceHandler);
  builder.bindEvent(resetButton, "onPress", handlers.resetHandler);
  builder.bindEvent(input, "onInput", handlers.noteInputHandler);

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

function ensureBuilderAppend(result: Result<void, { code: string; message: string }>): void {
  if (result.ok) {
    return;
  }

  throw new Error(`[mission-control-block] ${result.error.code}: ${result.error.message}`);
}
