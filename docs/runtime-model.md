# 运行时模型

## 基本原则

运行时不再“收集依赖”。

运行时只“执行依赖表”。

依赖边已经在编译期或构建期写好。运行时收到 signal 写入后，直接通过索引表定位受影响的 binding。

## 运行时数据

运行时至少有这几类数据：

- signal 值表
- binding 表
- region 状态表
- channel 订阅表
- async resource 状态表
- node 引用表
- dirty 标记
- flush 队列

这些数据优先按 slot 和数组组织，而不是按对象引用图组织。

## 数据流

### 1. 构建阶段

构建阶段完成这些工作：

- 先生成声明式 `BlockIR`
- 给每个 signal 分配 slot
- 给每个 binding 分配 slot
- 给每个 region 分配 slot
- lowering 生成 `signalToBindings` 表
- lowering 生成 binding 到 node 的映射
- lowering 生成参数区和最终 `Blueprint`

这一步完成后，运行时不再推断依赖。

当前推荐主链：

`author input / builder / fixture -> BlockIR -> lowering -> Blueprint`

这里的关键边界是：

- `BlockIR` 负责语义表达
- lowering 负责压平和布局优化
- 运行时只消费 `Blueprint`

### 2. 写入阶段

当某个 signal 被写入时：

- 根据 signal slot 读取 `signalToBindings`
- 找到受影响的 binding slot
- 标记 dirty
- 把需要刷新的 binding 或 block 放进队列

这里不需要执行表达式来判断依赖，也不需要全局上下文。

### 3. flush 阶段

flush 时执行这些动作：

- 顺序扫描 dirty binding
- 按 opcode 分派 patch
- 必要时切换局部 region 状态
- 必要时消费 channel 消息
- 必要时提交异步 resource 的确认结果
- 按稳定顺序提交 host 操作

flush 阶段关注的是“哪个 slot 脏了”，不是“哪个组件要重新算”。

## 绑定模型

每个 binding 都是一条显式指令。

例如：

- `TEXT`
- `ATTR`
- `PROP`
- `STYLE`
- `CLASS_TOGGLE`
- `EVENT`
- `REGION_SWITCH`
- `KEYED_LIST`

每个 binding 至少要知道：

- 自己是什么 opcode
- 自己操作哪个 node slot
- 自己读取哪段数据
- 自己依赖哪些 signal slot

依赖信息不是运行时临时生成，而是 `Blueprint` 的一部分。

在当前阶段，这个流程应该理解成两层：

1. `IRBinding`
   - 表达语义
   - 保持可读和可分析
2. `Blueprint` binding 表
   - 表达运行时需要的扁平布局

也就是说，binding 的“意义”先存在于 `BlockIR`，再经由 lowering 压平成运行时字段。

## Region 模型

结构性动态用 region 表达。

region 是运行时一等单元。它解决两件事：

- 把动态结构限制在局部边界内
- 让依赖表的局部替换成为可能

region 至少分三类：

- conditional region
- keyed list region
- nested block region

对高动态场景，再补一类：

- virtual list region

当 region 切换时：

- 只更新这个 region 的局部实例状态
- 只替换这个 region 相关的局部依赖
- 不重算父 block 的整张依赖表

当前实现状态：

- `CONDITIONAL` 已有真实内容控制。`mountTree()` 初始化 region slot 后，会先卸载所有 conditional branch 静态内容，后续通过 `regions.conditional(slot).attach()`、`switchTo()`、`clear()` 控制真实 DOM range。
- `NESTED_BLOCK` 已有真实 child tree 挂载。`regions.nested(slot).attach()` 会按 `regionNestedBlueprintSlot` 挂载子 Blueprint；`replace(blockSlot, blueprintSlot)` 会挂新 child tree、定位到 region anchor 内，再提交 runtime state；`detach()` 会释放 child tree。
- `KEYED_LIST` 已有最小真实 reconcile。`regions.keyedList(slot).attach()` 挂载 item child tree；`reconcile()` 根据 key 做 insert / remove / move；`clear()` 释放所有 item tree。
- `VIRTUAL_LIST` 已有最小 window controller。它维护 `itemCount / windowStart / windowEnd`，web 层使用固定可见 cell pool，窗口变化时重写 cell signals，而不是走普通 keyed diff。

当前 web controller 采用“先验证/挂载新内容，再提交稳定状态”的方向，避免 DOM 成功但 region state 失败，或 region state 成功但 DOM 半挂载。

### Virtual List Region

`virtual list region` 不是简单的“少渲染几个节点”。

它至少要维护：

- 可见窗口起止
- overscan 范围
- 复用节点池
- item slot 到可见 cell slot 的映射

