import traverseModule, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { err, ok, type HostPrimitive, type Result } from "@jue/shared";

import { createBlueprintBuilder, type BlueprintBuilder } from "../blueprint-builder";
import type { BlockIR } from "../block-ir";
import { parseModule } from "./parse";

type TraverseFunction = typeof traverseModule;
const traverse = resolveTraverseFunction(traverseModule);

// FrontendState keeps the author-facing symbol table separate from the builder-facing slot table.
// Lowering can then keep emitting the same slot-indexed runtime contract regardless of source syntax.
interface FrontendState {
  builder: BlueprintBuilder;
  signalSlots: Map<string, number>;
  signalSymbols: Map<string, number>;
  eventHandlers: Map<string, unknown>;
  initialSignalValues: unknown[];
  jsxHostPrimitives: Set<string>;
  jsxStructurePrimitives: Set<string>;
  createSignalLocalNames: Set<string>;
  staticInitializerAliases: Map<string, unknown>;
  structures: CompiledStructureDescriptor[];
  templateScope: TemplateScope | null;
}

interface TemplateScope {
  readonly paramName: string;
  readonly signalPaths: (((readonly string[]) | null))[];
  readonly signalSlotsByPath: Map<string, number>;
  readonly allowStructurePrimitives: boolean;
}

type CompiledStructureDescriptor =
  | CompiledKeyedListDescriptor
  | CompiledVirtualListDescriptor;

export interface CompiledTemplateDescriptor {
  readonly block: BlockIR;
  readonly initialSignalValues: readonly unknown[];
  readonly signalPaths: readonly (((readonly string[]) | null))[];
}

export interface CompiledKeyedListDescriptor {
  readonly kind: "keyed-list";
  readonly regionSlot: number;
  readonly sourceSignalSlot: number;
  readonly keyPath: readonly string[];
  readonly template: CompiledTemplateDescriptor;
}

export interface CompiledVirtualListDescriptor {
  readonly kind: "virtual-list";
  readonly regionSlot: number;
  readonly sourceSignalSlot: number;
  readonly keyPath: readonly string[];
  readonly estimateSize: number;
  readonly overscan: number;
  readonly template: CompiledTemplateDescriptor;
}

export interface CompileToBlockIRError {
  readonly code: string;
  readonly message: string;
}

export interface CompileToBlockIRResult {
  readonly block: BlockIR;
  readonly structures: readonly CompiledStructureDescriptor[];
}

export interface CompileSourceToBlockIROptions {
  readonly handlers?: Readonly<Record<string, unknown>>;
}

type StaticExpressionReadResult =
  | {
      readonly kind: "static";
      readonly value: unknown;
    }
  | {
      readonly kind: "dynamic";
    }
  | {
      readonly kind: "error";
      readonly error: CompileToBlockIRError;
    };

function resolveTraverseFunction(value: unknown): TraverseFunction {
  if (typeof value === "function") {
    return value as TraverseFunction;
  }

  if (typeof value === "object" && value !== null && "default" in value) {
    return resolveTraverseFunction((value as { readonly default: unknown }).default);
  }

  throw new TypeError("@babel/traverse did not expose a callable traverse function.");
}

export function compileSourceToBlockIR(
  source: string,
  options: CompileSourceToBlockIROptions = {}
): Result<CompileToBlockIRResult, CompileToBlockIRError> {
  const ast = parseModule(source);
  const imports = collectJueJsxImports(ast);
  const rootResult = findRenderRoot(ast);
  if (!rootResult.ok) {
    return rootResult;
  }

  const state: FrontendState = {
    builder: createBlueprintBuilder(),
    signalSlots: new Map<string, number>(),
    signalSymbols: new Map<string, number>(),
    eventHandlers: collectTopLevelFunctionHandlers(ast, options.handlers),
    initialSignalValues: [],
    jsxHostPrimitives: imports.jsxHostPrimitives,
    jsxStructurePrimitives: imports.jsxStructurePrimitives,
    createSignalLocalNames: imports.createSignalLocalNames,
    staticInitializerAliases: new Map<string, unknown>(),
    structures: [],
    templateScope: null
  };
  const signalsResult = collectRenderSignalDeclarations(ast, state);
  if (!signalsResult.ok) {
    return signalsResult;
  }

  const rootNodeResult = lowerHostJsxElement(rootResult.value, state, null);
  if (!rootNodeResult.ok) {
    return rootNodeResult;
  }

  state.builder.setSignalCount(state.signalSlots.size);
  state.builder.setInitialSignalValues(state.initialSignalValues);
  const block = state.builder.buildIR();
  if (!block.ok) {
    return err(block.error);
  }

  return ok({
    block: block.value,
    structures: state.structures
  });
}

function collectJueJsxImports(ast: t.File): {
  readonly jsxHostPrimitives: Set<string>;
  readonly jsxStructurePrimitives: Set<string>;
  readonly createSignalLocalNames: Set<string>;
} {
  const jsxHostPrimitives = new Set<string>();
  const jsxStructurePrimitives = new Set<string>();
  const createSignalLocalNames = new Set<string>();

  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement) || statement.source.value !== "@jue/jsx") {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier) || !t.isIdentifier(specifier.imported)) {
        continue;
      }

      if (isHostPrimitiveName(specifier.imported.name)) {
        jsxHostPrimitives.add(specifier.local.name);
        continue;
      }

      if (isStructurePrimitiveName(specifier.imported.name)) {
        jsxStructurePrimitives.add(specifier.local.name);
        continue;
      }

      if (specifier.imported.name === "createSignal") {
        createSignalLocalNames.add(specifier.local.name);
      }
    }
  }

  return {
    jsxHostPrimitives,
    jsxStructurePrimitives,
    createSignalLocalNames
  };
}

