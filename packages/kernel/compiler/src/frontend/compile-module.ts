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

  const runtimeCodeStr =
    runtime.statements.length === 0
      ? ""
      : generate(t.file(t.program(runtime.statements))).code;

  const blueprintStatements: t.Statement[] = [];
  for (let i = 0; i < keyedListDescriptors.length; i++) {
    blueprintStatements.push(
      ...buildBlueprintVariableDeclarations(
        `keyedListTemplate${i}`,
        keyedListDescriptors[i]!.template.blueprint
      )
    );
  }
  for (let i = 0; i < virtualListDescriptors.length; i++) {
    blueprintStatements.push(
      ...buildBlueprintVariableDeclarations(
        `virtualListTemplate${i}`,
        virtualListDescriptors[i]!.template.blueprint
      )
    );
  }
  blueprintStatements.push(...buildBlueprintVariableDeclarations("blueprint", serialized));

  const signalTypes = collectSignalTypes(ast, signalFactoryLocalNames);

  const runtimeFunction = buildCreateRuntimeFunction(
    block.value.signalSlots,
    runtime.statements,
    runtime.handlerNames,
    signalTypes
  );

  const file = buildModuleFile({
    imports: runtime.imports,
    runtimeFunction,
    blueprintStatements,
    signalCount: lowered.value.signalCount,
    signalSlots: block.value.signalSlots,
    initialSignalValues: lowered.value.initialSignalValues,
    keyedListDescriptors,
    virtualListDescriptors
  });

  const code = generate(file).code;

  return ok({
    code,
    blueprint: serialized,
    signalCount: lowered.value.signalCount,
    signalSlots: block.value.signalSlots,
    initialSignalValues: lowered.value.initialSignalValues,
    keyedListDescriptors,
    virtualListDescriptors,
    runtimeCode: runtimeCodeStr,
    handlerNames: runtime.handlerNames
  });
}

function createHandlerMarker(name: string): string {
  return `__jue_handler__:${name}`;
}

// ---------------------------------------------------------------------------
// AST-first module assembly
// ---------------------------------------------------------------------------

function buildModuleFile(input: {
  readonly imports: t.ImportDeclaration[];
  readonly runtimeFunction: t.ExportNamedDeclaration;
  readonly blueprintStatements: t.Statement[];
  readonly signalCount: number;
  readonly signalSlots: Readonly<Record<string, number>>;
  readonly initialSignalValues: readonly unknown[];
  readonly keyedListDescriptors: readonly SerializedKeyedListDescriptor[];
  readonly virtualListDescriptors: readonly SerializedVirtualListDescriptor[];
}): t.File {
  const body: t.Statement[] = [];

  body.push(
    t.importDeclaration(
      [t.importSpecifier(t.identifier("createBlueprint"), t.identifier("createBlueprint"))],
      t.stringLiteral("@jue/runtime-core")
    )
  );

  body.push(...input.imports);
  body.push(input.runtimeFunction);
  body.push(...input.blueprintStatements);

  body.push(
    t.exportNamedDeclaration(
      null,
      [t.exportSpecifier(t.identifier("blueprint"), t.identifier("blueprint"))]
    )
  );

  body.push(
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier("signalCount"), t.numericLiteral(input.signalCount))
      ]),
      []
    )
  );

  body.push(
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier("signalSlots"), valueToNode(input.signalSlots))
      ]),
      []
    )
  );

  body.push(
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier("initialSignalValues"), valueToNode(input.initialSignalValues))
      ]),
      []
    )
  );

  body.push(
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier("keyedListDescriptors"),
          t.arrayExpression(
            input.keyedListDescriptors.map((d, i) =>
              buildDescriptorElement(d, `keyedListTemplate${i}`)
            )
          )
        )
      ]),
      []
    )
  );

  body.push(
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier("virtualListDescriptors"),
          t.arrayExpression(
            input.virtualListDescriptors.map((d, i) =>
              buildDescriptorElement(d, `virtualListTemplate${i}`)
            )
          )
        )
      ]),
      []
    )
  );

  return t.file(t.program(body));
}

