# 路线图

这份 roadmap 只保留还没完成、或者虽然开始了但仍然属于主线问题的事项。

已经落地的内容不再在这里展开复述：

- `A / B / C` 已完成
- `D1 / E` 的最小可运行主链已经成立
- 最小 Babel frontend canary 已落地

这些事实统一归档到：

- `docs/01-overview/current-status.md`

## 当前主线

当前主线仍然是：

`D1 -> E -> F -> G -> D2`

原因不变：

- 先把 `BlockIR / lowering / Builder` 的语义层收稳
- 先把 region / channel / resource 的 runtime 边界收稳
- 先证明这套布局确实值得，再扩大 compiler frontend 输入面

这里说的是：

- 完整 compiler frontend 继续往后放
- 但不否认在 `D2` 正式推进前继续做最小 canary 扩展

## 当前判断

- `D1`：还在稳定化，主要剩确定性和 authoring 面收口
- `E`：正确性主链已通，但性能化和边界加固没做完
- `F`：还没系统推进
- `G`：还没开始形成仓库内证据
- `D2`：canary 已经明显超出最初最小面，但仍然只是受限 frontend，不是完整 authoring surface

## D1：BlockIR / lowering / Builder 稳定化

这一阶段不再讨论“有没有主链”，而是讨论“主链是否足够稳，能不能继续当长期后端边界”。

### 剩余工作

- 固化 lowering 的确定性输出规则
- 继续增强 Builder 的完整性校验和错误诊断
- 继续把 hand-written fixture / example 收敛到统一 authoring 面
- 收紧 `BlockIR -> lowering -> Blueprint` 之间的契约描述和测试保护

### 退出条件

- 相同语义输入能稳定产出确定性 `Blueprint`
- Builder 的非法输入会被稳定拒绝，不靠运行时兜底
- fixture / example 不再回退到手写 typed array
- 后续 frontend 扩面时，不需要重新定义后端语义层

## E：Region 与动态结构加固

这阶段已经不是“把 region 做出来”，而是“把它们做成可长期依赖的 runtime 边界”。

### 剩余工作

- 继续收紧 `KEYED_LIST` 的更新模型，减少正确性优先实现带来的性能损失
- 给 `VIRTUAL_LIST` 补：
  - overscan
  - 动态池扩容策略
  - item 高度测量
  - 真实滚动 benchmark
- 继续收紧 region disposal 和局部状态边界
- 为后续 channel / resource 接入预留更稳定的跨 region / 跨 instance 边界

### 退出条件

- 高频 region 切换不会触发父 block 广域重算
- 长列表滚动不会退化成大批量节点创建和销毁
- `KEYED_LIST` 和 `VIRTUAL_LIST` 的职责边界清晰，不互相兜底
- region 局部状态、销毁和恢复路径有明确模型与测试保护

## F：跨边界通信与异步调度

这阶段还没系统开始，但它仍然属于 runtime / IR 主线，不应该被 frontend 先行替代。

### 目标

- 在不引入全局共享状态的前提下覆盖复杂业务通信和异步更新

### 重点范围

- channel / port 订阅表
- scheduler lane
- async resource version 校验
- channel 与 dirty queue 协同

### 退出条件

- 跨 instance 更新不依赖全局 signal
- 异步结果不会覆盖更新版本更高的状态
- runtime 能表达复杂通信而不退回隐式共享状态模型

## G：V8 与基准验证

如果没有仓库内证据，这条路线就还只是设计判断，不是被证明的实现方向。

### 目标

- 用仓库内证据证明这套布局确实减少了运行时成本

### 重点范围

- operation count
- naive rerender baseline
- V8 profile
- hidden class / deopt 排查
- benchmark harness

### 退出条件

- 能明确展示 slot / 数组化方案相对 naive baseline 的收益
- 能解释主要收益来自哪里
- 能识别当前布局的主要瓶颈和下一步优化方向