function collectRenderSignalDeclarations(
  ast: t.File,
  state: FrontendState
): Result<void, CompileToBlockIRError> {
  const renderFunction = findRenderFunction(ast);
  if (renderFunction === null) {
    return err({
      code: "UNSUPPORTED_ROOT_SHAPE",
      message: "compile() currently requires a render() function."
    });
  }

  for (const statement of renderFunction.body.body) {
    if (!t.isVariableDeclaration(statement)) {
      continue;
    }

    if (statement.kind !== "const") {
      return err({
        code: "UNSUPPORTED_SIGNAL_DECLARATION",
        message: "compile() only supports const signal declarations."
      });
    }

    for (const declaration of statement.declarations) {
      collectStaticInitializerAlias(declaration, state);

      const signalDeclaration = readCreateSignalDeclaration(declaration, state);
      if (signalDeclaration === null) {
        continue;
      }

      if (!signalDeclaration.ok) {
        return signalDeclaration;
      }

      const slot = allocateSignalSlot(state, signalDeclaration.value.name);
      state.signalSymbols.set(signalDeclaration.value.name, slot);
      mergeInitialSignalValues(state, slot, signalDeclaration.value.initialValue);
    }
  }

  return ok(undefined);
}

function readCreateSignalDeclaration(
  declaration: t.VariableDeclarator,
  state: FrontendState
): Result<{ readonly name: string; readonly initialValue: unknown }, CompileToBlockIRError> | null {
  if (!t.isIdentifier(declaration.id)) {
    return null;
  }

  const init = declaration.init;
  if (!t.isCallExpression(init) || !t.isIdentifier(init.callee)) {
    return null;
  }

  if (!state.createSignalLocalNames.has(init.callee.name)) {
    return null;
  }

  if (init.arguments.length !== 1) {
    return err({
      code: "UNSUPPORTED_SIGNAL_DECLARATION",
      message: `Signal ${declaration.id.name} must call createSignal() with exactly one initial value.`
    });
  }

  const argument = init.arguments[0];
  if (!argument || t.isSpreadElement(argument) || t.isJSXNamespacedName(argument)) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: `Signal ${declaration.id.name} uses an unsupported createSignal() initializer.`
    });
  }

  const initialValue = readStaticSignalInitializer(argument);
  if (!initialValue.ok) {
    if (t.isIdentifier(argument)) {
      const aliasedValue = state.staticInitializerAliases.get(argument.name);
      if (aliasedValue !== undefined) {
        return ok({
          name: declaration.id.name,
          initialValue: aliasedValue
        });
      }
    }

    return initialValue;
  }

  return ok({
    name: declaration.id.name,
    initialValue: initialValue.value
  });
}

function collectStaticInitializerAlias(
  declaration: t.VariableDeclarator,
  state: FrontendState
): void {
  if (!t.isIdentifier(declaration.id) || !declaration.init || !t.isExpression(declaration.init)) {
    return;
  }

  if (t.isCallExpression(declaration.init) && t.isIdentifier(declaration.init.callee) && state.createSignalLocalNames.has(declaration.init.callee.name)) {
    return;
  }

  const initialValue = readStaticSignalInitializer(declaration.init);
  if (!initialValue.ok) {
    return;
  }

  state.staticInitializerAliases.set(declaration.id.name, initialValue.value);
}

function readStaticSignalInitializer(
  expression: t.Expression | t.ArgumentPlaceholder,
  scope: ReadonlyMap<string, unknown> = new Map<string, unknown>()
): Result<unknown, CompileToBlockIRError> {
  if (t.isStringLiteral(expression) || t.isNumericLiteral(expression) || t.isBooleanLiteral(expression)) {
    return ok(expression.value);
  }

  if (t.isNullLiteral(expression)) {
    return ok(null);
  }

  if (t.isIdentifier(expression)) {
    const value = scope.get(expression.name);
    if (value !== undefined || scope.has(expression.name)) {
      return ok(value);
    }

    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: `compile() only supports static identifier references in createSignal() initializers, got ${expression.name}.`
    });
  }

  if (t.isArrayExpression(expression)) {
    const values: unknown[] = [];
    for (const element of expression.elements) {
      if (!element || t.isSpreadElement(element)) {
        return err({
          code: "UNSUPPORTED_SIGNAL_INITIALIZER",
          message: "compile() does not support sparse or spread array createSignal() initializers."
        });
      }

      const value = readStaticSignalInitializer(element, scope);
      if (!value.ok) {
        return value;
      }

      values.push(value.value);
    }

    return ok(values);
  }

  if (t.isObjectExpression(expression)) {
    const value: Record<string, unknown> = {};
    for (const property of expression.properties) {
      if (!t.isObjectProperty(property) || property.computed) {
        return err({
          code: "UNSUPPORTED_SIGNAL_INITIALIZER",
          message: "compile() only supports plain object createSignal() initializers."
        });
      }

      const key = readObjectKey(property.key);
      if (!key.ok) {
        return key;
      }

      if (!t.isExpression(property.value)) {
        return err({
          code: "UNSUPPORTED_SIGNAL_INITIALIZER",
          message: "compile() only supports expression object values in createSignal() initializers."
        });
      }

      const propertyValue = readStaticSignalInitializer(property.value, scope);
      if (!propertyValue.ok) {
        return propertyValue;
      }

      value[key.value] = propertyValue.value;
    }

    return ok(value);
  }

  if (t.isTemplateLiteral(expression)) {
    let value = "";

    for (let index = 0; index < expression.quasis.length; index += 1) {
      value += expression.quasis[index]?.value.cooked ?? "";

      const templateExpression = expression.expressions[index];
      if (!templateExpression) {
        continue;
      }

      if (!t.isExpression(templateExpression)) {
        return err({
          code: "UNSUPPORTED_SIGNAL_INITIALIZER",
          message: `compile() only supports expression template interpolations in createSignal() initializers, got ${templateExpression.type}.`
        });
      }

      const evaluated = readStaticSignalInitializer(templateExpression, scope);
      if (!evaluated.ok) {
        return evaluated;
      }

      value += String(evaluated.value);
    }

    return ok(value);
  }

  if (t.isUnaryExpression(expression) && expression.operator === "-") {
    const argument = readStaticSignalInitializer(expression.argument, scope);
    if (!argument.ok) {
      return argument;
    }

    if (typeof argument.value !== "number") {
      return err({
        code: "UNSUPPORTED_SIGNAL_INITIALIZER",
        message: "compile() only supports numeric unary expressions in createSignal() initializers."
      });
    }

    return ok(-argument.value);
  }

  if (t.isCallExpression(expression)) {
    return readStaticArrayFromInitializer(expression, scope);
  }

  return err({
    code: "UNSUPPORTED_SIGNAL_INITIALIZER",
    message: `compile() only supports literal createSignal() initializers, got ${expression.type}.`
  });
}

