import type { Blueprint } from "@jue/runtime-core";
import { err, type Result } from "@jue/shared";

import { lowerBlockIRToBlueprint } from "../block-ir";
import { compileSourceToBlockIR } from "./compile-to-block-ir";

export {
  compileSourceToBlockIR,
  type CompileSourceToBlockIROptions,
  type CompileToBlockIRResult,
  type CompileToBlockIRError,
  type CompiledKeyedListDescriptor,
  type CompiledTemplateDescriptor,
  type CompiledVirtualListDescriptor
} from "./compile-to-block-ir";

export {
  compileModule,
  type CompiledModule,
  type SerializedBlueprint,
  type SerializedKeyedListDescriptor,
  type SerializedTemplateDescriptor,
  type SerializedVirtualListDescriptor
} from "./compile-module";

export interface CompileOptions {
  readonly filename?: string;
  readonly handlers?: Readonly<Record<string, unknown>>;
  readonly rootSymbol?: string;
}

export interface CompileError {
  readonly code: string;
  readonly message: string;
}

export function compile(source: string, options: CompileOptions = {}): Result<Blueprint, CompileError> {
  const block = compileSourceToBlockIR(source, {
    ...(options.handlers === undefined ? {} : { handlers: options.handlers }),
    ...(options.rootSymbol === undefined ? {} : { rootSymbol: options.rootSymbol })
  });
  if (!block.ok) {
    return err(block.error);
  }

  const lowered = lowerBlockIRToBlueprint(block.value.block);
  if (!lowered.ok) {
    return err(lowered.error);
  }

  return {
    ok: true,
    value: lowered.value.blueprint,
    error: null
  };
}
