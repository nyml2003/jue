import { performance } from "node:perf_hooks";

import { err, ok, type Result } from "@jue/shared";

import { listExampleApps } from "./examples.js";
import { compileFixtureSource, loadExampleFixtureSource } from "./testkit.js";

export interface BenchmarkSample {
  readonly exampleId: string;
  readonly iterations: number;
  readonly durationsMs: readonly number[];
  readonly avgMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

export interface BenchError {
  readonly code: string;
  readonly message: string;
}

export async function benchmarkExampleCompilation(
  exampleId: string,
  iterations: number = 5
): Promise<Result<BenchmarkSample, BenchError>> {
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return err({
      code: "BENCH_ITERATIONS_INVALID",
      message: "Benchmark iterations must be a positive integer."
    });
  }

  const loadedSource = await loadExampleFixtureSource(exampleId);
  if (!loadedSource.ok) {
    return loadedSource;
  }

  const durationsMs: number[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    const compiled = compileFixtureSource(loadedSource.value.source);
    const finishedAt = performance.now();
    if (!compiled.ok) {
      return compiled;
    }

    durationsMs.push(finishedAt - startedAt);
  }

  return ok(createBenchmarkSample(exampleId, durationsMs));
}

export async function benchmarkAllExampleCompilations(
  iterations: number = 5
): Promise<Result<readonly BenchmarkSample[], BenchError>> {
  const examples = await listExampleApps();
  const samples: BenchmarkSample[] = [];

  for (const example of examples) {
    const sample = await benchmarkExampleCompilation(example.id, iterations);
    if (!sample.ok) {
      return sample;
    }

    samples.push(sample.value);
  }

  return ok(samples);
}

export function formatBenchmarkTable(samples: readonly BenchmarkSample[]): string {
  const rows = [
    ["example", "iterations", "avg ms", "min ms", "max ms"],
    ...samples.map(sample => [
      sample.exampleId,
      String(sample.iterations),
      sample.avgMs.toFixed(3),
      sample.minMs.toFixed(3),
      sample.maxMs.toFixed(3)
    ])
  ];
  const widths = rows[0]?.map((_, index) => Math.max(...rows.map(row => row[index]?.length ?? 0))) ?? [];

  return rows
    .map(row => row.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join("  "))
    .join("\n");
}

function createBenchmarkSample(exampleId: string, durationsMs: readonly number[]): BenchmarkSample {
  const total = durationsMs.reduce((sum, duration) => sum + duration, 0);
  const minMs = Math.min(...durationsMs);
  const maxMs = Math.max(...durationsMs);

  return {
    exampleId,
    iterations: durationsMs.length,
    durationsMs,
    avgMs: total / durationsMs.length,
    minMs,
    maxMs
  };
}
