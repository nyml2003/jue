# 编译策略

## 编译器现在承担什么职责

在新的共识里，编译器不只是做静态提取。

它还要负责把依赖关系写死。

也就是说，编译器要把作者侧代码转成这几类东西：

- 静态结构
- binding opcode
- signal slot
- binding slot
- region slot
- channel slot
- async resource slot
- signal 到 binding 的显式依赖表

如果这部分不在编译期完成，运行时就会被迫回到动态推理模型。

## 输入表面

第一阶段继续用 TSX / JSX。

原因不变：

- 作者迁移成本低
- 容易直接对比现有框架
- 方便用同类 demo 做 benchmark

但输出语义必须和 React 不同。

作者写的是 TSX，编译器生成的是 slot graph 和 block blueprint，不是组件 rerender 逻辑。

## 输出契约

编译器输出的是 `Blueprint`。

`Blueprint` 至少要包含：

- 静态 fragment
- binding opcode 数组
- binding 到 node 的映射
- binding 参数表
- `signalToBindingStart`
- `signalToBindingCount`
- `signalToBindings`
- channel 订阅定义
- async resource 定义
- region 定义

重点不是“能不能渲染”，而是“运行时能不能只靠这些表完成更新”。

## 显式依赖生成

编译器必须把依赖边写成显式结构。

例如：

```tsx
<div class={active ? "on" : "off"}>{count}</div>
```

编译后的目标不是“运行时执行表达式，再收集依赖”，而是类似这样的结果：

- `signal active -> slot 0`
- `signal count -> slot 1`
- `binding classExpr -> slot 0`
- `binding text -> slot 1`
- `signalToBindings[0] = [classExpr]`
- `signalToBindings[1] = [text]`

这样 `setSignal(1)` 时，运行时只会命中文本 binding。

## 静态提取规则

编译器仍然应该激进地 hoist：

- 纯静态元素结构
- 静态 attribute
- 静态文本
- 不可变子树模板

但现在还要做另一件事：

- 把动态点压平到 slot 和表里

这两个目标必须一起成立。

## 不支持模式策略

如果某种写法会迫使系统退化到以下任一模式，就不要默认支持：

- 运行时依赖收集
- 通用 subtree rerender
- 不透明 children 兜底
- 无法提前分配 slot 的动态结构
- 依赖隐式全局通信的状态流

这类写法要么报错，要么明确放到未来设计里，不要在第一版偷偷兼容。

## 与 Runtime 的集成契约

IR 契约应该由 `runtime-core` 定义，编译器严格消费。

这样可以把这些东西固定下来：

- opcode 枚举
- slot 规则
- region 结构
- patch 参数格式
- `Blueprint` 字段顺序

这样做有两个直接好处：

1. 编译输出更稳定，适合做 snapshot test
2. 运行时数据布局更容易优化到 V8 友好的形态

## 对 V8 友好的输出要求

编译器输出不能只考虑语义，还要考虑运行时布局。

建议优先产出这类结构：

- `Uint8Array` 保存 opcode
- `Uint32Array` 保存 node index、binding index、slot index
- 平行数组保存参数
- 顺序表保存依赖边

尽量不要让运行时再把编译结果转换成一层新的对象图。

## 第一阶段编译器目标

第一阶段只需要证明这几件事：

- 静态节点 hoist
- 文本 binding 降级
- class / prop / style binding 降级
- event binding 降级
- 一个 conditional region
- 一个 keyed list region
- 一张可执行的 `signalToBindings` 表

只要这些东西能稳定输出，运行时主路径就已经成立了一半。

## 第二阶段编译器目标

在主路径稳定后，再补三类输出：

- `virtual list region` 标记与元数据
- channel / port 订阅定义
- async resource slot 定义

这里的重点不是把策略写死在编译结果里，而是：

- 编译器先把边界和 slot 固定下来
- 运行时再在这些边界内执行窗口计算、消息消费和异步确认
