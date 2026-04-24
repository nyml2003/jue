# 包规划图

## 目标

这份文档把 `jue` 的“开发世界边界”进一步落到具体包。

不是只说：

- kernel
- official layers
- ecosystem

而是直接回答：

- 现在仓库里已经有哪些包
- 以后还应该补哪些一方包
- 哪些包必须先做
- 哪些包可以后做
- 哪些不应该被放进 `jue` 本体

## 总体原则

包规划遵守三条规则：

1. 先围绕 kernel 收口，不让上层策略抢主线。
2. 先补 `jue` 独有价值的包，不重写通用基础设施。
3. 每个包都必须能回答“它定义不变量，还是只提供策略和体验”。

## 当前已存在的包

当前仓库已经有这些工作区包：

| 包名 | 当前状态 | 所属层 | 说明 |
| --- | --- | --- | --- |
| `@jue/shared` | 已有 | Kernel | opcode、类型、Result、宿主常量等共享定义 |
| `@jue/runtime-core` | 已有 | Kernel | Blueprint、scheduler、binding dispatch、region/resource/signal state |
| `@jue/compiler` | 已有 | Kernel + Authoring | 根入口保留后端/builder；`./frontend` 暴露 TSX frontend |
| `@jue/jsx` | 已有 | Official Authoring Layer | JSX 输入面与宿主无关原语入口 |
| `@jue/web` | 已有 | Official Host Layer | Web host adapter 与挂载实现 |
| `@jue/examples` | 已有 | Official Tooling Layer | example registry、compile/build 统一入口 |
| `@jue/inspect` | 已有 | Official Tooling Layer | compiled module / blueprint summary 与 example inspection |
| `@jue/testkit` | 已有 | Official Tooling Layer | fixture source / compile helper / batch fixture compile |
| `@jue/bench` | 已有 | Official Tooling Layer | example compilation benchmark 与 root `pnpm bench` 入口 |
| `@jue/native` | 占位 | Official Host Layer | 先占边界，当前不是主线 |

## 开发世界的包层次

下面的包层次是建议的一方完整版图。

其中：

- `Phase 1` = 当前主线必须做
- `Phase 2` = kernel 站稳后应该补
- `Phase 3` = 世界补齐时再做

## 一、Kernel 包

这些包定义全系统不变量。

### `@jue/shared`

- 层级：Kernel
- 当前状态：已存在
- 职责：
  - `Result`
  - opcode / lane / host primitive / event key
  - 共享类型
  - 开发期断言
- 备注：
  - 继续保持薄，不要偷偷长出状态机逻辑

### `@jue/reactivity`

- 层级：Kernel
- 当前状态：已先以 `@jue/runtime-core/reactivity` 子路径明确边界，后续再决定是否独立包
- 阶段：Phase 1
- 职责：
  - signal state
  - memo
  - batch
  - disposal
- 禁止：
  - 隐式依赖收集
  - DOM/host 逻辑

### `@jue/runtime-core`

- 层级：Kernel
- 当前状态：已存在
- 阶段：Phase 1
- 职责：
  - `Blueprint`
  - `BlockInstance`
  - dirty bits
  - binding dispatch
  - scheduler / lane / flush
  - region state machine
  - channel queue
  - resource state
- 备注：
  - 继续保持“只消费 Blueprint，不反向理解 authoring 语义”

### `@jue/compiler-ir`

- 层级：Kernel
- 当前状态：已先以 `@jue/compiler/ir` 子路径明确边界，后续再决定是否独立包
- 阶段：Phase 1
- 职责：
  - `BlockIR`
  - IR node / binding / region / channel / resource 定义
- 备注：
  - 这是长期后端语义层，必须稳定

### `@jue/compiler-lowering`

- 层级：Kernel
- 当前状态：已先以 `@jue/compiler/lowering` 子路径明确边界，后续再决定是否独立包
- 阶段：Phase 1
- 职责：
  - `BlockIR -> Blueprint`
  - slot 分配
  - typed array 布局
  - `signalToBindings`
  - 参数区压平

### `@jue/host-contract`

- 层级：Kernel
- 当前状态：已先以 `@jue/runtime-core/host-contract` 子路径明确边界，不急着独立包
- 阶段：Phase 1
- 职责：
  - host adapter interface
  - mount / patch / event bridge contract
