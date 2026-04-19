# jue

`jue` 是一个实验性的前端框架。它现在采用这套共识：

1. 协调器（coordinator）和渲染器（renderer）严格分层
2. 依赖追踪完全显式，不做运行时依赖收集
3. 运行时热路径按 slot、索引表和最小补丁设计
4. 数据布局优先考虑 V8 的稳定 shape 和顺序访问

它的目标不是“再做一个组件重渲染框架”。它要做的是一个编译驱动、表驱动、索引驱动的前端运行时。作者侧可以继续写 TSX，但状态变化时，运行时不重跑组件，不重建通用树，也不做广义 diff。

## 当前状态

仓库目前还在文档先行阶段。

现在先锁这几件事：

- 架构边界
- 显式依赖模型
- IR 结构
- 编译输出契约
- V8 友好的运行时约束
- 里程碑顺序

## 文档索引

- [架构设计](./docs/architecture.md)
- [运行时模型](./docs/runtime-model.md)
- [编译策略](./docs/compiler-strategy.md)
- [IR 规范](./docs/ir-spec.md)
- [API 草案](./docs/api-draft.md)
- [宿主适配规范](./docs/host-adapter-spec.md)
- [代码规范](./docs/code-style-spec.md)
- [工程与工具链规范](./docs/engineering-toolchain-spec.md)
- [Scheduler 规范](./docs/scheduler-spec.md)
- [Region 状态机](./docs/region-state-machine.md)
- [场景适配](./docs/scenario-coverage.md)
- [路线图](./docs/roadmap.md)

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
