import type { BlockIR, IRBinding, IRNode, IRRegion } from "@jue/compiler";
import {
  compileSourceToBlockIR,
  type CompiledKeyedListDescriptor,
  type CompiledTemplateDescriptor
} from "@jue/compiler/frontend";
import { err, ok, type HostPrimitive, type Result } from "@jue/shared";

export interface SkylineCompileError {
  readonly code: string;
  readonly message: string;
}

export type SkylineTemplateNode =
  | {
      readonly kind: "element";
      readonly type: HostPrimitive;
      readonly id: number;
      readonly parent: number | null;
    }
  | {
      readonly kind: "text";
      readonly type: "#text";
      readonly id: number;
      readonly parent: number | null;
      readonly staticText: string;
    };

type SkylineBindingKind = Exclude<IRBinding["kind"], "event">;

export interface SkylineBindingPlan {
  readonly kind: SkylineBindingKind;
  readonly node: number;
  readonly key?: string;
  readonly signal: number;
  readonly valuePath: string;
}

export interface SkylineConditionalDescriptor {
  readonly kind: "conditional";
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
  readonly branches: readonly {
    readonly startNode: number;
    readonly endNode: number;
  }[];
}

export interface SkylineListDescriptor {
  readonly kind: "keyed-list";
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
  readonly sourceSignalSlot?: number;
  readonly keyPath?: readonly string[];
  readonly template?: SkylineListTemplateDescriptor;
}

export interface SkylineListTemplateDescriptor {
  readonly signalCount: number;
  readonly initialSignalValues: readonly unknown[];
  readonly signalData: Readonly<Record<string, unknown>>;
  readonly signalPaths: readonly (((readonly string[]) | null))[];
  readonly template: readonly SkylineTemplateNode[];
  readonly templateCode: string;
  readonly bindings: readonly SkylineBindingPlan[];
}

export interface SkylineArtifact {
  readonly signalCount: number;
  readonly initialSignalValues: readonly unknown[];
  readonly signalData: Readonly<Record<string, unknown>>;
  readonly template: readonly SkylineTemplateNode[];
  readonly templateCode: string;
  readonly bindings: readonly SkylineBindingPlan[];
  readonly conditionals: readonly SkylineConditionalDescriptor[];
  readonly keyedLists: readonly SkylineListDescriptor[];
}

export interface CompileSkylineSourceOptions {
  readonly rootSymbol?: string;
}

export function compileSkylineSource(
  source: string,
  options: CompileSkylineSourceOptions = {}
): Result<SkylineArtifact, SkylineCompileError> {
  const block = compileSourceToBlockIR(source, {
    ...(options.rootSymbol === undefined ? {} : { rootSymbol: options.rootSymbol })
  });
  if (!block.ok) {
    return err(block.error);
  }

  return buildSkylineArtifact(block.value.block, {
    keyedLists: block.value.structures.filter(
      (structure): structure is CompiledKeyedListDescriptor => structure.kind === "keyed-list"
    )
  });
}

export function compileSkylineBlockIR(
  block: BlockIR
): Result<SkylineArtifact, SkylineCompileError> {
  return buildSkylineArtifact(block);
}