运行时目标不是让每次滚动都销毁一批旧节点、再创建一批新节点，而是尽量复用已有节点，把数据重绑定到新的可见窗口。

编译器可以标记“这是可虚拟化列表”，但窗口大小、overscan 和节点复用策略必须由运行时决定，不能写死在编译期。

当前最小实现只覆盖固定可见 cell 数量：

- `attach({ itemCount, windowStart, cells })` 挂载首个窗口
- `updateWindow({ itemCount, windowStart, cells })` 复用已有 cell tree，并把新窗口数据写入 cell signals
- `clear()` 释放 cell pool

还没有实现：

- 滚动事件接入
- overscan
- 动态 cell pool 扩容
- item 高度测量
- 真实长列表 benchmark

## 跨边界通信模型

跨 Region、跨 Instance 通信走显式 channel。

一个 channel 至少包含：

- `channelSlot`
- `messageType`
- `subscriberStart`
- `subscriberCount`

运行时流程：

- 发送方写入 channel 队列
- scheduler 在合适阶段消费消息
- 根据订阅表命中目标 binding 或 region

这样做的目的不是做一个通用 EventBus，而是把通信也收敛成显式表和受控调度。

禁止：

- 依赖任意全局 signal 传播状态
- 发送方直接改写接收方实例内部数据

## 异步调度模型

异步更新必须进入统一 scheduler。

推荐引入 lane：

- `SYNC_INPUT`
- `VISIBLE_UPDATE`
- `DEFERRED`
- `BACKGROUND`

注意：

- lane 由 UI 影响决定，不由“是不是接口请求”决定
- 网络请求可能触发 `VISIBLE_UPDATE`
- 定时器也可能只属于 `BACKGROUND`

为了避免异步结果覆盖新状态，还需要引入确认机制：

- `requestVersion`
- `resourceSlot`
- 提交前比对版本

旧请求返回时，如果版本落后，就丢弃，不进入 commit。

## Disposal 模型

完全显式依赖追踪并不自动保证不会泄漏。

只要 region 或 block 可以消失，就必须有对应的 disposal 路径。

当条件分支被卸载或 keyed child 被移除时：

- 释放 region 内的实例状态
- 释放 region 内的事件绑定
- 丢弃不再使用的 DOM 引用
- 清理局部 dirty 标记

## Scheduler 模型

建议的默认 scheduler：

- microtask batching
- 单批次去重
- 显式 `flush()`，方便测试和 benchmark

Scheduler 的目标不是做复杂推理，而是稳定地消费 dirty 数据。

## V8 友好的实现规则

### 1. 热路径走整数索引

优先：

- `signalSlot`
- `bindingSlot`
- `nodeSlot`
- `regionSlot`

避免热路径反复按字符串 key 读写对象。

### 2. 热路径少建闭包

不要给每个 binding 都建一个独立 updater closure。

更合适的方式是：

- opcode 分派
- 统一 dispatcher
- 定长表驱动

### 3. 热对象分冷热字段

例如 `BlockInstance`：

- 热字段：`blueprint`、`nodes`、`signalValues`、`dirtyBits`、`regions`
- 冷字段：`debugName`、`sourceMap`、`devState`

冷字段不要污染热路径对象布局。

### 4. 尽量顺序访问

flush 时尽量顺序扫描：

- dirty bitset
- binding 数组
- patch 参数数组

避免频繁随机跳对象引用。

## 运行时不变量

1. 一次 signal 写入只命中显式声明依赖它的 binding。
2. `runtime-core` 不做 DOM 操作。
3. `renderer-dom` 不做依赖判断。
4. 动态结构只能通过 region 改变。
5. 所有可销毁路径都必须可清理。
6. 跨边界通信只能通过显式 channel。
7. 异步结果提交前必须经过 lane 和版本校验。

## 第一条垂直链路

第一版运行时证明只需要打通这条链路：

- 一个 signal slot
- 一个 text binding slot
- 一张 `signalToBindings` 表
- 一次 dirty 标记
- 一次 flush
- 一次 `setText`

如果这条链路还依赖运行时依赖收集，说明模型没有真正切换完成。

当前仓库已经超出这条最小链路，至少已经证明：

- `TEXT`
- `PROP`
- `STYLE`
- `EVENT`
- 最小静态节点表挂载
- `CONDITIONAL` 真实 branch range attach / switch / clear
- `NESTED_BLOCK` 真实 child tree attach / replace / detach
- `KEYED_LIST` 最小真实 keyed item attach / reconcile / clear
- `VIRTUAL_LIST` 最小固定窗口 cell pool attach / update / clear

并且这些能力已经可以从 `BlockIR` 经 lowering 生成 `Blueprint` 后被 runtime 消费。
