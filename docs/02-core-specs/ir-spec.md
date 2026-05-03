# IR 规范

## 目标

这份文档定义 `jue` 的中间表示。目标很直接：

- 让编译器输出稳定
- 让运行时热路径只依赖索引表
- 让数据布局对 V8 友好

IR 不服务于“表达力最大化”。IR 服务于“更新路径最短、结构最稳、运行时最好优化”。

## 总体原则

1. 运行时只消费显式表，不做依赖推理。
2. 热路径优先整数索引，不优先对象引用。
3. Blueprint 只读，Instance 可变。
4. 热数据优先 SoA。

## 分层说明

当前 IR 规范分成两层：

1. 声明式 `BlockIR`
2. 运行时 `Blueprint`

其中：

- `BlockIR` 是编译期 / 构建期语义层
- `Blueprint` 是 lowering 后的 runtime 输入

也就是说，`Blueprint` 不再承担“唯一中间表示”的职责。

当前推荐主链是：

`author input / builder / fixture -> BlockIR -> lowering -> Blueprint`

这样做的目的：

- 让编译器、builder、fixture 共享同一份语义结构
- 让优化 pass 在 typed array 生成前完成
- 让 runtime 继续只看最紧凑的布局

## BlockIR

`BlockIR` 是声明式中间表示。

它追求的是：

- 可读
- 可分析
- 可重写
- 易于做 lowering

它不追求直接作为 runtime 热路径格式。

最小 `BlockIR` 建议至少包含：

```ts
interface BlockIR {
  signalCount: number
  nodes: IRNode[]
  bindings: IRBinding[]
}
```

### `IRNode`

建议最小形态：

```ts
type IRNode =
  | {
      id: number
      kind: "element"
      type: HostPrimitive
      parent: number | null
    }
  | {
      id: number
      kind: "text"
      value: string
      parent: number | null
    }
```

说明：

- `id` 是语义层稳定标识，不一定等于最终 node slot
- `parent` 表示结构关系
- `text` 节点只承载静态文本时，直接保存 `value`
- 动态文本不体现在 `IRNode.value`，而体现在 binding

### `IRBinding`

建议最小形态：

```ts
type IRBinding =
  | {
      kind: "text"
      node: number
      signal: number
    }
  | {
      kind: "prop"
      node: number
      key: string
      signal: number
    }
  | {
      kind: "style"
      node: number
      key: string
      signal: number
    }
  | {
      kind: "event"
      node: number
      event: HostEventKey
      handler: unknown
    }
```

说明：

- `node` 引用语义层 node id
- `signal` 是显式 signal slot
- `event.handler` 在第一阶段允许直接保存 ref
- 未来 region / channel / resource 可以继续扩展

### `BlockIR` 的责任边界

`BlockIR` 负责：

- 节点结构
- 静态节点类型
- binding 语义
- signal 依赖边

`BlockIR` 不负责：

- typed array 布局
- 参数区压缩细节
- runtime 热路径字段顺序

这些责任全部属于 lowering。

## 标量编码约定

为了让数组布局稳定，先固定这些基础约定：

- `Uint8Array`：小范围枚举值
- `Uint16Array`：中等规模计数和短偏移
- `Uint32Array`：slot、索引、偏移、长度
- `Int32Array`：可带负值的运行时状态

保留值：

- `0xffffffff`：无效索引
- `-1`：无效运行时状态

建议枚举都从 `0` 开始顺排，不保留稀疏编码。

## Blueprint

`Blueprint` 是 lowering 的输出，也是 runtime 的直接输入。

它应该是只读的、扁平的、可顺序访问的。

建议字段：

```ts
class Blueprint {
  staticHtml: string
  nodeCount: number
  bindingCount: number
  regionCount: number
  channelCount: number
  resourceCount: number

  bindingOpcode: Uint8Array
  bindingNodeIndex: Uint32Array
  bindingDataIndex: Uint32Array

  signalToBindingStart: Uint32Array
  signalToBindingCount: Uint32Array
  signalToBindings: Uint32Array

  regionType: Uint8Array
  regionAnchorStart: Uint32Array
  regionAnchorEnd: Uint32Array

  channelSubscriberStart: Uint32Array
  channelSubscriberCount: Uint32Array
  channelSubscribers: Uint32Array

  resourceLane: Uint8Array
  resourceVersionSlot: Uint32Array
}
```

