import generateModule from "@babel/generator";
import * as t from "@babel/types";
import type { Blueprint } from "@jue/runtime-core";
import { err, ok, type Result } from "@jue/shared";

import { lowerBlockIRToBlueprint } from "../block-ir";
import {
  compileSourceToBlockIR,
  type CompileToBlockIRError,
  type CompiledKeyedListDescriptor,
  type CompiledTemplateDescriptor,
  type CompiledVirtualListDescriptor
} from "./compile-to-block-ir";
import { parseModule } from "./parse";
import { findTopLevelRootComponent } from "./root-component";

type GenerateFunction = typeof generateModule;
const generate = resolveGenerateFunction(generateModule);

export interface CompiledModule {
  readonly code: string;
  readonly blueprint: SerializedBlueprint;
  readonly signalCount: number;
  readonly signalSlots: Readonly<Record<string, number>>;
  readonly initialSignalValues: readonly unknown[];
  readonly keyedListDescriptors: readonly SerializedKeyedListDescriptor[];
  readonly virtualListDescriptors: readonly SerializedVirtualListDescriptor[];
  readonly runtimeCode: string;
  readonly handlerNames: readonly string[];
}

export interface CompileModuleOptions {
  readonly rootSymbol?: string;
}

export interface SignalRuntimeBridge {
  read(name: string): unknown;
  write(name: string, value: unknown): void;
  update(name: string, updater: (value: unknown) => unknown): void;
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

export interface SerializedTemplateDescriptor {
  readonly blueprint: SerializedBlueprint;
  readonly signalCount: number;
  readonly initialSignalValues: readonly unknown[];
  readonly signalPaths: readonly (((readonly string[]) | null))[];
}

export interface SerializedKeyedListDescriptor {
  readonly regionSlot: number;
  readonly sourceSignalSlot: number;
  readonly keyPath: readonly string[];
  readonly template: SerializedTemplateDescriptor;
}

export interface SerializedVirtualListDescriptor extends SerializedKeyedListDescriptor {
  readonly estimateSize: number;
  readonly overscan: number;
}

export function compileModule(
  source: string,
  options: CompileModuleOptions = {}
): Result<CompiledModule, CompileToBlockIRError> {
  const ast = parseModule(source);
  const rootSymbol = options.rootSymbol ?? "render";
  const signalFactoryLocalNames = collectSignalFactoryLocalNames(ast);
  const runtime = buildRuntimeStatements(ast, rootSymbol, signalFactoryLocalNames);
  const block = compileSourceToBlockIR(source, {
    rootSymbol,
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
  const keyedListDescriptors = block.value.structures
    .filter((descriptor): descriptor is CompiledKeyedListDescriptor => descriptor.kind === "keyed-list")
    .map(serializeKeyedListDescriptor);
  const virtualListDescriptors = block.value.structures
    .filter((descriptor): descriptor is CompiledVirtualListDescriptor => descriptor.kind === "virtual-list")
    .map(serializeVirtualListDescriptor);
  return ok({
    code: createCompiledModuleCode({
      blueprint: serialized,
      signalCount: lowered.value.signalCount,
      signalSlots: block.value.signalSlots,
      initialSignalValues: lowered.value.initialSignalValues,
      keyedListDescriptors,
      virtualListDescriptors,
      runtimeImportCode: runtime.importCode,
      runtimeCode: runtime.code,
      handlerNames: runtime.handlerNames
    }),
    blueprint: serialized,
    signalCount: lowered.value.signalCount,
    signalSlots: block.value.signalSlots,
    initialSignalValues: lowered.value.initialSignalValues,
    keyedListDescriptors,
    virtualListDescriptors,
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
  readonly signalSlots: Readonly<Record<string, number>>;
  readonly initialSignalValues: readonly unknown[];
  readonly keyedListDescriptors: readonly SerializedKeyedListDescriptor[];
  readonly virtualListDescriptors: readonly SerializedVirtualListDescriptor[];
  readonly runtimeImportCode: string;
  readonly runtimeCode: string;
  readonly handlerNames: readonly string[];
}): string {
  const templateDeclarations = [
    ...input.keyedListDescriptors.map((descriptor, index) => ({
      constName: `keyedListTemplate${index}`,
      template: descriptor.template
    })),
    ...input.virtualListDescriptors.map((descriptor, index) => ({
      constName: `virtualListTemplate${index}`,
      template: descriptor.template
    }))
  ].map(declaration => createBlueprintDeclaration(declaration.constName, declaration.template.blueprint))
    .join("\n\n");
  const keyedListDescriptors = input.keyedListDescriptors
    .map((descriptor, index) => `{
      regionSlot: ${descriptor.regionSlot},
      sourceSignalSlot: ${descriptor.sourceSignalSlot},
      keyPath: ${JSON.stringify(descriptor.keyPath)},
      template: {
        blueprint: keyedListTemplate${index},
        signalCount: ${descriptor.template.signalCount},
        initialSignalValues: ${JSON.stringify(descriptor.template.initialSignalValues)},
        signalPaths: ${JSON.stringify(descriptor.template.signalPaths)}
      }
    }`)
    .join(",\n");
  const virtualListDescriptors = input.virtualListDescriptors
    .map((descriptor, index) => `{
      regionSlot: ${descriptor.regionSlot},
      sourceSignalSlot: ${descriptor.sourceSignalSlot},
      keyPath: ${JSON.stringify(descriptor.keyPath)},
      estimateSize: ${descriptor.estimateSize},
      overscan: ${descriptor.overscan},
      template: {
        blueprint: virtualListTemplate${index},
        signalCount: ${descriptor.template.signalCount},
        initialSignalValues: ${JSON.stringify(descriptor.template.initialSignalValues)},
        signalPaths: ${JSON.stringify(descriptor.template.signalPaths)}
      }
    }`)
    .join(",\n");
  const runtimeModuleCode = createRuntimeModuleCode(
    input.signalSlots,
    input.runtimeCode,
    input.handlerNames
  );

  return `
    import { createBlueprint } from "@jue/runtime-core";

    ${input.runtimeImportCode}

    ${runtimeModuleCode}

    ${templateDeclarations}

    ${createBlueprintDeclaration("blueprint", input.blueprint)}
    export { blueprint };
    export const signalCount = ${JSON.stringify(input.signalCount)};
    export const signalSlots = ${JSON.stringify(input.signalSlots)};
    export const initialSignalValues = ${JSON.stringify(input.initialSignalValues)};
    export const keyedListDescriptors = [${keyedListDescriptors}];
    export const virtualListDescriptors = [${virtualListDescriptors}];
  `;
}

function createRuntimeModuleCode(
  signalSlots: Readonly<Record<string, number>>,
  runtimeCode: string,
  handlerNames: readonly string[]
): string {
  const signalNames = Object.keys(signalSlots);
  const handlerEntries = handlerNames
    .map(name => `${JSON.stringify(name)}: ${name}`)
    .join(", ");
  const runtimeBody = runtimeCode.trim();

  if (signalNames.length === 0) {
    return `
      export function createRuntime(): {
        handlers: Record<string, unknown>;
      } {
        ${runtimeBody}
        return {
          handlers: { ${handlerEntries} }
        };
      }
    `;
  }

  const declarations = signalNames
    .map(name => `const ${name} = __jueCreateSignalRef(${JSON.stringify(name)});`)
    .join("\n");

  return `
    export function createRuntime(): {
      configureSignalRuntime: {
        (runtime: {
          read(name: string): any;
          write(name: string, value: any): void;
          update(name: string, updater: (value: any) => any): void;
        }): void;
      };
      handlers: Record<string, unknown>;
    } {
      let __jueSignalRuntime = {
        read(name: string): any {
          throw new Error(\`Signal runtime is not configured for \${name}.\`);
        },
        write(name: string, _value: any): void {
          throw new Error(\`Signal runtime is not configured for \${name}.\`);
        },
        update(name: string, _updater: (value: any) => any): void {
          throw new Error(\`Signal runtime is not configured for \${name}.\`);
        }
      };

      function configureSignalRuntime(runtime: {
        read(name: string): any;
        write(name: string, value: any): void;
        update(name: string, updater: (value: any) => any): void;
      }): void {
        __jueSignalRuntime = runtime;
      }

      function __jueCreateSignalRef(name: string) {
        return {
          get(): any {
            return __jueSignalRuntime.read(name);
          },
          set(value: any): void {
            __jueSignalRuntime.write(name, value);
          },
          update(updater: (value: any) => any): void {
            __jueSignalRuntime.update(name, updater);
          }
        };
      }

      ${declarations}

      ${runtimeBody}

      return {
        configureSignalRuntime,
        handlers: { ${handlerEntries} }
      };
    }
  `;
}

function buildRuntimeStatements(
  ast: t.File,
  rootSymbol: string,
  signalFactoryLocalNames: ReadonlySet<string>
): {
  readonly importCode: string;
  readonly code: string;
  readonly handlerNames: readonly string[];
} {
  const imports: t.ImportDeclaration[] = [];
  const statements: t.Statement[] = [];
  const handlerNames: string[] = [];
  const rootComponent = findTopLevelRootComponent(ast, rootSymbol);

  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      if (statement.source.value === "@jue/jsx") {
        continue;
      }

      imports.push(statement);
      continue;
    }

    if (rootComponent && statement === rootComponent.statement) {
      continue;
    }

    if (t.isFunctionDeclaration(statement) && statement.id) {
      handlerNames.push(statement.id.name);
      statements.push(statement);
      continue;
    }

    if (
      t.isExportNamedDeclaration(statement) &&
      t.isFunctionDeclaration(statement.declaration) &&
      statement.declaration.id
    ) {
      handlerNames.push(statement.declaration.id.name);
      statements.push(statement.declaration);
      continue;
    }

    if (t.isTSInterfaceDeclaration(statement) || t.isTSTypeAliasDeclaration(statement)) {
      statements.push(statement);
      continue;
    }

    if (t.isVariableDeclaration(statement)) {
      const runtimeDeclarations = statement.declarations.filter(
        declaration => !isSignalFactoryDeclaration(declaration, signalFactoryLocalNames)
      );
      if (runtimeDeclarations.length === 0) {
        continue;
      }

      statements.push(t.variableDeclaration(statement.kind, runtimeDeclarations));
    }
  }

  if (statements.length === 0) {
    return {
      importCode: imports.length === 0 ? "" : generate(t.file(t.program(imports))).code,
      code: "",
      handlerNames
    };
  }

  const file = t.file(t.program(statements));
  return {
    importCode: imports.length === 0 ? "" : generate(t.file(t.program(imports))).code,
    code: generate(file).code,
    handlerNames
  };
}

function collectSignalFactoryLocalNames(ast: t.File): ReadonlySet<string> {
  const signalFactoryLocalNames = new Set<string>();

  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement) || statement.source.value !== "@jue/jsx") {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier) || !t.isIdentifier(specifier.imported)) {
        continue;
      }

      if (specifier.imported.name === "signal") {
        signalFactoryLocalNames.add(specifier.local.name);
      }
    }
  }

  return signalFactoryLocalNames;
}

