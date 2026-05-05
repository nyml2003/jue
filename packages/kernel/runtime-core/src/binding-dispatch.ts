import { BindingOpcode, HOST_EVENT_KEYS, INVALID_INDEX, err, ok, type Result } from "@jue/shared";

import { clearDirty, createDirtyBitsetView } from "./dirty-bits";
import type { BlockInstance, HostAdapter, HostAdapterError } from "./types";
import type { HostEventHandler } from "./types";

export interface BindingDispatchError {
  readonly code: string;
  readonly message: string;
}

export interface BindingDispatchHooks {
  switchConditionalRegion?(regionSlot: number, branchIndex: number): Result<void, BindingDispatchError>;
}

/**
 * 把一个编译后的 binding opcode 分发到 host adapter 或运行时 hook。
 *
 * @description
 * 这是 binding flush 的总入口。它负责从 blueprint 中解码 slot，
 * 再把副作用路由到具体宿主 API 或 region 生命周期 hook。
 *
 * @param instance 持有 binding 表的 block 实例。
 * @param adapter 用于落具体宿主副作用的 host adapter。
 * @param bindingSlot 当前要刷新的 binding 槽位。
 * @param hooks 供 region 类 opcode 使用的运行时 hook。
 * @returns binding 成功执行并清除 dirty 标记时返回成功。
 */
export function dispatchBinding(
  instance: BlockInstance,
  adapter: HostAdapter,
  bindingSlot: number,
  hooks: BindingDispatchHooks = {}
): Result<void, BindingDispatchError> {
  const opcode = instance.blueprint.bindingOpcode[bindingSlot];

  if (opcode === undefined) {
    return err({
      code: "BINDING_SLOT_MISSING",
      message: `Binding slot ${bindingSlot} is missing from the blueprint.`
    });
  }

  // dispatch 层只负责把 blueprint 编码翻译成宿主调用；
  // 真实的 region 生命周期动作必须经由 hook 注入，避免这里直接耦合挂载实现。
  switch (opcode) {
    case BindingOpcode.TEXT:
      return dispatchTextBinding(instance, adapter, bindingSlot);
    case BindingOpcode.PROP:
      return dispatchPropBinding(instance, adapter, bindingSlot);
    case BindingOpcode.STYLE:
      return dispatchStyleBinding(instance, adapter, bindingSlot);
    case BindingOpcode.EVENT:
      return dispatchEventBinding(instance, adapter, bindingSlot);
    case BindingOpcode.REGION_SWITCH:
      return dispatchRegionSwitchBinding(instance, bindingSlot, hooks);
    default:
      return err({
        code: "UNSUPPORTED_BINDING_OPCODE",
        message: `Binding opcode ${opcode} is not supported yet.`
      });
  }
}

/**
 * 把 prop binding 应用到具体宿主节点上。
 *
 * @param instance 持有 binding 数据的 block 实例。
 * @param adapter 用于设置 prop 的 host adapter。
 * @param bindingSlot 当前要分发的 binding 槽位。
 * @returns prop 更新成功时返回成功。
 */
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

/**
 * 把 style binding 应用到具体宿主节点上。
 *
 * @param instance 持有 binding 数据的 block 实例。
 * @param adapter 用于设置样式项的 host adapter。
 * @param bindingSlot 当前要分发的 binding 槽位。
 * @returns style 更新成功时返回成功。
 */
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

/**
 * 把 event binding 应用到具体宿主节点上。
 *
 * @param instance 持有 binding 数据的 block 实例。
 * @param adapter 用于注册事件处理器的 host adapter。
 * @param bindingSlot 当前要分发的 binding 槽位。
 * @returns 事件处理器更新成功时返回成功。
 */
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

/**
 * 把 text binding 应用到具体宿主节点上。
 *
 * @param instance 持有 binding 数据的 block 实例。
 * @param adapter 用于设置文本内容的 host adapter。
 * @param bindingSlot 当前要分发的 binding 槽位。
 * @returns 文本更新成功时返回成功。
 */
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

