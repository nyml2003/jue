import { BindingOpcode, HOST_EVENT_KEYS, INVALID_INDEX, err, ok, type Result } from "@jue/shared";

import { clearDirty, createDirtyBitsetView } from "./dirty-bits";
import type { BlockInstance, HostAdapter, HostAdapterError } from "./types";
import type { HostEventHandler } from "./types";

export interface BindingDispatchError {
  readonly code: string;
  readonly message: string;
}

export function dispatchBinding(
  instance: BlockInstance,
  adapter: HostAdapter,
  bindingSlot: number
): Result<void, BindingDispatchError> {
  const opcode = instance.blueprint.bindingOpcode[bindingSlot];

  if (opcode === undefined) {
    return err({
      code: "BINDING_SLOT_MISSING",
      message: `Binding slot ${bindingSlot} is missing from the blueprint.`
    });
  }

  switch (opcode) {
    case BindingOpcode.TEXT:
      return dispatchTextBinding(instance, adapter, bindingSlot);
    case BindingOpcode.PROP:
      return dispatchPropBinding(instance, adapter, bindingSlot);
    case BindingOpcode.STYLE:
      return dispatchStyleBinding(instance, adapter, bindingSlot);
    case BindingOpcode.EVENT:
      return dispatchEventBinding(instance, adapter, bindingSlot);
    default:
      return err({
        code: "UNSUPPORTED_BINDING_OPCODE",
        message: `Binding opcode ${opcode} is not supported yet.`
      });
  }
}

function dispatchPropBinding(
  instance: BlockInstance,
  adapter: HostAdapter,
  bindingSlot: number
): Result<void, BindingDispatchError> {
  const nodeIndex = instance.blueprint.bindingNodeIndex[bindingSlot];
  const dataIndex = instance.blueprint.bindingDataIndex[bindingSlot];

  if (nodeIndex === undefined || nodeIndex === INVALID_INDEX) {
    return err({
      code: "PROP_BINDING_NODE_MISSING",
      message: `Prop binding ${bindingSlot} has no concrete node target.`
    });
  }

  const node = instance.nodes[nodeIndex];
  if (node === undefined) {
    return err({
      code: "PROP_BINDING_NODE_UNRESOLVED",
      message: `Prop binding ${bindingSlot} references missing node index ${nodeIndex}.`
    });
  }

  if (dataIndex === undefined) {
    return err({
      code: "PROP_BINDING_DATA_MISSING",
      message: `Prop binding ${bindingSlot} is missing parameter metadata.`
    });
  }

  const signalSlot = instance.blueprint.bindingArgU32[dataIndex];
  const propKeyRefIndex = instance.blueprint.bindingArgU32[dataIndex + 1];

  if (signalSlot === undefined || signalSlot >= instance.signalValues.length) {
    return err({
      code: "PROP_BINDING_SIGNAL_MISSING",
      message: `Prop binding ${bindingSlot} references missing signal slot ${signalSlot}.`
    });
  }

  if (propKeyRefIndex === undefined) {
    return err({
      code: "PROP_BINDING_KEY_INDEX_MISSING",
      message: `Prop binding ${bindingSlot} is missing a prop key reference index.`
    });
  }

  const propKey = instance.blueprint.bindingArgRef[propKeyRefIndex];
  if (typeof propKey !== "string") {
    return err({
      code: "PROP_BINDING_KEY_MISSING",
      message: `Prop binding ${bindingSlot} references missing prop key at ref slot ${propKeyRefIndex}.`
    });
  }

  const hostResult = adapter.setProp(node, propKey, instance.signalValues[signalSlot]);

  if (!hostResult.ok) {
    return err(hostResult.error satisfies HostAdapterError);
  }

  return clearBindingDirty(instance, bindingSlot);
}

function dispatchStyleBinding(
  instance: BlockInstance,
  adapter: HostAdapter,
  bindingSlot: number
): Result<void, BindingDispatchError> {
  const nodeIndex = instance.blueprint.bindingNodeIndex[bindingSlot];
  const dataIndex = instance.blueprint.bindingDataIndex[bindingSlot];

  if (nodeIndex === undefined || nodeIndex === INVALID_INDEX) {
    return err({
      code: "STYLE_BINDING_NODE_MISSING",
      message: `Style binding ${bindingSlot} has no concrete node target.`
    });
  }

  const node = instance.nodes[nodeIndex];
  if (node === undefined) {
    return err({
      code: "STYLE_BINDING_NODE_UNRESOLVED",
      message: `Style binding ${bindingSlot} references missing node index ${nodeIndex}.`
    });
  }

  if (dataIndex === undefined) {
    return err({
      code: "STYLE_BINDING_DATA_MISSING",
      message: `Style binding ${bindingSlot} is missing parameter metadata.`
    });
  }

  const signalSlot = instance.blueprint.bindingArgU32[dataIndex];
  const styleKeyRefIndex = instance.blueprint.bindingArgU32[dataIndex + 1];

  if (signalSlot === undefined || signalSlot >= instance.signalValues.length) {
    return err({
      code: "STYLE_BINDING_SIGNAL_MISSING",
      message: `Style binding ${bindingSlot} references missing signal slot ${signalSlot}.`
    });
  }

  if (styleKeyRefIndex === undefined) {
    return err({
      code: "STYLE_BINDING_KEY_INDEX_MISSING",
      message: `Style binding ${bindingSlot} is missing a style key reference index.`
    });
  }

  const styleKey = instance.blueprint.bindingArgRef[styleKeyRefIndex];
  if (typeof styleKey !== "string") {
    return err({
      code: "STYLE_BINDING_KEY_MISSING",
      message: `Style binding ${bindingSlot} references missing style key at ref slot ${styleKeyRefIndex}.`
    });
  }

  const hostResult = adapter.setStyle(node, styleKey, instance.signalValues[signalSlot]);

  if (!hostResult.ok) {
    return err(hostResult.error satisfies HostAdapterError);
  }

  return clearBindingDirty(instance, bindingSlot);
}

