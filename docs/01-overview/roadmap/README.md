# 路线图

这组文档是当前 `jue` 的唯一 roadmap 入口。

旧的：

- `D1 / E / F / G / D2`

这一套分段方式到这里为止，不再继续沿用。

从现在开始，后续规划一律按这组 roadmap 文档的阶段划分讨论。

## 目标

`jue` 的目标不再只是“把 runtime / compiler 主链做出来”。

新的目标是：

- 先把 `jue` 做成一个自洽的一方系统
- 再把官方能力层补齐
- 最后再决定要不要继续扩大宿主与应用世界

这里说的“一方系统”不是 app framework 总包。

它指的是：

- kernel
- authoring
- host
- 必要 tooling

这四层足够闭环，能让 `jue` 不再只是技术路线，而是一个真正可开发、可验证、可迭代的系统。

## 当前事实

当前仓库已经证明了这些事情：

- `BlockIR -> lowering -> Blueprint -> runtime` 主链已经成立
- `CONDITIONAL / NESTED_BLOCK / KEYED_LIST / VIRTUAL_LIST` 都已有最小链路
- `@jue/compiler/frontend` 已有最小 TSX canary
- examples 已开始承担真实回归面
- `04-layer` 里的边界与包规划已经明确：
  - `layer-model.md`
  - `package-map.md`

这意味着：

- 现在不再适合继续用“后端主链 vs D2 frontend”那套旧切法讨论未来
- 现在更适合按“哪些包构成一方系统，哪些能力进入官方层，哪些延后”来推进

## 新主线

新的主线分成三阶段：

1. `Phase 1`：一方系统成形
2. `Phase 2`：官方能力层补齐
3. `Phase 3`：世界扩面

主线顺序就是：

`Phase 1 -> Phase 2 -> Phase 3`

这个顺序的核心原则不变：

- 先稳 kernel
- 先稳 authoring 与 host 边界
- 先建立仓库内证据和工具闭环
- 再补 stdlib
- 最后再扩 native / language tools / create / convenience layers

## 文档拆分

- [Phase 1：一方系统成形](./phase-1.md)
- [Phase 2：官方能力层补齐](./phase-2.md)
- [Phase 3：世界扩面](./phase-3.md)
- [当前明确不做的事](./non-goals.md)

## 当前优先级摘要

如果只看“现在就该做什么”，排序是：

1. Phase 1 的 kernel 收口
2. Phase 1 的 authoring 收口
3. Phase 1 的 web host 加固
4. Phase 1 的 tooling 闭环
5. Phase 2 的 primitives / stream / router / query
6. Phase 3 的 form / animation / gesture / viewport / native / language-tools

## 发布判断

在把 `jue` 称为“第一版一方系统”之前，至少满足：

1. kernel 不变量已经稳定。
2. authoring 与 host 边界已经稳定。
3. Web host 可以承担第一宿主。
4. inspect / testkit / bench / examples 已形成最小闭环。
5. `jue` 已经不再只是 runtime + compiler，而是一个可开发、可验证、可继续扩展的系统。

## 结论

新的 roadmap 不再以旧的：

- `D1 / E / F / G / D2`

作为主线。

新的主线是：

- `Phase 1`：一方系统成形
- `Phase 2`：官方能力层补齐
- `Phase 3`：世界扩面

从现在开始，后续所有规划都以这套阶段为准。
