import { listExampleApps } from "@jue/lab/examples";
import { compileAllExampleFixtures } from "@jue/lab/testkit";

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
