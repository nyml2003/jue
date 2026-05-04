# Scheduler 规范

## 目标

这份文档定义 `jue` 的调度模型。

要解决四件事：

1. signal 写入后，什么时候进入 flush
2. 不同更新，谁先执行，谁后执行
3. Region、channel、async resource 怎么接入统一时序
4. 怎么保证调度不会把系统拖回“谁先来就先跑”的混乱模型

Scheduler 不负责推断依赖。Scheduler 只负责消费已经显式声明好的 dirty、消息和异步结果。

## 基本原则

1. 调度只看 slot、lane 和队列，不看组件语义。
2. 同一批次内必须有稳定顺序。
3. 同一 slot 的重复更新必须去重。
4. 调度优先级按 UI 影响定，不按事件来源定。
5. 结构性更新和数据更新必须进入同一 flush，不能各跑一套旁路。

## 调度单位

Scheduler 消费四类工作单元：

- `binding work`
- `region work`
- `channel message`
- `resource commit`

它们都必须带有：

- `slot`
- `lane`
- `version` 或批次序号

这样 scheduler 才能做去重、排序和丢弃过期结果。

## Lane

当前定义四条 lane：

- `SYNC_INPUT`
- `VISIBLE_UPDATE`
- `DEFERRED`
- `BACKGROUND`

### 语义

#### `SYNC_INPUT`

用于直接影响当前输入反馈的更新。

例如：

- 输入框 value 同步
- 光标相关状态
- 按钮按下态

要求：

- 当前批次优先执行
- 不等待后台任务

#### `VISIBLE_UPDATE`

用于影响当前可见区域的更新。

例如：

- 当前屏幕内文本变化
- 条件分支切换
- 普通列表局部协调
- 虚拟列表窗口更新

要求：

- 低于 `SYNC_INPUT`
- 高于 `DEFERRED`

#### `DEFERRED`

用于可以稍后完成，但仍与当前页面有关的更新。

例如：

- 非关键面板刷新
- 预先计算下一屏数据
- 非当前焦点区域的派生状态

#### `BACKGROUND`

用于后台刷新、预取和低价值维护性更新。

例如：

- 预取数据
- 埋点状态整理
- 不影响当前画面的缓存同步

### 规则

1. lane 由 UI 影响决定，不由“是不是网络请求”决定。
2. 一个网络请求的结果可以进入 `VISIBLE_UPDATE`。
3. 一个定时器触发的更新也可能只是 `BACKGROUND`。
4. 同一批次内，先处理高 lane，再处理低 lane。

## 队列模型

建议维护四组核心队列：

- `dirtyBindings`
- `dirtyRegions`
- `channelQueue`
- `resourceQueue`

每组队列都按 lane 分桶。

可以表示为：

```ts
dirtyBindingsByLane[lane]
dirtyRegionsByLane[lane]
channelQueueByLane[lane]
resourceQueueByLane[lane]
```

## 批次模型

一次 flush 是一个批次。

每个批次至少要有：

- `batchId`
- `scheduledLanes`
- `flushedLanes`

批次规则：

1. 同一 microtask 内新增的同 lane 工作，默认并入当前批次。
2. flush 期间产生的更低优先级工作，可以延后到下一批次。
3. flush 期间产生的同等或更高优先级工作，允许并入尾部，但必须保证不会无限重入。

## flush 触发

默认触发方式：

- signal 写入后，如果当前没有已安排批次，就安排一个 microtask flush
- channel 入队后，如果其 lane 高于当前空闲状态，也安排 flush
- resource 返回并通过版本校验后，安排对应 lane 的 flush

禁止：

- 每次写入都立即同步全量 flush
- 每个来源各自维护独立 flush 机制

## flush 阶段

一个标准 flush 分成六段：

1. `ingest`
2. `dedupe`
3. `plan`
4. `compute`
5. `commit`
6. `finalize`

### 1. `ingest`

读取当前批次要处理的：

- dirty binding
- dirty region
- channel message
- resource result

只做收集，不做 patch。

### 2. `dedupe`

对同一批次内重复工作去重。

规则：

- 同一 binding slot 只保留一次
- 同一 region slot 只保留一次结构更新入口
- 同一 resource 只保留当前版本
- 同一 channel message 不自动合并，除非 message type 明确允许折叠

### 3. `plan`

把工作排成稳定顺序。

顺序规则：

