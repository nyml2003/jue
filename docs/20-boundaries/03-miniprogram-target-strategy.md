# 小程序 Target 策略

## 目标

这份文档定义 `jue` 面向微信小程序的支持策略。

这里要回答的不是：

- 小程序能不能算另一个 `native`
- 现有 `HostAdapter` 能不能硬接小程序

而是：

- 小程序在 `jue` 世界里应该落在哪一层
- 哪些能力应该复用现有 kernel / compiler
- 哪些能力必须按小程序宿主单独实现
- 为什么推荐 `Skyline + glass-easel` 作为默认基础

## 结论先行

`jue` 对微信小程序的支持，默认不走“命令式节点 adapter”路线。

推荐路线是：

1. 继续复用 `TSX -> BlockIR -> Blueprint / update plan` 主链
2. 新增 `@jue/miniprogram` 或 `@jue/skyline` 作为官方 host target 包
3. 把 authoring 产物编译成：
   - `WXML`
   - `WXSS`
   - 页面 / 组件 `JS / JSON`
   - batched `setData` flush glue
4. 运行时尽量只保留 signal runtime、handler bridge、最小 patch 合并逻辑
5. 宿主渲染、列表、样式、组件树能力优先消费 `Skyline + glass-easel`

当前代码已经验证了一条更具体的边界：

- `@jue/skyline` 当前首先是 **Node 侧 compile-time target package**
- 小程序运行时真正消费的是生成出来的 `miniprogram/` 工程壳和页面产物
- 不是在小程序运行时里直接加载 compiler/frontend

这里的关键词不是“给统一 Renderer 多加一个方法”，而是：

- 编译后端分流
- target artifact 独立生成
- target glue 独立消费

一句话说：

- Web / Native / Canvas 更像“节点宿主”
- 小程序更像“模板宿主”

所以小程序默认是 target / backend，不是当前 `HostAdapter` 的直接同类。

## 为什么不是直接补 HostAdapter

当前 `HostAdapter` contract 假设宿主能提供：

- `createNode`
- `createText`
- `insert`
- `remove`
- `setProp`
- `setStyle`
- `setEvent`

这类 contract 适合：

- DOM
- 原生 view tree
- canvas scene graph

但微信小程序的主路径不是“把一棵宿主节点树交给运行时逐步插拔”，而是：

- 先定义模板
- 再通过数据驱动视图更新
- 事件回调回到逻辑层

也就是说：

- 小程序当然有宿主组件树
- 但 `jue` 不该把它当成一个可自由命令式 patch 的 DOM-like 表面去依赖

如果强行把现有 `HostAdapter` contract 直接套进去，会带来三个问题：

1. 把小程序宿主误建模成“命令式节点系统”
2. 为了贴合现有 runtime，反向扭曲小程序 target 的编译产物
3. 让 `setData` / 模板结构 / 事件桥接这些真正关键的优化点失焦

## 推荐基础：Skyline + glass-easel

默认推荐：

- 渲染基础：`Skyline`
- 组件基础：`glass-easel`

原因：

1. 这套基础已经提供更接近宿主内部优化路径的渲染能力
2. 长列表、滚动、基础组件、样式编译等高成本能力应该优先交给宿主
3. `jue` 的独特价值不在“重复造渲染器”，而在“更聪明地生成模板和更新计划”

因此小程序路线的优先级应该是：

1. 更小的 `setData` patch
2. 更稳定的模板结构
3. 更少的胶水代码
4. 更清晰的 signal -> binding -> data path

而不是：

1. 重做一套宿主渲染树
2. 在逻辑层模拟 DOM patch
3. 在运行时解释大量结构变化

## 包定位

推荐新增官方 host target 包：

- `@jue/miniprogram`
  - 面向微信小程序的通用 target
- 或 `@jue/skyline`
  - 明确以 `Skyline + glass-easel` 为默认宿主前提

第一版更推荐后者，如果后续真要兼容非 Skyline 小程序，再讨论是否额外抽出更通用的 `@jue/miniprogram`。

### 这个包应该负责

- source / compiled module 到 `WXML` 结构的生成
- host primitive 到小程序标签与组件的映射
- signal slot / binding slot 到 `setData` path 的生成
- 事件 handler 名称与组件 methods 的桥接
- `Show / List` 等结构原语到小程序结构语法的 lowering
- Skyline 下滚动 / 列表 / 容器约束的 target 级策略

### 这个包不应该负责

- 改写 kernel 语义
- 反向把小程序私有约束写进 `@jue/jsx` 主语义
- 新造一套与宿主重复的长列表 / 动画 / 组件树系统
- 让 runtime-core 直接依赖小程序 API
- 让小程序运行时直接依赖 Babel / compiler frontend / Node-only 包

