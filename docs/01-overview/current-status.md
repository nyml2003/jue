# 当前现状

更新时间：2026-04-25

这份文档只记录当前仓库已经成立的事实，用来同步代码、文档和后续路线。

## 总结

`jue` 的 `Phase 2` 还没有通过新的支持验收线。

当前仓库已经不只是：

- 一个 kernel
- 一组 Phase 1 tooling

而是已经进入“Phase 2 包面已落地，但支持尚未全部坐实”的状态：

- `@jue/primitives / @jue/authoring-check / @jue/stream / @jue/router / @jue/query / @jue/devtrace / @jue/docsgen` 已落成第一版包面
- 但只有通过“非调试、端到端、完备用例”的能力，才允许标成支持

## 当前已经成立的能力

### 1. Kernel 与 Phase 1 基线仍然稳定

- `BlockIR -> lowering -> Blueprint -> runtime` 主链仍然稳定
- `@jue/compiler/ir`、`@jue/compiler/lowering`、`@jue/compiler/builder` 仍作为明确子边界存在
- `@jue/runtime-core/reactivity`、`@jue/runtime-core/host-contract` 仍作为明确子边界存在
- 新增 `@jue/runtime-core/channel` 作为显式消息通道最小能力面

### 2. Authoring 层已经进入 Phase 2 施工期

- `@jue/primitives` 已存在，并给出官方结构原语支持矩阵
- `@jue/jsx` 已通过 `@jue/primitives` 暴露 `Show / List / VirtualList / Portal / Boundary`
- compiler/frontend 当前已经落地这些 support point：
  - `Show`
  - `List`
  - `VirtualList`
- 但这不等于这些能力已经被正式支持。
- `Portal / Boundary` 已被正式保留为原语边界，但当前仍明确处于未实现状态
- `@jue/authoring-check` 已能：
  - 收集 source 里引用到的结构原语
  - 输出支持矩阵
  - 把 compile 结果转成作者侧诊断

### 3. 第一批官方 stdlib 包已存在

- `@jue/stream`
  - `createStream`
  - `fromSignal`
  - `fromChannel`
  - `toSignal`
  - `toChannel`
  - `toResource`
  - `map / filter / scan / distinctUntilChanged / merge / takeUntil`
- `@jue/router`
  - `createHistoryBridge`
  - `createRouter`
  - route state / query / param match
- `@jue/query`
  - `createQueryClient`
  - `createQuery`
  - `query`
  - cache entry / stale / invalidate / preload / reload

### 4. Phase 2 Tooling 已存在

- `@jue/devtrace`
  - signal / channel / resource / navigation / docsgen trace event
  - collector / formatter
- `@jue/docsgen`
  - Phase 2 package matrix
  - example registry snippet
  - CLI 入口
- 根命令已增加：
  - `pnpm docs:phase2`

### 5. 现有 examples 与 tooling 继续作为回归基线

- `@jue/examples` 仍承担 example registry
- `@jue/inspect`、`@jue/testkit`、`@jue/bench` 仍是 Phase 1 的验证基线
- `examples/web-playground/apps/*` 继续承担真实回归面

## 当前 workspace 包

当前工作区里已有这些包：

- `@jue/shared`
- `@jue/runtime-core`
- `@jue/compiler`
- `@jue/jsx`
- `@jue/primitives`
- `@jue/authoring-check`
- `@jue/stream`
- `@jue/router`
- `@jue/query`
- `@jue/devtrace`
- `@jue/docsgen`
- `@jue/web`
- `@jue/examples`
- `@jue/inspect`
- `@jue/testkit`
- `@jue/bench`
- `@jue/native`（占位）

## 最新验证结果

2026-04-25 本地执行结果：

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：通过，`31` 个测试文件、`195` 个测试全部通过
- `pnpm build`：通过
- `pnpm bench`：通过
- `pnpm docs:phase2`：通过
- `pnpm test:e2e -- --grep virtual-list-lab`：通过

这并不意味着当前仓库已经满足 `Phase 2` 退出条件。

新的支持标准是：

1. 除调试/工具能力外，没有非调试、端到端、完备用例的能力，一律视为未支持。
2. example 必须走 authoring 主路径，不能靠业务级 `page.ts` glue 证明支持。
3. 如果 compiler 不能把能力自然编进 `.component.tsx -> generated -> runtime` 主链，就不能写成“已支持”。

## 下一步

主线仍然是 `Phase 2`，但重点已经改变：

- 不再先补包和文档
- 先修 compiler 主路径
- 再补非调试、端到端、零胶水 example

更具体地说，接下来应该优先推进：

- 让 `Show` 真正自动响应 signal 更新
- 让 `stream / router / query` 能以 `jue` 世界能力进入 authoring 主路径
- 把 `router-query-lab`、`stream-lab` 这类例子从 glue-heavy 状态收敛到真正可验收
