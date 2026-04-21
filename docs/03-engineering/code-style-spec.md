# 代码规范

## 目标

这份文档定义 `jue` 的实现规范。

目标不是统一格式细节，而是保护已经定下来的架构方向：

- 完全显式依赖追踪
- 编译驱动、表驱动、索引驱动
- 协调器和渲染器严格分层
- 宿主适配层不反向污染主规范
- 热路径对 V8 友好

后续实现如果违反这里的规则，就不是“风格不同”，而是直接偏离架构。

## 规范等级

### 硬规则

必须执行。违反就需要重构，不接受“先这样写起来”。

### 软规则

默认执行。只有在明确收益更高时才允许例外，并且要写清理由。

本文里没有特殊说明的规则，一律按硬规则处理。

## 一、分层边界规范

### 1. `packages/runtime-core`

允许：

- slot graph
- scheduler
- dirty 管理
- binding dispatch
- region 生命周期

禁止：

- 直接调用任何宿主 API
- 写 DOM 专用逻辑
- 写 native 专用逻辑
- 做运行时依赖收集

### 2. `packages/web` / `packages/native` / 其他宿主包

允许：

- 节点创建
- 节点插入和移除
- 属性映射
- 事件桥接
- 样式和布局桥接

禁止：

- 依赖追踪
- dirty 判定
- scheduler lane 决策
- resource 版本控制

### 3. `packages/compiler`

允许：

- 解析 TSX / JSX
- 生成 `Blueprint`
- 生成 slot、binding、region、channel、resource 定义

禁止：

- 宿主 patch 逻辑
- 运行时调度逻辑
- 兜底 vnode runtime

### 4. `packages/shared`

允许：

- 枚举
- 类型
- 常量
- 开发期断言

禁止：

- 状态读写逻辑
- 宿主 API 访问
- runtime 状态机实现

## 二、数据布局规范

### 1. 热路径优先数组化

热路径数据优先使用：

- `Uint8Array`
- `Uint16Array`
- `Uint32Array`
- `Int32Array`
- 稳定类型的普通数组

不优先使用：

- 深层对象图
- `Map`
- `Set`
- 动态形状对象

### 2. 热对象字段必须固定

`BlockInstance`、`SchedulerState`、`RegionState` 这类热对象必须：

- 构造时一次性初始化所有字段
- 后续不增加新字段
- 后续不删除字段

禁止：

- `delete`
- 条件式加字段
- 同一类对象出现多种 shape

### 3. 同类数组元素类型必须稳定

允许：

- `Uint32Array` 全是整数索引
- `Node[]` 全是宿主节点引用
- `unknown[]` 明确作为冷引用区

禁止：

- 一个热数组里混 number、object、function
- 用 `null` / object / number 混合表示不同状态

### 4. 冷热数据分离

热路径数据：

- 当前值
- 索引
- dirty bit
- 生命周期状态
- 队列状态

冷路径数据：

- debug name
- source map
- profiler tag
- 开发期统计

禁止把冷字段挂进热对象主结构。

## 三、命名规范

### 1. 宿主无关原语

统一使用语义名：

- `View`
- `Text`
- `Button`
- `Input`
- `Image`
- `ScrollView`

禁止把 HTML 标签名写成主规范命名。

### 2. runtime / IR 字段

统一使用直接名，不造词：

- `bindingOpcode`
- `bindingNodeIndex`
- `regionLifecycle`
- `resourceVersion`
- `dirtyBindingBits`

禁止：

- 自造缩写词
- 含义不清的双关命名
- “优化版”“增强版”这类悬空名字

### 3. 函数命名

优先动作导向：

- `markDirty`
- `flushLane`
- `dispatchBinding`
- `commitRegionUpdate`
- `applyHostPatch`

禁止：

- `handleStuff`
- `processData`
- `runMagic`

### 4. 缩写规则

允许固定术语缩写：

- `IR`
- `DOM`
- `JSX`
- `V8`

禁止项目内部自己发明缩写。

## 四、响应式与状态规范

### 1. 禁止隐式依赖收集

禁止：

- `activeEffect`
- 读取时自动订阅
- `memo(() => ...)`

所有依赖必须显式进入编译期或构建期结构。

### 2. 派生值必须显式依赖

允许：

```ts
memo([count, price], (count, price) => count * price)
```

禁止：

```ts
memo(() => count.get() * price.get())
```

### 3. 通信必须走 channel

跨边界通信统一走：

- `channel`
- `publish`
- `subscribe`

禁止：

- 全局 signal 直连消息总线
- 共享可变对象偷偷传递状态

### 4. 异步必须走 resource

异步结果进入：

- `resource`
- scheduler lane
- version 校验

禁止请求返回后直接改宿主节点。

