function parsePatternOverride(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
    throw new Error(`${name} must be a JSON-encoded string array.`);
  }

  return parsed;
}

export function readVitestCoverageIncludeOverride(): string[] | undefined {
  return parsePatternOverride("JUE_VITEST_COVERAGE_INCLUDE");
}

export function readVitestIncludeOverride(): string[] | undefined {
  return parsePatternOverride("JUE_VITEST_INCLUDE");
}
