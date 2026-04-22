import { describe, expect, it } from "vitest";

import { compile } from "../src/index";
import { compileModule } from "../src/frontend/index";

describe("@jue/compiler compileModule", () => {
  it("compiles a TSX module into runtime code, blueprint payload, and handler exports", () => {
    const result = compileModule(`
      import { View, Text, Button, createSignal } from "@jue/jsx";

      let pressed = 0;

      function handlePress() {
        pressed += 1;
      }

      function readPressed() {
        return pressed;
      }

      export function render() {
        const title = createSignal("hello");
        return (
          <View>
            <Text>{title}</Text>
            <Button onPress={handlePress}>go</Button>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.handlerNames).toEqual(["handlePress", "readPressed"]);
    expect(result.value.runtimeCode).toContain("let pressed = 0;");
    expect(result.value.runtimeCode).toContain("function handlePress()");
    expect(result.value.code).toContain("export const handlers");
    expect(result.value.code).toContain("\"handlePress\": handlePress");
    expect(result.value.code).toContain("createBlueprint");
    expect(result.value.blueprint.bindingOpcode).toContain(0);
    expect(result.value.blueprint.bindingOpcode).toContain(5);
  });

  it("omits runtime code when the module only exports render", () => {
    const result = compileModule(`
      import { View, Text } from "@jue/jsx";

      export function render() {
        return <View><Text>hello</Text></View>;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.runtimeCode).toBe("");
    expect(result.value.handlerNames).toEqual([]);
  });
});

describe("@jue/compiler root entry", () => {
  it("keeps root compile() on the moved-entry error", () => {
    expect(compile("function render() {}")).toEqual({
      ok: false,
      value: null,
      error: {
        code: "COMPILE_MOVED",
        message: "compile() moved to @jue/compiler/frontend. Import compile() from that subpath."
      }
    });
  });
});

