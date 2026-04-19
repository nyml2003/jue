import { type FlushBindingsResult } from "@jue/runtime-core";
import { err, ok, type Result } from "@jue/shared";
import { createBlueprintBuilder } from "@jue/compiler";
import { mountTree } from "@jue/web";

const SIGNAL_COUNT_SLOT = 0;
const SIGNAL_CARD_CLASS_SLOT = 1;
const SIGNAL_ROW_CLASS_SLOT = 2;
const SIGNAL_LABEL_CLASS_SLOT = 3;
const SIGNAL_VALUE_CLASS_SLOT = 4;
const SIGNAL_BUTTON_CLASS_SLOT = 5;

export interface MountedCounterBlock {
  increment(): Result<FlushBindingsResult, CounterBlockError>;
  dispose(): Result<void, CounterBlockError>;
}

export interface CounterBlockError {
  readonly code: string;
  readonly message: string;
}

export function mountCounterBlock(root: Node): Result<MountedCounterBlock, CounterBlockError> {
  let count = 0;
  let mountedTreeRef: ReturnType<typeof mountTree> extends Result<infer T, unknown> ? T | null : never = null;

  const clickHandler = () => {
    count += 1;
    void mountedTreeRef?.setSignal(SIGNAL_COUNT_SLOT, count);
  };

  const builder = createCounterBlueprintBuilder(clickHandler);
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
    increment() {
      count += 1;
      return mountedTree.setSignal(SIGNAL_COUNT_SLOT, count);
    },
    dispose() {
      return mountedTree.dispose();
    }
  });
}

function createCounterBlueprintBuilder(clickHandler: () => void) {
  const builder = createBlueprintBuilder();
  builder.setSignalCount(6);
  builder.setInitialSignalValues([0, "card", "row", "label", "value", "button"]);

  const card = builder.element("View");
  const title = builder.element("Text");
  const titleText = builder.text("jue counter block");
  ensureBuilderAppend(builder.append(card, title));
  ensureBuilderAppend(builder.append(title, titleText));

  const summary = builder.element("Text");
  const summaryText = builder.text("This demo is mounted from a runtime-owned static node table.");
  ensureBuilderAppend(builder.append(card, summary));
  ensureBuilderAppend(builder.append(summary, summaryText));

  const row = builder.element("View");
  const label = builder.element("Text");
  const labelText = builder.text("Count:");
  ensureBuilderAppend(builder.append(card, row));
  ensureBuilderAppend(builder.append(row, label));
  ensureBuilderAppend(builder.append(label, labelText));

  const value = builder.element("View");
  const valueText = builder.text("");
  ensureBuilderAppend(builder.append(row, value));
  ensureBuilderAppend(builder.append(value, valueText));

  const button = builder.element("Button");
  const buttonText = builder.text("Increment");
  ensureBuilderAppend(builder.append(row, button));
  ensureBuilderAppend(builder.append(button, buttonText));

  builder.bindProp(card, "className", SIGNAL_CARD_CLASS_SLOT);
  builder.bindProp(row, "className", SIGNAL_ROW_CLASS_SLOT);
  builder.bindProp(label, "className", SIGNAL_LABEL_CLASS_SLOT);
  builder.bindProp(value, "className", SIGNAL_VALUE_CLASS_SLOT);
  builder.bindProp(button, "className", SIGNAL_BUTTON_CLASS_SLOT);
  builder.bindText(valueText, SIGNAL_COUNT_SLOT);
  builder.bindEvent(button, "onPress", clickHandler);

  return builder;
}

function ensureBuilderAppend(result: Result<void, { code: string; message: string }>): void {
  if (result.ok) {
    return;
  }

  throw new Error(`[counter-block] ${result.error.code}: ${result.error.message}`);
}
