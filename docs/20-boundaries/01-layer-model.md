# 开发世界边界

## 目标

这份文档不讨论某个单点 API。

它回答的是更大的问题：

`jue` 到底是什么。
`jue` 不是什么。
如果以后要继续往上做 authoring、tooling、router、stream、SSR 或应用框架，边界应该画在哪里。

如果这个边界不先画清楚，后面很容易出现两类错误：

- 把所有上层体验都塞进内核，导致主线失焦
- 把本来必须统一的不变量放到生态层，导致系统分叉

## 一句话定义

`jue` 是一个编译驱动、slot 驱动、显式调度的 UI 系统。

它的核心不是“组件开发体验总包”，而是：

- 显式依赖
- 显式结构边界
- 显式通信边界
- 显式异步提交边界

也就是说：

- `jue` 要统一不变量
- `jue` 不替所有上层生活方式做决定

## 三圈模型

整个 `jue` 开发世界分成三圈：

1. `Jue Kernel`
2. `Jue Official Layers`
3. `Jue Ecosystem`

其中：

- 只有前两圈属于 `jue`
- 第一圈才属于 `jue kernel`

## 一、Jue Kernel

这是最内核的一圈。

它的职责只有一个：

`定义全系统必须统一的不变量。`

### 包含什么

- `signal / memo / batch` 的最低层状态语义
- `BlockIR -> lowering -> Blueprint` 契约
- slot / opcode / parameter layout
- region 模型
- scheduler / lane / flush 规则
- `channel / resource` 的最低层语义
- mount / dispose / flush 生命周期
- host adapter contract

### 当前仓库里大致对应

- `packages/kernel/runtime-core`
- `packages/kernel/compiler`
- `packages/kernel/shared`
- `docs/10-specs/*`

### Kernel 必须回答的问题

- signal 写入后命中哪些 binding
- binding、region、channel、resource 怎么进入同一批次
- 哪些结构变化属于 region，哪些不允许发生
- 异步结果何时有效，何时丢弃
- runtime 和 host adapter 的边界在哪里
- compiler 和 runtime 的契约字段是什么

### Kernel 不该做什么

- router 策略
- query/cache 策略
- form 策略
- stream 操作符生态
- animation DSL
- 应用目录约定
- 业务脚手架
- SSR framework
- design system

原因很简单：

- 这些都存在多种合理策略
- 它们不该决定系统不变量
- 它们会明显快于 kernel 契约变化

### Kernel 的硬边界

1. 不做运行时依赖收集
2. 不做组件级重跑
3. 不做通用 subtree diff
4. 不允许全局 signal 充当消息总线
5. 不允许异步旁路 scheduler
6. 不允许 host adapter 反向决定主规范

## 二、Jue Official Layers

这是第二圈。

它们仍然属于 `jue`，但不属于 kernel。

它们的职责是：

`把 kernel 变成可写、可调、可落地的系统。`

### 2.1 Authoring Layer

职责：

- 给作者提供可用输入面
- 让输入面稳定落到 kernel 契约

包含：

- `jue/jsx`
- 结构原语：
  - `Show`
  - `List`
  - `VirtualList`
  - `Portal`
  - `Boundary`
- 以后可能存在的作者侧 DSL / builder convenience layer

边界：

- authoring layer 可以更好写
- 但不能反向改变 kernel 的 region / scheduler / slot 语义

### 2.2 Host Layer

职责：

- 把宿主无关原语映射到具体宿主

包含：

- `jue/web`
- 未来的 `jue/native`
- 未来的 `jue/canvas`
- 未来的 `jue/terminal`

边界：

- host layer 只负责映射和桥接
- 不负责 signal、dirty、lane、resource version

### 2.3 Standard Library

职责：

- 提供常见但不该进入 kernel 的策略层能力

适合放在这里的东西：

- `stream`
- router
- query / resource helper
- form model
- animation / transition
- gesture
- viewport / focus / history helper

这层的共同点是：

- 建立在 kernel 原语之上
- 对开发体验很重要
- 但存在明显策略空间

### 2.4 Tooling Layer

职责：

