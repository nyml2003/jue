# Monorepo Topology

## 目标

这份文档只回答一个工程问题：

当前 `jue` monorepo 里的依赖关系，怎么在**不拆 repo、不重定义现有 package 单位**的前提下，被稳定看清。

它不负责：

- 定义 kernel 语义
- 替代包边界文档
- 替代当前现状文档

它负责：

- 定义 monorepo 里的物理单位是什么
- 定义分层披露单位是什么
- 定义当前层图该怎么画
- 定义 package container、example package 和公开子路径之间的关系
- 定义 registry 和报告的同步方式

## 一句话规则

`package 是物理管理单位，disclosure unit 是分层披露单位。`

如果某个 package 横跨多个层级，层图里不直接展示整个 package，而展示它的稳定公开子路径。

## 为什么需要两级模型

当前 monorepo 里，至少有两种真实情况同时成立：

1. 有些 package 天然只属于一个层，例如 `@jue/shared`、`@jue/web`、`@jue/stream`
2. 有些 package 作为工程容器横跨多个层，例如 `@jue/compiler`

如果强行让“整个 package 只能属于一个层”，就会出现两个坏结果：

- 把 `@jue/compiler` 这种复合包写成 `Kernel + Authoring`，层图被污染
- 或者为了层图好看，提前拆包，工程结构反过来服从展示结构

这两种都不对。

所以这里固定两级模型：

- `Package Container`
  - 当前真实存在的 package
  - 负责 ownership、build、release、workspace 管理
- `Disclosure Unit`
  - 层图里真正拿来归层的单位
  - 优先使用稳定公开子路径
  - 如果某个 package 只有单层职责，就直接用 package 本体作为 disclosure unit

## 当前 monorepo 的 package 类型

### 1. Pure Package

整个 package 只属于一个层。

例如：

- `@jue/shared`
- `@jue/runtime-core`
- `@jue/web`
- `@jue/stream`
- `@jue/devtrace`
- `@jue/web-playground`

它们既是 package container，也是 disclosure unit。

### 2. Composite Package Container

package 本体是一个工程容器，但其稳定公开入口横跨多个层。

当前最典型的是：

- `@jue/compiler`

它的分层披露必须下沉到稳定公开子路径：

- `@jue/compiler/ir`
- `@jue/compiler/lowering`
- `@jue/compiler/frontend`
- `@jue/compiler/builder`

注意：

- 这里的“子路径”必须是当前 package 已公开的稳定入口
- 不允许拿内部文件路径伪装成 disclosure unit

## 当前层图

### Kernel

- `@jue/shared`
- `@jue/runtime-core`
- `@jue/runtime-core/reactivity`
- `@jue/runtime-core/channel`
- `@jue/runtime-core/host-contract`
- `@jue/compiler/ir`
- `@jue/compiler/lowering`

### Official Authoring

- `@jue/jsx`
- `@jue/primitives`
- `@jue/authoring-check`
- `@jue/compiler/frontend`
- `@jue/compiler/builder`

### Official Host

- `@jue/web`
- `@jue/native`

### Official Host Target

- `@jue/skyline`

### Official Stdlib

- `@jue/stream`
- `@jue/router`
- `@jue/query`

### Official Tooling

- `@jue/devtrace`
- `@jue/docsgen`
- `@jue/examples`
- `@jue/inspect`
- `@jue/testkit`
- `@jue/bench`

### Example Packages

- `@jue/web-playground`
- `jue-mobile-showcase`
- `jue-current-app`

## 当前 package container 清单

下面这张表记录物理 package 单位，不是层图单位。

| Package Container | 类型 | 说明 |
| --- | --- | --- |
| `@jue/shared` | Pure | Kernel 共享定义 |
| `@jue/runtime-core` | Pure | Kernel 主执行包；同时公开 kernel 子路径 |
| `@jue/compiler` | Composite | 同时承载 kernel 后端与 authoring 入口 |
| `@jue/jsx` | Pure | 官方 authoring 入口 |
| `@jue/primitives` | Pure | 官方结构原语 |
| `@jue/authoring-check` | Pure | 作者侧诊断 |
| `@jue/web` | Pure | 官方 web host |
| `@jue/native` | Pure | 官方 native host 占位 |
| `@jue/skyline` | Pure | 官方模板宿主 target |
| `@jue/stream` | Pure | 官方 stdlib |
| `@jue/router` | Pure | 官方 stdlib |
| `@jue/query` | Pure | 官方 stdlib |
| `@jue/devtrace` | Pure | 官方 tooling |
| `@jue/docsgen` | Pure | 官方 tooling |
| `@jue/examples` | Pure | 官方 example registry tooling |
| `@jue/inspect` | Pure | 官方 inspect tooling |
| `@jue/testkit` | Pure | 官方 test tooling |
| `@jue/bench` | Pure | 官方 benchmark tooling |
| `@jue/web-playground` | Pure | example package |
| `jue-mobile-showcase` | Pure | example package |
| `jue-current-app` | Pure | example package |