function readStaticArrayFromInitializer(
  expression: t.CallExpression,
  scope: ReadonlyMap<string, unknown>
): Result<unknown, CompileToBlockIRError> {
  if (
    !t.isMemberExpression(expression.callee) ||
    !t.isIdentifier(expression.callee.object, { name: "Array" }) ||
    !t.isIdentifier(expression.callee.property, { name: "from" })
  ) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: `compile() only supports literal createSignal() initializers, got ${expression.type}.`
    });
  }

  const sourceArgument = expression.arguments[0];
  if (!sourceArgument || t.isSpreadElement(sourceArgument) || t.isArgumentPlaceholder(sourceArgument)) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: "compile() requires Array.from() to receive a concrete source in createSignal() initializers."
    });
  }

  const mapperArgument = expression.arguments[1];
  const sourceValues = readArrayFromSource(sourceArgument, scope);
  if (!sourceValues.ok) {
    return sourceValues;
  }

  if (!mapperArgument) {
    return ok(sourceValues.value);
  }

  if (t.isSpreadElement(mapperArgument) || t.isArgumentPlaceholder(mapperArgument)) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: "compile() does not support spread Array.from() mappers in createSignal() initializers."
    });
  }

  if (!t.isArrowFunctionExpression(mapperArgument) || !t.isExpression(mapperArgument.body)) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: "compile() only supports expression-bodied arrow mappers in Array.from() createSignal() initializers."
    });
  }

  const valueParam = mapperArgument.params[0];
  const indexParam = mapperArgument.params[1];
  if ((valueParam && !t.isIdentifier(valueParam)) || (indexParam && !t.isIdentifier(indexParam))) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: "compile() only supports identifier params in Array.from() createSignal() mappers."
    });
  }

  const mappedValues: unknown[] = [];

  for (let index = 0; index < sourceValues.value.length; index += 1) {
    const mapperScope = new Map(scope);
    if (valueParam) {
      mapperScope.set(valueParam.name, sourceValues.value[index]);
    }
    if (indexParam) {
      mapperScope.set(indexParam.name, index);
    }

    const mappedValue = readStaticSignalInitializer(mapperArgument.body, mapperScope);
    if (!mappedValue.ok) {
      return mappedValue;
    }

    mappedValues.push(mappedValue.value);
  }

  return ok(mappedValues);
}

function readArrayFromSource(
  source: t.Expression,
  scope: ReadonlyMap<string, unknown>
): Result<unknown[], CompileToBlockIRError> {
  if (t.isArrayExpression(source)) {
    const values = readStaticSignalInitializer(source, scope);
    return values.ok
      ? ok(values.value as unknown[])
      : values;
  }

  if (!t.isObjectExpression(source)) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: "compile() only supports Array.from() object sources with a static length in createSignal() initializers."
    });
  }

  const lengthProperty = source.properties.find(property =>
    t.isObjectProperty(property) &&
    !property.computed &&
    ((t.isIdentifier(property.key) && property.key.name === "length") ||
      (t.isStringLiteral(property.key) && property.key.value === "length"))
  );

  if (!lengthProperty || !t.isObjectProperty(lengthProperty) || !t.isExpression(lengthProperty.value)) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: "compile() requires Array.from() object sources to define a static length."
    });
  }

  const lengthValue = readStaticSignalInitializer(lengthProperty.value, scope);
  if (!lengthValue.ok) {
    return lengthValue;
  }

  if (!Number.isInteger(lengthValue.value) || typeof lengthValue.value !== "number" || lengthValue.value < 0) {
    return err({
      code: "UNSUPPORTED_SIGNAL_INITIALIZER",
      message: "compile() requires Array.from() length to be a non-negative integer."
    });
  }

  return ok(Array.from({ length: lengthValue.value }, () => undefined));
}

function readObjectKey(
  key: t.Expression | t.Identifier | t.PrivateName
): Result<string, CompileToBlockIRError> {
  if (t.isIdentifier(key)) {
    return ok(key.name);
  }

  if (t.isStringLiteral(key) || t.isNumericLiteral(key)) {
    return ok(String(key.value));
  }

  return err({
    code: "UNSUPPORTED_SIGNAL_INITIALIZER",
    message: "compile() only supports identifier, string, or numeric object keys in createSignal() initializers."
  });
}

function findRenderFunction(ast: t.File): t.FunctionDeclaration | null {
  for (const statement of ast.program.body) {
    if (t.isFunctionDeclaration(statement) && statement.id?.name === "render") {
      return statement;
    }

    if (!t.isExportNamedDeclaration(statement) || !t.isFunctionDeclaration(statement.declaration)) {
      continue;
    }

    if (statement.declaration.id?.name === "render") {
      return statement.declaration;
    }
  }

  return null;
}

function findRenderRoot(ast: t.File): Result<t.JSXElement, CompileToBlockIRError> {
  const renderFunction = findRenderFunction(ast);
  if (renderFunction === null) {
    return err({
      code: "UNSUPPORTED_ROOT_SHAPE",
      message: "compile() currently requires a render() function."
    });
  }

  let root: t.JSXElement | null = null;
  traverse(ast, {
    ReturnStatement(path: NodePath<t.ReturnStatement>) {
      if (root !== null) {
        return;
      }

      const functionParent = path.findParent(parent => parent.isFunctionDeclaration());
      if (!functionParent || functionParent.node !== renderFunction) {
        return;
      }

      const argument = path.node.argument;
      if (!t.isJSXElement(argument)) {
        return;
      }

      root = argument;
      path.stop();
    }
  });

  if (root === null) {
    return err({
      code: "UNSUPPORTED_ROOT_SHAPE",
      message: "compile() currently requires a function that returns a single JSX element."
    });
  }

  return ok(root);
}

