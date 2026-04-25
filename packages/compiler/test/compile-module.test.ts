import { describe, expect, it } from "vitest";

import { compile } from "../src/index";
import { compileModule } from "../src/frontend/index";

describe("@jue/compiler compileModule", () => {
  it("compiles a TSX module into runtime code, blueprint payload, and handler exports", () => {
    const result = compileModule(`
      import { View, Text, Button, signal } from "@jue/jsx";

      let pressed = 0;

      function handlePress() {
        pressed += 1;
        title.set("pressed");
      }

      function readPressed() {
        return pressed;
      }

      export function render() {
        const title = signal("hello");
        return (
          <View>
            <Text>{title.get()}</Text>
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
    expect(result.value.code).toContain("export function createRuntime()");
    expect(result.value.code).toContain("export const signalSlots");
    expect(result.value.code).toContain("configureSignalRuntime");
    expect(result.value.code).toContain("const title = __jueCreateSignalRef(\"title\");");
    expect(result.value.code).toContain("handlers: { \"handlePress\": handlePress, \"readPressed\": readPressed }");
    expect(result.value.code).toContain("\"handlePress\": handlePress");
    expect(result.value.code).toContain("createBlueprint");
    expect(result.value.blueprint.bindingOpcode).toContain(0);
    expect(result.value.blueprint.bindingOpcode).toContain(5);
    expect(result.value.signalSlots).toEqual({ title: 0 });
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
    expect(result.value.code).toContain("export function createRuntime()");
  });

  it("emits keyed list and virtual list descriptors for authored structure primitives", () => {
    const result = compileModule(`
      import { List, Text, View, VirtualList, createSignal } from "@jue/jsx";

      export function render() {
        const items = createSignal([
          { id: "a", label: "Alpha" },
          { id: "b", label: "Bravo" }
        ]);
        const rows = createSignal([
          { id: "0", label: "Row 00" },
          { id: "1", label: "Row 01" },
          { id: "2", label: "Row 02" }
        ]);

        return (
          <View>
            <List each={items} by={item => item.id}>
              {item => <Text className="item-label">{item.label}</Text>}
            </List>
            <VirtualList each={rows} by={row => row.id} estimateSize={() => 44} overscan={1}>
              {row => <Text className="row-label">{row.label}</Text>}
            </VirtualList>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.keyedListDescriptors).toHaveLength(1);
    expect(result.value.virtualListDescriptors).toHaveLength(1);
    expect(result.value.keyedListDescriptors[0]).toMatchObject({
      regionSlot: 0,
      sourceSignalSlot: 0,
      keyPath: ["id"]
    });
    expect(result.value.virtualListDescriptors[0]).toMatchObject({
      regionSlot: 1,
      sourceSignalSlot: 1,
      keyPath: ["id"],
      estimateSize: 44,
      overscan: 1
    });
    expect(result.value.keyedListDescriptors[0]?.template.initialSignalValues).toEqual(["item-label"]);
    expect(result.value.keyedListDescriptors[0]?.template.signalPaths).toEqual([null, ["label"]]);
    expect(result.value.virtualListDescriptors[0]?.template.initialSignalValues).toEqual(["row-label"]);
    expect(result.value.virtualListDescriptors[0]?.template.signalPaths).toEqual([null, ["label"]]);
    expect(result.value.code).toContain("export const keyedListDescriptors");
    expect(result.value.code).toContain("export const virtualListDescriptors");
    expect(result.value.signalSlots).toEqual({
      items: 0,
      rows: 1
    });
  });

  it("keeps non-jsx runtime imports and top-level signal declarations available to generated handlers", () => {
    const result = compileModule(`
      import { createRouter } from "@jue/router";
      import { signal, Text, View, Button } from "@jue/jsx";

      const count = signal(0);
      const router = createRouter({
        history: {
          current() { return "/"; },
          navigate() {},
          replace() {},
          back() {},
          subscribe() { return { unsubscribe() {} }; }
        }
      });

      function handlePress() {
        count.update(value => value + 1);
        router.navigate("/next");
      }

      export function render() {
        return (
          <View>
            <Text>{count.get()}</Text>
            <Button onPress={handlePress}>go</Button>
          </View>
        );
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.code).toContain("import { createRouter } from \"@jue/router\";");
    expect(result.value.code).toContain("const count = __jueCreateSignalRef(\"count\");");
    expect(result.value.runtimeCode).not.toContain("const count = signal(0);");
    expect(result.value.runtimeCode).toContain("const router = createRouter");
    expect(result.value.code).not.toContain("export const handlers");
    expect(result.value.signalSlots).toEqual({ count: 0 });
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