1. 先按 lane 排
2. lane 内先 structure，再 data
3. structure 内先 region，再 nested block
4. data 内先 binding，再 channel 派发后的目标更新

### 4. `compute`

只做计算，不做宿主提交。

这一阶段可以：

- 计算 region 状态转移
- 计算 keyed reconcile 计划
- 计算 virtual list 新窗口
- 计算 resource 是否允许提交

这一阶段不应该直接改 DOM。

### 5. `commit`

统一提交 host patch。

提交顺序建议：

1. 必要的结构切换
2. node 插入 / 移除
3. text / attr / prop / style / class patch
4. event 绑定更新

这样可以避免先 patch 旧结构，再切换结构。

### 6. `finalize`

做批次收尾：

- 写回稳定状态
- 清理已消费 dirty
- 释放已完成 disposal 的临时引用
- 决定是否立刻安排下一批次

## Region 协同规则

Scheduler 不决定 Region 该转到哪个状态。

Scheduler 只决定：

- 何时处理某个 Region
- 它属于哪条 lane
- 它与哪些 binding / channel / resource 同批提交

规则：

1. Region 的结构事件先于其内部 binding patch。
2. `CONDITIONAL` 分支切换优先于旧分支内部 patch。
3. `KEYED_LIST` 的 reconcile 先于子项内部 patch。
4. `VIRTUAL_LIST` 的窗口重算先于 cell 重绑定。

## Channel 协同规则

channel 不是立即执行器，而是 scheduler 输入源。

处理顺序：

1. 读取 message
2. 查订阅表
3. 命中目标 Region 或 binding 入口
4. 生成对应 dirty work
5. 并入当前批次或下一批次

规则：

1. channel 只触发显式声明的入口。
2. channel 不能绕过 scheduler 直接 patch。
3. 广播型 message 默认进入 `DEFERRED`，除非调用方显式提升 lane。

## Async Resource 协同规则

resource 返回时，先做版本检查，再进入 scheduler。

流程：

1. 根据 `resourceSlot` 读取当前版本
2. 对比返回结果携带的版本
3. 版本过期则丢弃
4. 版本匹配则进入对应 lane 的 `resourceQueue`

规则：

1. resource 结果不能直接写 DOM。
2. resource 结果不能绕过 lane 排序。
3. 同一 resource 的旧结果必须可丢弃。

## 去重规则

去重不是可选优化，是正确性要求。

至少要保证：

1. 同一批次内，同一 binding slot 只提交一次
2. 同一批次内，同一 region slot 只执行一次结构转移
3. 同一 resource slot 只保留最新版本
4. 同一 channel message 是否折叠，必须由 message type 显式声明

## 饥饿控制

不能让 `BACKGROUND` 永远没机会执行，也不能让后台任务拖慢输入。

建议规则：

1. 单批次设置最大工作量上限
2. 超出的低优先级工作让渡到下一批次
3. 连续多批次只处理高优先级时，插入一次低优先级配额

但注意：

- 饥饿控制只能影响批次切分
- 不能打破 lane 的基本优先级顺序

## 同步 API

调试和测试阶段需要同步入口。

建议保留：

- `flush()`
- `flushLane(lane)`
- `drainBackground()`

语义：

- `flush()` 处理当前所有可执行批次
- `flushLane(lane)` 只处理不高于指定 lane 的工作
- `drainBackground()` 处理后台残留

这些 API 只改变“何时执行”，不改变顺序规则。

## 实现约束

1. Scheduler 热路径少用 `Map`、`Set`
2. 队列优先用数组、位图、环形缓冲区
3. 同 lane 的顺序必须稳定
4. 不能在 commit 阶段重新做依赖推理

## 验证清单

至少覆盖这些测试：

1. 同一 binding 多次写入只提交一次
2. `SYNC_INPUT` 先于 `VISIBLE_UPDATE`
3. `VISIBLE_UPDATE` 先于 `DEFERRED`
4. 旧 resource 结果会被丢弃
5. channel message 不会绕过 scheduler 直接触发 patch
6. Region 结构切换先于内部 binding patch
7. 高频输入下，`BACKGROUND` 不会永久饿死

## 实现顺序

建议实现顺序：

1. 单 lane microtask flush
2. dirty binding 去重
3. dirty region 接入
4. lane 分桶
5. channel 接入
6. resource version 校验
7. 饥饿控制

这样可以先把最短主路径跑通，再逐步补复杂时序。
