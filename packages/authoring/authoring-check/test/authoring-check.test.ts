import { describe, expect, it } from "vitest";

import { checkAuthoringSource, collectReferencedPrimitives, createAuthoringSupportMatrix } from "../src/index";

describe("@jue/authoring-check", () => {
  it("detects referenced structure primitives and support status", () => {
    const source = `
      import { Show, Text, View, signal } from "@jue/jsx";

      export function render() {
        const visible = signal(true);
        return <View><Show when={visible.get()}><Text>ready</Text></Show></View>;
      }
    `;

    expect(collectReferencedPrimitives(source)).toEqual(["Show"]);
    expect(createAuthoringSupportMatrix().some(entry => entry.primitive === "Show" && entry.implemented)).toBe(true);
  });

  it("reports unsupported authoring primitives through compile diagnostics", () => {
    const result = checkAuthoringSource(`
      import { Portal, Text, View, signal } from "@jue/jsx";

      export function render() {
        const visible = signal(true);
        return <View><Portal target={visible.get()}><Text>bad</Text></Portal></View>;
      }
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some(diagnostic => diagnostic.code === "PRIMITIVE_NOT_IMPLEMENTED")).toBe(true);
  });

  it("accepts a custom root symbol when checking authoring source", () => {
    const result = checkAuthoringSource(`
      import { Show, Text, View, signal } from "@jue/jsx";

      export function App() {
        const visible = signal(true);
        return <View><Show when={visible.get()}><Text>ready</Text></Show></View>;
      }
    `, { rootSymbol: "App" });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("accepts an exported const arrow root symbol", () => {
    const result = checkAuthoringSource(`
      import { Show, Text, View, signal } from "@jue/jsx";

      export const App = () => {
        const visible = signal(true);
        return <View><Show when={visible.get()}><Text>ready</Text></Show></View>;
      };
    `, { rootSymbol: "App" });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
});
