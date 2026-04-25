import type { HostPrimitive } from "@jue/shared";
export { Boundary, List, Portal, Show, VirtualList } from "@jue/primitives";

export interface Signal<T> {
  get(): T;
  set(value: T): void;
  update(updater: (value: T) => T): void;
}

export const View = "View" as const satisfies HostPrimitive;
export const Text = "Text" as const satisfies HostPrimitive;
export const Button = "Button" as const satisfies HostPrimitive;
export const Input = "Input" as const satisfies HostPrimitive;
export const Image = "Image" as const satisfies HostPrimitive;
export const ScrollView = "ScrollView" as const satisfies HostPrimitive;

export type JueJsxPrimitive =
  | typeof View
  | typeof Text
  | typeof Button
  | typeof Input
  | typeof Image
  | typeof ScrollView;

export function createSignal<T>(initialValue: T): T {
  return initialValue;
}

export function signal<T>(initialValue: T): Signal<T> {
  let current = initialValue;

  return {
    get() {
      return current;
    },
    set(value) {
      current = value;
    },
    update(updater) {
      current = updater(current);
    }
  };
}
