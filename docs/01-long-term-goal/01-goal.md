# 长期目标

## 目标

`jue` 的目标不是“再做一个组件重渲染框架”。

它要做的是一个编译驱动、表驱动、索引驱动的前端运行时。作者侧可以继续写 TSX，但状态变化时，运行时不重跑组件，不重建通用树，也不做广义 diff。

## 核心主张

传统组件级重渲染流水线会支付三类大开销：

- 重跑组件或计算子树
- 在运行时推断依赖
- 在更新后再对较大结构做 diff

`jue` 的长期方向是直接绕开这三步：

- 编译期把动态位置降成 binding
- 编译期或构建期把 signal 到 binding 的依赖边写成表
- 运行时只根据 signal slot 命中 binding slot
- flush 阶段只执行具体 host patch

## 长期约束

这套方向长期不变：

1. 协调器（coordinator）和渲染器（renderer）严格分层
2. 依赖追踪完全显式，不做运行时依赖收集
3. 运行时热路径按 slot、索引表和最小补丁设计
4. 数据布局优先考虑 V8 的稳定 shape 和顺序访问

## 明确拒绝的路线

- 运行时 `activeEffect` 风格依赖收集
- vnode 作为默认运行时结构
- 组件级全量重跑
- 广义 subtree diff
- 为了兼容动态语法而退回通用解释执行

## 当前不处理

- SSR 与 hydration
- resumability
- 跨平台渲染器
- React 兼容层
- 插件生态

## 成功判据

一次状态写入应当收敛到这条路径：

`setSignal(slot) -> read signalToBindings -> mark dirty -> flush binding slots -> host patch`

如果这条路径里出现了运行时依赖收集、组件重跑或通用 diff，说明架构已经偏离目标。

## 接着读什么

- [架构设计](./02-architecture.md)
- [当前现状](../02-current-status/01-current-status.md)
- [实施计划](../03-implementation-plan/01-implementation-plan.md)
