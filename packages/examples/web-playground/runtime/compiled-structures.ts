import type { KeyedListItemSpec, VirtualListWindowSpec } from "@jue/web";
import type { Blueprint } from "@jue/runtime-core";

export interface CompiledTemplateDescriptor {
  readonly blueprint: Blueprint;
  readonly signalCount: number;
  readonly initialSignalValues: readonly unknown[];
  readonly signalPaths: readonly (((readonly string[]) | null))[];
}

export interface CompiledKeyedListDescriptor {
  readonly regionSlot: number;
  readonly sourceSignalSlot: number;
  readonly keyPath: readonly string[];
  readonly template: CompiledTemplateDescriptor;
}

export interface CompiledVirtualListDescriptor extends CompiledKeyedListDescriptor {
  readonly estimateSize: number;
  readonly overscan: number;
}

export function readCompiledItems<T>(
  descriptor: { readonly sourceSignalSlot: number },
  initialSignalValues: readonly unknown[]
): readonly T[] {
  const source = initialSignalValues[descriptor.sourceSignalSlot];
  return Array.isArray(source) ? source as readonly T[] : [];
}

export function createKeyedListItems<T>(
  descriptor: CompiledKeyedListDescriptor,
  items: readonly T[]
): KeyedListItemSpec[] {
  return items.map(item => ({
    key: String(readPathValue(item, descriptor.keyPath)),
    blueprint: descriptor.template.blueprint,
    signalCount: descriptor.template.signalCount,
    initialSignalValues: createTemplateSignalValues(descriptor.template, item)
  }));
}

export function createVirtualListWindow<T>(
  descriptor: CompiledVirtualListDescriptor,
  items: readonly T[],
  visibleCount: number,
  requestedWindowStart: number
): VirtualListWindowSpec {
  const cellCount = Math.min(items.length, visibleCount + (descriptor.overscan * 2));
  const windowStart = items.length <= cellCount
    ? 0
    : clamp(requestedWindowStart - descriptor.overscan, 0, items.length - cellCount);
  const windowItems = items.slice(windowStart, windowStart + cellCount);

  return {
    itemCount: items.length,
    windowStart,
    cells: windowItems.map(item => ({
      blueprint: descriptor.template.blueprint,
      signalCount: descriptor.template.signalCount,
      initialSignalValues: createTemplateSignalValues(descriptor.template, item)
    }))
  };
}

export function resolveVirtualWindowMetrics(
  descriptor: CompiledVirtualListDescriptor,
  itemCount: number,
  visibleCount: number,
  requestedWindowStart: number
): {
  readonly cellCount: number;
  readonly windowStart: number;
  readonly topSpacerHeight: number;
  readonly bottomSpacerHeight: number;
} {
  const cellCount = Math.min(itemCount, visibleCount + (descriptor.overscan * 2));
  const windowStart = itemCount <= cellCount
    ? 0
    : clamp(requestedWindowStart - descriptor.overscan, 0, itemCount - cellCount);
  const renderedCount = Math.min(cellCount, Math.max(0, itemCount - windowStart));
  const topSpacerHeight = windowStart * descriptor.estimateSize;
  const bottomSpacerHeight = Math.max(0, itemCount - windowStart - renderedCount) * descriptor.estimateSize;

  return {
    cellCount,
    windowStart,
    topSpacerHeight,
    bottomSpacerHeight
  };
}

function readPathValue(source: unknown, path: readonly string[]): unknown {
  let current = source;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function createTemplateSignalValues<T>(
  template: CompiledTemplateDescriptor,
  item: T
): unknown[] {
  return template.signalPaths.map((path, index) => path === null
    ? template.initialSignalValues[index]
    : readPathValue(item, path));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
