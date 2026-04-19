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

- 给每个 signal 分配 slot
- 给每个 binding 分配 slot
- 给每个 region 分配 slot
- 生成 `signalToBindings` 表
- 生成 binding 到 node 的映射

这一步完成后，运行时不再推断依赖。

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

### Virtual List Region

`virtual list region` 不是简单的“少渲染几个节点”。

它至少要维护：

- 可见窗口起止
- overscan 范围
- 复用节点池
- item slot 到可见 cell slot 的映射

运行时目标不是让每次滚动都销毁一批旧节点、再创建一批新节点，而是尽量复用已有节点，把数据重绑定到新的可见窗口。

编译器可以标记“这是可虚拟化列表”，但窗口大小、overscan 和节点复用策略必须由运行时决定，不能写死在编译期。

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
