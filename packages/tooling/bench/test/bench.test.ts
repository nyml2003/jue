import { describe, expect, it } from "vitest";

import { benchmarkExampleCompilation, formatBenchmarkTable } from "../src/index";

describe("@jue/bench", () => {
  it("benchmarks example compilation with deterministic sample metadata", async () => {
    const benchmark = await benchmarkExampleCompilation("virtual-list-lab", 2);

    expect(benchmark.ok).toBe(true);
    if (!benchmark.ok) {
      return;
    }

    expect(benchmark.value.iterations).toBe(2);
    expect(benchmark.value.minMs).toBeGreaterThanOrEqual(0);
    expect(formatBenchmarkTable([benchmark.value])).toContain("virtual-list-lab");
  });
});
