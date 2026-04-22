import generateModule from "@babel/generator";
import * as t from "@babel/types";
import type { Blueprint } from "@jue/runtime-core";
import { err, ok, type Result } from "@jue/shared";

import { lowerBlockIRToBlueprint } from "../block-ir";
import { compileSourceToBlockIR, type CompileToBlockIRError } from "./compile-to-block-ir";
import { parseModule } from "./parse";

type GenerateFunction = typeof generateModule;
const generate = resolveGenerateFunction(generateModule);

export interface CompiledModule {
  readonly code: string;
  readonly blueprint: SerializedBlueprint;
  readonly signalCount: number;
  readonly initialSignalValues: readonly unknown[];
  readonly runtimeCode: string;
  readonly handlerNames: readonly string[];
}

function resolveGenerateFunction(value: unknown): GenerateFunction {
  if (typeof value === "function") {
    return value as GenerateFunction;
  }

  if (typeof value === "object" && value !== null && "default" in value) {
    return resolveGenerateFunction((value as { readonly default: unknown }).default);
  }

  throw new TypeError("@babel/generator did not expose a callable generator function.");
}

export interface SerializedBlueprint {
  readonly nodeCount: number;
  readonly nodeKind: readonly number[];
  readonly nodePrimitiveRefIndex: readonly number[];
  readonly nodeTextRefIndex: readonly number[];
  readonly nodeParentIndex: readonly number[];
  readonly bindingOpcode: readonly number[];
  readonly bindingNodeIndex: readonly number[];
  readonly bindingDataIndex: readonly number[];
  readonly bindingArgU32: readonly number[];
  readonly bindingArgRef: readonly unknown[];
  readonly regionType: readonly number[];
  readonly regionAnchorStart: readonly number[];
  readonly regionAnchorEnd: readonly number[];
  readonly regionBranchRangeStart: readonly number[];
  readonly regionBranchRangeCount: readonly number[];
  readonly regionBranchNodeStart: readonly number[];
  readonly regionBranchNodeEnd: readonly number[];
  readonly regionNestedBlockSlot: readonly number[];
  readonly regionNestedBlueprintSlot: readonly number[];
  readonly regionNestedMountMode: readonly number[];
  readonly signalToBindingStart: readonly number[];
  readonly signalToBindingCount: readonly number[];
  readonly signalToBindings: readonly number[];
}

export function compileModule(
  source: string
): Result<CompiledModule, CompileToBlockIRError> {
  const ast = parseModule(source);
  const runtime = buildRuntimeStatements(ast);
  const block = compileSourceToBlockIR(source, {
    handlers: Object.fromEntries(runtime.handlerNames.map(name => [name, createHandlerMarker(name)]))
  });
  if (!block.ok) {
    return block;
  }

  const lowered = lowerBlockIRToBlueprint(block.value.block);
  if (!lowered.ok) {
    return err(lowered.error);
  }

  const serialized = serializeBlueprint(lowered.value.blueprint);
  return ok({
    code: createCompiledModuleCode({
      blueprint: serialized,
      signalCount: lowered.value.signalCount,
      initialSignalValues: lowered.value.initialSignalValues,
      runtimeCode: runtime.code,
      handlerNames: runtime.handlerNames
    }),
    blueprint: serialized,
    signalCount: lowered.value.signalCount,
    initialSignalValues: lowered.value.initialSignalValues,
    runtimeCode: runtime.code,
    handlerNames: runtime.handlerNames
  });
}

function createHandlerMarker(name: string): string {
  return `__jue_handler__:${name}`;
}

