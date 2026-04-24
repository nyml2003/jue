# 当前现状

更新时间：2026-04-25

这份文档只记录当前仓库已经成立的事实，用来同步代码、文档和后续路线。

## 总结

`jue` 的 `Phase 1` 基线已经闭环。

现在的仓库不再只是：

- 一个 runtime
- 一个 compiler

而是已经形成了第一版一方系统基线：

- kernel 主链稳定
- authoring 输入面稳定
- Web host 成为首个完整宿主
- examples / inspect / testkit / bench 形成最小验证闭环

## 当前已经成立的能力

### 1. Kernel 主链

- `BlockIR -> lowering -> Blueprint -> runtime` 主链已经成立
- `@jue/compiler/ir`、`@jue/compiler/lowering`、`@jue/compiler/builder` 已作为明确子边界存在
- `@jue/runtime-core/reactivity`、`@jue/runtime-core/host-contract` 已作为明确子边界存在
- `runtime-core` 的 region / resource / lane / dirty / flush 语义已经有真实测试覆盖

### 2. Authoring 边界

- `@jue/compiler` 根入口保留后端与 builder 能力
- `compile()` 已迁移到 `@jue/compiler/frontend`
- frontend 仍然是受限输入面，但已支持当前 Phase 1 所需的最小 TSX authoring：
  - 单根 JSX Element
  - 静态 element / text
  - `{identifier}` 文本绑定
  - 简单 prop 绑定
  - 直接命名函数 event handler
  - `cond ? <A /> : <B />`
  - `List` / `VirtualList` 的最小 authoring 形状
- `compileModule()` 已可把 `.component.tsx` 编译成可执行模块

### 3. Web Host 与 Examples

- `CONDITIONAL`、`NESTED_BLOCK`、`KEYED_LIST`、`VIRTUAL_LIST` 都已有真实链路
- `examples/web-playground/apps/*` 已成为真实回归面，而不是演示页集合
- `scripts/compile-example-components.ts` 现在通过 `@jue/examples` 统一发现 app 并生成 `generated/page.generated.ts`
- `pnpm build` 已把 package build 和 example build 放进同一条验证链路

### 4. Tooling 闭环

当前仓库已经有这些第一方 tooling surface：

- `@jue/examples`
  - example registry
  - app 路径约定
  - compile / build 脚本统一入口
- `@jue/inspect`
  - compiled module / blueprint summary
  - example inspection
- `@jue/testkit`
  - example fixture source loading
  - fixture compile helper
  - batch fixture compile
- `@jue/bench`
  - example compilation benchmark
  - root `pnpm bench` 入口

## 当前 workspace 包

当前工作区里已有这些包：

- `@jue/shared`
- `@jue/runtime-core`
- `@jue/compiler`
- `@jue/jsx`
- `@jue/web`
- `@jue/native`（占位）
- `@jue/examples`
- `@jue/inspect`
- `@jue/testkit`
- `@jue/bench`

## 最新验证结果

2026-04-25 本地执行结果：

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：通过，`23` 个测试文件、`173` 个测试全部通过
- `pnpm build`：通过
- `pnpm test:e2e -- --grep virtual-list-lab`：通过
- `pnpm bench`：通过，并输出 example compilation 基准表

这意味着当前仓库已经满足 `Phase 1` 文档里的退出条件：

1. `BlockIR / lowering / Blueprint` 契约已可长期作为后端边界。
2. `runtime-core` 的 region / channel / resource / lane 模型已形成可验证基线。
3. Web host 已能承担一方系统的首个完整宿主角色。
4. examples / testkit / inspect / bench 已形成最小验证闭环。
5. frontend 仍是受限输入面，但不会继续反向污染后端契约。

## 下一步

主线已经不再是“补齐 Phase 1”。

现在的主线应该切到 `Phase 2`，但要遵守一个前提：

- 不轻易打穿已经形成的 kernel / authoring / host / tooling 基线

更具体地说，接下来应该优先推进：

- `@jue/primitives`
- `@jue/authoring-check`
- `@jue/stream`
- `@jue/router`
- `@jue/query`

而不是回头重新改写 Phase 1 的基础契约。