function collectReferencedNames(statements: t.Statement[]): Set<string> {
  const referenced = new Set<string>();

  function visit(node: t.Node | null | undefined, isDeclId = false) {
    if (!node) return;
    if (t.isIdentifier(node) && !isDeclId) {
      referenced.add(node.name);
    }
    for (const [key, child] of Object.entries(node as unknown as Record<string, unknown>)) {
      if (
        (t.isTSPropertySignature(node) || t.isTSMethodSignature(node)) && key === "key"
      ) {
        continue;
      }
      if (t.isMemberExpression(node) && !node.computed && key === "property") {
        continue;
      }
      if (
        (t.isObjectProperty(node) || t.isObjectMethod(node)) &&
        !node.computed &&
        key === "key"
      ) {
        continue;
      }
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object" && "type" in item) {
            visit(item as t.Node, false);
          }
        }
      } else if (child && typeof child === "object" && "type" in child) {
        const nextIsDeclId =
          (t.isFunctionDeclaration(node) && key === "id") ||
          (t.isVariableDeclarator(node) && key === "id") ||
          (t.isTSTypeAliasDeclaration(node) && key === "id") ||
          (t.isTSInterfaceDeclaration(node) && key === "id");
        visit(child as t.Node, nextIsDeclId);
      }
    }
  }

  for (const statement of statements) {
    visit(statement);
  }
  return referenced;
}