## 复用与重写边界

### 可以直接复用

- `@jue/compiler/frontend`
- `BlockIR`
- lowering 前的 authoring 结构语义
- signal / binding 依赖分析
- handler 提取逻辑
- authoring-check 的支持矩阵体系

### 需要重写或新增

- `Blueprint` 到小程序模板 / data path 的后端生成
- 页面 / 组件壳代码生成
- batched `setData` runtime glue
- 小程序事件对象归一化
- 宿主原语映射表
- Skyline 能力声明与限制声明

其中 `batched setData runtime glue` 的意思也应该收口成：

- 它是模板宿主 target glue
- 它不是通用 runtime-core 接口的一部分
- 它不应该要求 Web / Native 共享同一个更新 contract

### 不应该直接搬过去

- `@jue/web` 的 `mountTree`
- 基于 `HostNode[]` 的直接挂载路径
- DOM `insertBefore / appendChild / removeChild`
- Web adapter 上的样式与事件实现

## 支持策略

### Step 1：最小可跑 target

第一步只支持：

- `View`
- `Text`
- `Button`
- `Input`
- `Image`
- `ScrollView`
- `Show`
- 基础 `List`

能力要求：

- 单页面可编译
- 事件能回到 methods
- 多个 signal 更新能合并成一次 flush
- 条件显示优先编译成结构语法，不在运行时模拟节点切换

## 当前实现状态

当前仓库已经落下去的，不再只是策略：

### 已落地

- `packages/host-target/skyline`
- `compileSkylineBlockIR(block)`
- `compileSkylineSource(source, { rootSymbol })`
- 最小 `template / templateCode / signalData / bindings / conditionals / keyedLists` artifact
- `packages/examples/jue-mobile-showcase`
  - 浏览器侧 compiled module
  - 小程序侧 generated scaffold
  - `project.config.json`
  - `miniprogram/app.js / app.json`
  - `pages/showcase/index.js / .wxml / .wxss / .json`

### 还没落地

- 事件 bridge
- target-side `setData` runtime glue
- `VirtualList` target 支持
- 完整多页面、小程序路由、query、stream 主路径

### 当前最重要的边界

现在必须明确：

- `@jue/skyline` 是编译期包
- 小程序侧吃的是生成产物
- `packages/examples/jue-mobile-showcase/miniprogram` 里的文件是 generated artifact，不是 authoring source

### Step 2：数据与路由主路径

第二步再推进：

- `@jue/router`
- `@jue/query`
- `@jue/stream`
- 页面级组合与代码拆分

原则：

- 先走 authoring 主路径
- 不接受业务 glue 证明“能力已支持”

### Step 3：宿主特化能力

第三步再考虑：

- VirtualList 与 Skyline 列表能力的官方集成
- 手势 / 动画 / viewport 能力
- 更复杂组件树与 Portal 类边界

## 长列表策略

长列表默认优先复用宿主能力。

原则是：

1. 优先使用 Skyline 提供的列表优化能力
2. `jue` 负责把结构和更新计划编译到适合宿主消费的形式
3. 不在第一版自造完整 virtual list runtime

只有当宿主能力无法覆盖，并且 `jue` 真的需要额外抽象时，才考虑补特化控制层。

## Native 的关系

小程序 target 不等于 `@jue/native`。

两者会共享：

- authoring 层
- IR / dependency graph
- 编译约束
- 宿主能力声明思路

但两者默认不是同一种后端：

- 小程序更接近模板宿主
- Native 更接近节点宿主

因此：

- 做完小程序 target，会帮助我们校验跨宿主边界
- 但不会自动产出一个真正的 native renderer

## 验证标准

小程序 target 至少要验证：

1. `.component.tsx -> generated target -> miniprogram app` 主链可跑通
2. signal 更新能合并成最小 `setData` patch
3. `Show` 与 `List` 走 target 级 lowering，而不是业务 glue
4. 事件能归一化回 authoring handler
5. target 没有要求 kernel 反向依赖小程序 API
6. Skyline 宿主特化能力与限制有明确文档，不做隐式假设

## 结论

`jue` 对微信小程序的正确支持姿势不是：

- 给现有 Web-like runtime 再补一个 adapter

而是：

- 在现有 compiler / IR / signal graph 之上
- 新增一个以 `Skyline + glass-easel` 为默认宿主的官方 target

这样既能保住 `jue` 的编译驱动价值，也不会把主规范重新绑回 DOM 心智。
