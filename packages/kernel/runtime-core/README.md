# @jue/runtime-core

`jue` 框架的**运行时内核**。负责管理编译产物（Blueprint）的实例化、响应式信号、异步资源、调度刷新，以及跨平台的宿主抽象。

它**不依赖任何具体平台**（Web/Native/小程序），只通过 `HostAdapter` 接口与外部宿主交互。

## 职责

- **Blueprint 管理**：定义编译产物的紧凑内存布局（TypedArray），并提供构造与校验。
- **BlockInstance**：将 Blueprint 实例化为可运行的组件实例，管理节点、信号、区域、资源的全部运行时状态。
- **响应式信号**：基于 slot 的细粒度 signal 读写，变化时自动标记 dirty。
- **异步资源**：为数据请求（query、fetch 等）提供状态机（idle/pending/ready/error）。
- **调度系统**：按 Lane 优先级（SYNC_INPUT → VISIBLE_UPDATE → DEFERRED → BACKGROUND）批量刷新绑定。
- **宿主抽象**：通过 `HostAdapter` 接口将操作委托给具体平台（创建节点、插入、更新文本/属性/样式/事件）。

## 核心概念

### Blueprint

编译器输出的产物是一个纯数据对象，全部用 TypedArray 存储，零对象开销：

```ts
export interface Blueprint {
  readonly nodeCount: number;
  readonly bindingCount: number;
  readonly regionCount: number;
  readonly nodeKind: Uint8Array;              // 每个节点的类型
  readonly nodePrimitiveRefIndex: Uint32Array; // 元素节点引用的 primitive 索引
  readonly nodeParentIndex: Uint32Array;       // 父节点索引
  readonly bindingOpcode: Uint8Array;          // 绑定指令类型
  readonly bindingNodeIndex: Uint32Array;      // 绑定作用的节点索引
  readonly bindingDataIndex: Uint32Array;      // 绑定使用的数据索引
  readonly regionType: Uint8Array;             // 区域类型（条件/列表/嵌套/虚拟列表）
  readonly regionAnchorStart: Uint32Array;     // 区域锚点起始节点
  readonly regionAnchorEnd: Uint32Array;       // 区域锚点结束节点
  // ... 信号到绑定的映射表等
}
```

### HostAdapter

跨平台的关键接口。每个平台（Web、Native、小程序）需要提供自己的实现：

```ts
export interface HostAdapter {
  createNode(type: HostPrimitive, propsIndex: number): Result<HostNode, HostAdapterError>;
  createText(value: string): Result<HostNode, HostAdapterError>;
  insert(parent: HostNode | HostRoot, node: HostNode, anchor: HostNode | null): Result<void, HostAdapterError>;
  remove(parent: HostNode | HostRoot, node: HostNode): Result<void, HostAdapterError>;
  setText(node: HostNode, value: string): Result<void, HostAdapterError>;
  setProp(node: HostNode, prop: string, value: unknown): Result<void, HostAdapterError>;
  setStyle(node: HostNode, styleKey: string, value: unknown): Result<void, HostAdapterError>;
  setEvent(node: HostNode, eventKey: HostEventKey, handler: HostEventHandler | null): Result<void, HostAdapterError>;
}
```

### Signal

运行时状态的最小单元。每个 BlockInstance 拥有一组 signal slot，通过 `readSignal` / `writeSignal` 访问：

```ts
export interface SignalState {
  readonly values: unknown[];      // 当前值
  readonly version: Uint32Array;   // 每次写入递增，用于依赖追踪
  readonly flags: Uint8Array;      // 额外标记位
}
```

`writeSignal` 在值真正变化时会递增 version，并触发调度系统将相关 binding 加入刷新队列。

### Channel

跨组件通信通道，支持带 Lane 优先级的发布/订阅：

```ts
export interface Channel<T> {
  readonly name: string;
  version: number;
  readonly queue: ChannelMessage<T>[];
  readonly subscribers: Set<(message: ChannelMessage<T>) => void>;
}
```

### Lane 与调度

| Lane | 优先级 | 典型场景 |
|------|--------|----------|
| `SYNC_INPUT` | 最高 | 输入框同步响应 |
| `VISIBLE_UPDATE` | 高 | 可见区域 UI 更新 |
| `DEFERRED` | 中 | 非关键数据更新 |
| `BACKGROUND` | 低 | 日志、埋点、预加载 |

调度器将 binding 刷新任务按 Lane 分队列，批量执行，避免重复计算。

## 主要导出

- `createBlueprint` / `createEmptyBlueprint` —— 构造编译产物
- `createBlockInstance` —— 实例化组件
- `readSignal` / `writeSignal` / `createSignalState` —— 信号系统
- `createChannel` / `publishChannel` / `subscribeChannel` / `drainChannel` —— 通道通信
- `createResourceState` / `beginResourceRequest` / `commitResourceValue` / `commitResourceError` —— 异步资源
- `createSchedulerState` / `enqueueSchedulerSlot` / `beginSchedulerFlush` / `completeSchedulerFlush` —— 调度系统
- `dispatchBinding` / `flushBindingQueue` —— binding 分发与刷新
- `attachConditionalRegion` / `attachKeyedListRegion` / `beginConditionalRegionSwitch` / `completeKeyedListReconcile` 等 —— 动态区域生命周期管理

## 设计特点

- **零对象分配倾向**：核心数据结构全用 TypedArray，减少 GC 压力。
- **平台无关**：只认识 `HostAdapter`，不认识 DOM、UIKit 或小程序视图。
- **显式错误**：所有可能失败的操作都返回 `Result<T, E>`，不抛异常。