## 五、宿主适配规范

### 1. 主规范先于适配层

`jue` 主入口定义语义原语。

`jue/web`、`jue/native` 只负责映射。

禁止：

- 在 adapter 里私自改主语义
- 把宿主私有能力直接写回主入口

### 2. Web 便利层不是主规范

可以有：

- `jue/web`
- `jue/web-html`

但 `jue/web-html` 只能是便利层，不能反过来定义 API 本体。

### 3. 事件名优先跨宿主语义

优先：

- `onPress`
- `onInput`
- `onScroll`

不优先：

- `onclick`
- `touchstart`
- 某宿主私有事件名

## 六、类型规范

### 1. TypeScript 一律严格模式

要求：

- `strict: true`
- 不用 `any`
- 尽量避免不必要的类型断言

### 2. 公共接口必须结构明确

公共类型要明确字段，不返回模糊对象。

优先：

```ts
type ResourceState = {
  status: "idle" | "pending" | "ready" | "error"
  version: number
}
```

不优先：

```ts
type ResourceState = Record<string, unknown>
```

### 3. 状态机优先枚举值

生命周期、lane、opcode、region type 一律使用枚举值或稳定常量。

禁止裸字符串散落在实现里。

### 4. 错误处理优先 Result

默认使用：

```ts
type Result<T, E> =
  | { ok: true; value: T; error: null }
  | { ok: false; value: null; error: E }
```

规则：

- 可预期失败优先返回 `Result`
- 不用 `throw new Error(...)` 作为常规控制流
- `Error` 只留给真正不可恢复、不可继续的进程级异常

## 七、函数与控制流规范

### 1. 热路径函数要短

热路径函数只做一层职责。

例如：

- `dispatchBinding`
- `commitText`
- `computeWindow`

不要写一个函数同时做：

- 状态转移
- 队列处理
- 宿主 patch

### 2. 早返回优先

在 guard 场景下优先早返回，减少多层嵌套。

### 3. 分支条件必须可解释

复杂分支前要能回答：

- 这是谁的职责
- 这个条件在保护什么
- 不满足时为什么应该直接退出

## 八、注释规范

### 1. 注释只写必要信息

允许写：

- 为什么这样做
- 哪个边界不能破
- 哪个状态顺序不能改

不要写：

- 一眼能看懂的代码行为
- 废话式注释

### 2. 热路径代码优先用命名解释，不靠长注释解释

如果一段代码必须靠大段注释才能理解，先改命名和拆函数。

### 3. 边界规则允许写硬注释

例如：

```ts
// Region 结构切换必须先于内部 binding patch，不能交换顺序。
```

这种注释是有价值的。

## 九、文件与目录规范

### 1. 文件命名

优先：

- `signal.ts`
- `region-state.ts`
- `scheduler-queue.ts`
- `host-adapter.ts`

不要用：

- `utils.ts`
- `helpers.ts`
- `misc.ts`

### 2. 目录组织

建议：

- 一个目录只服务一个稳定边界
- runtime、compiler、adapter 不混放

### 3. 测试文件命名

统一：

- `*.test.ts`
- `*.test.tsx`

按边界命名：

- `scheduler.test.ts`
- `region-conditional.test.ts`
- `host-adapter-web.test.ts`

## 十、测试规范

### 1. 每个核心能力都要测两层

- 结构正确性
- 调度顺序正确性

### 2. Region 必测

每种 Region 至少测：

- init
- activate
- update
- dispose

### 3. Scheduler 必测

至少测：

- lane 顺序
- 去重
- 旧 resource 结果丢弃
- channel 不绕过 scheduler
- 背景任务不永久饥饿

### 4. Host adapter 必测

adapter 只测：

- 映射是否正确
- 事件是否归一化
- root / node 是否正确挂载

adapter 不负责测 core 的依赖或调度逻辑。

## 十一、禁止写法清单

下面这些写法直接禁止：

1. 运行时依赖收集
2. 热路径动态 shape 变化
3. adapter 承担 scheduler 职责
4. adapter 承担 reactivity 职责
5. HTML 语义反向定义主规范
6. 全局 signal 充当消息总线
7. 异步结果直写宿主节点
8. `Map` / `Set` 进入最热更新路径
9. `utils.ts` / `helpers.ts` 式杂物文件
10. 大函数同时处理状态、调度、patch 三层职责
11. 用 `throw new Error(...)` 代替可预期失败的 `Result`

## 十二、提交前检查

每次提交前至少确认：

1. 有没有破坏分层边界
2. 有没有引入隐式依赖收集
3. 有没有让热路径 shape 变得不稳定
4. 有没有让 adapter 偷偷承担 core 职责
5. 测试是否覆盖新增边界或状态转移