说明：

- `bindingOpcode` 定义每个 binding 的类型
- `bindingNodeIndex` 指向 binding 操作的 node slot
- `bindingDataIndex` 指向 binding 参数区
- `signalToBindings` 是核心依赖表
- `channelSubscribers` 是跨边界通信表
- `resourceLane` 和 `resourceVersionSlot` 用于异步提交控制

在当前分层里，`Blueprint` 明确不承担以下职责：

- 不承担作者输入友好性
- 不承担语义层调试友好性
- 不承担优化 pass 的主要工作面

这些都应该留在 `BlockIR`。

## BlockInstance

`BlockInstance` 是挂载后的运行时实例。字段要固定，构造时一次性写全。

建议字段：

```ts
class BlockInstance {
  blueprint: Blueprint
  nodes: Node[]
  signalValues: unknown[]
  regionState: Int32Array
  resourceState: Int32Array
  dirtyBits: Uint32Array
  mounted: boolean

  parent: BlockInstance | null
  firstChild: BlockInstance | null
  nextSibling: BlockInstance | null
}
```

注意：

- 不要在运行时新增字段
- 不要 `delete`
- debug 字段不要塞进热对象

建议把 `BlockInstance` 再分成冷热两层：

- 热字段：
  - `blueprint`
  - `nodes`
  - `signalValues`
  - `regionState`
  - `resourceState`
  - `dirtyBits`
- 冷字段：
  - `debugName`
  - `sourceMap`
  - `devCounters`

不要让调试信息污染热路径对象 shape。

## SignalState 布局

signal 的依赖边已经在 `Blueprint` 里固定，所以运行时 signal 状态只需要保存值和少量元信息。

建议布局：

```ts
signalValues: unknown[]
signalVersion: Uint32Array
signalFlags: Uint8Array
```

说明：

- `signalValues[slot]`：当前值
- `signalVersion[slot]`：当前版本号
- `signalFlags[slot]`：如只读、脏标记、开发期标记

signal 不需要再挂一份 subscribers 对象图。

## Signal Slot

每个 signal 在 block 作用域内都有稳定 slot。

signal 运行时至少要有：

- 当前值
- 对应的 binding 范围

依赖关系不挂在 signal 对象上动态维护，而是通过 `signalToBindings` 间接表达。

## Binding

binding 是最小更新单元。

每个 binding 有这些最小信息：

- `opcode`
- `nodeIndex`
- `dataIndex`
- 依赖它的 signal 范围

常见 opcode：

- `TEXT`
- `ATTR`
- `PROP`
- `STYLE`
- `CLASS_TOGGLE`
- `EVENT`
- `REGION_SWITCH`
- `KEYED_LIST`
- `CHANNEL_DISPATCH`
- `RESOURCE_COMMIT`

在当前阶段，binding 的推荐工作流是：

1. `IRBinding` 表达语义
2. lowering 分配 binding slot
3. lowering 生成 `bindingOpcode / bindingNodeIndex / bindingDataIndex / 参数区`

这样 binding 语义和 runtime 布局就不会耦在一起。

## Region

region 是结构性动态边界。

region 至少需要描述：

- `type`
- `anchorStart`
- `anchorEnd`
- 当前激活状态

推荐的 region 类型：

- `CONDITIONAL`
- `KEYED_LIST`
- `NESTED_BLOCK`
- `VIRTUAL_LIST`

region 的意义是把动态结构限制在局部，不让整棵树进入可变状态。

## RegionState 布局

Region 的静态边界在 `Blueprint`，运行时状态在 `BlockInstance`。

建议 `RegionState` 继续走 SoA：

```ts
regionLifecycle: Uint8Array
regionActiveState: Int32Array
regionLocalDirty: Uint32Array
regionChildStart: Uint32Array
regionChildCount: Uint32Array
```

含义：

- `regionLifecycle[slot]`
  - 对应 `UNINITIALIZED / INACTIVE / ACTIVE / UPDATING / DISPOSING / DISPOSED`
- `regionActiveState[slot]`
  - 类型相关运行时状态
  - 例如条件分支当前 branch、列表当前模式、虚拟列表当前窗口状态
- `regionLocalDirty[slot]`
  - 局部 dirty bit
