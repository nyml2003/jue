import type { Blueprint } from "@jue/runtime-core";
import { err, type Result } from "@jue/shared";

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
