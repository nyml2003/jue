import { describe, expect, it } from "vitest";

import {
  benchmarkAllExampleCompilations,
  benchmarkExampleCompilation,
  formatBenchmarkTable,
} from "../src/bench";

describe("@jue/lab/bench", () => {
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

  it("rejects invalid iteration counts and missing examples", async () => {
    const invalidIterations = await benchmarkExampleCompilation("virtual-list-lab", 0);
    expect(invalidIterations).toEqual({
      ok: false,
      value: null,
      error: {
        code: "BENCH_ITERATIONS_INVALID",
        message: "Benchmark iterations must be a positive integer."
      }
    });

    const missingExample = await benchmarkExampleCompilation("missing-example", 1);
    expect(missingExample.ok).toBe(false);
  });

  it("benchmarks the full example suite and formats multi-row tables", async () => {
    const suite = await benchmarkAllExampleCompilations(1);

    expect(suite.ok).toBe(true);
    if (!suite.ok) {
      return;
    }

    expect(suite.value.length).toBeGreaterThan(1);
    const table = formatBenchmarkTable(suite.value.slice(0, 2));
    expect(table).toContain("example");
    expect(table).toContain("avg ms");
  });
});
