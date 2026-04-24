import { readFile } from "node:fs/promises";

import { compileModule, type CompiledModule } from "@jue/compiler/frontend";
import { getExampleAppDefinition, listExampleApps, type ExampleAppDefinition } from "@jue/examples";
import { inspectCompiledModule, type CompiledModuleInspectionSummary } from "@jue/inspect";
import { err, ok, type Result } from "@jue/shared";

export interface FixtureError {
  readonly code: string;
  readonly message: string;
}

export interface LoadedExampleFixtureSource {
  readonly example: ExampleAppDefinition;
  readonly source: string;
}

export interface CompiledExampleFixture extends LoadedExampleFixtureSource {
  readonly module: CompiledModule;
  readonly summary: CompiledModuleInspectionSummary;
}

export function compileFixtureSource(
  source: string
): Result<{ readonly module: CompiledModule; readonly summary: CompiledModuleInspectionSummary }, FixtureError> {
  const compiled = compileModule(source);
  if (!compiled.ok) {
    return err(compiled.error);
  }

  return ok({
    module: compiled.value,
    summary: inspectCompiledModule(compiled.value)
  });
}

export async function loadExampleFixtureSource(
  exampleId: string
): Promise<Result<LoadedExampleFixtureSource, FixtureError>> {
  const example = await getExampleAppDefinition(exampleId);
  if (!example) {
    return err({
      code: "EXAMPLE_NOT_FOUND",
      message: `Unknown example fixture ${exampleId}.`
    });
  }

  return ok({
    example,
    source: await readFile(example.componentPath, "utf8")
  });
}

export async function compileExampleFixture(
  exampleId: string
): Promise<Result<CompiledExampleFixture, FixtureError>> {
  const loaded = await loadExampleFixtureSource(exampleId);
  if (!loaded.ok) {
    return loaded;
  }

  const compiled = compileFixtureSource(loaded.value.source);
  if (!compiled.ok) {
    return compiled;
  }

  return ok({
    ...loaded.value,
    module: compiled.value.module,
    summary: compiled.value.summary
  });
}

export async function compileAllExampleFixtures(): Promise<Result<readonly CompiledExampleFixture[], FixtureError>> {
  const examples = await listExampleApps();
  const fixtures: CompiledExampleFixture[] = [];

  for (const example of examples) {
    const fixture = await compileExampleFixture(example.id);
    if (!fixture.ok) {
      return fixture;
    }

    fixtures.push(fixture.value);
  }

  return ok(fixtures);
}