- 提供验证、调试、基准和文档同步能力

包含：

- inspect
- devtrace
- bench
- testkit
- docsgen
- diagnostics
- language tools
- example canary manager

它们不定义运行时语义，但会深刻影响整个开发世界是否可用。

## 三、Jue Ecosystem

这是第三圈。

它不属于 `jue` 本体，只是建立在 `jue` 上面的生态。

### 包含什么

- app framework
- SSR product framework
- routing convention framework
- data client
- design system
- CMS / admin shell
- 企业级工程模板
- 第三方 adapter
- 第三方 devtools / plugins

### 这层的特点

- 更强业务相关
- 更强宿主相关
- 更强团队偏好相关
- 允许多种合理风格共存

### 为什么它不属于 `jue`

因为这层回答的是：

- 你的产品怎么组织
- 你的团队怎么写应用
- 你的部署模型是什么

这些都不应该反向定义 kernel 和 official layers。

## 各圈之间的关系

### Kernel -> Official Layers

Kernel 提供：

- 不变量
- 契约
- 最低层原语

Official Layers 提供：

- authoring
- host bridge
- strategy library
- tooling

### Official Layers -> Ecosystem

Official Layers 提供：

- 稳定基础
- 官方推荐写法
- 可验证接口

Ecosystem 在其之上做：

- 应用框架
- 产品模式
- 团队约定

### 禁止的反向依赖

1. ecosystem 不能反向定义 kernel 契约
2. host layer 不能反向定义主规范
3. stdlib 不能偷偷变成第二个 kernel
4. tooling 不能成为运行时语义的唯一来源

## 判断规则

以后新增任何能力，都先问下面 5 个问题。

### 1. 它是不是全系统不变量

如果是：

- 进 kernel

例如：

- lane 顺序
- resource version 语义
- region lifecycle

### 2. 它是不是建立在 kernel 之上的官方能力层

如果是：

- 进 official layers

例如：

- JSX authoring
- web adapter
- stream bridge
- inspect

### 3. 它是不是存在多种合理策略

如果是：

- 不进 kernel

例如：

- router
- query cache
- animation API
- form API

### 4. 它是不是强宿主相关

如果是：

- 优先进 host layer
- 而不是 kernel

例如：

- browser history
- DOM selection
- native navigation

### 5. 它是不是强业务或团队约定

如果是：

- 进 ecosystem

例如：

- app shell
- file-based routing convention
- 页面目录结构
- design system

## 对当前主线的影响

这套边界判断直接服务当前主线：

- kernel 收口纪律继续保留
- authoring layer 先做最小必要收口
- official stdlib 先围绕 authoring 主路径接入推进
- ecosystem 继续留在主线之外

### 当前优先做的

1. 稳定 `BlockIR / lowering / Blueprint`
2. 稳定 region / scheduler / channel / resource 边界
3. 做仓库内 benchmark 和 runtime 证据
4. 收口最小 frontend authoring 边界
5. 建立必要的 inspect / test / bench 工具

### 当前不该抢主线的

- 完整 stream 生态
- router 体系
- SSR / hydration framework
- full app framework

## 一个更短的判断版本

如果以后只想记一句：

`Kernel 定不变量，Official Layers 做可用性，Ecosystem 做生活方式。`

再短一点就是：

`jue 统一语义，不统一所有上层策略。`

## 边界清单

### 属于 `jue kernel`

- signal / memo / batch 基础语义
- IR / lowering / Blueprint 契约
- scheduler / lane / flush
- region
- channel / resource 最低层
- host contract

### 属于 `jue` 但不属于 kernel

- JSX authoring
- web/native host layer
- stdlib
- inspect / bench / testkit / diagnostics

### 不属于 `jue`

- app framework
- business conventions
- 团队模板
- 产品脚手架
- design system
- 第三方生态策略包

## 结论

`jue` 不是“前端世界总包”。

它应该是：

- 一个明确内核
- 一组官方能力层
- 一个允许多样化上层生态的底座

如果这条边界保持清楚，那么后面无论你做：

- stream
- router
- query
- SSR
- app framework

都不会再反过来把 kernel 搅混。