function createCompiledModuleCode(input: {
  readonly blueprint: SerializedBlueprint;
  readonly signalCount: number;
  readonly initialSignalValues: readonly unknown[];
  readonly runtimeCode: string;
  readonly handlerNames: readonly string[];
}): string {
  const handlerEntries = input.handlerNames
    .map(name => `${JSON.stringify(name)}: ${name}`)
    .join(", ");
  const bindingArgRef = `[${input.blueprint.bindingArgRef
    .map(value => typeof value === "string" && value.startsWith("__jue_handler__:")
      ? value.slice("__jue_handler__:".length)
      : JSON.stringify(value))
    .join(", ")}]`;

  return `
    import { createBlueprint } from "@jue/runtime-core";

    ${input.runtimeCode}

    const blueprintResult = createBlueprint({
      nodeCount: ${JSON.stringify(input.blueprint.nodeCount)},
      nodeKind: new Uint8Array(${JSON.stringify(input.blueprint.nodeKind)}),
      nodePrimitiveRefIndex: new Uint32Array(${JSON.stringify(input.blueprint.nodePrimitiveRefIndex)}),
      nodeTextRefIndex: new Uint32Array(${JSON.stringify(input.blueprint.nodeTextRefIndex)}),
      nodeParentIndex: new Uint32Array(${JSON.stringify(input.blueprint.nodeParentIndex)}),
      bindingOpcode: new Uint8Array(${JSON.stringify(input.blueprint.bindingOpcode)}),
      bindingNodeIndex: new Uint32Array(${JSON.stringify(input.blueprint.bindingNodeIndex)}),
      bindingDataIndex: new Uint32Array(${JSON.stringify(input.blueprint.bindingDataIndex)}),
      bindingArgU32: new Uint32Array(${JSON.stringify(input.blueprint.bindingArgU32)}),
      bindingArgRef: ${bindingArgRef},
      regionType: new Uint8Array(${JSON.stringify(input.blueprint.regionType)}),
      regionAnchorStart: new Uint32Array(${JSON.stringify(input.blueprint.regionAnchorStart)}),
      regionAnchorEnd: new Uint32Array(${JSON.stringify(input.blueprint.regionAnchorEnd)}),
      regionBranchRangeStart: new Uint32Array(${JSON.stringify(input.blueprint.regionBranchRangeStart)}),
      regionBranchRangeCount: new Uint32Array(${JSON.stringify(input.blueprint.regionBranchRangeCount)}),
      regionBranchNodeStart: new Uint32Array(${JSON.stringify(input.blueprint.regionBranchNodeStart)}),
      regionBranchNodeEnd: new Uint32Array(${JSON.stringify(input.blueprint.regionBranchNodeEnd)}),
      regionNestedBlockSlot: new Uint32Array(${JSON.stringify(input.blueprint.regionNestedBlockSlot)}),
      regionNestedBlueprintSlot: new Uint32Array(${JSON.stringify(input.blueprint.regionNestedBlueprintSlot)}),
      regionNestedMountMode: new Uint8Array(${JSON.stringify(input.blueprint.regionNestedMountMode)}),
      signalToBindingStart: new Uint32Array(${JSON.stringify(input.blueprint.signalToBindingStart)}),
      signalToBindingCount: new Uint32Array(${JSON.stringify(input.blueprint.signalToBindingCount)}),
      signalToBindings: new Uint32Array(${JSON.stringify(input.blueprint.signalToBindings)})
    });

    if (!blueprintResult.ok) {
      throw new Error(blueprintResult.error.message);
    }

    export const blueprint = blueprintResult.value;
    export const signalCount = ${JSON.stringify(input.signalCount)};
    export const initialSignalValues = ${JSON.stringify(input.initialSignalValues)};
    export const handlers = { ${handlerEntries} };
  `;
}

function buildRuntimeStatements(ast: t.File): {
  readonly code: string;
  readonly handlerNames: readonly string[];
} {
  const statements: t.Statement[] = [];
  const handlerNames: string[] = [];

  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      continue;
    }

    if (isRenderFunctionStatement(statement)) {
      continue;
    }

    if (t.isFunctionDeclaration(statement) && statement.id) {
      handlerNames.push(statement.id.name);
      statements.push(statement);
      continue;
    }

    if (t.isVariableDeclaration(statement)) {
      statements.push(statement);
    }
  }

  if (statements.length === 0) {
    return {
      code: "",
      handlerNames
    };
  }

  const file = t.file(t.program(statements));
  return {
    code: generate(file).code,
    handlerNames
  };
}

function isRenderFunctionStatement(statement: t.Statement): boolean {
  if (t.isFunctionDeclaration(statement) && statement.id?.name === "render") {
    return true;
  }

  return t.isExportNamedDeclaration(statement) &&
    t.isFunctionDeclaration(statement.declaration) &&
    statement.declaration.id?.name === "render";
}

function serializeBlueprint(blueprint: Blueprint): SerializedBlueprint {
  return {
    nodeCount: blueprint.nodeCount,
    nodeKind: Array.from(blueprint.nodeKind),
    nodePrimitiveRefIndex: Array.from(blueprint.nodePrimitiveRefIndex),
    nodeTextRefIndex: Array.from(blueprint.nodeTextRefIndex),
    nodeParentIndex: Array.from(blueprint.nodeParentIndex),
    bindingOpcode: Array.from(blueprint.bindingOpcode),
    bindingNodeIndex: Array.from(blueprint.bindingNodeIndex),
    bindingDataIndex: Array.from(blueprint.bindingDataIndex),
    bindingArgU32: Array.from(blueprint.bindingArgU32),
    bindingArgRef: blueprint.bindingArgRef,
    regionType: Array.from(blueprint.regionType),
    regionAnchorStart: Array.from(blueprint.regionAnchorStart),
    regionAnchorEnd: Array.from(blueprint.regionAnchorEnd),
    regionBranchRangeStart: Array.from(blueprint.regionBranchRangeStart),
    regionBranchRangeCount: Array.from(blueprint.regionBranchRangeCount),
    regionBranchNodeStart: Array.from(blueprint.regionBranchNodeStart),
    regionBranchNodeEnd: Array.from(blueprint.regionBranchNodeEnd),
    regionNestedBlockSlot: Array.from(blueprint.regionNestedBlockSlot),
    regionNestedBlueprintSlot: Array.from(blueprint.regionNestedBlueprintSlot),
    regionNestedMountMode: Array.from(blueprint.regionNestedMountMode),
    signalToBindingStart: Array.from(blueprint.signalToBindingStart),
    signalToBindingCount: Array.from(blueprint.signalToBindingCount),
    signalToBindings: Array.from(blueprint.signalToBindings)
  };
}
