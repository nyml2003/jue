# 宿主适配规范

## 目标

这份文档定义 `jue` 的宿主适配层。

要解决五件事：

1. core/runtime 和 host adapter 的边界
2. 宿主无关原语如何映射到具体宿主
3. 事件、样式、布局由谁负责
4. 容器句柄和节点句柄怎么定义
5. 哪些能力必须留在 core，哪些能力只能放在 adapter

这份规范的目标不是把所有宿主拉平，而是让不同宿主都在同一套边界里工作。

## 基本原则

1. 主规范先定义宿主无关语义，再定义宿主映射。
2. adapter 只负责“怎么落到宿主”，不负责状态推理。
3. coordinator 不直接接触宿主 API。
4. renderer 不知道 signal、channel、resource 的语义。
5. 宿主差异可以存在，但必须收敛到统一 contract。

## 分层边界

### core / runtime 负责

- signal、memo、resource、channel
- slot graph
- binding dispatch
- region 生命周期
- scheduler
- dirty 管理
- host op 调用顺序

### host adapter 负责

- 宿主节点创建
- 宿主节点插入与移除
- 宿主属性映射
- 宿主事件桥接
- 宿主样式和布局桥接
- 宿主容器挂载

### 明确禁止

core / runtime 不能做：

- 直接调用 DOM API
- 直接调用 native view API
- 判断某个宿主事件应该怎么翻译

host adapter 不能做：

- 依赖追踪
- dirty 判定
- lane 决策
- resource 版本控制

## 宿主适配包

建议按宿主拆包：

- `jue/web`
- `jue/native`
- `jue/canvas`
- `jue/terminal`

但要注意：不是所有宿主都应该被建模成“命令式节点 adapter”。

像微信小程序这类模板驱动宿主，更合理的落点通常是：

- `jue/miniprogram`
- 或 `jue/skyline`

它们默认应被视为 target / backend，而不是直接复用当前 `HostAdapter` contract 的同类宿主。

规范层 `jue` 只定义：

- 宿主无关原语
- host adapter contract 类型

各适配包只做映射，不改主语义。

如果某个宿主主要依赖模板生成、数据同步和事件桥接，而不是运行时节点创建与插拔，那么：

1. 仍然要复用同一套宿主无关原语
2. 但不要求必须强行落进 `createNode / insert / remove` 这一类节点 contract
3. 更推荐新增官方 target 包，在编译后端完成模板、样式、事件和更新路径生成

这里要再强调一次：

- `HostAdapter` 是节点宿主 contract
- 模板宿主应该走 target/backend contract

不要把两者硬拼成一个“万能 Renderer”接口。

## 宿主节点模型

宿主适配层至少要定义两类句柄：

- `HostRoot`
- `HostNode`

### `HostRoot`

表示挂载根。

它是宿主容器的统一抽象：

- Web：DOM 容器元素
- Native：原生根容器句柄
- Canvas：渲染上下文或舞台根
- Terminal：终端输出缓冲根

### `HostNode`

表示宿主节点句柄。

它不要求跨宿主结构相同，但对 runtime 来说必须是可存储的稳定引用。

## Host Adapter Contract

这一节定义的是“节点宿主 contract”，不是所有宿主后端的统一超集。

建议最小 contract：

```ts
interface HostAdapter {
  createNode(type: HostNodeType, propsIndex: number): Result<HostNode, HostAdapterError>
  createText(value: string): Result<HostNode, HostAdapterError>
  insert(parent: HostNode | HostRoot, node: HostNode, anchor: HostNode | null): Result<void, HostAdapterError>
  remove(parent: HostNode | HostRoot, node: HostNode): Result<void, HostAdapterError>

  setText(node: HostNode, value: string): Result<void, HostAdapterError>
  setProp(node: HostNode, prop: HostPropKey, value: unknown): Result<void, HostAdapterError>
  setStyle(node: HostNode, styleKey: HostStyleKey, value: unknown): Result<void, HostAdapterError>
  setEvent(node: HostNode, eventKey: HostEventKey, handler: HostEventHandler | null): Result<void, HostAdapterError>

  beginBatch?(): Result<void, HostAdapterError>
  endBatch?(): Result<void, HostAdapterError>
}
```

