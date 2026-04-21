# jue

`jue` 是一个实验性的前端框架。它现在采用这套共识：

1. 协调器（coordinator）和渲染器（renderer）严格分层
2. 依赖追踪完全显式，不做运行时依赖收集
3. 运行时热路径按 slot、索引表和最小补丁设计
4. 数据布局优先考虑 V8 的稳定 shape 和顺序访问

它的目标不是“再做一个组件重渲染框架”。它要做的是一个编译驱动、表驱动、索引驱动的前端运行时。作者侧可以继续写 TSX，但状态变化时，运行时不重跑组件，不重建通用树，也不做广义 diff。

## 当前状态

仓库已经不再是纯文档先行阶段。

当前更准确的状态是：

- `BlockIR -> lowering -> Blueprint -> runtime` 主链已经成立
- `CONDITIONAL / NESTED_BLOCK / KEYED_LIST / VIRTUAL_LIST` 四类 region 都已有最小可运行链路
- Babel frontend 的最小 TSX canary 已经接入 `@jue/compiler/frontend`
- `examples/web-playground` 里已经有从 `.component.tsx` 编译到 `.generated.ts` 再挂载的真实例子

当前主线不是“先把文档写完”，而是：

- 稳定 runtime / IR / region 边界
- 继续收口 compiler frontend 的边界和输入面
- 修齐 lint、文档和工程入口的一致性

建议阅读顺序：

1. 先读文档总索引和当前现状
2. 再读 architecture / roadmap
3. 再读 runtime / compiler / IR 等核心规范

## 文档索引

- [文档总索引](./docs/README.md)
- [当前现状](./docs/01-overview/current-status.md)
- [架构设计](./docs/01-overview/architecture.md)
- [路线图](./docs/01-overview/roadmap.md)
- [运行时模型](./docs/02-core-specs/runtime-model.md)
- [编译策略](./docs/02-core-specs/compiler-strategy.md)
- [IR 规范](./docs/02-core-specs/ir-spec.md)
- [API 草案](./docs/02-core-specs/api-draft.md)
- [宿主适配规范](./docs/02-core-specs/host-adapter-spec.md)
- [Scheduler 规范](./docs/02-core-specs/scheduler-spec.md)
- [Region 状态机](./docs/02-core-specs/region-state-machine.md)
- [场景适配](./docs/02-core-specs/scenario-coverage.md)
- [代码规范](./docs/03-engineering/code-style-spec.md)
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

先做最小垂直链路：

- 一个 signal slot
- 一个 text binding slot
- 一张 `signalToBindings` 表
- 一次 `setSignal`
- 一次 dirty queue flush
- 一次 DOM `setText`

如果这条链路还需要动态依赖收集、对象图遍历或通用 diff，说明设计没有收敛到位。