- `regionChildStart[slot]`
  - 关联子实例或子项范围起点
- `regionChildCount[slot]`
  - 关联子实例或子项数量

### `CONDITIONAL` 扩展布局

```ts
regionBranchActive: Int32Array
regionBranchTarget: Int32Array
regionBranchCount: Uint16Array
```

### `KEYED_LIST` 扩展布局

```ts
regionListItemCount: Uint32Array
regionListWorkStart: Uint32Array
regionListWorkCount: Uint32Array
```

### `NESTED_BLOCK` 扩展布局

```ts
regionNestedBlockSlot: Uint32Array
regionNestedBlueprintSlot: Uint32Array
regionNestedMountMode: Uint8Array
```

### `VIRTUAL_LIST` 扩展布局

```ts
regionWindowStart: Uint32Array
regionWindowEnd: Uint32Array
regionOverscanStart: Uint32Array
regionOverscanEnd: Uint32Array
regionPoolStart: Uint32Array
regionPoolCount: Uint32Array
regionVisibleCount: Uint32Array
regionItemToCellStart: Uint32Array
regionItemToCellCount: Uint32Array
```

原则：

- 通用字段所有 Region 都有
- 扩展字段按类型使用
- 未使用字段保留默认值，不做对象分支

### Virtual List Region 扩展

`VIRTUAL_LIST` 额外需要：

- 可见窗口边界
- overscan
- 复用池起始位
- item slot 到 cell slot 的映射范围

这些运行时状态不一定都放进 `Blueprint`，但 slot 边界必须由 `Blueprint` 固定。

## Channel

channel 用于跨 Region、跨 Instance 的显式通信。

核心结构：

```ts
channelSubscriberStart: Uint32Array
channelSubscriberCount: Uint32Array
channelSubscribers: Uint32Array
```

用法和 `signalToBindings` 类似：

- 对于 channel slot `c`
- 根据起始位和数量找到订阅者
- 命中目标 binding、region 或 instance 局部入口

## ChannelMessage 布局

channel 运行时消息建议走环形缓冲区，不走对象队列。

建议结构：

```ts
channelMessageSlot: Uint32Array
channelMessageLane: Uint8Array
channelMessageType: Uint8Array
channelMessagePayloadStart: Uint32Array
channelMessagePayloadCount: Uint16Array
channelMessageVersion: Uint32Array
```

配套数据区：

```ts
channelPayloadU32: Uint32Array
channelPayloadF64: Float64Array
channelPayloadRef: unknown[]
```

规则：

- 小 payload 优先编码成标量区
- 复杂 payload 才落到 `channelPayloadRef`
- message 本体不要在热路径里创建临时对象

## Async Resource

异步资源不是普通 signal。

它至少要有：

- `resourceSlot`
- `lane`
- `versionSlot`

提交规则：

- 发起请求时递增版本
- 返回时比对版本
- 只有版本匹配的结果才能进入 commit

## ResourceState 布局

建议把资源状态拆成定长数组：

```ts
resourceStatus: Uint8Array
resourceLaneState: Uint8Array
resourceVersion: Uint32Array
resourcePendingCount: Uint16Array
resourceValueRef: unknown[]
resourceErrorRef: unknown[]
```

状态建议：

- `IDLE`
- `PENDING`
- `READY`
- `ERROR`

说明：

- `resourceStatus[slot]`：当前资源状态
- `resourceLaneState[slot]`：当前提交 lane
- `resourceVersion[slot]`：最新有效版本
- `resourcePendingCount[slot]`：挂起中的请求数
- `resourceValueRef[slot]`：最近一次有效结果
- `resourceErrorRef[slot]`：最近一次有效错误

## 依赖表

核心结构是：

```ts
signalToBindingStart: Uint32Array
signalToBindingCount: Uint32Array
signalToBindings: Uint32Array
```

用法：

- 对于 signal slot `s`
- 从 `signalToBindingStart[s]` 取起始偏移
- 从 `signalToBindingCount[s]` 取数量
- 到 `signalToBindings` 里顺序取出 binding slot

这样一次 `setSignal(s)` 就能直接定位受影响的 binding。

## Dirty 标记

建议用 bitset 或定长数组表示 dirty 状态。

目标：

- 标记便宜
- flush 顺序扫描便宜
- 批量去重便宜

