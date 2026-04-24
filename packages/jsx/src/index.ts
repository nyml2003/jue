import type { HostPrimitive } from "@jue/shared";

export const View = "View" as const satisfies HostPrimitive;
export const Text = "Text" as const satisfies HostPrimitive;
export const Button = "Button" as const satisfies HostPrimitive;
export const Input = "Input" as const satisfies HostPrimitive;
export const Image = "Image" as const satisfies HostPrimitive;
export const ScrollView = "ScrollView" as const satisfies HostPrimitive;
export const List = "List" as const;
export const VirtualList = "VirtualList" as const;

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