说明：

- `createNode` 用宿主原语类型创建节点
- `setProp`、`setStyle`、`setEvent` 由 adapter 自己翻译成宿主行为
- `beginBatch` / `endBatch` 是可选优化钩子，不是核心调度入口
- 可预期失败统一返回 `Result`，不用 `throw` 做常规控制流

硬规则：

1. 不要把 `setDataPath()` 这类模板宿主专用更新入口塞进这里
2. 不要为了兼容小程序，把节点宿主 contract 退化成最小公分母
3. 小程序、Skyline 这类模板宿主应走独立 target artifact + target glue 路线

## Template Target Contract

对于模板宿主，更合理的边界不是 `HostAdapter`，而是 target/backend contract。

它要回答的是：

- 模板结构如何生成
- 动态路径如何编号
- 事件如何桥回 authoring handler
- batched patch 如何提交到宿主

也就是说，模板宿主更像消费下面这些东西：

- template tree
- data path plan
- methods bridge
- target patch queue

而不是消费：

- `createNode`
- `insert`
- `remove`

## 宿主原语映射

主规范原语：

- `View`
- `Text`
- `Button`
- `Input`
- `Image`
- `ScrollView`

adapter 必须为这些原语提供明确映射。

### Web 建议映射

- `View -> div`
- `Text -> span` 或纯文本节点包装
- `Button -> button`
- `Input -> input` / `textarea`
- `Image -> img`
- `ScrollView -> div` + overflow 策略

### Native 建议映射

- `View -> native view`
- `Text -> native text`
- `Button -> pressable + text` 或宿主按钮控件
- `Input -> native text input`
- `Image -> native image view`
- `ScrollView -> native scroll view`

### Canvas 建议映射

Canvas 不是 DOM 树，adapter 可以映射到绘制节点或场景节点：

- `View -> group`
- `Text -> text draw node`
- `Image -> sprite`
- `ScrollView -> clipped group + scroll offset`

重点不在“长得一样”，而在“语义一致”。

### 模板宿主建议映射

有些宿主不是“运行时节点树优先”，而是“模板 + 数据更新优先”。

微信小程序就是典型例子。

这类宿主建议这样处理：

- `View / Text / Button / Input / Image / ScrollView` 仍保持同一套主语义原语
- 结构和静态样式优先在编译期生成模板产物
- 动态内容优先编译成最小更新路径
- 事件优先桥接回宿主 methods / handlers

也就是说：

- 原语语义继续共享
- 但后端形态不一定是节点 adapter
- runtime-core 也不应该假设模板宿主一定存在 `HostNode[]`

## 属性映射规则

主 API 的 props 不是直接等于宿主 props。

adapter 必须做显式翻译。

### 通用规则

1. 主 API prop 名优先用宿主无关语义。
2. adapter 再把它翻译成宿主字段。
3. 不允许把宿主私有 prop 直接泄漏回主规范。

例如：

- `Button.onPress`
  - Web adapter -> `click`
  - Native adapter -> `press`

- `ScrollView.direction`
  - Web adapter -> overflow / flex 组合
  - Native adapter -> scroll orientation

## 事件适配规则

事件必须先归一化，再进入 runtime。

### 主规范事件名

建议优先使用宿主无关名字：

- `onPress`
- `onInput`
- `onFocus`
- `onBlur`
- `onScroll`

### adapter 责任

adapter 负责：

- 监听宿主真实事件
- 归一化事件对象
- 调用 runtime 提供的 handler

adapter 不负责：

- 决定 lane
- 决定是否需要更新
- 直接 patch 其他节点

### 事件对象

主规范事件对象建议最小化。

不要把宿主原生事件原样暴露成规范的一部分。

建议事件对象只保留：

- `type`
- `target`
- `currentTarget`
- `value?`
- `x?`
- `y?`
- `deltaX?`
- `deltaY?`
- `nativeEvent?`

其中 `nativeEvent` 只能作为 adapter 扩展字段，不应成为主逻辑依赖。

## 样式与布局边界

