import { compileModule } from "@jue/compiler/frontend";
import { getPrimitiveSupport, isStructurePrimitiveName, listStructurePrimitives, type StructurePrimitiveName } from "@jue/primitives";

export interface AuthoringDiagnostic {
  readonly severity: "error" | "info";
  readonly code: string;
  readonly message: string;
}

export interface AuthoringPrimitiveStatus {
  readonly primitive: StructurePrimitiveName;
  readonly referenced: boolean;
  readonly implemented: boolean;
  readonly notes: string;
}

export interface AuthoringCheckResult {
  readonly ok: boolean;
  readonly primitives: readonly AuthoringPrimitiveStatus[];
  readonly diagnostics: readonly AuthoringDiagnostic[];
}

export interface AuthoringCheckOptions {
  readonly rootSymbol?: string;
}

export function collectReferencedPrimitives(source: string): readonly StructurePrimitiveName[] {
  const matches = source.match(/<([A-Z][A-Za-z0-9]*)/g) ?? [];
  const names = new Set<StructurePrimitiveName>();

  for (const match of matches) {
    const candidate = match.slice(1);
    if (isStructurePrimitiveName(candidate)) {
      names.add(candidate);
    }
  }

  return [...names];
}

export function createAuthoringSupportMatrix(): readonly AuthoringPrimitiveStatus[] {
  return listStructurePrimitives().map(primitive => {
    const support = getPrimitiveSupport(primitive);

    return {
      primitive,
      referenced: false,
      implemented: support.implemented,
      notes: support.notes
    };
  });
}

export function checkAuthoringSource(source: string, options: AuthoringCheckOptions = {}): AuthoringCheckResult {
  const referenced = new Set(collectReferencedPrimitives(source));
  const primitives = createAuthoringSupportMatrix().map(status => ({
    ...status,
    referenced: referenced.has(status.primitive)
  }));
  const diagnostics: AuthoringDiagnostic[] = [];
  const compiled = compileModule(source, options.rootSymbol === undefined
    ? {}
    : { rootSymbol: options.rootSymbol });

  for (const primitive of primitives) {
    if (primitive.referenced && !primitive.implemented) {
      diagnostics.push({
        severity: "info",
        code: "PRIMITIVE_NOT_IMPLEMENTED",
        message: `${primitive.primitive} is reserved but not implemented yet.`
      });
    }
  }

  if (!compiled.ok) {
    diagnostics.push({
      severity: "error",
      code: compiled.error.code,
      message: compiled.error.message
    });
  }

  return {
    ok: diagnostics.every(diagnostic => diagnostic.severity !== "error"),
    primitives,
    diagnostics
  };
}
