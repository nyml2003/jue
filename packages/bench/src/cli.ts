import { benchmarkAllExampleCompilations, formatBenchmarkTable } from "./index";

async function main() {
  const rawIterations = process.argv[2];
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
}

void main();
