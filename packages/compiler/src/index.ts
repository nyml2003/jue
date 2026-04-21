import type { Blueprint } from "@jue/runtime-core";
import { err, type Result } from "@jue/shared";

import { lowerBlockIRToBlueprint } from "./block-ir";

export type { BlockIR, IRBinding, IRNode, IRRegion, LowerBlockIRError, LoweredBlockIR } from "./block-ir";
export { lowerBlockIRToBlueprint } from "./block-ir";
export type {
  BlueprintBuilder,
  BlueprintBuilderError,
  ConditionalRegionDefinition,
  KeyedListRegionDefinition,
  NestedBlockRegionDefinition,
  VirtualListRegionDefinition
} from "./blueprint-builder";
export { buildBlockIR, createBlueprintBuilder } from "./blueprint-builder";

export interface CompileOptions {
  readonly _legacyCompileMoved?: never;
}

export interface CompileError {
  readonly code: string;
  readonly message: string;
}

export function compile(_source: string, _options: CompileOptions = {}): Result<Blueprint, CompileError> {
  return {
    ok: false,
    value: null,
    error: {
      code: "COMPILE_MOVED",
      message: "compile() moved to @jue/compiler/frontend. Import compile() from that subpath."
    }
  } satisfies Result<Blueprint, CompileError>;
}
