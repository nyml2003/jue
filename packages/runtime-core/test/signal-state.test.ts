import { describe, expect, it } from "vitest";

import { createSignalState, readSignal, writeSignal } from "../src/index";

describe("@jue/runtime-core signal-state", () => {
  it("rejects out-of-range signal reads and writes", () => {
    const state = createSignalState(1);

    expect(readSignal(state, 2)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "SIGNAL_SLOT_OUT_OF_RANGE",
        message: "Signal slot 2 is out of range for size 1."
      }
    });

    expect(writeSignal(state, -1, "x")).toEqual({
      ok: false,
      value: null,
      error: {
        code: "SIGNAL_SLOT_OUT_OF_RANGE",
        message: "Signal slot -1 is out of range for size 1."
      }
    });
  });

  it("returns false when writing the same value", () => {
    const state = createSignalState(1);
    expect(writeSignal(state, 0, null)).toEqual({
      ok: true,
      value: false,
      error: null
    });
    expect(state.version[0]).toBe(0);
  });
});

