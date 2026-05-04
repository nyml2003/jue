# jue

`jue` 是一个实验性的前端框架。

它的长期方向是：把作者侧输入收敛成宿主无关的 TSX authoring，把运行时收敛成编译驱动、表驱动、索引驱动的执行系统。状态变化时，运行时不重跑组件，不重建通用树，也不做广义 diff。

当前主线不是继续扩世界，而是先按新的支持标准收口现有能力：先修 compiler 主路径，再决定哪些能力真的能被标成支持。

核心入口：

- [长期目标](./docs/01-long-term-goal/01-goal.md)
- [当前现状](./docs/02-current-status/01-current-status.md)
- [实施计划](./docs/03-implementation-plan/01-implementation-plan.md)
- [文档总索引](./docs/README.md)
