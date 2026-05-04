import { readFile } from "node:fs/promises";

import { compileModule, type CompiledModule, type SerializedBlueprint } from "@jue/compiler/frontend";
import { getExampleAppDefinition, type ExampleAppDefinition } from "@jue/examples";
import { err, ok, type Result } from "@jue/shared";

export interface BlueprintInspectionSummary {
  readonly nodeCount: number;
  readonly bindingCount: number;
  readonly regionCount: number;
  readonly signalCount: number;
  readonly bindingOpcodes: readonly number[];
  readonly regionTypes: readonly number[];
}

export interface CompiledModuleInspectionSummary extends BlueprintInspectionSummary {
  readonly handlerCount: number;
  readonly keyedListDescriptorCount: number;
  readonly virtualListDescriptorCount: number;
  readonly runtimeLineCount: number;
}

export interface InspectedExampleApp {
  readonly example: ExampleAppDefinition;
  readonly source: string;
  readonly module: CompiledModule;
  readonly summary: CompiledModuleInspectionSummary;
}

export interface InspectError {
  readonly code: string;
  readonly message: string;
}

export function inspectSerializedBlueprint(
  blueprint: SerializedBlueprint,
  signalCount: number = blueprint.signalToBindingCount.length
): BlueprintInspectionSummary {
  return {
    nodeCount: blueprint.nodeCount,
    bindingCount: blueprint.bindingOpcode.length,
    regionCount: blueprint.regionType.length,
    signalCount,
    bindingOpcodes: blueprint.bindingOpcode,
    regionTypes: blueprint.regionType
  };
}

export function inspectCompiledModule(module: CompiledModule): CompiledModuleInspectionSummary {
  const blueprint = inspectSerializedBlueprint(module.blueprint, module.signalCount);

  return {
    ...blueprint,
    handlerCount: module.handlerNames.length,
    keyedListDescriptorCount: module.keyedListDescriptors.length,
    virtualListDescriptorCount: module.virtualListDescriptors.length,
    runtimeLineCount: module.runtimeCode
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0).length
  };
}

export async function inspectExampleApp(exampleId: string): Promise<Result<InspectedExampleApp, InspectError>> {
  const example = await getExampleAppDefinition(exampleId);
  if (!example) {
    return err({
      code: "EXAMPLE_NOT_FOUND",
      message: `Unknown example app ${exampleId}.`
    });
  }

  const source = await readFile(example.componentPath, "utf8");
  const compiled = compileModule(source, {
    rootSymbol: example.rootSymbol
  });
  if (!compiled.ok) {
    return err(compiled.error);
  }

  return ok({
    example,
    source,
    module: compiled.value,
    summary: inspectCompiledModule(compiled.value)
  });
}