- 备注：
  - 这层必须稳定，但不一定需要马上拆包

## 二、Authoring 包

这些包属于 `jue`，但不定义 kernel 不变量。

### `@jue/jsx-runtime`

- 层级：Official Authoring Layer
- 当前状态：可由 `@jue/jsx` 演进或拆分
- 阶段：Phase 1
- 职责：
  - JSX runtime
  - authoring primitive 映射

### `@jue/compiler-frontend`

- 层级：Official Authoring Layer
- 当前状态：当前已经以 `@jue/compiler/frontend` 子路径存在，并已作为稳定公开边界使用
- 阶段：Phase 1
- 职责：
  - TSX / JSX parser
  - source -> BlockIR
  - 错误模型
  - support boundary 收口
- 备注：
  - 现在不一定要拆成独立包，但文档上应把它当独立能力边界

### `@jue/builder`

- 层级：Official Authoring Layer
- 当前状态：当前 builder 逻辑在 `@jue/compiler` 内，并已以 `@jue/compiler/builder` 子路径明确边界
- 阶段：Phase 1
- 职责：
  - 手写 builder
  - fixture DSL
  - 让 tests / examples / compiler 共用同一 authoring 语义层

### `@jue/primitives`

- 层级：Official Authoring Layer
- 当前状态：建议先逻辑定义，后决定是否独立包
- 阶段：Phase 2
- 职责：
  - `Show`
  - `List`
  - `VirtualList`
  - `Portal`
  - `Boundary`
- 备注：
  - 先保证这些原语在 frontend/IR/runtime 三端语义一致，再谈更复杂 authoring

### `@jue/authoring-check`

- 层级：Official Authoring Layer
- 当前状态：尚未系统存在
- 阶段：Phase 2
- 职责：
  - 静态诊断
  - unsupported pattern 报错
  - feature support matrix
- 备注：
  - 这是 compiler error model 外层的“作者体验层”

## 三、Host 包

### `@jue/web`

- 层级：Official Host Layer
- 当前状态：已存在
- 阶段：Phase 1
- 职责：
  - Web host primitives
  - DOM mount / patch / event bridge
  - keyed / virtual list controller

### `@jue/native`

- 层级：Official Host Layer
- 当前状态：占位
- 阶段：Phase 3
- 职责：
  - Native host 映射
- 备注：
  - 当前文档已明确原生渲染目标不在早期主线

### `@jue/web-html`

- 层级：Official Host Convenience Layer
- 当前状态：未开始
- 阶段：Phase 3
- 职责：
  - 纯 Web convenience layer
  - HTML tag 兼容入口
- 备注：
  - 它只能是便利层，不能反向定义主规范

## 四、Stdlib 包

这些包属于 `jue` 官方能力层，但不该进入 kernel。

### `@jue/stream`

- 层级：Official Standard Library
- 阶段：Phase 2
- 职责：
  - stream core
  - `toSignal`
  - `fromSignal`
  - `fromChannel`
  - `toChannel`
  - `toResource`
- 备注：
  - 它应该是 scheduler-aware stream，不是第二套隐式响应式系统

### `@jue/router`

- 层级：Official Standard Library
- 阶段：Phase 2
- 职责：
  - route state
  - history bridge
  - params / query model
  - route -> region / block 边界

### `@jue/query`

- 层级：Official Standard Library
- 阶段：Phase 2
- 职责：
  - resource helper
  - cache / invalidation
  - retry / preload / stale policy

### `@jue/form`

- 层级：Official Standard Library
- 阶段：Phase 3
- 职责：
  - field state
  - validation
  - submit lifecycle
  - dirty / touched / error model

### `@jue/animation`

- 层级：Official Standard Library
- 阶段：Phase 3
- 职责：
  - transition
  - motion scheduling
  - region enter/leave timing

### `@jue/gesture`

- 层级：Official Standard Library
- 阶段：Phase 3
- 职责：
  - pointer / drag / scroll gesture bridge

### `@jue/viewport`

- 层级：Official Standard Library
- 阶段：Phase 3
- 职责：
  - viewport observer
  - focus / visibility / resize / intersection helpers

