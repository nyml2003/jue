import { describe, expect, it } from "vitest";

import { Boundary, getPrimitiveSupport, isStructurePrimitiveName, listStructurePrimitives, Portal, Show } from "../src/index";

describe("@jue/primitives", () => {
  it("lists the official structure primitives", () => {
    expect(listStructurePrimitives()).toEqual([
      "Show",
      "List",
      "VirtualList",
      "Portal",
      "Boundary"
    ]);
  });

  it("describes current support status", () => {
    expect(getPrimitiveSupport(Show).implemented).toBe(true);
    expect(getPrimitiveSupport(Portal).implemented).toBe(false);
    expect(getPrimitiveSupport(Boundary).phase).toBe("phase-3");
  });

  it("recognizes structure primitive names", () => {
    expect(isStructurePrimitiveName("Show")).toBe(true);
    expect(isStructurePrimitiveName("View")).toBe(false);
  });
});