## D2：Compiler Frontend

这一阶段现在只保留“什么时候值得扩大 frontend 输入面”的问题，不再把最小 canary 当作主进展来反复展开。

### 当前边界

已落地的 canary 只证明：

- `source -> BlockIR -> lowering -> Blueprint` 这条链可行
- TSX authored example 可以进入真实 example 流程
- frontend 已经能覆盖一批基础表达式和属性 lowering：
  - 单根 JSX Element
  - 静态 element / text
  - `{identifier}` 文本绑定
  - 字面量 child / 静态 prop / 静态 style
  - `style={{ ... }}` 的最小 object lowering
  - 隐式 boolean attribute
  - 直接命名函数 event handler
  - 极小 conditional：`cond ? <A /> : <B />`
- example 侧已经不是单一 demo，而是一组独立 app，可作为 compiler/frontend 的真实回归面

它还没有证明：

- frontend 输入面已经稳定
- authoring 语法已经足够表达核心动态结构
- 编译错误模型已经能支撑持续扩面

### 剩余工作

- 明确 `@jue/compiler` 与 `@jue/compiler/frontend` 的公开边界
- 继续扩和收紧前端错误模型
- 继续让 example apps 覆盖已经支持的 frontend 边界，而不是只停在 compiler unit test
- 按 `api-draft` 对齐结构原语优先级：
  - `Show`
  - `List`
  - `VirtualList`
- 在没有充分证据前，不把“完整组件系统”当作 D2 的第一优先级
- 等 `D1 / E / F / G` 收到足够证据后，再决定是否系统推进完整 frontend

### authoring 优先级

结合当前代码和 `docs/02-core-specs`，D2 的 authoring 扩面优先级调整为：

1. 基础表达式、属性和错误模型继续收口
2. 与现有 region/runtime 直接对齐的结构原语：
   - `Show -> CONDITIONAL`
   - `List -> KEYED_LIST`
   - `VirtualList -> VIRTUAL_LIST`
3. 在这些原语稳定后，再评估 `fragments`
4. 组件调用放在更后面，不抢在结构原语之前

理由：

- `api-draft` 承诺的结构原语不是 `For`，而是 `Show / List / VirtualList`
- 这些原语直接映射到已经存在的 runtime / region 契约
- `fragments` 和组件调用虽然常见，但它们更容易把 frontend 过早拖进完整组件系统问题
- 当前主线仍然是先稳 runtime / IR / region，再决定 frontend 输入面能扩到多大

### 当前仍不支持

- `Show / List / VirtualList` 这类结构原语的 authoring surface
- keyed / virtual list authoring 语法
- fragments
- 组件调用
- spread props
- hooks

### 退出条件

- 非 fixture 输入可以稳定产出 `BlockIR`
- frontend 不直接拼 typed arrays
- frontend 扩面不会反向破坏后端契约
- compiler 错误模型、authoring 边界和 example 链路都足够稳定
- 至少一组与 `Show / List / VirtualList` 对应的 authoring primitive 能稳定落到现有 region/runtime 契约

## 早期不要做的事

在 `G` 之前，不推进这些方向：

- SSR 与 hydration
- resumability
- 原生渲染目标
- React 兼容层
- 插件架构
- 面向外部的稳定 API 承诺

这些方向会在核心路径尚未证实之前，过早放大系统复杂度。

## 发布门槛

在称第一版原型“可用”之前，至少满足：

1. 显式依赖表完整可执行。
2. 热路径里没有运行时依赖收集。
3. `Blueprint` 和 `BlockInstance` 结构稳定。
4. DOM 更新路径只走 binding patch。
5. 对本地 naive baseline 有 benchmark 和 profile 证据。
6. 长列表、跨边界通信、异步更新都有受控模型，不靠兜底全局状态。
7. 编译前后端边界清晰：
   `author input / Builder -> BlockIR -> lowering -> Blueprint -> runtime`