样式和布局是最容易把宿主差异反灌回主 API 的地方。

这里要强约束。

### 主规范负责

- 定义少量通用布局语义
- 定义少量通用视觉语义

例如：

- `direction`
- `align`
- `justify`
- `gap`
- `padding`
- `margin`
- `width`
- `height`

### adapter 负责

- 把这些语义翻译成宿主样式系统

例如：

- Web -> CSS
- Native -> style object
- Canvas -> draw/layout parameters

### 明确不做

- 不把 CSS 作为主规范样式语言
- 不把某个 native style object 作为主规范样式语言

## 文本规则

`Text` 是语义原语，不等价于某个宿主节点。

adapter 需要明确：

- 文本节点是否独立存在
- 文本是否必须包在容器里
- 文本样式如何继承

Web 和 Native 在这点上差异很大，所以必须由 adapter 自己处理，而不是由 core 假设。

## 挂载规则

`mount` 的主规范只接受 `HostRoot`。

adapter 负责：

- 校验 root 类型
- 准备根容器环境
- 提供根级宿主上下文

例如：

- Web adapter 负责确认 root 是有效 DOM 容器
- Native adapter 负责确认 root 是有效 native root handle

## Portal 规则

`Portal` 是结构原语，不是宿主特例。

但真正的目标切换必须由 adapter 支持。

adapter 至少要能回答：

- 目标 root / host node 是否可挂载
- 是否支持跨层级 overlay
- 是否需要额外容器管理

如果某个宿主不支持 `Portal`，adapter 必须显式声明，而不是静默退化。

## ScrollView 与 VirtualList 关系

`ScrollView` 是宿主原语。

`VirtualList` 是结构原语。

两者不能混成一个东西。

关系是：

- `ScrollView` 提供滚动宿主能力
- `VirtualList` 消费滚动信息，驱动窗口更新

adapter 负责：

- 提供滚动事件
- 提供滚动位置读取
- 提供必要的可见区域尺寸信息

runtime 负责：

- 根据这些信息计算窗口
- 决定哪些 cell 需要重绑定

## 适配器能力声明

每个 adapter 应该有一份能力声明。

建议字段：

```ts
interface HostCapabilities {
  supportsPortal: boolean
  supportsVirtualListReuse: boolean
  supportsTextNode: boolean
  supportsMeasuredLayout: boolean
  supportsSynchronousInput: boolean
}
```

作用：

- 让上层知道某个能力能不能依赖
- 避免把 Web 的便利能力默认视为所有宿主都有

## 适配器扩展面

允许 adapter 提供扩展，但要遵守两条规则：

1. 扩展只能挂在宿主包下，不回流主规范
2. 扩展不能破坏主原语语义

例如：

- `jue/web` 可以扩 `className`
- `jue/native` 可以扩 `elevation`

但这些都不能直接写进 `jue` 主入口。

## 调试与开发体验

adapter 应该提供最小调试信息：

- 节点类型
- 节点 id
- 宿主 root id

但调试信息属于冷路径。

不要为了调试方便，把大量宿主对象直接挂进热路径运行时结构。

## 实现顺序

建议 adapter 实现顺序：

1. `jue/web`
2. `jue/native`
3. 其他宿主

原因：

- Web 最容易验证原语和事件映射
- Native 最能暴露“主规范是否被 Web 绑死”
- 只有在这两者都成立后，其他宿主才有扩展意义

补充：

- 模板宿主不必等价于 `native`
- 如果要进入微信小程序，推荐单独走 `Skyline + glass-easel` target 路线
- 这条路线主要验证的是“主语义能否脱离 DOM 心智”，而不是“现有 adapter contract 能否硬套到所有宿主”

## 验证清单

每个 adapter 至少要验证：

1. `View / Text / Button / Input / Image / ScrollView` 都有明确映射
2. `onPress / onInput / onScroll` 等事件能归一化
3. `mount` 只接受合法 `HostRoot`
4. `Portal` 支持情况明确
5. `VirtualList` 所需的滚动和尺寸信息能提供
6. adapter 没有偷偷承担 scheduler 或依赖追踪职责
