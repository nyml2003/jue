import { benchmarkAllExampleCompilations, formatBenchmarkTable } from "./bench.js";

async function main() {
  const command = process.argv[2];

  if (command === "bench") {
    const rawIterations = process.argv[3];
    const parsedIterations = rawIterations === undefined ? Number.NaN : Number(rawIterations);
    const iterations = Number.isInteger(parsedIterations) && parsedIterations > 0
      ? parsedIterations
      : 5;

    const benchmark = await benchmarkAllExampleCompilations(iterations);
    if (!benchmark.ok) {
      console.error(`${benchmark.error.code}: ${benchmark.error.message}`);
      process.exitCode = 1;
      return;
    }

    console.log(formatBenchmarkTable(benchmark.value));
    return;
  }

  if (command === "compile-examples") {
    const { compileExampleComponents } = await import("./compile-examples.js");
    await compileExampleComponents();
    return;
  }

  console.error(`Unknown command: ${command}. Available: bench, compile-examples`);
  process.exitCode = 1;
}

void main();
