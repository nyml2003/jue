import type { Blueprint } from "@jue/runtime-core";
import { err, type Result } from "@jue/shared";

export type { BlockIR, IRBinding, IRNode, IRRegion, LowerBlockIRError, LoweredBlockIR } from "./block-ir";
export { lowerBlockIRToBlueprint } from "./block-ir";
export type {
  BlueprintBuilder,
  BlueprintBuilderError,
  ConditionalRegionDefinition,
  KeyedListRegionDefinition,
  NestedBlockRegionDefinition
} from "./blueprint-builder";
export { buildBlockIR, createBlueprintBuilder } from "./blueprint-builder";

export interface CompileOptions {
  readonly filename?: string;
}

export interface CompileError {
  readonly code: string;
  readonly message: string;
}

export function compile(_source: string, _options: CompileOptions = {}): Result<Blueprint, CompileError> {
  return err({
    code: "NOT_IMPLEMENTED",
    message: "compile() is not implemented yet."
  });
}
