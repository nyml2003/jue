# 路线图

## 交付策略

现在的路线图围绕两个目标排：

- 先证明“完全显式依赖追踪”可行
- 再证明“这套布局确实对 V8 友好”

在这两个前提没有证实之前，不扩表面积，不谈生态，不谈兼容。

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

- 热路径里没有 `activeEffect`、没有动态依赖收集、没有对象图遍历

## Milestone C：DOM Renderer

目标：

- 通过窄 host 接口驱动真实 DOM

范围：

- text / element 创建
- insert / remove
- attr / prop / style / class patch
- event binding

退出条件：

- runtime-core 不导入 DOM API 也能完成挂载和更新

## Milestone D1：BlockIR / lowering / Builder

目标：

- 建立稳定的编译后端，让作者输入、fixture 和未来编译前端共享同一套语义层

范围：

- `BlockIR`
- lowering
- `BlueprintBuilder`
- fixture / example 迁移到 `BlockIR -> Blueprint`
- lowering 排序、参数区和依赖表生成

退出条件：

- counter 示例经由 `Builder / BlockIR -> Blueprint` 路径生成后，运行时只消费索引表，不做依赖推理
- 不再需要手写 `Uint32Array` / `Uint8Array` fixture

当前状态：

- 已开始
- `BlockIR`
- lowering
- `BlueprintBuilder`
- example 已迁移到这条链

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

- 能明确展示 slot/数组化方案相对 naive baseline 的收益

## 早期不要做的事

在 Milestone G 之前，不推进这些方向：

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