function isSignalFactoryDeclaration(
  declaration: t.VariableDeclarator,
  signalFactoryLocalNames: ReadonlySet<string>
): boolean {
  if (!declaration.init || !t.isCallExpression(declaration.init) || !t.isIdentifier(declaration.init.callee)) {
    return false;
  }

  return signalFactoryLocalNames.has(declaration.init.callee.name);
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

function serializeTemplateDescriptor(template: CompiledTemplateDescriptor): SerializedTemplateDescriptor {
  const lowered = lowerBlockIRToBlueprint(template.block);
  if (!lowered.ok) {
    throw new Error(lowered.error.message);
  }

  return {
    blueprint: serializeBlueprint(lowered.value.blueprint),
    signalCount: lowered.value.signalCount,
    initialSignalValues: template.initialSignalValues,
    signalPaths: template.signalPaths
  };
}

function serializeKeyedListDescriptor(descriptor: CompiledKeyedListDescriptor): SerializedKeyedListDescriptor {
  return {
    regionSlot: descriptor.regionSlot,
    sourceSignalSlot: descriptor.sourceSignalSlot,
    keyPath: descriptor.keyPath,
    template: serializeTemplateDescriptor(descriptor.template)
  };
}

function serializeVirtualListDescriptor(descriptor: CompiledVirtualListDescriptor): SerializedVirtualListDescriptor {
  return {
    regionSlot: descriptor.regionSlot,
    sourceSignalSlot: descriptor.sourceSignalSlot,
    keyPath: descriptor.keyPath,
    estimateSize: descriptor.estimateSize,
    overscan: descriptor.overscan,
    template: serializeTemplateDescriptor(descriptor.template)
  };
}

function createBlueprintDeclaration(
  constName: string,
  blueprint: SerializedBlueprint
): string {
  const bindingArgRef = `[${blueprint.bindingArgRef.map(value => JSON.stringify(value)).join(", ")}]`;
  return `
    const ${constName}Result = createBlueprint({
      nodeCount: ${JSON.stringify(blueprint.nodeCount)},
      nodeKind: new Uint8Array(${JSON.stringify(blueprint.nodeKind)}),
      nodePrimitiveRefIndex: new Uint32Array(${JSON.stringify(blueprint.nodePrimitiveRefIndex)}),
      nodeTextRefIndex: new Uint32Array(${JSON.stringify(blueprint.nodeTextRefIndex)}),
      nodeParentIndex: new Uint32Array(${JSON.stringify(blueprint.nodeParentIndex)}),
      bindingOpcode: new Uint8Array(${JSON.stringify(blueprint.bindingOpcode)}),
      bindingNodeIndex: new Uint32Array(${JSON.stringify(blueprint.bindingNodeIndex)}),
      bindingDataIndex: new Uint32Array(${JSON.stringify(blueprint.bindingDataIndex)}),
      bindingArgU32: new Uint32Array(${JSON.stringify(blueprint.bindingArgU32)}),
      bindingArgRef: ${bindingArgRef},
      regionType: new Uint8Array(${JSON.stringify(blueprint.regionType)}),
      regionAnchorStart: new Uint32Array(${JSON.stringify(blueprint.regionAnchorStart)}),
      regionAnchorEnd: new Uint32Array(${JSON.stringify(blueprint.regionAnchorEnd)}),
      regionBranchRangeStart: new Uint32Array(${JSON.stringify(blueprint.regionBranchRangeStart)}),
      regionBranchRangeCount: new Uint32Array(${JSON.stringify(blueprint.regionBranchRangeCount)}),
      regionBranchNodeStart: new Uint32Array(${JSON.stringify(blueprint.regionBranchNodeStart)}),
      regionBranchNodeEnd: new Uint32Array(${JSON.stringify(blueprint.regionBranchNodeEnd)}),
      regionNestedBlockSlot: new Uint32Array(${JSON.stringify(blueprint.regionNestedBlockSlot)}),
      regionNestedBlueprintSlot: new Uint32Array(${JSON.stringify(blueprint.regionNestedBlueprintSlot)}),
      regionNestedMountMode: new Uint8Array(${JSON.stringify(blueprint.regionNestedMountMode)}),
      signalToBindingStart: new Uint32Array(${JSON.stringify(blueprint.signalToBindingStart)}),
      signalToBindingCount: new Uint32Array(${JSON.stringify(blueprint.signalToBindingCount)}),
      signalToBindings: new Uint32Array(${JSON.stringify(blueprint.signalToBindings)})
    });

    if (!${constName}Result.ok) {
      throw new Error(${constName}Result.error.message);
    }

    const ${constName} = ${constName}Result.value;
  `;
}
