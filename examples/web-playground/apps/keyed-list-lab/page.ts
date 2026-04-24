import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

import {
  createKeyedListItems,
  readCompiledItems,
  type CompiledKeyedListDescriptor
} from "../../runtime/compiled-structures";
import {
  blueprint,
  initialSignalValues,
  keyedListDescriptors,
  signalCount
} from "./generated/page.generated";

interface KeyedRow {
  readonly id: string;
  readonly label: string;
  readonly status: string;
}

type KeyedListScenario = "baseline" | "reordered" | "trimmed";

const SCENARIOS: Record<KeyedListScenario, readonly KeyedRow[]> = {
  baseline: [
    { id: "alpha", label: "Alpha", status: "Primary" },
    { id: "bravo", label: "Bravo", status: "Warm" },
    { id: "charlie", label: "Charlie", status: "Cold" }
  ],
  reordered: [
    { id: "bravo", label: "Bravo", status: "Warm" },
    { id: "delta", label: "Delta", status: "Inserted" },
    { id: "alpha", label: "Alpha", status: "Primary" }
  ],
  trimmed: [
    { id: "delta", label: "Delta", status: "Inserted" }
  ]
};

export interface MountedKeyedListLab {
  applyScenario(name: KeyedListScenario): Result<void, KeyedListLabError>;
  readOrder(): string[];
  dispose(): Result<void, KeyedListLabError>;
}

export interface KeyedListLabError {
  readonly code: string;
  readonly message: string;
}

export function mountKeyedListLab(root: Node): Result<MountedKeyedListLab, KeyedListLabError> {
  const descriptor = keyedListDescriptors[0] as CompiledKeyedListDescriptor | undefined;
  if (!descriptor) {
    return err({
      code: "KEYED_LIST_DESCRIPTOR_MISSING",
      message: "Generated keyed list descriptor is missing."
    });
  }

  const mountedResult = mountTree({
    blueprint,
    root,
    signalCount,
    initialSignalValues
  });
  if (!mountedResult.ok) {
    return err(mountedResult.error);
  }

  const flushResult = mountedResult.value.flushInitialBindings();
  if (!flushResult.ok) {
    return err(flushResult.error);
  }

  let items = readCompiledItems<KeyedRow>(descriptor, initialSignalValues);
  const attachResult = mountedResult.value.regions.keyedList(descriptor.regionSlot).attach(
    createKeyedListItems(descriptor, items)
  );
  if (!attachResult.ok) {
    return err(attachResult.error);
  }

  return ok({
    applyScenario(name) {
      items = SCENARIOS[name];
      const reconcileResult = mountedResult.value.regions.keyedList(descriptor.regionSlot).reconcile(
        createKeyedListItems(descriptor, items)
      );
      return reconcileResult.ok ? ok(undefined) : err(reconcileResult.error);
    },
    readOrder() {
      return readRowLabels(root);
    },
    dispose() {
      return mountedResult.value.dispose();
    }
  });
}

function readRowLabels(root: Node): string[] {
  if (!(root instanceof Element)) {
    return [];
  }

  return Array.from(root.querySelectorAll(".keyed-row__label"))
    .map(label => label.textContent ?? "")
    .filter(label => label.length > 0);
}
