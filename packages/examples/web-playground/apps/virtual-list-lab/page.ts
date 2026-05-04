import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

import {
  createVirtualListWindow,
  readCompiledItems,
  resolveVirtualWindowMetrics,
  type CompiledVirtualListDescriptor
} from "../../runtime/compiled-structures";
import {
  blueprint,
  initialSignalValues,
  signalCount,
  virtualListDescriptors
} from "./generated/page.generated";

interface VirtualRow {
  readonly id: string;
  readonly label: string;
}

const VISIBLE_COUNT = 3;

export interface MountedVirtualListLab {
  setWindowStart(windowStart: number): Result<void, VirtualListLabError>;
  readVisibleLabels(): string[];
  readReuseIds(): string[];
  dispose(): Result<void, VirtualListLabError>;
}

export interface VirtualListLabError {
  readonly code: string;
  readonly message: string;
}

export function mountVirtualListLab(root: Node): Result<MountedVirtualListLab, VirtualListLabError> {
  const descriptor = virtualListDescriptors[0] as CompiledVirtualListDescriptor | undefined;
  if (!descriptor) {
    return err({
      code: "VIRTUAL_LIST_DESCRIPTOR_MISSING",
      message: "Generated virtual list descriptor is missing."
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

  const items = readCompiledItems<VirtualRow>(descriptor, initialSignalValues);
  const viewport = root instanceof Element
    ? root.querySelector<HTMLElement>(".virtual-lab-viewport")
    : null;
  let attached = false;

  const updateWindow = (requestedWindowStart: number): Result<void, VirtualListLabError> => {
    const metrics = resolveVirtualWindowMetrics(descriptor, items.length, VISIBLE_COUNT, requestedWindowStart);
    syncSpacerHeights(root, metrics.topSpacerHeight, metrics.bottomSpacerHeight);

    const windowSpec = createVirtualListWindow(descriptor, items, VISIBLE_COUNT, requestedWindowStart);
    const list = mountedResult.value.regions.virtualList(descriptor.regionSlot);
    const result = attached
      ? list.updateWindow(windowSpec)
      : list.attach(windowSpec);

    if (!result.ok) {
      return err(result.error);
    }

    attached = true;
    annotateCellReuse(root);
    return ok(undefined);
  };

  const initialAttach = updateWindow(0);
  if (!initialAttach.ok) {
    return initialAttach;
  }

  const handleScroll = () => {
    if (!viewport) {
      return;
    }

    void updateWindow(Math.floor(viewport.scrollTop / descriptor.estimateSize));
  };
  viewport?.addEventListener("scroll", handleScroll);

  return ok({
    setWindowStart(windowStart) {
      return updateWindow(windowStart);
    },
    readVisibleLabels() {
      return readTexts(root, ".virtual-row__label");
    },
    readReuseIds() {
      if (!(root instanceof Element)) {
        return [];
      }

      return Array.from(root.querySelectorAll(".virtual-row"))
        .map(node => node.getAttribute("data-reuse-id") ?? "")
        .filter(value => value.length > 0);
    },
    dispose() {
      viewport?.removeEventListener("scroll", handleScroll);
      return mountedResult.value.dispose();
    }
  });
}

function syncSpacerHeights(root: Node, topHeight: number, bottomHeight: number): void {
  if (!(root instanceof Element)) {
    return;
  }

  const top = root.querySelector<HTMLElement>(".virtual-spacer--top");
  const bottom = root.querySelector<HTMLElement>(".virtual-spacer--bottom");
  if (top) {
    top.style.height = `${topHeight}px`;
  }

  if (bottom) {
    bottom.style.height = `${bottomHeight}px`;
  }
}

function annotateCellReuse(root: Node): void {
  if (!(root instanceof Element)) {
    return;
  }

  Array.from(root.querySelectorAll<HTMLElement>(".virtual-row")).forEach((row, index) => {
    if (!row.dataset.reuseId) {
      row.dataset.reuseId = String(index);
    }
  });
}

function readTexts(root: Node, selector: string): string[] {
  if (!(root instanceof Element)) {
    return [];
  }

  return Array.from(root.querySelectorAll(selector))
    .map(node => node.textContent ?? "")
    .filter(text => text.length > 0);
}