function buildSkylineArtifact(
  block: BlockIR,
  structureOptions: {
    readonly keyedLists?: readonly CompiledKeyedListDescriptor[];
  } = {}
): Result<SkylineArtifact, SkylineCompileError> {
  const initialSignalValues = block.initialSignalValues ?? [];
  const template: SkylineTemplateNode[] = [];
  for (const node of block.nodes) {
    template.push(lowerNode(node));
  }

  const bindings: SkylineBindingPlan[] = [];
  for (const binding of block.bindings) {
    const lowered = lowerBinding(binding);
    if (!lowered.ok) {
      return lowered;
    }

    bindings.push(lowered.value);
  }

  const conditionals: SkylineConditionalDescriptor[] = [];
  const keyedLists: SkylineListDescriptor[] = [];
  const regions = block.regions ?? [];
  const keyedListByRegionSlot = new Map(
    (structureOptions.keyedLists ?? []).map(descriptor => [descriptor.regionSlot, descriptor] as const)
  );

  for (let regionSlot = 0; regionSlot < regions.length; regionSlot += 1) {
    const region = regions[regionSlot];
    if (region === undefined) {
      continue;
    }

    switch (region.kind) {
      case "conditional":
        conditionals.push({
          kind: "conditional",
          anchorStartNode: region.anchorStartNode,
          anchorEndNode: region.anchorEndNode,
          branches: region.branches
        });
        break;
      case "keyed-list": {
        const keyedList = createSkylineListDescriptor(region, keyedListByRegionSlot.get(regionSlot));
        if (!keyedList.ok) {
          return keyedList;
        }

        keyedLists.push(keyedList.value);
        break;
      }
      case "nested-block":
      case "virtual-list":
        return err({
          code: "SKYLINE_REGION_UNSUPPORTED",
          message: `Skyline target does not support ${region.kind} regions yet.`
        });
    }
  }

  return ok({
    signalCount: block.signalCount,
    initialSignalValues,
    signalData: createSignalData(block.signalCount, initialSignalValues),
    template,
    templateCode: emitTemplateCode(template, bindings),
    bindings,
    conditionals,
    keyedLists
  });
}

function createSkylineListDescriptor(
  region: Extract<IRRegion, { readonly kind: "keyed-list" }>,
  descriptor: CompiledKeyedListDescriptor | undefined
): Result<SkylineListDescriptor, SkylineCompileError> {
  if (descriptor === undefined) {
    return ok({
      kind: "keyed-list",
      anchorStartNode: region.anchorStartNode,
      anchorEndNode: region.anchorEndNode
    });
  }

  const template = lowerListTemplateDescriptor(descriptor.template);
  if (!template.ok) {
    return template;
  }

  return ok({
    kind: "keyed-list",
    anchorStartNode: region.anchorStartNode,
    anchorEndNode: region.anchorEndNode,
    sourceSignalSlot: descriptor.sourceSignalSlot,
    keyPath: descriptor.keyPath,
    template: template.value
  });
}

function lowerListTemplateDescriptor(
  descriptor: CompiledTemplateDescriptor
): Result<SkylineListTemplateDescriptor, SkylineCompileError> {
  const templateArtifact = buildSkylineArtifact(descriptor.block);
  if (!templateArtifact.ok) {
    return templateArtifact;
  }

  return ok({
    signalCount: templateArtifact.value.signalCount,
    initialSignalValues: descriptor.initialSignalValues,
    signalData: createSignalData(
      templateArtifact.value.signalCount,
      descriptor.initialSignalValues
    ),
    signalPaths: descriptor.signalPaths,
    template: templateArtifact.value.template,
    templateCode: templateArtifact.value.templateCode,
    bindings: templateArtifact.value.bindings
  });
}

function lowerNode(node: IRNode): SkylineTemplateNode {
  if (node.kind === "text") {
    return {
      kind: "text",
      type: "#text",
      id: node.id,
      parent: node.parent,
      staticText: node.value
    };
  }

  return {
    kind: "element",
    type: node.type,
    id: node.id,
    parent: node.parent
  };
}

function lowerBinding(
  binding: IRBinding
): Result<SkylineBindingPlan, SkylineCompileError> {
  switch (binding.kind) {
    case "text":
      return ok({
        kind: "text",
        node: binding.node,
        signal: binding.signal,
        valuePath: createSignalPath(binding.signal)
      });
    case "prop":
      return ok({
        kind: "prop",
        node: binding.node,
        key: binding.key,
        signal: binding.signal,
        valuePath: createSignalPath(binding.signal)
      });
    case "style":
      return ok({
        kind: "style",
        node: binding.node,
        key: binding.key,
        signal: binding.signal,
        valuePath: createSignalPath(binding.signal)
      });
    case "region-switch":
      return ok({
        kind: "region-switch",
        node: binding.region,
        signal: binding.signal,
        valuePath: createSignalPath(binding.signal)
      });
    case "event":
      return err({
        code: "SKYLINE_EVENT_UNSUPPORTED",
        message: "Skyline target does not lower event bindings yet."
      });
  }
}

