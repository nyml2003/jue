# `@jue/runtime-core`

Kernel 运行时核心。负责 signal 管理、binding 调度、region 生命周期、channel 消息和 async resource 的提交控制。

设计原则：运行时只消费显式表，不做依赖推理。

## 内部文档

- [运行时模型](./docs/runtime-model.md) — 数据流、绑定模型、region 模型、调度模型
- [Scheduler 规范](./docs/scheduler-spec.md) — lane、队列、flush 阶段与去重规则
- [Region 状态机](./docs/region-state-machine.md) — `CONDITIONAL`、`KEYED_LIST`、`NESTED_BLOCK`、`VIRTUAL_LIST`

## 上层文档

- [API 草案](../../docs/10-specs/02-api-draft.md)
- [场景覆盖](../../docs/10-specs/09-scenario-coverage.md)