function buildCreateRuntimeFunction(
  signalSlots: Readonly<Record<string, number>>,
  runtimeStatements: t.Statement[],
  handlerNames: readonly string[],
  signalTypes: ReadonlyMap<string, t.TSType>
): t.ExportNamedDeclaration {
  const signalNames = Object.keys(signalSlots);
  const referencedNames = collectReferencedNames(runtimeStatements);
  const body: t.Statement[] = [];

  const stringParam = (name: string) => param(name, t.tsStringKeyword());
  const unknownParam = (name: string) => param(name, t.tsUnknownKeyword());
  const updaterType = t.tsFunctionType(
    null,
    [unknownParam("value")],
    t.tsTypeAnnotation(t.tsUnknownKeyword())
  );
  const signalRuntimeType = t.tsTypeLiteral([
    t.tsMethodSignature(
      t.identifier("read"),
      null,
      [stringParam("name")],
      t.tsTypeAnnotation(t.tsUnknownKeyword())
    ),
    t.tsMethodSignature(
      t.identifier("write"),
      null,
      [stringParam("name"), unknownParam("value")],
      t.tsTypeAnnotation(t.tsVoidKeyword())
    ),
    t.tsMethodSignature(
      t.identifier("update"),
      null,
      [stringParam("name"), param("updater", updaterType)],
      t.tsTypeAnnotation(t.tsVoidKeyword())
    )
  ]);

  if (signalNames.length > 0) {
    const signalRuntimeId = t.identifier("__jueSignalRuntime");
    signalRuntimeId.typeAnnotation = t.tsTypeAnnotation(signalRuntimeType);
    body.push(
      t.variableDeclaration("let", [
        t.variableDeclarator(
          signalRuntimeId,
          t.objectExpression([
            t.objectMethod(
              "method",
              t.identifier("read"),
              [stringParam("name")],
              t.blockStatement([
                t.throwStatement(
                  t.newExpression(t.identifier("Error"), [
                    t.templateLiteral(
                      [
                        t.templateElement(
                          {
                            raw: "Signal runtime is not configured for ",
                            cooked: "Signal runtime is not configured for "
                          },
                          false
                        ),
                        t.templateElement({ raw: ".", cooked: "." }, true)
                      ],
                      [t.identifier("name")]
                    )
                  ])
                )
              ])
            ),
            t.objectMethod(
              "method",
              t.identifier("write"),
              [stringParam("name"), unknownParam("_value")],
              t.blockStatement([
                t.throwStatement(
                  t.newExpression(t.identifier("Error"), [
                    t.templateLiteral(
                      [
                        t.templateElement(
                          {
                            raw: "Signal runtime is not configured for ",
                            cooked: "Signal runtime is not configured for "
                          },
                          false
                        ),
                        t.templateElement({ raw: ".", cooked: "." }, true)
                      ],
                      [t.identifier("name")]
                    )
                  ])
                )
              ])
            ),
            t.objectMethod(
              "method",
              t.identifier("update"),
              [stringParam("name"), param("_updater", updaterType)],
              t.blockStatement([
                t.throwStatement(
                  t.newExpression(t.identifier("Error"), [
                    t.templateLiteral(
                      [
                        t.templateElement(
                          {
                            raw: "Signal runtime is not configured for ",
                            cooked: "Signal runtime is not configured for "
                          },
                          false
                        ),
                        t.templateElement({ raw: ".", cooked: "." }, true)
                      ],
                      [t.identifier("name")]
                    )
                  ])
                )
              ])
            )
          ])
        )
      ])
    );

    body.push(
      t.functionDeclaration(
        t.identifier("configureSignalRuntime"),
        [param("runtime", signalRuntimeType)],
        t.blockStatement([
          t.expressionStatement(
            t.assignmentExpression("=", t.identifier("__jueSignalRuntime"), t.identifier("runtime"))
          )
        ])
      )
    );

    const tUpdaterParamType = t.tsFunctionType(
      null,
      [param("value", t.tsTypeReference(t.identifier("T")))],
      t.tsTypeAnnotation(t.tsTypeReference(t.identifier("T")))
    );
    const signalRefDecl = t.functionDeclaration(
      t.identifier("__jueCreateSignalRef"),
      [stringParam("name")],
      t.blockStatement([
        t.returnStatement(
          t.objectExpression([
            t.objectMethod(
              "method",
              t.identifier("get"),
              [],
              t.blockStatement([
                t.returnStatement(
                  t.tsAsExpression(
                    t.callExpression(
                      t.memberExpression(t.identifier("__jueSignalRuntime"), t.identifier("read")),
                      [t.identifier("name")]
                    ),
                    t.tsTypeReference(t.identifier("T"))
                  )
                )
              ])
            ),
            t.objectMethod(
              "method",
              t.identifier("set"),
              [unknownParam("value")],
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(t.identifier("__jueSignalRuntime"), t.identifier("write")),
                    [
                      t.identifier("name"),
                      t.tsAsExpression(t.identifier("value"), t.tsUnknownKeyword())
                    ]
                  )
                )
              ])
            ),
            t.objectMethod(
              "method",
              t.identifier("update"),
              [param("updater", tUpdaterParamType)],
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(t.identifier("__jueSignalRuntime"), t.identifier("update")),
                    [
                      t.identifier("name"),
                      t.tsAsExpression(t.identifier("updater"), updaterType)
                    ]
                  )
                )
              ])
            )
          ])
        )
      ])
    );
    const signalRefType = t.tsTypeLiteral([
      t.tsMethodSignature(t.identifier("get"), null, [], t.tsTypeAnnotation(t.tsTypeReference(t.identifier("T")))),
      t.tsMethodSignature(
        t.identifier("set"),
        null,
        [param("value", t.tsTypeReference(t.identifier("T")))],
        t.tsTypeAnnotation(t.tsVoidKeyword())
      ),
      t.tsMethodSignature(
        t.identifier("update"),
        null,
        [
          param(
            "updater",
            t.tsFunctionType(
              null,
              [param("value", t.tsTypeReference(t.identifier("T")))],
              t.tsTypeAnnotation(t.tsTypeReference(t.identifier("T")))
            )
          )
        ],
        t.tsTypeAnnotation(t.tsVoidKeyword())
      )
    ]);
    signalRefDecl.typeParameters = t.tsTypeParameterDeclaration([
      t.tsTypeParameter(null, t.tsUnknownKeyword(), "T")
    ]);
    signalRefDecl.returnType = t.tsTypeAnnotation(signalRefType);
    body.push(signalRefDecl);

    for (const name of signalNames) {
      if (!referencedNames.has(name)) continue;
      const callExpr = t.callExpression(
        t.identifier("__jueCreateSignalRef"),
        [t.stringLiteral(name)]
      );
      const type = signalTypes.get(name);
      if (type && type.type !== "TSUnknownKeyword") {
        callExpr.typeParameters = t.tsTypeParameterInstantiation([type]);
      }
      body.push(
        t.variableDeclaration("const", [
          t.variableDeclarator(t.identifier(name), callExpr)
        ])
      );
    }
  }

  body.push(...runtimeStatements);

  const handlersObj = t.objectExpression(
    handlerNames.map(name => t.objectProperty(t.stringLiteral(name), t.identifier(name)))
  );

  const returnProps: t.ObjectProperty[] = [t.objectProperty(t.identifier("handlers"), handlersObj)];
  if (signalNames.length > 0) {
    returnProps.unshift(
      t.objectProperty(t.identifier("configureSignalRuntime"), t.identifier("configureSignalRuntime"))
    );
  }

  body.push(t.returnStatement(t.objectExpression(returnProps)));

  return t.exportNamedDeclaration(
    t.functionDeclaration(t.identifier("createRuntime"), [], t.blockStatement(body)),
    []
  );
}

