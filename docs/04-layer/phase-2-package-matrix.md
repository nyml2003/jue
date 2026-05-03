# Support Matrix

Examples tracked: 5
Compiled fixtures: 5

状态口径：

- `Compiler support point`：当前 frontend/IR/lowering 主链上已经存在最小支持点
- `Runtime/host path`：runtime + web host 上已经存在最小执行路径
- `Support accepted`：只有通过“非调试、端到端、零业务 glue、走 authoring 主路径”的新验收线，才记为 `yes`

| Primitive | Compiler support point | Runtime/host path | Support accepted | Notes |
| --- | --- | --- | --- | --- |
| Show | yes | yes | no | 已有真实 conditional-region lowering 和 runtime 路径，但还没有通过新的 authoring 主路径验收线。 |
| List | yes | yes | no | 已有 keyed-list lowering 和最小 reconcile 路径，但在端到端 authoring 主路径过关前还不能记为支持。 |
| VirtualList | yes | yes | no | 已有 virtual-list lowering 和最小 window controller 路径，但仍卡在非调试、零 glue 的支持验收线上。 |
| Portal | no | no | no | 仍是保留原语，host/runtime 支持尚未激活。 |
| Boundary | no | no | no | 仍是保留原语，boundary runtime 尚未激活。 |

## Example Registry

- account-overview
- incident-brief
- keyed-list-lab
- release-checklist
- virtual-list-lab

## Fixture Summary

- account-overview: 45 bindings, 0 regions
- incident-brief: 33 bindings, 0 regions
- keyed-list-lab: 7 bindings, 1 regions
- release-checklist: 33 bindings, 0 regions
- virtual-list-lab: 9 bindings, 1 regions

## Core Spec Index

- api-draft.md
- compiler-strategy.md
- host-adapter-spec.md
- ir-spec.md
- region-state-machine.md
- runtime-model.md
- scenario-coverage.md
- scheduler-spec.md
