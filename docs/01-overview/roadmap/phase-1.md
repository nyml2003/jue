# Phase 1：一方系统成形

`Phase 1` 已于 2026-04-25 完成。

这份文档保留为阶段定义和完成标准记录。

目标不是“再多做几个功能点”，而是把 `jue` 做成一个完整的一方开发系统。

## 核心目标

1. Kernel 边界稳定
2. Authoring 输入面稳定
3. Web host 作为第一个完整宿主稳定
4. 必要 tooling 形成闭环

## 包范围

- `@jue/shared`
- `@jue/reactivity`（可以先逻辑独立，后拆包）
- `@jue/runtime-core`
- `@jue/compiler-ir`（可以先作为 `@jue/compiler` 内部边界）
- `@jue/compiler-lowering`（可以先作为 `@jue/compiler` 内部边界）
- `@jue/web`
- `@jue/jsx-runtime`（可以先由 `@jue/jsx` 演进）
- `@jue/compiler-frontend`
- `@jue/builder`
- `@jue/inspect`
- `@jue/testkit`
- `@jue/bench`
- `@jue/examples`

## 当前最重要的工作

### 1. Kernel 收口

- 继续稳 `BlockIR`
- 继续稳 lowering 的确定性输出
- 继续稳 `Blueprint` 布局
- 继续稳 scheduler / lane / dirty / resource / channel 语义
- 明确哪些能力属于 `runtime-core`，哪些应该从中拆成 `reactivity` 或 contract

### 2. Authoring 收口

- 明确 `@jue/compiler` 与 `@jue/compiler/frontend` 的公开边界
- 继续收口 frontend 错误模型
- 继续让 builder / fixture / example 共用同一 authoring 语义层
- 不再把“完整组件系统”当作近期目标

### 3. Web host 收口

- 继续加固 `KEYED_LIST`
- 继续加固 `VIRTUAL_LIST`
- 继续收口 disposal 与局部状态边界
- 继续让 example 成为真实 host 回归面，而不是演示页集合

### 4. Tooling 闭环

- 把 inspect 做成第一优先级工具
- 把 testkit 做成统一夹具层
- 把 bench 做成仓库内证据来源
- 把 examples 做成 compile / run / coverage 的标准回归入口

## 退出条件

只有同时满足下面这些条件，才算真正进入 Phase 2：

1. `BlockIR / lowering / Blueprint` 契约已经稳定到可以长期作为后端边界。
2. `runtime-core` 的 region / channel / resource / lane 模型已经清楚，不需要靠补丁式语义继续兜底。
3. Web host 已经足够稳定，能承担一方系统的首个完整宿主角色。
4. examples、testkit、inspect、bench 已经形成最小验证闭环。
5. frontend 仍然是受限输入面，但它已经足够稳定，不会持续反向污染后端契约。

## 当前状态

上述退出条件已经满足。

当前后续原则是：

- 不再把 `Phase 1` 当成待完成任务
- 也不要为了扩 authoring 或 stdlib，反向改坏已经稳定的基线