function buildBlueprintVariableDeclarations(
  constName: string,
  blueprint: SerializedBlueprint
): t.Statement[] {
  const callExpr = t.callExpression(t.identifier("createBlueprint"), [
    t.objectExpression([
      t.objectProperty(t.identifier("nodeCount"), t.numericLiteral(blueprint.nodeCount)),
      t.objectProperty(
        t.identifier("nodeKind"),
        t.newExpression(t.identifier("Uint8Array"), [
          t.arrayExpression(Array.from(blueprint.nodeKind).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("nodePrimitiveRefIndex"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.nodePrimitiveRefIndex).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("nodeTextRefIndex"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.nodeTextRefIndex).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("nodeParentIndex"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.nodeParentIndex).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("bindingOpcode"),
        t.newExpression(t.identifier("Uint8Array"), [
          t.arrayExpression(Array.from(blueprint.bindingOpcode).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("bindingNodeIndex"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.bindingNodeIndex).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("bindingDataIndex"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.bindingDataIndex).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("bindingArgU32"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.bindingArgU32).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("bindingArgRef"),
        t.arrayExpression(blueprint.bindingArgRef.map(v => valueToNode(v)))
      ),
      t.objectProperty(
        t.identifier("regionType"),
        t.newExpression(t.identifier("Uint8Array"), [
          t.arrayExpression(Array.from(blueprint.regionType).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionAnchorStart"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionAnchorStart).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionAnchorEnd"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionAnchorEnd).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionBranchRangeStart"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionBranchRangeStart).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionBranchRangeCount"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionBranchRangeCount).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionBranchNodeStart"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionBranchNodeStart).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionBranchNodeEnd"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionBranchNodeEnd).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionNestedBlockSlot"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionNestedBlockSlot).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionNestedBlueprintSlot"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.regionNestedBlueprintSlot).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("regionNestedMountMode"),
        t.newExpression(t.identifier("Uint8Array"), [
          t.arrayExpression(Array.from(blueprint.regionNestedMountMode).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("signalToBindingStart"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.signalToBindingStart).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("signalToBindingCount"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.signalToBindingCount).map(n => t.numericLiteral(n)))
        ])
      ),
      t.objectProperty(
        t.identifier("signalToBindings"),
        t.newExpression(t.identifier("Uint32Array"), [
          t.arrayExpression(Array.from(blueprint.signalToBindings).map(n => t.numericLiteral(n)))
        ])
      )
    ])
  ]);

  return [
    t.variableDeclaration("const", [
      t.variableDeclarator(t.identifier(`${constName}Result`), callExpr)
    ]),
    t.ifStatement(
      t.unaryExpression(
        "!",
        t.memberExpression(t.identifier(`${constName}Result`), t.identifier("ok"))
      ),
      t.blockStatement([
        t.throwStatement(
          t.newExpression(t.identifier("Error"), [
            t.memberExpression(
              t.memberExpression(t.identifier(`${constName}Result`), t.identifier("error")),
              t.identifier("message")
            )
          ])
        )
      ])
    ),
    t.variableDeclaration("const", [
      t.variableDeclarator(
        t.identifier(constName),
        t.memberExpression(t.identifier(`${constName}Result`), t.identifier("value"))
      )
    ])
  ];
}

function param(name: string, type: t.TSType): t.Identifier {
  const id = t.identifier(name);
  id.typeAnnotation = t.tsTypeAnnotation(type);
  return id;
}

function buildDescriptorElement(
  descriptor: SerializedKeyedListDescriptor | SerializedVirtualListDescriptor,
  templateVarName: string
): t.ObjectExpression {
  const props: t.ObjectProperty[] = [
    t.objectProperty(t.identifier("regionSlot"), t.numericLiteral(descriptor.regionSlot)),
    t.objectProperty(t.identifier("sourceSignalSlot"), t.numericLiteral(descriptor.sourceSignalSlot)),
    t.objectProperty(t.identifier("keyPath"), valueToNode(descriptor.keyPath)),
    t.objectProperty(
      t.identifier("template"),
      t.objectExpression([
        t.objectProperty(t.identifier("blueprint"), t.identifier(templateVarName)),
        t.objectProperty(t.identifier("signalCount"), t.numericLiteral(descriptor.template.signalCount)),
        t.objectProperty(t.identifier("initialSignalValues"), valueToNode(descriptor.template.initialSignalValues)),
        t.objectProperty(t.identifier("signalPaths"), valueToNode(descriptor.template.signalPaths))
      ])
    )
  ];

  if ("estimateSize" in descriptor) {
    props.push(
      t.objectProperty(t.identifier("estimateSize"), t.numericLiteral(descriptor.estimateSize)),
      t.objectProperty(t.identifier("overscan"), t.numericLiteral(descriptor.overscan))
    );
  }

  return t.objectExpression(props);
}

function valueToNode(value: unknown): t.Expression {
  if (value === null) return t.nullLiteral();
  if (value === undefined) return t.identifier("undefined");
  if (typeof value === "boolean") return t.booleanLiteral(value);
  if (typeof value === "number") return t.numericLiteral(value);
  if (typeof value === "string") return t.stringLiteral(value);
  if (Array.isArray(value)) {
    return t.arrayExpression(value.map(valueToNode));
  }
  if (typeof value === "object" && value !== null) {
    return t.objectExpression(
      Object.entries(value).map(([k, v]) => t.objectProperty(t.stringLiteral(k), valueToNode(v)))
    );
  }
  throw new TypeError(`Unsupported value: ${typeof value}`);
}

// ---------------------------------------------------------------------------
// Runtime statement extraction (already AST-based, now returns nodes)
// ---------------------------------------------------------------------------

function buildRuntimeStatements(
  ast: t.File,
  rootSymbol: string,
  signalFactoryLocalNames: ReadonlySet<string>
): {
  readonly imports: t.ImportDeclaration[];
  readonly statements: t.Statement[];
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

    if (t.isTSTypeAliasDeclaration(statement) || t.isTSInterfaceDeclaration(statement)) {
      statements.push(statement);
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

  const referencedNames = collectReferencedNames(statements);
  const filteredStatements = statements.filter(statement => {
    if (t.isTSTypeAliasDeclaration(statement) || t.isTSInterfaceDeclaration(statement)) {
      return referencedNames.has(statement.id.name);
    }
    return true;
  });

  return { imports, statements: filteredStatements, handlerNames };
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

function inferSignalType(
  argument: t.Expression | t.SpreadElement | t.JSXNamespacedName | t.ArgumentPlaceholder
): t.TSType {
  if (t.isNumericLiteral(argument)) return t.tsNumberKeyword();
  if (t.isStringLiteral(argument)) return t.tsStringKeyword();
  if (t.isBooleanLiteral(argument)) return t.tsBooleanKeyword();
  if (t.isArrayExpression(argument)) {
    const elements = argument.elements.filter(
      (e): e is t.Expression => e !== null && !t.isSpreadElement(e)
    );
    if (elements.length === 0) return t.tsArrayType(t.tsUnknownKeyword());
    const firstType = inferSignalType(elements[0]!);
    const allSame = elements.every(e => inferSignalType(e).type === firstType.type);
    return allSame ? t.tsArrayType(firstType) : t.tsArrayType(t.tsUnknownKeyword());
  }
  if (t.isObjectExpression(argument)) {
    return t.tsTypeReference(
      t.identifier("Record"),
      t.tsTypeParameterInstantiation([t.tsStringKeyword(), t.tsUnknownKeyword()])
    );
  }
  return t.tsUnknownKeyword();
}

function collectSignalTypes(
  ast: t.File,
  signalFactoryLocalNames: ReadonlySet<string>
): ReadonlyMap<string, t.TSType> {
  const map = new Map<string, t.TSType>();
  for (const statement of ast.program.body) {
    if (!t.isVariableDeclaration(statement)) continue;
    for (const declaration of statement.declarations) {
      if (!isSignalFactoryDeclaration(declaration, signalFactoryLocalNames)) continue;
      if (!t.isIdentifier(declaration.id)) continue;
      const arg =
        t.isCallExpression(declaration.init) && declaration.init.arguments.length > 0
          ? declaration.init.arguments[0]
          : null;
      const type =
        arg && !t.isSpreadElement(arg) && !t.isJSXNamespacedName(arg) && !t.isArgumentPlaceholder(arg)
          ? inferSignalType(arg)
          : t.tsUnknownKeyword();
      map.set(declaration.id.name, type);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Serialization helpers (unchanged)
// ---------------------------------------------------------------------------

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

function serializeVirtualListDescriptor(
  descriptor: CompiledVirtualListDescriptor
): SerializedVirtualListDescriptor {
  return {
    regionSlot: descriptor.regionSlot,
    sourceSignalSlot: descriptor.sourceSignalSlot,
    keyPath: descriptor.keyPath,
    estimateSize: descriptor.estimateSize,
    overscan: descriptor.overscan,
    template: serializeTemplateDescriptor(descriptor.template)
  };
}
