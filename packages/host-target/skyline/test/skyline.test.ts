import { describe, expect, it } from "vitest";

import type { BlockIR } from "@jue/compiler";

import { compileSkylineBlockIR, compileSkylineSource } from "../src/index";

describe("@jue/skyline", () => {
  it("lowers a minimal host block into a skyline artifact", () => {
    const block: BlockIR = {
      signalCount: 1,
      initialSignalValues: ["hello"],
      nodes: [
        { id: 0, kind: "element", type: "View", parent: null },
        { id: 1, kind: "text", value: "", parent: 0 }
      ],
      bindings: [
        { kind: "text", node: 1, signal: 0 }
      ]
    };

    const result = compileSkylineBlockIR(block);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.signalCount).toBe(1);
    expect(result.value.signalData).toEqual({ s0: "hello" });
    expect(result.value.template).toEqual([
      { kind: "element", type: "View", id: 0, parent: null },
      { kind: "text", type: "#text", id: 1, parent: 0, staticText: "" }
    ]);
    expect(result.value.templateCode).toBe("<view>{{signals.s0}}</view>");
    expect(result.value.bindings).toEqual([
      { kind: "text", node: 1, signal: 0, valuePath: "signals.s0" }
    ]);
  });

  it("captures conditional and keyed-list region metadata", () => {
    const block: BlockIR = {
      signalCount: 1,
      nodes: [
        { id: 0, kind: "element", type: "View", parent: null },
        { id: 1, kind: "text", value: "A", parent: 0 },
        { id: 2, kind: "text", value: "B", parent: 0 },
        { id: 3, kind: "text", value: "[", parent: 0 },
        { id: 4, kind: "text", value: "]", parent: 0 }
      ],
      bindings: [
        { kind: "region-switch", signal: 0, region: 0, truthyBranch: 0, falsyBranch: 1 }
      ],
      regions: [
        {
          kind: "conditional",
          anchorStartNode: 1,
          anchorEndNode: 2,
          branches: [
            { startNode: 1, endNode: 1 },
            { startNode: 2, endNode: 2 }
          ]
        },
        {
          kind: "keyed-list",
          anchorStartNode: 3,
          anchorEndNode: 4
        }
      ]
    };

    const result = compileSkylineBlockIR(block);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.conditionals).toEqual([
      {
        kind: "conditional",
        anchorStartNode: 1,
        anchorEndNode: 2,
        branches: [
          { startNode: 1, endNode: 1 },
          { startNode: 2, endNode: 2 }
        ]
      }
    ]);
    expect(result.value.keyedLists).toEqual([
      {
        kind: "keyed-list",
        anchorStartNode: 3,
        anchorEndNode: 4
      }
    ]);
  });

  it("rejects unsupported skyline event bindings and unsupported region kinds", () => {
    const withEvent: BlockIR = {
      signalCount: 0,
      nodes: [
        { id: 0, kind: "element", type: "Button", parent: null }
      ],
      bindings: [
        { kind: "event", node: 0, event: "onPress", handler: "noop" }
      ]
    };

    expect(compileSkylineBlockIR(withEvent)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "SKYLINE_EVENT_UNSUPPORTED",
        message: "Skyline target does not lower event bindings yet."
      }
    });

    const withVirtualList: BlockIR = {
      signalCount: 0,
      nodes: [
        { id: 0, kind: "element", type: "View", parent: null }
      ],
      bindings: [],
      regions: [
        {
          kind: "virtual-list",
          anchorStartNode: 0,
          anchorEndNode: 0
        }
      ]
    };

    expect(compileSkylineBlockIR(withVirtualList)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "SKYLINE_REGION_UNSUPPORTED",
        message: "Skyline target does not support virtual-list regions yet."
      }
    });
  });

  it("compiles TSX source directly into a skyline artifact", () => {
    const result = compileSkylineSource(`
      import { View, Text, signal } from "@jue/jsx";

      export function App() {
        const title = signal("hello");
        return <View><Text>{title.get()}</Text></View>;
      }
    `, { rootSymbol: "App" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.signalCount).toBe(1);
    expect(result.value.signalData).toEqual({ s0: "hello" });
    expect(result.value.templateCode).toBe("<view><text>{{signals.s0}}</text></view>");
    expect(result.value.bindings).toEqual([
      { kind: "text", node: 2, signal: 0, valuePath: "signals.s0" }
    ]);
  });

  it("preserves keyed list metadata during source compilation", () => {
    const result = compileSkylineSource(`
      import { List, Text, View, signal } from "@jue/jsx";

      export function App() {
        const items = signal([
          { id: "a", label: "Alpha" },
          { id: "b", label: "Bravo" }
        ]);

        return (
          <View>
            <List each={items.get()} by={item => item.id}>
              {item => <Text>{item.label}</Text>}
            </List>
          </View>
        );
      }
    `, { rootSymbol: "App" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.keyedLists).toEqual([
      {
        kind: "keyed-list",
        anchorStartNode: 1,
        anchorEndNode: 2,
        sourceSignalSlot: 0,
        keyPath: ["id"],
        template: {
          signalCount: 1,
          initialSignalValues: [],
          signalData: { s0: null },
          signalPaths: [["label"]],
          template: [
            { kind: "element", type: "Text", id: 0, parent: null },
            { kind: "text", type: "#text", id: 1, parent: 0, staticText: "" }
          ],
          templateCode: "<text>{{signals.s0}}</text>",
          bindings: [
            { kind: "text", node: 1, signal: 0, valuePath: "signals.s0" }
          ]
        }
      }
    ]);
  });

  it("rejects unsupported event bindings during source compilation", () => {
    const result = compileSkylineSource(`
      import { Button, View } from "@jue/jsx";

      function handlePress() {}

      export function App() {
        return <View><Button onPress={handlePress}>go</Button></View>;
      }
    `, { rootSymbol: "App" });

    expect(result).toEqual({
      ok: false,
      value: null,
      error: {
        code: "SKYLINE_EVENT_UNSUPPORTED",
        message: "Skyline target does not lower event bindings yet."
      }
    });
  });
});