function collectTopLevelFunctionHandlers(
  ast: t.File,
  handlers: Readonly<Record<string, unknown>> = {}
): Map<string, unknown> {
  const resolvedHandlers = new Map<string, unknown>();
  for (const [name, handler] of Object.entries(handlers)) {
    resolvedHandlers.set(name, handler);
  }

  for (const statement of ast.program.body) {
    if (!t.isFunctionDeclaration(statement) || !statement.id) {
      if (
        !t.isExportNamedDeclaration(statement) ||
        !t.isFunctionDeclaration(statement.declaration) ||
        !statement.declaration.id
      ) {
        continue;
      }

      if (!resolvedHandlers.has(statement.declaration.id.name)) {
        resolvedHandlers.set(statement.declaration.id.name, statement.declaration.id.name);
      }
      continue;
    }

    if (!resolvedHandlers.has(statement.id.name)) {
      resolvedHandlers.set(statement.id.name, statement.id.name);
    }
  }

  return resolvedHandlers;
}

type JsxTagKind =
  | {
      readonly kind: "host";
      readonly primitive: HostPrimitive;
    }
  | {
      readonly kind: "structure";
      readonly primitive: "List" | "VirtualList";
    };

function lowerHostJsxElement(
  element: t.JSXElement,
  state: FrontendState,
  parent: number | null
): Result<number, CompileToBlockIRError> {
  const tagKindResult = getJsxTagKind(state, element.openingElement.name);
  if (!tagKindResult.ok) {
    return tagKindResult;
  }

  if (tagKindResult.value.kind !== "host") {
    return err({
      code: "UNSUPPORTED_ROOT_SHAPE",
      message: `compile() currently requires JSX tag <${tagKindResult.value.primitive}> to appear inside a host element.`
    });
  }

  const node = state.builder.element(tagKindResult.value.primitive);
  if (parent !== null) {
    const appendResult = state.builder.append(parent, node);
    if (!appendResult.ok) {
      return err(appendResult.error);
    }
  }

  const attributesResult = lowerJsxAttributes(element.openingElement.attributes, state, node);
  if (!attributesResult.ok) {
    return attributesResult;
  }

  for (const child of element.children) {
    if (t.isJSXText(child)) {
      const value = normalizeJsxText(child.value);
      if (value.length === 0) {
        continue;
      }

      const textNode = state.builder.text(value);
      const appendResult = state.builder.append(node, textNode);
      if (!appendResult.ok) {
        return err(appendResult.error);
      }
      continue;
    }

    if (t.isJSXElement(child)) {
      const childTagKind = getJsxTagKind(state, child.openingElement.name);
      if (!childTagKind.ok) {
        return childTagKind;
      }

      if (childTagKind.value.kind === "host") {
        const childResult = lowerHostJsxElement(child, state, node);
        if (!childResult.ok) {
          return childResult;
        }
      } else {
        const structureResult = lowerStructurePrimitive(child, state, node, childTagKind.value.primitive);
        if (!structureResult.ok) {
          return structureResult;
        }
      }
      continue;
    }

    if (t.isJSXExpressionContainer(child)) {
      const expressionResult = lowerJsxExpressionChild(child.expression, state, node);
      if (!expressionResult.ok) {
        return expressionResult;
      }
      continue;
    }

    return err({
      code: "UNSUPPORTED_JSX_CHILD",
      message: `compile() does not support JSX child kind ${child.type}.`
    });
  }

  return ok(node);
}

