import { describe, expect, it } from "vitest";

import { checkAuthoringSource, collectReferencedPrimitives, createAuthoringSupportMatrix } from "../src/index";

describe("@jue/authoring-check", () => {
  it("detects referenced structure primitives and support status", () => {
    const source = `
      import { Show, Text, View } from "@jue/jsx";

      export function render() {
        const visible = createSignal(true);
        return <View><Show when={visible}><Text>ready</Text></Show></View>;
      }
    `;

    expect(collectReferencedPrimitives(source)).toEqual(["Show"]);
    expect(createAuthoringSupportMatrix().some(entry => entry.primitive === "Show" && entry.implemented)).toBe(true);
  });

  it("reports unsupported authoring primitives through compile diagnostics", () => {
    const result = checkAuthoringSource(`
      import { Portal, Text, View, createSignal } from "@jue/jsx";

      export function render() {
        const visible = createSignal(true);
        return <View><Portal target={visible}><Text>bad</Text></Portal></View>;
      }
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some(diagnostic => diagnostic.code === "PRIMITIVE_NOT_IMPLEMENTED")).toBe(true);
  });
});
