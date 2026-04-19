import { BindingOpcode, INVALID_INDEX, err, ok, type Result } from "@jue/shared";

import { clearDirty, createDirtyBitsetView } from "./dirty-bits";
import type { BlockInstance, HostAdapter, HostAdapterError } from "./types";

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
    default:
      return err({
        code: "UNSUPPORTED_BINDING_OPCODE",
        message: `Binding opcode ${opcode} is not supported yet.`
      });
  }
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

  return String(value);
}