function lowerStructurePrimitive(
  element: t.JSXElement,
  state: FrontendState,
  parent: number,
  primitive: "List" | "VirtualList"
): Result<void, CompileToBlockIRError> {
  if (state.templateScope && !state.templateScope.allowStructurePrimitives) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() does not support nested structure primitive <${primitive}> inside template callbacks yet.`
    });
  }

  const eachAttribute = readRequiredStructureAttribute(element, "each");
  if (!eachAttribute.ok) {
    return eachAttribute;
  }

  const byAttribute = readRequiredStructureAttribute(element, "by");
  if (!byAttribute.ok) {
    return byAttribute;
  }

  const eachExpression = getAttributeExpression(eachAttribute.value, primitive, "each");
  if (!eachExpression.ok) {
    return eachExpression;
  }

  const byExpression = getAttributeExpression(byAttribute.value, primitive, "by");
  if (!byExpression.ok) {
    return byExpression;
  }

  const eachSignalSlot = readSignalReference(eachExpression.value, state);
  if (!eachSignalSlot.ok) {
    return eachSignalSlot;
  }

  const keyPath = readKeySelectorPath(byExpression.value, primitive);
  if (!keyPath.ok) {
    return keyPath;
  }

  const renderCallback = readStructureRenderCallback(element, primitive);
  if (!renderCallback.ok) {
    return renderCallback;
  }

  const templateResult = compileTemplateCallback(renderCallback.value, state, primitive);
  if (!templateResult.ok) {
    return templateResult;
  }

  const anchorStart = state.builder.text("");
  const appendStart = state.builder.append(parent, anchorStart);
  if (!appendStart.ok) {
    return err(appendStart.error);
  }

  const anchorEnd = state.builder.text("");
  const appendEnd = state.builder.append(parent, anchorEnd);
  if (!appendEnd.ok) {
    return err(appendEnd.error);
  }

  if (primitive === "List") {
    const regionSlot = state.builder.defineKeyedListRegion({
      anchorStartNode: anchorStart,
      anchorEndNode: anchorEnd
    });
    state.structures.push({
      kind: "keyed-list",
      regionSlot,
      sourceSignalSlot: eachSignalSlot.value,
      keyPath: keyPath.value,
      template: templateResult.value
    });
    return ok(undefined);
  }

  const estimateAttribute = readRequiredStructureAttribute(element, "estimateSize");
  if (!estimateAttribute.ok) {
    return estimateAttribute;
  }

  const overscanAttribute = readRequiredStructureAttribute(element, "overscan");
  if (!overscanAttribute.ok) {
    return overscanAttribute;
  }

  const estimateExpression = getAttributeExpression(estimateAttribute.value, primitive, "estimateSize");
  if (!estimateExpression.ok) {
    return estimateExpression;
  }

  const overscanExpression = getAttributeExpression(overscanAttribute.value, primitive, "overscan");
  if (!overscanExpression.ok) {
    return overscanExpression;
  }

  const estimateSize = readStaticNumberExpression(estimateExpression.value, primitive, "estimateSize");
  if (!estimateSize.ok) {
    return estimateSize;
  }

  const overscan = readStaticNumberExpression(overscanExpression.value, primitive, "overscan");
  if (!overscan.ok) {
    return overscan;
  }

  const regionSlot = state.builder.defineVirtualListRegion({
    anchorStartNode: anchorStart,
    anchorEndNode: anchorEnd
  });

  state.structures.push({
    kind: "virtual-list",
    regionSlot,
    sourceSignalSlot: eachSignalSlot.value,
    keyPath: keyPath.value,
    estimateSize: estimateSize.value,
    overscan: overscan.value,
    template: templateResult.value
  });

  return ok(undefined);
}

function readRequiredStructureAttribute(
  element: t.JSXElement,
  attributeName: string
): Result<t.JSXAttribute, CompileToBlockIRError> {
  for (const attribute of element.openingElement.attributes) {
    if (t.isJSXSpreadAttribute(attribute)) {
      return err({
        code: "UNSUPPORTED_JSX_SPREAD",
        message: "compile() does not support JSX spread attributes yet."
      });
    }

    const name = getJsxAttributeName(attribute.name);
    if (!name.ok) {
      return name;
    }

    if (name.value === attributeName) {
      return ok(attribute);
    }
  }

  return err({
    code: "UNSUPPORTED_COMPONENT_CALL",
    message: `compile() requires structure primitive attribute ${attributeName}.`
  });
}

function getAttributeExpression(
  attribute: t.JSXAttribute,
  primitive: "List" | "VirtualList",
  attributeName: string
): Result<t.Expression, CompileToBlockIRError> {
  if (!attribute.value) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}>.${attributeName} to use an expression value.`
    });
  }

  if (!t.isJSXExpressionContainer(attribute.value) || t.isJSXEmptyExpression(attribute.value.expression)) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}>.${attributeName} to use a JSX expression.`
    });
  }

  return ok(attribute.value.expression);
}

function readStructureRenderCallback(
  element: t.JSXElement,
  primitive: "List" | "VirtualList"
): Result<t.ArrowFunctionExpression, CompileToBlockIRError> {
  let callback: t.ArrowFunctionExpression | null = null;

  for (const child of element.children) {
    if (t.isJSXText(child) && normalizeJsxText(child.value).length === 0) {
      continue;
    }

    if (!t.isJSXExpressionContainer(child) || t.isJSXEmptyExpression(child.expression) || !t.isArrowFunctionExpression(child.expression)) {
      return err({
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: `compile() requires <${primitive}> children to be a single arrow-function render callback.`
      });
    }

    if (callback !== null) {
      return err({
        code: "UNSUPPORTED_COMPONENT_CALL",
        message: `compile() only supports a single render callback child for <${primitive}>.`
      });
    }

    callback = child.expression;
  }

  if (callback === null) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}> to define a render callback child.`
    });
  }

  return ok(callback);
}

