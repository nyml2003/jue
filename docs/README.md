# docs

当前文档按三层结构组织：

- `01-overview`
  - 讲项目是什么、现在在哪个阶段、接下来往哪里走
- `02-core-specs`
  - 讲 runtime / compiler / IR / host / scheduler 的核心契约
- `03-engineering`
  - 讲代码规范和工程工具链

建议阅读顺序：

1. `01-overview/current-status.md`
2. `01-overview/architecture.md`
3. `01-overview/roadmap.md`
4. `02-core-specs/*`
5. `03-engineering/*`

## 01 Overview

- [架构设计](./01-overview/architecture.md)
- [路线图](./01-overview/roadmap.md)
- [当前现状](./01-overview/current-status.md)

## 02 Core Specs

- [运行时模型](./02-core-specs/runtime-model.md)
- [编译策略](./02-core-specs/compiler-strategy.md)
- [IR 规范](./02-core-specs/ir-spec.md)
- [API 草案](./02-core-specs/api-draft.md)
- [宿主适配规范](./02-core-specs/host-adapter-spec.md)
- [Scheduler 规范](./02-core-specs/scheduler-spec.md)
- [Region 状态机](./02-core-specs/region-state-machine.md)
- [场景适配](./02-core-specs/scenario-coverage.md)

## 03 Engineering

- [代码规范](./03-engineering/code-style-spec.md)
- [工程与工具链规范](./03-engineering/engineering-toolchain-spec.md)
