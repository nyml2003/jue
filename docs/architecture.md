# 架构设计

## 目标

`jue` 的目标是让运行时热路径尽量短、尽量窄、尽量稳定。

这里的“稳定”有两层意思：

- 视图结构尽量稳定。动态变化被限制在 binding 和 region 里。
- 对象 shape 尽量稳定。热对象字段固定，热数据用数组和 TypedArray 表示。

## 总体模型

系统分成五层：

### `packages/reactivity`

职责：

- signal 值存储
- dirty 标记
- batch 调度
- disposal

禁止包含：

- `activeEffect`
- 运行时依赖收集
- DOM API

这里的 `reactivity` 不再负责“读取时自动收集依赖”。依赖边由编译器或构建器显式生成。

### `packages/runtime-core`

职责：

- `Blueprint`
- `BlockInstance`
- binding dispatch
- region 状态
- 特化 region 策略
- channel / port 通信边界
- async scheduler lane
- dirty queue
- commit 顺序
- host renderer contract

禁止包含：

- 具体 DOM API
- 浏览器专用 patch
- 动态依赖推理

### `packages/renderer-dom`

职责：

- DOM 节点创建
- 插入与移除
- text、attr、prop、style、class patch
- 事件绑定
- keyed region 的局部协调原语

禁止包含：

- signal 图
- dirty 判定
- 依赖追踪

### `packages/compiler`

职责：

- 产出声明式 `BlockIR`
- 把 `BlockIR` lower 到 `Blueprint`
- 解析 TSX / JSX
- 静态结构提取
- 生成 slot、binding、region
- 生成 `signalToBindings` 之类的索引表
- 最终产出 `Blueprint`

禁止包含：

- 兜底 vnode runtime
- 隐式依赖收集逻辑

### `packages/shared`

职责：

- opcode
- 内部类型
- 开发期断言
- 调试和性能标记

## 硬规则

### 1. 不做运行时依赖收集

不能存在这类后门：

- `activeEffect`
- “执行表达式时顺便记录依赖”
- “先跑一遍再看读了哪些 signal”

依赖必须在编译期或构建期写成显式边。

### 2. 协调器只看索引，不看语义对象图

热路径里，协调器只关心：

- signal slot
- binding slot
- region slot
- node slot

协调器不应该遍历 AST、vnode 或组件对象。

### 3. 渲染器只执行宿主操作

渲染器只知道：

- patch 什么
- patch 到哪里
- 用什么宿主 API patch

渲染器不应该知道：

- 为什么某个 binding 失效
- 某个 signal 依赖了谁

### 4. 热数据优先用 SoA，不用对象链

热路径的数据布局优先采用 `struct of arrays`：

- `bindingOpcode[]`
- `bindingNodeIndex[]`
- `bindingDataIndex[]`
- `signalToBindingStart[]`
- `signalToBindingCount[]`
- `signalToBindings[]`

不要把热路径建成一堆互相引用的对象。

### 5. 热对象字段一次性定型

`BlockInstance`、`RegionState`、调度队列这类热对象，必须在构造时把字段一次性写全。

禁止：

- 运行时增删字段
- `delete`
- 同一种对象出现多种字段布局

## 运行时单位

运行时的基本单位不是组件，而是 `Block`。

一个 block 有两种形态：

- `BlockIR`：编译期 / 构建期语义层
- `Blueprint`：只读的编译产物
- `BlockInstance`：挂载后的运行时实例

`BlockIR` 负责描述：

- 节点结构
- binding 语义
- 依赖关系
- 未来的 region / channel / resource 语义边界

`Blueprint` 负责描述：

- runtime 热路径需要的扁平布局
- binding opcode
- binding 到 node 的映射
- signal 到 binding 的依赖表
- 参数区
- region 结构

也就是说：

- 语义层在 `BlockIR`
- 执行层在 `Blueprint`
- 两者之间由 lowering 连接

`BlockInstance` 负责保存：

- 真实 DOM 引用
- 当前 signal 值
- 当前 region 状态
- dirty bit
- mount 状态

## 动态工作模型

运行时允许的动态工作只有这几类：

- text patch
- attr patch
- prop patch
- class token patch
- style field patch
- event 绑定
- conditional region 切换
- keyed list 的局部协调
- virtual list region 的窗口更新与节点复用
- channel 消息驱动的显式跨边界更新
- async resource 的受控提交

运行时明确不做：

- 组件重跑
- 通用 subtree rerender
- 广义 diff

## 场景扩展规则

### 长列表不是普通 keyed list

长列表必须作为特化 region 处理，而不是直接套普通 `KEYED_LIST`。

这里至少要多出三类能力：

- 视窗计算
- DOM 节点池与复用
- item slot 的局部重绑定

否则长列表会退化成频繁 mount / unmount，Region 机制本身也会被 DOM 创建和销毁成本吞掉。

### 跨边界通信不能退回全局 signal

跨 Region、跨 Instance 的通信必须显式声明。

允许的方向是：

- `Channel`
- `Port`
- 显式订阅表

不允许的方向是：

- 任意全局 signal 直连
- 靠共享可变对象绕过 slot 边界

### 异步更新必须进入 scheduler 模型

异步请求、定时器、用户输入不是三套独立更新系统。

它们都必须经过统一 scheduler。

但 scheduler 的优先级不应按“任务来源”粗暴决定，而应按“对 UI 的影响类型”决定：

- 输入反馈
- 可见区域更新
- 非可见预取
- 后台刷新

这样才能避免“网络请求天然低优先级”导致的错判。

## V8 友好约束

### 热路径约束

- 热路径少用 `Map` 和 `Set`
- 热路径不用混合 shape 的对象数组
- 热路径避免闭包泛滥
- 热路径优先整数索引访问

### 调度约束

- dirty 标记用 bitset 或定长数组
- flush 用顺序扫描
- binding 分发尽量走稳定 opcode 分派

### 数据布局约束

- Blueprint 扁平化
- Instance 字段固定
- debug 字段与热字段分开
- 能用 TypedArray 的地方优先用 TypedArray

## 成功判据

一次状态写入应当收敛到这条路径：

`setSignal(slot) -> read signalToBindings -> mark dirty -> flush binding slots -> host patch`

如果这条路径里出现了运行时依赖收集、组件重跑或通用 diff，说明架构已经偏离目标。