## 当前直接依赖图

这里只记录当前 manifest 里已经存在的内部 package 依赖，不推导未来结构。

### Kernel / Authoring / Host / Stdlib / Tooling

- `@jue/runtime-core -> @jue/shared`
- `@jue/compiler -> @jue/runtime-core, @jue/shared`
- `@jue/jsx -> @jue/primitives, @jue/shared`
- `@jue/authoring-check -> @jue/compiler, @jue/primitives`
- `@jue/web -> @jue/runtime-core, @jue/shared`
- `@jue/native -> @jue/runtime-core, @jue/shared`
- `@jue/skyline -> @jue/compiler, @jue/shared`
- `@jue/stream -> @jue/runtime-core, @jue/shared`
- `@jue/router -> @jue/devtrace, @jue/shared`
- `@jue/query -> @jue/devtrace, @jue/runtime-core, @jue/shared`
- `@jue/devtrace -> @jue/shared`
- `@jue/docsgen -> @jue/authoring-check, @jue/examples, @jue/primitives, @jue/testkit`
- `@jue/inspect -> @jue/compiler, @jue/examples, @jue/shared`
- `@jue/testkit -> @jue/compiler, @jue/examples, @jue/inspect, @jue/shared`
- `@jue/bench -> @jue/examples, @jue/shared, @jue/testkit`

### Example Packages

- `@jue/web-playground -> @jue/shared, @jue/web`
- `jue-mobile-showcase`
  - 当前 `package.json` 没有声明内部 package 依赖
  - 但脚本会通过 workspace filter 调用 `@jue/skyline`
- `jue-current-app`
  - 当前 `package.json` 没有声明内部 package 依赖

## 允许的披露规则

### 1. layer 图只收 disclosure unit

允许：

- `@jue/compiler/frontend -> Official Authoring`

不允许：

- `@jue/compiler -> Kernel + Authoring`

### 2. composite container 不直接进单层清单

如果一个 container 跨层：

- 它可以出现在 container inventory
- 它不能直接出现在“某一层的 package 名单”里

### 3. example package 是一等 package

`examples/*` 下的 package 不是附属目录。

它们在 monorepo 里就是正式 package，只是层级属于 `Example Packages`，不属于官方能力层。

### 4. `@jue/examples` 和 example package 不是一回事

- `@jue/examples`
  - 是 tooling package
  - 负责 example registry
- `@jue/web-playground` / `jue-mobile-showcase` / `jue-current-app`
  - 是 example package
  - 负责实际示例、验证或展示

## 维护规则

以后新增任何 package，都先问两件事：

1. 它是 pure package 还是 composite container
2. 它在层图里应该作为哪个 disclosure unit 出现

如果是 composite container，必须同时补：

- 稳定公开子路径
- 对应 disclosure unit 的层级归属

如果没有这两样，就不要把它写进正式层图。

## registry 与报告

当前这套拓扑同时落到两个文件：

- [monorepo-topology.registry.json](./monorepo-topology.registry.json)
  - machine-readable 的真相源
- [05-monorepo-dependency-report.md](./05-monorepo-dependency-report.md)
  - 从 registry 和当前 workspace manifests 汇总出来的依赖报告

配套命令：

- `pnpm topology:check`
  - 校验 registry 是否覆盖全部当前 package
  - 校验 package id、path、公开 exports 和 disclosure unit 是否一致
- `pnpm topology:report`
  - 生成依赖报告和 Mermaid 图

维护顺序：

1. 先更新 registry
2. 再跑 `pnpm topology:check`
3. 最后跑 `pnpm topology:report`

## 和其他文档的关系

- [包规划图](../20-boundaries/02-package-map.md)
  - 回答“这些包大体属于哪一层、承担什么职责”
- [当前现状](../02-current-status/01-current-status.md)
  - 只记录当前已经成立的事实
- 本文档
  - 回答“在一个 monorepo 里，这些 package 和子路径应该怎么被稳定看清”
