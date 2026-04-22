import { describe, expect, it } from "vitest";

import {
  clearDirty,
  createDirtyBitset,
  createDirtyBitsetView,
  isDirty,
  markDirty,
  resetDirtyBitset
} from "../src/index";

describe("@jue/runtime-core dirty bits", () => {
  it("tracks dirty slots across words and can reset them", () => {
    const bitset = createDirtyBitset(40);

    expect(bitset.words).toEqual(new Uint32Array(2));
    expect(isDirty(bitset, 0)).toEqual({
      ok: true,
      value: false,
      error: null
    });

    expect(markDirty(bitset, 0)).toEqual({
      ok: true,
      value: true,
      error: null
    });
    expect(markDirty(bitset, 0)).toEqual({
      ok: true,
      value: false,
      error: null
    });
    expect(markDirty(bitset, 33)).toEqual({
      ok: true,
      value: true,
      error: null
    });

    expect(isDirty(bitset, 0)).toEqual({
      ok: true,
      value: true,
      error: null
    });
    expect(isDirty(bitset, 33)).toEqual({
      ok: true,
      value: true,
      error: null
    });

    expect(clearDirty(bitset, 0)).toEqual({
      ok: true,
      value: undefined,
      error: null
    });
    expect(isDirty(bitset, 0)).toEqual({
      ok: true,
      value: false,
      error: null
    });

    resetDirtyBitset(bitset);
    expect(Array.from(bitset.words)).toEqual([0, 0]);
  });

  it("supports external bitset views and rejects out-of-range slots", () => {
    const words = new Uint32Array([2]);
    const bitset = createDirtyBitsetView(2, words);

    expect(isDirty(bitset, 1)).toEqual({
      ok: true,
      value: true,
      error: null
    });

    expect(markDirty(bitset, -1)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "DIRTY_SLOT_OUT_OF_RANGE",
        message: "Dirty bit slot -1 is out of range for size 2."
      }
    });
    expect(isDirty(bitset, 2)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "DIRTY_SLOT_OUT_OF_RANGE",
        message: "Dirty bit slot 2 is out of range for size 2."
      }
    });
    expect(clearDirty(bitset, 3)).toEqual({
      ok: false,
      value: null,
      error: {
        code: "DIRTY_SLOT_OUT_OF_RANGE",
        message: "Dirty bit slot 3 is out of range for size 2."
      }
    });
  });
});