function createSignalData(
  signalCount: number,
  initialSignalValues: readonly unknown[]
): Readonly<Record<string, unknown>> {
  const signalData: Record<string, unknown> = {};
  for (let slot = 0; slot < signalCount; slot += 1) {
    signalData[`s${slot}`] = initialSignalValues[slot] ?? null;
  }

  return signalData;
}

function createSignalPath(signal: number): string {
  return `signals.s${signal}`;
}

function emitTemplateCode(
  template: readonly SkylineTemplateNode[],
  bindings: readonly SkylineBindingPlan[]
): string {
  if (template.length === 0) {
    return "";
  }

  const textBindingsByNode = new Map<number, SkylineBindingPlan>();
  const propBindingsByNode = new Map<number, SkylineBindingPlan[]>();
  const styleBindingsByNode = new Map<number, SkylineBindingPlan[]>();
  const childrenByParent = new Map<number | null, SkylineTemplateNode[]>();

  for (const node of template) {
    pushBindingByNode(childrenByParent, node.parent, node);
  }

  for (const binding of bindings) {
    switch (binding.kind) {
      case "text":
        textBindingsByNode.set(binding.node, binding);
        break;
      case "prop": {
        pushBindingByNode(propBindingsByNode, binding.node, binding);
        break;
      }
      case "style": {
        pushBindingByNode(styleBindingsByNode, binding.node, binding);
        break;
      }
      case "region-switch":
        break;
    }
  }

  const roots = childrenByParent.get(null) ?? [];
  return roots.map(node => emitTemplateNode(node, childrenByParent, textBindingsByNode, propBindingsByNode, styleBindingsByNode)).join("");
}

function emitTemplateNode(
  node: SkylineTemplateNode,
  childrenByParent: ReadonlyMap<number | null, readonly SkylineTemplateNode[]>,
  textBindingsByNode: ReadonlyMap<number, SkylineBindingPlan>,
  propBindingsByNode: ReadonlyMap<number, readonly SkylineBindingPlan[]>,
  styleBindingsByNode: ReadonlyMap<number, readonly SkylineBindingPlan[]>
): string {
  if (node.kind === "text") {
    const textBinding = textBindingsByNode.get(node.id);
    if (textBinding === undefined) {
      return escapeTemplateText(node.staticText);
    }

    return toInterpolation(textBinding.valuePath);
  }

  const tag = mapSkylineTag(node.type);
  const attributes = [
    ...emitPropAttributes(propBindingsByNode.get(node.id) ?? []),
    ...emitStyleAttribute(styleBindingsByNode.get(node.id) ?? [])
  ];
  const attributeCode = attributes.length === 0 ? "" : ` ${attributes.join(" ")}`;
  const children = childrenByParent.get(node.id) ?? [];
  const childCode = children
    .map(child => emitTemplateNode(child, childrenByParent, textBindingsByNode, propBindingsByNode, styleBindingsByNode))
    .join("");

  return `<${tag}${attributeCode}>${childCode}</${tag}>`;
}

function emitPropAttributes(bindings: readonly SkylineBindingPlan[]): readonly string[] {
  return bindings.map(binding => {
    const key = binding.key ?? "data-jue-prop";
    return `${mapSkylinePropKey(key)}="${toInterpolation(binding.valuePath)}"`;
  });
}

function emitStyleAttribute(bindings: readonly SkylineBindingPlan[]): readonly string[] {
  if (bindings.length === 0) {
    return [];
  }

  const styleCode = bindings
    .map(binding => `${binding.key ?? "unknown"}: ${toInterpolation(binding.valuePath)};`)
    .join(" ");

  return [`style="${styleCode}"`];
}

function pushBindingByNode<TKey, TValue>(
  map: Map<TKey, TValue[]>,
  key: TKey,
  value: TValue
): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function mapSkylineTag(type: HostPrimitive): string {
  switch (type) {
    case "View":
      return "view";
    case "Text":
      return "text";
    case "Button":
      return "button";
    case "Input":
      return "input";
    case "Image":
      return "image";
    case "ScrollView":
      return "scroll-view";
  }
}

function mapSkylinePropKey(key: string): string {
  if (key === "className") {
    return "class";
  }

  return key;
}

function toInterpolation(path: string): string {
  return `{{${path}}}`;
}

function escapeTemplateText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
