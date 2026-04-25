import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createAuthoringSupportMatrix } from "@jue/authoring-check";
import { listExampleApps } from "@jue/examples";
import { compileAllExampleFixtures } from "@jue/testkit";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export async function generatePhase2PackageMatrix(): Promise<string> {
  const examples = await listExampleApps();
  const primitives = createAuthoringSupportMatrix();
  const fixtures = await compileAllExampleFixtures();
  const fixtureCount = fixtures.ok ? fixtures.value.length : 0;

  return [
    "# Phase 2 Package Matrix",
    "",
    `Examples tracked: ${examples.length}`,
    `Compiled fixtures: ${fixtureCount}`,
    "",
    "| Primitive | Implemented | Notes |",
    "| --- | --- | --- |",
    ...primitives.map(primitive => `| ${primitive.primitive} | ${primitive.implemented ? "yes" : "no"} | ${primitive.notes} |`)
  ].join("\n");
}

export async function generateExampleRegistrySnippet(): Promise<string> {
  const examples = await listExampleApps();
  const fixtures = await compileAllExampleFixtures();
  const fixtureSummary = fixtures.ok
    ? fixtures.value.map((fixture: (typeof fixtures.value)[number]) => `- ${fixture.example.id}: ${fixture.summary.bindingCount} bindings, ${fixture.summary.regionCount} regions`)
    : [`- fixture compile failed: ${fixtures.error.code}`];

  return [
    "## Example Registry",
    ...examples.map(example => `- ${example.id}`),
    "",
    "## Fixture Summary",
    ...fixtureSummary
  ].join("\n");
}

export async function generateCoreSpecSnippet(): Promise<string> {
  const specsRoot = join(REPO_ROOT, "docs", "02-core-specs");
  const entries = await readdir(specsRoot, { withFileTypes: true });

  return [
    "## Core Spec Index",
    ...entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
      .map(entry => `- ${entry.name}`)
      .sort((left, right) => left.localeCompare(right))
  ].join("\n");
}