不要把 dirty 状态挂成一堆动态对象。

建议拆成三组：

```ts
dirtyBindingBits: Uint32Array
dirtyRegionBits: Uint32Array
dirtyResourceBits: Uint32Array
```

规则：

- 一个 bit 对应一个 slot
- 同一批次内重复置位不重复入队
- 清理发生在 `finalize`

## SchedulerState 布局

scheduler 本身也需要固定布局。

建议字段：

```ts
class SchedulerState {
  batchId: number
  scheduledLanes: number
  flushingLanes: number

  dirtyBindingQueueStart: Uint32Array
  dirtyBindingQueueCount: Uint32Array

  dirtyRegionQueueStart: Uint32Array
  dirtyRegionQueueCount: Uint32Array

  channelQueueStart: Uint32Array
  channelQueueCount: Uint32Array

  resourceQueueStart: Uint32Array
  resourceQueueCount: Uint32Array
}
```

配合扁平数据区：

```ts
bindingQueueData: Uint32Array
regionQueueData: Uint32Array
channelQueueData: Uint32Array
resourceQueueData: Uint32Array
```

说明：

- 每条 lane 只保存起点和数量
- 真实数据区顺序存 slot
- 这样 flush 时可以按 lane 顺序线性扫描

## Dispatcher

binding 更新建议走统一 dispatcher。

例如：

```ts
switch (opcode) {
  case TEXT:
  case ATTR:
  case PROP:
}
```

或者固定 handler 表：

```ts
handlers[opcode](instance, bindingIndex)
```

不要为每个 binding 生成独立闭包。

建议把 dispatcher 输入固定成：

```ts
dispatchBinding(
  instance: BlockInstance,
  bindingSlot: number,
  lane: number
)
```

Region、channel、resource 也采用类似形式，避免调用点变成 megamorphic。

## Blueprint 参数区布局

为了避免 `bindingDataIndex` 指向一堆异构对象，建议再补一层参数区：

```ts
bindingArgU32: Uint32Array
bindingArgF64: Float64Array
bindingArgRef: unknown[]
```

规则：

- 能编码成标量的参数，优先进入 `U32 / F64`
- 只有真的无法标量化时，才进入 `Ref`
- `bindingDataIndex` 指向参数区起点，而不是对象引用

这些规则属于 lowering 阶段，而不是 `BlockIR` 阶段。

也就是说：

- `BlockIR` 只表达“这个 binding 依赖哪个 signal、操作哪个 key”
- lowering 再决定这些 key / signal / handler 具体如何落到参数区

## 存储分层建议

最终建议把运行时数据分成四层：

1. `Blueprint`
   - 编译产物，只读
2. `Instance Hot State`
   - `nodes / signalValues / regionState / dirtyBits`
3. `Scheduler State`
   - lane 队列和批次状态
4. `Cold Ref State`
   - debug、复杂 payload、开发期辅助信息

这样可以把最热的数据压在最稳定的布局里。

## V8 约束

这几条是硬要求：

1. 热对象字段固定
2. 热路径少用 `Map`、`Set`
3. 数组元素类型尽量稳定
4. 先用整数索引，再考虑字符串 key
5. Blueprint 扁平化
6. 冷数据与热数据分离
7. 跨边界通信也走索引表，不走通用事件对象图

## 最小例子

源码：

```tsx
<View class={active.get() ? "on" : "off"}>
  <Text>{count.get()}</Text>
</View>
```

目标结构：

- `active -> signal slot 0`
- `count -> signal slot 1`
- `class binding -> binding slot 0`
- `text binding -> binding slot 1`
- `signalToBindings[0] = [0]`
- `signalToBindings[1] = [1]`

运行时行为：

- `setSignal(1)` 只命中文本 binding
- `setSignal(0)` 只命中 class binding

这就是 IR 设计的基本目标。

## 推荐实现顺序

当前推荐顺序：

1. 先固定 `BlockIR`
2. 再实现 `lowerBlockIRToBlueprint()`
3. 让 builder / fixture / example 先迁移到 `BlockIR`
4. 再让编译器前端产出 `BlockIR`

这样可以先验证：

- `BlockIR` 是否足够表达当前 runtime 能力
- lowering 是否稳定
- runtime 是否真的只依赖 `Blueprint`