## 五、Tooling 包

这些包不定义运行时语义，但会决定 `jue` 是否真的可开发。

### `@jue/inspect`

- 层级：Official Tooling Layer
- 当前状态：已存在
- 阶段：Phase 1
- 职责：
  - source -> BlockIR -> Blueprint 可视化
  - slot / typed array / region descriptor 检查

### `@jue/devtrace`

- 层级：Official Tooling Layer
- 阶段：Phase 2
- 职责：
  - signal write
  - lane
  - dirty
  - flush
  - region lifecycle trace

### `@jue/bench`

- 层级：Official Tooling Layer
- 当前状态：已存在
- 阶段：Phase 1
- 职责：
  - operation count
  - naive baseline compare
  - V8/profile artifact
  - list / virtual list / scheduler benchmark

### `@jue/testkit`

- 层级：Official Tooling Layer
- 当前状态：已存在
- 阶段：Phase 1
- 职责：
  - compiler fixture runner
  - runtime harness
  - host mock
  - region assertion helpers

### `@jue/examples`

- 层级：Official Tooling Layer
- 当前状态：已存在
- 阶段：Phase 1
- 职责：
  - example registry
  - compile-all
  - run-all
  - feature coverage map

### `@jue/docsgen`

- 层级：Official Tooling Layer
- 阶段：Phase 2
- 职责：
  - 从 specs / examples / fixtures 生成文档片段和支持矩阵

### `@jue/language-tools`

- 层级：Official Tooling Layer
- 阶段：Phase 3
- 职责：
  - diagnostics
  - editor integration
  - LSP / TS plugin

### `@jue/create`

- 层级：Official Tooling Layer
- 阶段：Phase 3
- 职责：
  - project scaffold
  - example / template bootstrap
- 备注：
  - 要等 authoring surface 稳住后再做

## 六、不属于 `jue` 本体的包

下面这些可以存在，但不应该算进 `jue` 本体：

- `@jue/app-framework`
- `@jue/ssr-framework`
- `@jue/design-system`
- `@jue/cms`
- `@jue/admin-shell`
- 第三方 UI kit
- 第三方 router convention
- 第三方 data client

这些属于 ecosystem，不该反向定义 kernel 或 official layers。

## 建设顺序

### Phase 1：一方世界成形

目标：

- 先把 `jue` 从“一个 runtime + compiler”做成“一个完整的一方系统”

建议顺序：

1. `@jue/shared`
2. `@jue/reactivity`（或先逻辑独立）
3. `@jue/runtime-core`
4. `@jue/compiler-ir`
5. `@jue/compiler-lowering`
6. `@jue/web`
7. `@jue/jsx-runtime`
8. `@jue/compiler-frontend`
9. `@jue/builder`
10. `@jue/inspect`
11. `@jue/testkit`
12. `@jue/bench`
13. `@jue/examples`

### Phase 2：官方能力层补齐

目标：

- 在不破坏 kernel 的前提下，把一方 stdlib 和验证工具补起来

建议顺序：

1. `@jue/primitives`
2. `@jue/authoring-check`
3. `@jue/stream`
4. `@jue/router`
5. `@jue/query`
6. `@jue/devtrace`
7. `@jue/docsgen`

### Phase 3：世界扩面

目标：

- 把 `jue` 的宿主与应用世界做大

建议顺序：

1. `@jue/form`
2. `@jue/animation`
3. `@jue/gesture`
4. `@jue/viewport`
5. `@jue/language-tools`
6. `@jue/create`
7. `@jue/native`
8. `@jue/web-html`

## 当前建议

`Phase 1` 已经完成。

现在更合理的目标不是继续补这一层，而是：

1. 保持 `shared / runtime-core / compiler / jsx / web` 的边界稳定
2. 把 `examples / inspect / testkit / bench` 当作长期验证基线维护
3. 进入 `Phase 2`，但不要为了上层体验反向改坏 Phase 1 contract

## 结论

如果要把 `jue` 自研做完，真正的版图不是：

- runtime
- compiler

而是：

- kernel
- authoring
- host
- stdlib
- tooling

其中前 3 层是本体地基，后 2 层决定这个世界能不能真正被人使用。
