# 路线图

## 交付策略

现在的路线图围绕两个目标排：

- 先证明“完全显式依赖追踪”可行
- 再证明“这套布局确实对 V8 友好”

在这两个前提没有证实之前，不扩表面积，不谈生态，不谈兼容。

## 当前状态

当前阶段判断：

- `A`：基本完成
- `B`：基本完成
- `C`：最小版本成立
- `D1`：已进入稳定化阶段
- `E`：四类 region 的最小垂直链路已成立，`VIRTUAL_LIST` 仍需性能化
- `F / G`：尚未系统推进
- `D2`：推迟到后面

当前主线不再是“尽快接入完整编译前端”。

当前主线是：

`D1 -> E -> F -> G -> D2`

原因：

- 先把 `BlockIR / lowering / Builder` 契约做稳
- 先把 region / channel / resource 的 runtime 边界做稳
- 先验证布局和热路径是否真的值得
- 最后再接入完整编译前端

注意：

- 这里说的是“完整 compiler frontend 放后面”
- 不排斥在 `D2` 之前插入一个极小的 frontend canary 来验证 IR/lowering 没有只适配 Builder

## Milestone A：IR 与最小运行时链路

目标：

- 固定 slot、binding、region 的基本模型

范围：

- `Blueprint`
- `BlockInstance`
- opcode
- `signalToBindings`
- dirty queue
- 一个 text binding patch

退出条件：

- 一次 `setSignal(slot)` 可以直接命中 binding slot 并完成 `setText`

当前状态：

- 已完成，并且实际能力已经超出最初定义

## Milestone B：State Core 与 Scheduler

目标：

- 建立不依赖运行时依赖收集的 signal 写入路径

范围：

- signal 值表
- batch 调度
- dirty bitset
- 显式 `flush()`
- disposal 基础机制

退出条件：

- 热路径里没有 `activeEffect`
- 没有动态依赖收集
- 没有对象图遍历

当前状态：

- 已完成最小主链

## Milestone C：DOM Renderer

目标：

- 通过窄 host 接口驱动真实 DOM

范围：

- text / element 创建
- insert / remove
- attr / prop / style / class patch
- event binding

退出条件：

- `runtime-core` 不导入 DOM API 也能完成挂载和更新

当前状态：

- 最小版本成立
- `TEXT / PROP / STYLE / EVENT` 已打通
- 静态节点表挂载已成立
- `ATTR / CLASS_TOGGLE` 等细分路径还没有单独收敛

## Milestone D1：BlockIR / lowering / Builder

目标：

- 建立稳定的编译后端，让作者输入、fixture 和未来编译前端共享同一套语义层

范围：

- `BlockIR`
- lowering
- `BlueprintBuilder`
- fixture / example 迁移到 `BlockIR -> Blueprint`
- lowering 排序、参数区和依赖表生成
- Builder 完整性校验和错误诊断

退出条件：

- counter 示例经由 `Builder / BlockIR -> Blueprint` 路径生成后，运行时只消费索引表，不做依赖推理
- 不再需要手写 `Uint32Array` / `Uint8Array` fixture
- Builder 足够稳定，能承担 fixture / example 的主要 authoring 面
- lowering 的 node / binding / 参数区 / `signalToBindings` 规则有明确测试保护

当前状态：

- 已开始且主链已跑通
- `BlockIR`
- lowering
- `BlueprintBuilder`
- example 已迁移到这条链
- 当前正处于稳定化阶段

下一步重点：

- 继续增强 Builder 拓扑校验
- 固化 lowering 的确定性输出规则
- 让更多 fixture / example 迁移到 Builder

## Milestone E：Region 与动态结构加固

目标：

- 把条件分支和 keyed list 收敛成局部 region 更新

范围：

- conditional region
- keyed list region
- nested block region
- region disposal
- virtual list region

退出条件：

- 高频 region 切换不会触发父 block 广域重算
- 长列表滚动不会退化成整批节点创建和销毁

当前状态：