function compileTemplateCallback(
  callback: t.ArrowFunctionExpression,
  state: FrontendState,
  primitive: "List" | "VirtualList"
): Result<CompiledTemplateDescriptor, CompileToBlockIRError> {
  if (callback.params.length !== 1 || !t.isIdentifier(callback.params[0])) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}> render callbacks to declare exactly one identifier parameter.`
    });
  }

  if (!t.isJSXElement(callback.body)) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}> render callbacks to return a single JSX element.`
    });
  }

  const templateState: FrontendState = {
    builder: createBlueprintBuilder(),
    signalSlots: new Map<string, number>(),
    signalSymbols: new Map<string, number>(),
    eventHandlers: state.eventHandlers,
    initialSignalValues: [],
    jsxHostPrimitives: state.jsxHostPrimitives,
    jsxStructurePrimitives: state.jsxStructurePrimitives,
    createSignalLocalNames: new Set<string>(),
    staticInitializerAliases: new Map<string, unknown>(),
    structures: [],
    templateScope: {
      paramName: callback.params[0].name,
      signalPaths: [],
      signalSlotsByPath: new Map<string, number>(),
      allowStructurePrimitives: false
    }
  };
  const templateScope = templateState.templateScope;
  if (!templateScope) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() failed to initialize template scope for <${primitive}>.`
    });
  }

  const templateRoot = lowerHostJsxElement(callback.body, templateState, null);
  if (!templateRoot.ok) {
    return templateRoot;
  }

  templateState.builder.setSignalCount(templateState.signalSlots.size);
  const block = templateState.builder.buildIR();
  if (!block.ok) {
    return err(block.error);
  }

  const normalizedSignalPaths = Array.from(
    { length: templateState.signalSlots.size },
    (_, index) => templateScope.signalPaths[index] ?? null
  );

  return ok({
    block: block.value,
    initialSignalValues: templateState.initialSignalValues,
    signalPaths: normalizedSignalPaths
  });
}

function readKeySelectorPath(
  expression: t.Expression,
  primitive: "List" | "VirtualList"
): Result<readonly string[], CompileToBlockIRError> {
  if (!t.isArrowFunctionExpression(expression) || expression.params.length !== 1 || !t.isIdentifier(expression.params[0])) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}>.by to be an arrow function with one identifier parameter.`
    });
  }

  if (!t.isExpression(expression.body)) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}>.by to return a direct property path.`
    });
  }

  const path = readMemberPathFromRoot(expression.body, expression.params[0].name);
  if (!path.ok) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() only supports <${primitive}>.by selectors of the form item => item.id or item => item.meta.id.`
    });
  }

  if (path.value.length === 0) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires <${primitive}>.by to reference at least one property.`
    });
  }

  return ok(path.value);
}

function readStaticNumberExpression(
  expression: t.Expression,
  primitive: "List" | "VirtualList",
  attributeName: string
): Result<number, CompileToBlockIRError> {
  if (t.isNumericLiteral(expression)) {
    return ok(expression.value);
  }

  if (t.isArrowFunctionExpression(expression) && expression.params.length <= 1 && t.isNumericLiteral(expression.body)) {
    return ok(expression.body.value);
  }

  return err({
    code: "UNSUPPORTED_COMPONENT_CALL",
    message: `compile() requires <${primitive}>.${attributeName} to be a static numeric literal or arrow function returning one.`
  });
}

function lowerJsxAttributes(
  attributes: readonly (t.JSXAttribute | t.JSXSpreadAttribute)[],
  state: FrontendState,
  node: number
): Result<void, CompileToBlockIRError> {
  for (const attribute of attributes) {
    if (t.isJSXSpreadAttribute(attribute)) {
      return err({
        code: "UNSUPPORTED_JSX_SPREAD",
        message: "compile() does not support JSX spread attributes yet."
      });
    }

    const name = getJsxAttributeName(attribute.name);
    if (!name.ok) {
      return name;
    }

    const value = attribute.value;
    if (value === null) {
      bindStaticAttributeValue(state, node, name.value, true);
      continue;
    }

    if (t.isStringLiteral(value)) {
      bindStaticAttributeValue(state, node, name.value, value.value);
      continue;
    }

    if (!t.isJSXExpressionContainer(value)) {
      const valueKind = value?.type ?? "unknown";
      return err({
        code: "UNSUPPORTED_ATTRIBUTE_VALUE",
        message: `compile() does not support attribute ${name.value} with value kind ${valueKind}.`
      });
    }

    const expression = value.expression;
    if (t.isJSXEmptyExpression(expression)) {
      return err({
        code: "UNSUPPORTED_EXPRESSION",
        message: `compile() does not support empty JSX expression for attribute ${name.value}.`
      });
    }

    if (name.value === "style") {
      // `style={{ ... }}` still lowers into per-style-key bindings because the runtime only
      // knows how to patch one style key per binding slot; there is no object-style patch opcode.
      const styleObjectResult = lowerStyleObjectAttribute(expression, state, node);
      if (!styleObjectResult.ok) {
        return styleObjectResult;
      }
      continue;
    }

    if (isEventAttribute(name.value)) {
      if (state.templateScope) {
        return err({
          code: "UNSUPPORTED_EVENT_HANDLER",
          message: "compile() does not support event handlers inside List or VirtualList template callbacks yet."
        });
      }

      if (!t.isIdentifier(expression)) {
        return err({
          code: "UNSUPPORTED_EVENT_HANDLER",
          message: `compile() requires event ${name.value} to reference a named function.`
        });
      }

      const handler = state.eventHandlers.get(expression.name);
      if (handler === undefined) {
        return err({
          code: "UNSUPPORTED_EVENT_HANDLER",
          message: `compile() could not resolve event handler ${expression.name}.`
        });
      }

      state.builder.bindEvent(node, normalizeEventName(name.value), handler);
      continue;
    }

    const staticExpression = readStaticExpressionValue(expression);
    if (staticExpression.kind === "error") {
      return err(staticExpression.error);
    }

    if (staticExpression.kind === "static") {
      bindStaticAttributeValue(state, node, name.value, staticExpression.value);
      continue;
    }

    const signalSlotResult = readSignalReference(expression, state);
    if (!signalSlotResult.ok) {
      return signalSlotResult;
    }

    if (name.value.startsWith("style:")) {
      state.builder.bindStyle(node, name.value.slice("style:".length), signalSlotResult.value);
      continue;
    }

    state.builder.bindProp(node, normalizePropName(name.value), signalSlotResult.value);
  }

  return ok(undefined);
}

function lowerJsxExpressionChild(
  expression: t.Expression | t.JSXEmptyExpression,
  state: FrontendState,
  parent: number
): Result<void, CompileToBlockIRError> {
  if (t.isJSXEmptyExpression(expression)) {
    return ok(undefined);
  }

  if (t.isConditionalExpression(expression)) {
    return lowerConditionalExpression(expression, state, parent);
  }

  const staticExpression = readStaticExpressionValue(expression);
  if (staticExpression.kind === "error") {
    return err(staticExpression.error);
  }

  if (staticExpression.kind === "static") {
    if (staticExpression.value === null || typeof staticExpression.value === "boolean") {
      return ok(undefined);
    }

    return appendStaticTextBinding(state, parent, staticExpression.value);
  }

  const signalSlotResult = readSignalReference(expression, state);
  if (!signalSlotResult.ok) {
    return signalSlotResult;
  }

  const textNode = state.builder.text("");
  const appendResult = state.builder.append(parent, textNode);
  if (!appendResult.ok) {
    return err(appendResult.error);
  }

  state.builder.bindText(textNode, signalSlotResult.value);
  return ok(undefined);
}

function lowerConditionalExpression(
  expression: t.ConditionalExpression,
  state: FrontendState,
  parent: number
): Result<void, CompileToBlockIRError> {
  const testResult = readSignalReference(expression.test, state);
  if (!testResult.ok) {
    return testResult;
  }

  if (!t.isJSXElement(expression.consequent) || !t.isJSXElement(expression.alternate)) {
    return err({
      code: "UNSUPPORTED_REGION_PATTERN",
      message: "compile() currently only supports conditional JSX of the form cond ? <A /> : <B />."
    });
  }

  const consequentResult = lowerHostJsxElement(expression.consequent, state, parent);
  if (!consequentResult.ok) {
    return consequentResult;
  }

  const alternateResult = lowerHostJsxElement(expression.alternate, state, parent);
  if (!alternateResult.ok) {
    return alternateResult;
  }

  // The runtime switches conditional regions by anchor range, so frontend lowering must
  // materialize both branch ranges before it can describe the region metadata.
  state.builder.defineConditionalRegion({
    anchorStartNode: consequentResult.value,
    anchorEndNode: alternateResult.value,
    branches: [
      { startNode: consequentResult.value, endNode: consequentResult.value },
      { startNode: alternateResult.value, endNode: alternateResult.value }
    ]
  });

  return ok(undefined);
}

function lowerStyleObjectAttribute(
  expression: t.Expression,
  state: FrontendState,
  node: number
): Result<void, CompileToBlockIRError> {
  if (!t.isObjectExpression(expression)) {
    return err({
      code: "UNSUPPORTED_STYLE_OBJECT",
      message: "compile() only supports style={{ key: value }} object literals."
    });
  }

  for (const property of expression.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      return err({
        code: "UNSUPPORTED_STYLE_OBJECT",
        message: "compile() does not support computed or spread style properties yet."
      });
    }

    const styleKeyResult = readStyleObjectKey(property.key);
    if (!styleKeyResult.ok) {
      return styleKeyResult;
    }

    if (!t.isExpression(property.value)) {
      return err({
        code: "UNSUPPORTED_STYLE_OBJECT",
        message: `compile() does not support style.${styleKeyResult.value} with non-expression value.`
      });
    }

    const staticExpression = readStaticExpressionValue(property.value);
    if (staticExpression.kind === "error") {
      return err({
        code: "UNSUPPORTED_STYLE_OBJECT",
        message: staticExpression.error.message
      });
    }

    if (staticExpression.kind === "static") {
      // Static style members still go through slot allocation so backend/runtime stay on the
      // same "binding reads slot N" contract as dynamic identifier-driven styles.
      if (staticExpression.value === null || typeof staticExpression.value === "boolean") {
        return err({
          code: "UNSUPPORTED_STYLE_OBJECT",
          message: `compile() does not support style.${styleKeyResult.value} with ${String(staticExpression.value)} value.`
        });
      }

      bindStaticAttributeValue(state, node, `style:${styleKeyResult.value}`, staticExpression.value);
      continue;
    }

    // Non-static style members are limited to signal identifiers for now. Allowing arbitrary
    // expressions here would immediately leak implicit computation back into runtime authoring.
    const signalSlotResult = readSignalReference(property.value, state);
    if (!signalSlotResult.ok) {
      return signalSlotResult;
    }

    state.builder.bindStyle(node, styleKeyResult.value, signalSlotResult.value);
  }

  return ok(undefined);
}

function readSignalReference(
  expression: t.Expression,
  state: FrontendState
): Result<number, CompileToBlockIRError> {
  const templatePath = readTemplateSignalPath(expression, state);
  if (templatePath !== null) {
    return ok(templatePath);
  }

  if (!t.isIdentifier(expression)) {
    return err({
      code: "UNSUPPORTED_EXPRESSION",
      message: `compile() currently only supports identifier expressions, got ${expression.type}.`
    });
  }

  const slot = state.signalSymbols.get(expression.name);
  if (slot !== undefined) {
    return ok(slot);
  }

  return err({
    code: "SIGNAL_REFERENCE_MISSING",
    message: `Signal ${expression.name} is not declared with createSignal().`
  });
}

function readStyleObjectKey(
  key: t.Expression | t.Identifier | t.PrivateName
): Result<string, CompileToBlockIRError> {
  if (t.isIdentifier(key)) {
    return ok(key.name);
  }

  if (t.isStringLiteral(key)) {
    return ok(key.value);
  }

  return err({
    code: "UNSUPPORTED_STYLE_OBJECT",
    message: "compile() only supports identifier or string style property keys."
  });
}

function readStaticExpressionValue(expression: t.Expression): StaticExpressionReadResult {
  if (t.isIdentifier(expression) || t.isMemberExpression(expression)) {
    return {
      kind: "dynamic"
    };
  }

  if (t.isStringLiteral(expression) || t.isNumericLiteral(expression) || t.isBooleanLiteral(expression)) {
    return {
      kind: "static",
      value: expression.value
    };
  }

  if (t.isNullLiteral(expression)) {
    return {
      kind: "static",
      value: null
    };
  }

  if (t.isTemplateLiteral(expression)) {
    if (expression.expressions.length > 0) {
      return {
        kind: "error",
        error: {
          code: "UNSUPPORTED_EXPRESSION",
          message: "compile() does not support template literals with expressions yet."
        }
      };
    }

    return {
      kind: "static",
      value: expression.quasis.map(quasi => quasi.value.cooked ?? "").join("")
    };
  }

  return {
    kind: "error",
    error: {
      code: "UNSUPPORTED_EXPRESSION",
      // Keep the accepted set intentionally narrow. Once this helper says "static", callers are
      // allowed to allocate immutable slots without introducing extra runtime evaluation paths.
      message: `compile() currently only supports identifier or literal expressions, got ${expression.type}.`
    }
  };
}

function readTemplateSignalPath(
  expression: t.Expression,
  state: FrontendState
): number | null {
  const templateScope = state.templateScope;
  if (!templateScope) {
    return null;
  }

  const path = readMemberPathFromRoot(expression, templateScope.paramName);
  if (!path.ok) {
    return null;
  }

  const pathKey = JSON.stringify(path.value);
  const existing = templateScope.signalSlotsByPath.get(pathKey);
  if (existing !== undefined) {
    return existing;
  }

  const slot = allocateSignalSlot(state, `${templateScope.paramName}:${pathKey}`);
  templateScope.signalSlotsByPath.set(pathKey, slot);
  templateScope.signalPaths[slot] = [...path.value];
  return slot;
}

function readMemberPathFromRoot(
  expression: t.Expression,
  rootName: string
): Result<readonly string[], CompileToBlockIRError> {
  if (t.isIdentifier(expression)) {
    return expression.name === rootName
      ? ok([])
      : err({
        code: "UNSUPPORTED_EXPRESSION",
        message: `compile() expected expression rooted at ${rootName}.`
      });
  }

  if (!t.isMemberExpression(expression) || expression.optional) {
    return err({
      code: "UNSUPPORTED_EXPRESSION",
      message: `compile() expected a property path rooted at ${rootName}.`
    });
  }

  if (!t.isExpression(expression.object)) {
    return err({
      code: "UNSUPPORTED_EXPRESSION",
      message: `compile() expected a property path rooted at ${rootName}.`
    });
  }

  const parentPath = readMemberPathFromRoot(expression.object, rootName);
  if (!parentPath.ok) {
    return parentPath;
  }

  const segment = readMemberPathSegment(expression);
  if (!segment.ok) {
    return segment;
  }

  return ok([
    ...parentPath.value,
    segment.value
  ]);
}

function readMemberPathSegment(
  expression: t.MemberExpression
): Result<string, CompileToBlockIRError> {
  if (t.isIdentifier(expression.property) && !expression.computed) {
    return ok(expression.property.name);
  }

  if (expression.computed && t.isStringLiteral(expression.property)) {
    return ok(expression.property.value);
  }

  if (expression.computed && t.isNumericLiteral(expression.property)) {
    return ok(String(expression.property.value));
  }

  return err({
    code: "UNSUPPORTED_EXPRESSION",
    message: "compile() only supports identifier, string, or numeric property segments."
  });
}

function getJsxTagKind(
  state: FrontendState,
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName
): Result<JsxTagKind, CompileToBlockIRError> {
  if (!t.isJSXIdentifier(name)) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: "compile() does not support component/member JSX tags yet."
    });
  }

  if (state.jsxHostPrimitives.has(name.name)) {
    switch (name.name) {
      case "View":
      case "Text":
      case "Button":
      case "Input":
      case "Image":
      case "ScrollView":
        return ok({
          kind: "host",
          primitive: name.name
        });
    }
  }

  if (state.jsxStructurePrimitives.has(name.name)) {
    switch (name.name) {
      case "List":
      case "VirtualList":
        return ok({
          kind: "structure",
          primitive: name.name
        });
    }
  }

  if (!state.jsxHostPrimitives.has(name.name) && !state.jsxStructurePrimitives.has(name.name)) {
    return err({
      code: "UNSUPPORTED_COMPONENT_CALL",
      message: `compile() requires JSX tag <${name.name}> to be imported from @jue/jsx.`
    });
  }

  return err({
    code: "UNSUPPORTED_COMPONENT_CALL",
    message: `compile() does not support JSX tag <${name.name}> yet.`
  });
}

function isHostPrimitiveName(name: string): boolean {
  return name === "View" ||
    name === "Text" ||
    name === "Button" ||
    name === "Input" ||
    name === "Image" ||
    name === "ScrollView";
}

function isStructurePrimitiveName(name: string): boolean {
  return name === "List" || name === "VirtualList";
}

function getJsxAttributeName(
  name: t.JSXIdentifier | t.JSXNamespacedName
): Result<string, CompileToBlockIRError> {
  if (t.isJSXNamespacedName(name)) {
    return ok(`${name.namespace.name}:${name.name.name}`);
  }

  return ok(name.name);
}

function normalizeJsxText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePropName(name: string): string {
  return name === "class" ? "className" : name;
}

function normalizeEventName(name: string): "onPress" | "onInput" | "onFocus" | "onBlur" | "onScroll" {
  switch (name) {
    case "onClick":
      return "onPress";
    case "onInput":
    case "onFocus":
    case "onBlur":
    case "onScroll":
      return name;
    default:
      return "onPress";
  }
}

function isEventAttribute(name: string): boolean {
  return name === "onClick" ||
    name === "onPress" ||
    name === "onInput" ||
    name === "onFocus" ||
    name === "onBlur" ||
    name === "onScroll";
}

function allocateSignalSlot(state: FrontendState, signalName: string): number {
  const existing = state.signalSlots.get(signalName);
  if (existing !== undefined) {
    return existing;
  }

  const slot = state.signalSlots.size;
  state.signalSlots.set(signalName, slot);
  return slot;
}

// Static literal bindings still become slot-backed bindings because the backend/runtime contract
// only understands "binding reads slot N", not a separate direct-literal patch path.
function bindStaticAttributeValue(
  state: FrontendState,
  node: number,
  attributeName: string,
  value: unknown
): void {
  const slot = allocateSignalSlot(state, createStaticSignalKey(node, attributeName, value));
  mergeInitialSignalValues(state, slot, value);

  if (attributeName.startsWith("style:")) {
    state.builder.bindStyle(node, attributeName.slice("style:".length), slot);
    return;
  }

  state.builder.bindProp(node, normalizePropName(attributeName), slot);
}

function appendStaticTextBinding(
  state: FrontendState,
  parent: number,
  value: unknown
): Result<void, CompileToBlockIRError> {
  const textNode = state.builder.text("");
  const appendResult = state.builder.append(parent, textNode);
  if (!appendResult.ok) {
    return err(appendResult.error);
  }

  // Even literal JSX children are lowered as text bindings instead of inline text nodes so the
  // frontend keeps one consistent path for "dynamic-looking child content becomes a binding slot".
  const slot = allocateSignalSlot(state, createStaticSignalKey(parent, "__text", value));
  mergeInitialSignalValues(state, slot, value);
  state.builder.bindText(textNode, slot);
  return ok(undefined);
}

function createStaticSignalKey(node: number, key: string, value: unknown): string {
  return `__static:${node}:${key}:${typeof value}:${JSON.stringify(value)}`;
}

function mergeInitialSignalValues(
  state: FrontendState,
  slot: number,
  value: unknown
): readonly unknown[] {
  while (state.initialSignalValues.length <= slot) {
    state.initialSignalValues.push(undefined);
  }

  state.initialSignalValues[slot] = value;
  state.builder.setInitialSignalValues(state.initialSignalValues);
  return state.initialSignalValues;
}
