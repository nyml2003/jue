import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ExampleAppDefinition {
  readonly id: string;
  readonly appRoot: string;
  readonly componentPath: string;
  readonly generatedModulePath: string;
  readonly runtimeEntryPath: string;
  readonly unitTestPath: string;
  readonly errorTestPath: string;
  readonly e2eTestPath: string;
  readonly cssPath: string;
  readonly indexHtmlPath: string;
  readonly mainPath: string;
  readonly distRoot: string;
}

export const DEFAULT_WEB_PLAYGROUND_APPS_ROOT = fileURLToPath(
  new URL("../../../examples/web-playground/apps", import.meta.url)
);

export function createExampleAppDefinition(appRoot: string): ExampleAppDefinition {
  const id = basename(appRoot);

  return {
    id,
    appRoot,
    componentPath: join(appRoot, "page.component.tsx"),
    generatedModulePath: join(appRoot, "generated", "page.generated.ts"),
    runtimeEntryPath: join(appRoot, "page.ts"),
    unitTestPath: join(appRoot, "page.test.ts"),
    errorTestPath: join(appRoot, "page.error.test.ts"),
    e2eTestPath: join(appRoot, "e2e", "page.spec.ts"),
    cssPath: join(appRoot, "page.css"),
    indexHtmlPath: join(appRoot, "index.html"),
    mainPath: join(appRoot, "main.ts"),
    distRoot: join(appRoot, "dist")
  };
}

export async function listExampleApps(
  appsRoot: string = DEFAULT_WEB_PLAYGROUND_APPS_ROOT
): Promise<readonly ExampleAppDefinition[]> {
  const entries = await readdir(appsRoot, { withFileTypes: true });

  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => createExampleAppDefinition(join(appsRoot, entry.name)))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function getExampleAppDefinition(
  exampleId: string,
  appsRoot: string = DEFAULT_WEB_PLAYGROUND_APPS_ROOT
): Promise<ExampleAppDefinition | null> {
  const examples = await listExampleApps(appsRoot);
  return examples.find(example => example.id === exampleId) ?? null;
}