/**
 * 把条件 region 切换 binding 解析成一次运行时 hook 调用。
 *
 * @param instance 持有 binding 数据的 block 实例。
 * @param bindingSlot 当前要分发的 binding 槽位。
 * @param hooks 能执行 region 切换的运行时 hook。
 * @returns 目标分支切换成功时返回成功。
 */
function dispatchRegionSwitchBinding(
  instance: BlockInstance,
  bindingSlot: number,
  hooks: BindingDispatchHooks
): Result<void, BindingDispatchError> {
  const dataIndex = instance.blueprint.bindingDataIndex[bindingSlot];
  if (dataIndex === undefined) {
    return err({
      code: "REGION_SWITCH_DATA_MISSING",
      message: `Region switch binding ${bindingSlot} is missing parameter metadata.`
    });
  }

  const signalSlot = instance.blueprint.bindingArgU32[dataIndex];
  const regionSlot = instance.blueprint.bindingArgU32[dataIndex + 1];
  const truthyBranch = instance.blueprint.bindingArgU32[dataIndex + 2];
  const falsyBranch = instance.blueprint.bindingArgU32[dataIndex + 3];

  if (signalSlot === undefined || signalSlot >= instance.signalValues.length) {
    return err({
      code: "REGION_SWITCH_SIGNAL_MISSING",
      message: `Region switch binding ${bindingSlot} references missing signal slot ${signalSlot}.`
    });
  }

  if (regionSlot === undefined) {
    return err({
      code: "REGION_SWITCH_REGION_MISSING",
      message: `Region switch binding ${bindingSlot} is missing its region slot.`
    });
  }

  if (truthyBranch === undefined || falsyBranch === undefined) {
    return err({
      code: "REGION_SWITCH_BRANCH_MISSING",
      message: `Region switch binding ${bindingSlot} is missing branch metadata.`
    });
  }

  if (!hooks.switchConditionalRegion) {
    return err({
      code: "REGION_SWITCH_UNSUPPORTED",
      message: `Region switch binding ${bindingSlot} requires a conditional-region switch hook.`
    });
  }

  const targetBranch = instance.signalValues[signalSlot] ? truthyBranch : falsyBranch;
  const switchResult = hooks.switchConditionalRegion(regionSlot, targetBranch);
  if (!switchResult.ok) {
    return switchResult;
  }

  return clearBindingDirty(instance, bindingSlot);
}

/**
 * 在 binding 成功分发后清除对应的 dirty 标记。
 *
 * @param instance 持有 dirty bitset 的 block 实例。
 * @param bindingSlot 要清除的 binding 槽位。
 * @returns dirty 位清除成功时返回成功。
 */
function clearBindingDirty(
  instance: BlockInstance,
  bindingSlot: number
): Result<void, BindingDispatchError> {
  const dirtyBitset = createDirtyBitsetView(instance.blueprint.bindingCount, instance.dirtyBindingBits);

  // dirty 位只能在宿主侧更新成功后清除，否则 flush 失败时会丢失下一轮重试机会。
  const clearResult = clearDirty(dirtyBitset, bindingSlot);

  if (!clearResult.ok) {
    return err(clearResult.error);
  }

  return ok(undefined);
}

/**
 * 把任意运行时值规范化为宿主可接收的文本内容。
 *
 * @param value text binding 产出的运行时值。
 * @returns 发送给 host adapter 的字符串表示。
 */
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

/**
 * 判断一个字符串是否属于支持的宿主事件 key。
 *
 * @param value 候选事件 key。
 * @returns 该值是否为已知的宿主事件 key。
 */
function isHostEventKey(value: string): value is typeof HOST_EVENT_KEYS[number] {
  return HOST_EVENT_KEYS.includes(value as typeof HOST_EVENT_KEYS[number]);
}

/**
 * 判断一个未知值能否作为宿主事件处理器使用。
 *
 * @param value 候选处理器值。
 * @returns 该值是否可调用。
 */
function isHostEventHandler(value: unknown): value is HostEventHandler {
  return typeof value === "function";
}
