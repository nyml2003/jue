import { createBlueprint, type FlushBindingsResult } from "@jue/runtime-core";
import { BindingOpcode, INVALID_INDEX, err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

const NODE_KIND_ELEMENT = 1;
const NODE_KIND_TEXT = 2;

const SIGNAL_COUNT_SLOT = 0;
const SIGNAL_CARD_CLASS_SLOT = 1;
const SIGNAL_ROW_CLASS_SLOT = 2;
const SIGNAL_LABEL_CLASS_SLOT = 3;
const SIGNAL_VALUE_CLASS_SLOT = 4;
const SIGNAL_BUTTON_CLASS_SLOT = 5;

const REF_VIEW = 0;
const REF_TEXT = 1;
const REF_BUTTON = 2;
const REF_TITLE_TEXT = 3;
const REF_SUMMARY_TEXT = 4;
const REF_COUNT_LABEL_TEXT = 5;
const REF_INCREMENT_TEXT = 6;
const REF_CLASS_NAME = 7;
const REF_EVENT_ON_PRESS = 8;
const REF_CLICK_HANDLER = 9;

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

  const blueprintResult = createCounterBlueprint(clickHandler);
  if (!blueprintResult.ok) {
    return err(blueprintResult.error);
  }

  const mountedTreeResult = mountTree({
    blueprint: blueprintResult.value,
    root,
    signalCount: 6,
    initialSignalValues: [0, "card", "row", "label", "value", "button"]
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

function createCounterBlueprint(clickHandler: () => void) {
  return createBlueprint({
    nodeCount: 11,
    nodeKind: new Uint8Array([
      NODE_KIND_ELEMENT, // 0 card
      NODE_KIND_ELEMENT, // 1 title
      NODE_KIND_TEXT,    // 2 title text
      NODE_KIND_ELEMENT, // 3 summary
      NODE_KIND_TEXT,    // 4 summary text
      NODE_KIND_ELEMENT, // 5 row
      NODE_KIND_ELEMENT, // 6 label
      NODE_KIND_TEXT,    // 7 label text
      NODE_KIND_ELEMENT, // 8 value
      NODE_KIND_TEXT,    // 9 value text
      NODE_KIND_ELEMENT  // 10 button
    ]),
    nodePrimitiveRefIndex: new Uint32Array([
      REF_VIEW,
      REF_TEXT,
      INVALID_INDEX,
      REF_TEXT,
      INVALID_INDEX,
      REF_VIEW,
      REF_TEXT,
      INVALID_INDEX,
      REF_VIEW,
      INVALID_INDEX,
      REF_BUTTON
    ]),
    nodeTextRefIndex: new Uint32Array([
      INVALID_INDEX,
      INVALID_INDEX,
      REF_TITLE_TEXT,
      INVALID_INDEX,
      REF_SUMMARY_TEXT,
      INVALID_INDEX,
      INVALID_INDEX,
      REF_COUNT_LABEL_TEXT,
      INVALID_INDEX,
      REF_INCREMENT_TEXT,
      INVALID_INDEX
    ]),
    nodeParentIndex: new Uint32Array([
      INVALID_INDEX,
      0,
      1,
      0,
      3,
      0,
      5,
      6,
      5,
      8,
      5
    ]),
    bindingOpcode: new Uint8Array([
      BindingOpcode.PROP,
      BindingOpcode.PROP,
      BindingOpcode.PROP,
      BindingOpcode.PROP,
      BindingOpcode.PROP,
      BindingOpcode.TEXT,
      BindingOpcode.EVENT
    ]),
    bindingNodeIndex: new Uint32Array([
      0,
      5,
      6,
      8,
      10,
      9,
      10
    ]),
    bindingDataIndex: new Uint32Array([
      0,
      2,
      4,
      6,
      8,
      SIGNAL_COUNT_SLOT,
      10
    ]),
    bindingArgU32: new Uint32Array([
      SIGNAL_CARD_CLASS_SLOT, REF_CLASS_NAME,
      SIGNAL_ROW_CLASS_SLOT, REF_CLASS_NAME,
      SIGNAL_LABEL_CLASS_SLOT, REF_CLASS_NAME,
      SIGNAL_VALUE_CLASS_SLOT, REF_CLASS_NAME,
      SIGNAL_BUTTON_CLASS_SLOT, REF_CLASS_NAME,
      REF_EVENT_ON_PRESS, REF_CLICK_HANDLER
    ]),
    bindingArgRef: [
      "View",
      "Text",
      "Button",
      "jue counter block",
      "This demo is mounted from a runtime-owned static node table.",
      "Count:",
      "Increment",
      "className",
      "onPress",
      clickHandler
    ],
    regionType: new Uint8Array(0),
    regionAnchorStart: new Uint32Array(0),
    regionAnchorEnd: new Uint32Array(0),
    signalToBindingStart: new Uint32Array([0, 1, 2, 3, 4, 5]),
    signalToBindingCount: new Uint32Array([1, 1, 1, 1, 1, 1]),
    signalToBindings: new Uint32Array([5, 0, 1, 2, 3, 4])
  });
}
