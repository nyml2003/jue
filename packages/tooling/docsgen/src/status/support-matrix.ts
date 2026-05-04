import { createAuthoringSupportMatrix } from "@jue/authoring-check";
import { listExampleApps } from "@jue/lab/examples";
import { compileAllExampleFixtures } from "@jue/lab/testkit";

export async function generateSupportMatrix(): Promise<string> {
  const examples = await listExampleApps();
  const primitives = createAuthoringSupportMatrix();
  const fixtures = await compileAllExampleFixtures();
  const fixtureCount = fixtures.ok ? fixtures.value.length : 0;

  return [
    "# Support Matrix",
    "",
    `Examples tracked: ${examples.length}`,
    `Compiled fixtures: ${fixtureCount}`,
    "",
    "| Primitive | Implemented | Notes |",
    "| --- | --- | --- |",
    ...primitives.map(primitive => `| ${primitive.primitive} | ${primitive.implemented ? "yes" : "no"} | ${primitive.notes} |`)
  ].join("\n");
}