function dispatchEventBinding(
  instance: BlockInstance,
  adapter: HostAdapter,
  bindingSlot: number
): Result<void, BindingDispatchError> {
  const nodeIndex = instance.blueprint.bindingNodeIndex[bindingSlot];
  const dataIndex = instance.blueprint.bindingDataIndex[bindingSlot];

  if (nodeIndex === undefined || nodeIndex === INVALID_INDEX) {
    return err({
      code: "EVENT_BINDING_NODE_MISSING",
      message: `Event binding ${bindingSlot} has no concrete node target.`
    });
  }

  const node = instance.nodes[nodeIndex];
  if (node === undefined) {
    return err({
      code: "EVENT_BINDING_NODE_UNRESOLVED",
      message: `Event binding ${bindingSlot} references missing node index ${nodeIndex}.`
    });
  }

  if (dataIndex === undefined) {
    return err({
      code: "EVENT_BINDING_DATA_MISSING",
      message: `Event binding ${bindingSlot} is missing parameter metadata.`
    });
  }

  const eventKeyRefIndex = instance.blueprint.bindingArgU32[dataIndex];
  const handlerRefIndex = instance.blueprint.bindingArgU32[dataIndex + 1];

  if (eventKeyRefIndex === undefined) {
    return err({
      code: "EVENT_BINDING_KEY_INDEX_MISSING",
      message: `Event binding ${bindingSlot} is missing an event key reference index.`
    });
  }

  if (handlerRefIndex === undefined) {
    return err({
      code: "EVENT_BINDING_HANDLER_INDEX_MISSING",
      message: `Event binding ${bindingSlot} is missing an event handler reference index.`
    });
  }

  const eventKey = instance.blueprint.bindingArgRef[eventKeyRefIndex];
  if (typeof eventKey !== "string" || !isHostEventKey(eventKey)) {
    return err({
      code: "EVENT_BINDING_KEY_MISSING",
      message: `Event binding ${bindingSlot} references missing event key at ref slot ${eventKeyRefIndex}.`
    });
  }

  const handler = instance.blueprint.bindingArgRef[handlerRefIndex];
  if (handler !== null && !isHostEventHandler(handler)) {
    return err({
      code: "EVENT_BINDING_HANDLER_MISSING",
      message: `Event binding ${bindingSlot} references missing handler at ref slot ${handlerRefIndex}.`
    });
  }

  const hostResult = adapter.setEvent(node, eventKey, handler ?? null);

  if (!hostResult.ok) {
    return err(hostResult.error satisfies HostAdapterError);
  }

  return clearBindingDirty(instance, bindingSlot);
}

function dispatchTextBinding(
  instance: BlockInstance,
  adapter: HostAdapter,
  bindingSlot: number
): Result<void, BindingDispatchError> {
  const nodeIndex = instance.blueprint.bindingNodeIndex[bindingSlot];
  const signalSlot = instance.blueprint.bindingDataIndex[bindingSlot];

  if (nodeIndex === undefined || nodeIndex === INVALID_INDEX) {
    return err({
      code: "TEXT_BINDING_NODE_MISSING",
      message: `Text binding ${bindingSlot} has no concrete node target.`
    });
  }

  const node = instance.nodes[nodeIndex];
  if (node === undefined) {
    return err({
      code: "TEXT_BINDING_NODE_UNRESOLVED",
      message: `Text binding ${bindingSlot} references missing node index ${nodeIndex}.`
    });
  }

  if (signalSlot === undefined || signalSlot >= instance.signalValues.length) {
    return err({
      code: "TEXT_BINDING_SIGNAL_MISSING",
      message: `Text binding ${bindingSlot} references missing signal slot ${signalSlot}.`
    });
  }

  const textValue = normalizeText(instance.signalValues[signalSlot]);
  const hostResult = adapter.setText(node, textValue);

  if (!hostResult.ok) {
    return err(hostResult.error satisfies HostAdapterError);
  }

  return clearBindingDirty(instance, bindingSlot);
}

function clearBindingDirty(
  instance: BlockInstance,
  bindingSlot: number
): Result<void, BindingDispatchError> {
  const dirtyBitset = createDirtyBitsetView(instance.blueprint.bindingCount, instance.dirtyBindingBits);
  const clearResult = clearDirty(dirtyBitset, bindingSlot);

  if (!clearResult.ok) {
    return err(clearResult.error);
  }

  return ok(undefined);
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "symbol") {
    return value.description ?? "";
  }

  return Object.prototype.toString.call(value);
}

function isHostEventKey(value: string): value is typeof HOST_EVENT_KEYS[number] {
  return HOST_EVENT_KEYS.includes(value as typeof HOST_EVENT_KEYS[number]);
}

function isHostEventHandler(value: unknown): value is HostEventHandler {
  return typeof value === "function";
}
