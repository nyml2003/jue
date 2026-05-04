# 当前现状

更新时间：2026-05-03

这份文档只记录当前仓库已经成立的事实，用来同步代码、文档和后续路线。

## 总结

`jue` 当前还没有通过新的支持验收线。

当前仓库已经不只是一个 kernel 和一组早期 tooling。

更准确地说，它已经进入：

- 包面已落地
- 主链已存在
- 但支持尚未全部坐实

- `@jue/primitives / @jue/authoring-check / @jue/stream / @jue/router / @jue/query / @jue/devtrace / @jue/docsgen` 已落成第一版包面
- 但只有通过“非调试、端到端、完备用例”的能力，才允许标成支持

## 当前已经成立的能力

### 1. Kernel 基线仍然稳定

- `BlockIR -> lowering -> Blueprint -> runtime` 主链仍然稳定
- `@jue/compiler/ir`、`@jue/compiler/lowering`、`@jue/compiler/builder` 仍作为明确子边界存在
- `@jue/runtime-core/reactivity`、`@jue/runtime-core/host-contract` 仍作为明确子边界存在
- 新增 `@jue/runtime-core/channel` 作为显式消息通道最小能力面

### 2. Authoring 层已经进入主线收口期

- canonical authoring grammar 已先冻结这些主规则：
  - authoring 文件是普通 TSX 模块
  - 根组件由调用方决定
  - 宿主原语使用 PascalCase：`View / Text / Button / Input / Image / ScrollView`
  - signal 使用显式 `get / set / update`
  - 条件与列表只走 `Show / List / VirtualList`
- 但当前 frontend 的 guaranteed subset 仍然更窄：
  - 当前仍默认把 `render` 当作未显式指定 `rootSymbol` 时的默认根名
  - 但已经支持调用方显式传入 `rootSymbol`
  - 只吃有限的模板表达式与结构组合
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

### 4. 当前这批 Tooling 已存在

- `@jue/devtrace`
  - signal / channel / resource / navigation / docsgen trace event
  - collector / formatter
- `@jue/docsgen`
  - 支持矩阵
  - example registry snippet
  - CLI 入口
- 根命令已增加：
  - `pnpm docs:status`

### 5. 小程序 / Skyline 线已经有最小代码落点

- `@jue/skyline` 已存在，不再只是规划包名
- 当前它的定位已经明确为：
  - **Node 侧 compile-time target package**
  - 不是给微信小程序运行时直接加载的 runtime package
- 当前已落地的能力：
  - `compileSkylineBlockIR(block)`
  - `compileSkylineSource(source, { rootSymbol })`
  - 最小 template node lowering
  - `text / prop / style / region-switch` binding plan
  - `Show` conditional metadata
  - `List` keyed-list metadata
  - 最小 `templateCode + signalData` 产物
- 当前仍明确未落地：
  - event bridge
  - `setData` flush runtime glue
  - `VirtualList` target support
  - 完整微信工程 runtime 行为

### 6. `examples/mobile` 已经成为这条架构的现实示例

- 已新增：
  - `packages/examples/jue-mobile-showcase`
- 它当前证明的是：
  - 同一份 TSX authoring source
  - 一份浏览器侧 compiled module
  - 一份微信小程序 skyline scaffold
- 当前小程序生成产物已经包括：
  - `project.config.json`
  - `miniprogram/app.js / app.json`
  - `miniprogram/pages/showcase/index.js / .wxml / .wxss / .json`
  - `miniprogram/generated/showcase.artifact.json`
- 这些文件当前都走脚本生成，不是手写壳

### 7. 现有 examples 与 tooling 继续作为回归基线

- `@jue/examples` 仍承担 example registry
- `@jue/inspect`、`@jue/testkit`、`@jue/bench` 仍是当前验证基线
- `packages/examples/web-playground/apps/*` 继续承担真实回归面

## 当前 monorepo package containers

当前 monorepo 里，已经存在这些 package container：

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
- `@jue/skyline`
- `@jue/web-playground`
- `jue-mobile-showcase`
- `jue-current-app`

补充说明：

- 上面这份清单记录的是物理 package 单位，不直接等于分层披露单位
- 当前 `@jue/compiler` 是一个 composite package container
- 它在 monorepo 层图里，应进一步披露为：
  - `@jue/compiler/ir`
  - `@jue/compiler/lowering`
  - `@jue/compiler/frontend`
  - `@jue/compiler/builder`
- 当前 `@jue/runtime-core` 仍是单一 kernel package container，但它公开的稳定子路径：
  - `@jue/runtime-core/reactivity`
  - `@jue/runtime-core/channel`
  - `@jue/runtime-core/host-contract`
  也应该被当成正式 disclosure unit 看待
- 当前正式口径见：
  - [Monorepo 拓扑](../30-engineering/04-monorepo-topology-spec.md)

## 最新验证结果

2026-05-03 本地执行结果：

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：通过，`34` 个测试文件、`225` 个测试全部通过
- `pnpm build`：通过
- `pnpm --dir packages/examples/jue-mobile-showcase run lint:generated`：通过

这并不意味着当前仓库已经满足支持收口条件。

新的支持标准是：

1. 除调试/工具能力外，没有非调试、端到端、完备用例的能力，一律视为未支持。
2. example 必须走 authoring 主路径，不能靠业务级 `page.ts` glue 证明支持。
3. 如果 compiler 不能把能力自然编进 `.component.tsx -> generated -> runtime` 主链，就不能写成“已支持”。

## 下一步

当前主线仍然是支持验收和主路径收口，但重点已经改变：

- 不再先补包和文档
- 先修 compiler 主路径
- 再补非调试、端到端、零胶水 example

更具体地说，接下来应该优先推进：

- 给小程序线补事件 bridge 和 target glue
- 让 `stream / router / query` 能以 `jue` 世界能力进入 authoring 主路径
- 把 `router-query-lab`、`stream-lab` 这类例子从 glue-heavy 状态收敛到真正可验收

另见：

- [Authoring Grammar 规范](../10-specs/01-authoring-grammar-spec.md)
- [实现方案](../03-implementation-plan/01-implementation-plan.md)