- `CONDITIONAL` 已从 metadata skeleton 推进到真实 branch content attach / switch / clear
- `mountTree()` 会初始化 region slot，并在初始挂载后卸载 conditional 的未激活 branch 内容
- `NESTED_BLOCK` 已支持真实 child tree attach / replace / detach，child 内容插入到 region anchor 内
- `KEYED_LIST` 已支持最小真实 item attach / reconcile / clear
- `KEYED_LIST` reconcile 已能处理 insert / remove / move，并拒绝重复 key
- runtime keyed payload 有容量防护，失败时不会把 region 卡在 `UPDATING`
- web controller 已提供 `regions.conditional()`、`regions.nested()`、`regions.keyedList()`
- `VIRTUAL_LIST` 已有最小 window state 和 web controller
- `VIRTUAL_LIST` 最小 web controller 使用固定可见 cell pool，窗口更新时重写 cell signals，不走普通 keyed diff
- `examples/web-playground/src/tab-panel.ts` 已把第二个 tab 接到 `VIRTUAL_LIST`
- `tab-panel` 现在有真实 scroll viewport、top/bottom spacer 和 1000 item / 12 visible cells 的 example

当前限制：

- `KEYED_LIST` 现在是正确性优先的最小 reconcile，不是最终性能最优 diff
- child block / list item 的局部状态隔离已建立，但还没有 channel/resource 跨实例通信
- `VIRTUAL_LIST` 当前仍是最小版本：已有滚动事件接入，但还没有 overscan、动态池扩容、item 高度测量和真实滚动 benchmark
- 普通 `KEYED_LIST` 仍不能当长列表方案

为什么先于 D2：

- region 是 runtime / IR 契约问题，不是作者输入表面问题
- 先把 region 边界做稳，再接前端，错误成本更低

## Milestone F：跨边界通信与异步调度

目标：

- 在不引入全局共享状态的前提下覆盖复杂业务通信和异步更新

范围：

- channel / port 订阅表
- scheduler lane
- async resource version 校验
- channel 与 dirty queue 协同

退出条件：

- 跨 Instance 更新不依赖全局 signal
- 异步结果不会覆盖更新版本更高的状态

为什么先于 D2：

- channel / resource 仍然属于 runtime / IR 契约问题
- 先让后端语义层稳定，再让前端去产出这些语义

## Milestone G：V8 与基准验证

目标：

- 用仓库内证据证明这套布局确实减少了运行时成本

范围：

- operation count
- naive rerender baseline
- V8 profile
- hidden class / deopt 排查
- benchmark harness

退出条件：

- 能明确展示 slot / 数组化方案相对 naive baseline 的收益
- 能解释主要收益来自哪里
- 能识别当前布局的主要瓶颈和下一步优化方向

为什么先于 D2：

- 先验证 runtime / lowering 值不值得，再决定前端要为哪套契约服务

## Milestone D2：Compiler Frontend

目标：

- 让真实作者输入先产出 `BlockIR`，再复用已有 lowering 生成 `Blueprint`

范围：

- TSX / JSX 或其他前端输入表面
- 静态结构 hoist
- binding 降级
- signal slot 分配
- `signalToBindings` 生成
- 编译错误诊断

退出条件：

- 非 fixture 输入可以稳定产出 `BlockIR`
- compiler 前端不直接拼 typed arrays
- counter 示例可以不经 hand-written builder 而由编译前端生成

备注：

- `D2` 推迟，不代表完全不做前端验证
- 在 `D2` 正式开始前，可以插入一个极小的 frontend canary，验证 `BlockIR / lowering` 没有只适配 Builder

## 早期不要做的事

在 `G` 之前，不推进这些方向：

- SSR 与 hydration
- resumability
- 原生渲染目标
- React 兼容层
- 插件架构
- 面向外部的稳定 API 承诺

这些方向会在核心路径未证实时，过早放大系统复杂度。

## 发布门槛

在称第一版原型“可用”之前，至少满足：

1. 显式依赖表完整可执行
2. 热路径里没有运行时依赖收集
3. `Blueprint` 和 `BlockInstance` 结构稳定
4. DOM 更新路径只走 binding patch
5. 对本地 naive baseline 有 benchmark 和 profile 证据
6. 长列表、跨边界通信、异步更新都有受控模型，不靠兜底全局状态
7. 编译前后端边界清晰：
   `author input / Builder -> BlockIR -> lowering -> Blueprint -> runtime`
