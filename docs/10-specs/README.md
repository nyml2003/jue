# Specs Index

实现规范已按主题下沉到各子包。这里只保留跨包全景文档和索引。

## 跨包全景规范（保留在 docs/）

| 文档 | 说明 |
|------|------|
| [Authoring Grammar 规范](./01-authoring-grammar-spec.md) | canonical grammar、current guaranteed subset、future sugar |
| [API 草案](./02-api-draft.md) | 作者侧 API 三层结构、核心协调层、结构原语层、宿主原语层 |
| [场景覆盖](./09-scenario-coverage.md) | 长列表、跨边界通信、异步更新的设计约束 |

## 已下沉到子包的实现规范

### Compiler

- `packages/kernel/compiler/docs/compiler-strategy.md` — 编译策略与三层主链
- `packages/kernel/compiler/docs/ir-spec.md` — IR 规范与数据布局

### Runtime

- `packages/kernel/runtime-core/docs/runtime-model.md` — 运行时模型与数据流
- `packages/kernel/runtime-core/docs/scheduler-spec.md` — 调度器规范
- `packages/kernel/runtime-core/docs/region-state-machine.md` — Region 状态机

### Host Adapter

- `packages/host/web/docs/host-adapter-spec.md` — Web 宿主适配规范
- `packages/host/native/docs/host-adapter-spec.md` — Native 宿主适配规范

### Host Target

- `packages/host-target/skyline/docs/miniprogram-target-strategy.md` — 小程序 Target 策略
