# jue

`jue` 是一个实验性的前端框架。它现在采用这套共识：

1. 协调器（coordinator）和渲染器（renderer）严格分层
2. 依赖追踪完全显式，不做运行时依赖收集
3. 运行时热路径按 slot、索引表和最小补丁设计
4. 数据布局优先考虑 V8 的稳定 shape 和顺序访问

它的目标不是“再做一个组件重渲染框架”。它要做的是一个编译驱动、表驱动、索引驱动的前端运行时。作者侧可以继续写 TSX，但状态变化时，运行时不重跑组件，不重建通用树，也不做广义 diff。

## 当前状态

`Phase 2` 正在重做验收。

当前更准确的状态是：

- `BlockIR -> lowering -> Blueprint -> runtime` 主链已经稳定
- `@jue/compiler/frontend`、`@jue/compiler/ir`、`@jue/compiler/lowering`、`@jue/compiler/builder` 已形成明确边界
- `@jue/runtime-core/reactivity`、`@jue/runtime-core/host-contract`、`@jue/runtime-core/channel` 已形成明确边界
- `examples/web-playground/apps/*` 已是从 `.component.tsx -> generated/page.generated.ts -> mount` 的真实回归面
- `@jue/examples`、`@jue/inspect`、`@jue/testkit`、`@jue/bench` 已形成第一版 tooling 闭环
- `@jue/primitives`、`@jue/authoring-check`、`@jue/stream`、`@jue/router`、`@jue/query`、`@jue/devtrace`、`@jue/docsgen` 已落成第一版包面
- 但这些能力还没有全部通过新的“非调试、端到端、完备用例”验收线

当前主线不是“进入 Phase 3”，而是：

- 先按新的支持标准重做 `Phase 2` 验收
- 先修 compiler 主路径，再决定哪些能力真的能被标成支持

建议阅读顺序：

1. 先读文档总索引和当前现状
2. 再读 architecture / roadmap
3. 再读 runtime / compiler / IR 等核心规范

## 文档索引

- [文档总索引](./docs/README.md)
- [当前现状](./docs/01-overview/current-status.md)
- [架构设计](./docs/01-overview/architecture.md)
- [路线图](./docs/01-overview/roadmap/README.md)
- [开发世界边界](./docs/04-layer/layer-model.md)
- [包规划图](./docs/04-layer/package-map.md)
- [运行时模型](./docs/02-core-specs/runtime-model.md)
- [编译策略](./docs/02-core-specs/compiler-strategy.md)
- [IR 规范](./docs/02-core-specs/ir-spec.md)
- [API 草案](./docs/02-core-specs/api-draft.md)
- [宿主适配规范](./docs/02-core-specs/host-adapter-spec.md)
- [Scheduler 规范](./docs/02-core-specs/scheduler-spec.md)
- [Region 状态机](./docs/02-core-specs/region-state-machine.md)
- [场景适配](./docs/02-core-specs/scenario-coverage.md)
- [代码规范](./docs/03-engineering/code-style-spec.md)
- [风格 DNA](./docs/03-engineering/style-dna.md)
- [工程与工具链规范](./docs/03-engineering/engineering-toolchain-spec.md)

## 核心主张

传统组件级重渲染流水线会支付三类大开销：

- 重跑组件或计算子树
- 在运行时推断依赖
- 在更新后再对较大结构做 diff

`jue` 直接绕开这三步：

- 编译期把动态位置降成 binding
- 编译期或构建期把 signal 到 binding 的依赖边写成表
- 运行时只根据 signal slot 命中 binding slot
- flush 阶段只执行具体 host patch

## 现在明确拒绝的路线

- 运行时 `activeEffect` 风格依赖收集
- vnode 作为默认运行时结构
- 组件级全量重跑
- 广义 subtree diff
- 为了兼容动态语法而退回通用解释执行

## v0 暂不处理

- SSR 与 hydration
- resumability
- 跨平台渲染器
- React 兼容层
- 插件生态

## 直接下一步

下一步不是直接进入 `Phase 3`，而是继续完成 `Phase 2`：

- 把 `Show` 变成真正零胶水的 authoring 能力
- 把 `stream / router / query` 变成真正可跨端的 TSX 主路径能力
- 给这些能力补非调试、端到端、完备用例

前提是不要回头打穿已经稳定的 kernel / host / tooling / stdlib contract。
