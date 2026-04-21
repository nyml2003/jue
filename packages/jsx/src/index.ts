import type { HostPrimitive } from "@jue/shared";

export const View = "View" as HostPrimitive;
export const Text = "Text" as HostPrimitive;
export const Button = "Button" as HostPrimitive;
export const Input = "Input" as HostPrimitive;
export const Image = "Image" as HostPrimitive;
export const ScrollView = "ScrollView" as HostPrimitive;

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
