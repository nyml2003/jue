# Authoring Grammar Specification

## 目标

这份文档定义 `jue` authoring 层的 **canonical grammar**。

它回答的是：

- 作者代码允许长什么样
- 哪些写法属于正式 grammar
- 哪些只是 future sugar
- compiler/frontend 至少应该围绕什么输入模型收口

这份文档不讨论：

- runtime 热路径布局
- lowering 内部优化
- host adapter 内部实现

## 权威性

这份文档是 authoring grammar 的单一事实源。

如果下面这些文档之间出现冲突：

- `api-draft.md`
- `current-status.md`
- `compiler-strategy.md`

都应以这份 grammar spec 为准，再回头修其他文档。

## 设计立场

`jue` 的 authoring 层分成两层：

1. 逻辑层
2. 模板层

规则是：

- 逻辑层尽量贴近普通严格 TS
- 模板层保持轻量、可静态分析、可稳定 lowering
- 编译器承担复杂归一化工作
- runtime 不为 authoring 便利性回退到隐式依赖收集

一句话：

**逻辑层放宽，模板层收紧，复杂性交给编译器，不推给运行时。**

## 状态分层

这份文档里的规则分三层：

1. `Canonical grammar`
2. `Current guaranteed subset`
3. `Future sugar`

含义：

- `Canonical grammar`
  - 框架长期要收敛到的正式 authoring 语法
- `Current guaranteed subset`
  - 当前 frontend/compiler 应优先保证成立的子集
- `Future sugar`
  - 未来可讨论的人体工学包装，但不能反向改写 canonical grammar

## 一、文件与模块模型

### 1. 源文件形态

authoring 文件使用普通 TSX 模块表达。

当前推荐形态：

- `.component.tsx`

但 grammar 本身不依赖这个扩展名才能成立。

### 2. 正式入口不设语法限制

canonical grammar 不再要求：

- `export function render()`
- `export default function App()`
- 某个固定导出名

也就是说：

- TSX 文件就是普通模块
- 里面可以导出任意数量的组件、函数、常量和类型
- grammar 不靠“哪个导出名”定义根组件

### 3. 根组件由调用方决定

真正会被挂载、编译成页面根、或作为 route/page 入口的组件，由调用方显式决定。

允许的外部决定方式包括：

- `mount(App, root)`
- route/page config 指定组件符号
- 编译入口配置指定组件符号

这里的关键是：

- **根组件选择属于调用方和 toolchain 的职责**
- **不属于 authoring grammar 本身**

### 4. 当前实现差距

当前 frontend/compiler 当前仍保留一层更窄的默认入口习惯。

当前真实情况是：

- 调用方已经可以显式传入 `rootSymbol`
- `export function App()` 和 `export const App = () => ...` 都可以作为根组件
- 但如果调用方不传 `rootSymbol`，当前默认根名仍是 `render`

这层默认值只是：

- `Current guaranteed subset`

而不是 canonical grammar。

## 二、原语命名空间

### 1. 宿主原语

主 grammar 只承认下面这些 PascalCase 宿主原语：

- `View`
- `Text`
- `Button`
- `Input`
- `Image`
- `ScrollView`

它们表达的是宿主无关语义，不是平台标签别名。

### 2. 结构原语

主 grammar 只承认下面这些 PascalCase 结构原语：

- `Show`
- `List`
- `VirtualList`
- `Portal`
- `Boundary`

当前真正进入支持验收主线的仍只有：

- `Show`
- `List`
- `VirtualList`

`Portal / Boundary` 当前只是 grammar 中保留的原语名，不等于已经支持。

### 3. 非 grammar 标签

下面这些都不是主 grammar：

- `div / span / button`
- `view / text / image`
- 宿主私有标签名
- Web DOM 标签全集

如果未来要提供这些写法，只能通过：

- `jue/web-html`
- 或其他明确标记为 convenience layer 的入口

而不能把它们写回 canonical grammar。

## 三、逻辑层语法

### 1. 逻辑层目标

逻辑层应尽量贴近普通严格 TS 模块。

允许：

- `import`
- `export`
- `const`
- `let`
- `function`
- `type` / `interface`
- 普通表达式、条件、局部变量、辅助函数

不鼓励把业务逻辑塞回模板表达式里。

### 2. 仓库级语言纪律

整个前端仓库默认遵守下面这些规则：

1. 禁止 `this`
2. 禁止显式 `any`
3. 作者代码、业务代码、public authoring API 禁显式写 `undefined`

也就是说：

- 不走 class / instance 风格 authoring
- 不把 `any` 当逃生门
- 需要“空值”时优先用 `null`、Option，或省略字段

### 3. `signal`

canonical grammar 里，signal 先固定成显式读写：

```ts
const count = signal(0)

count.get()
count.set(1)
count.update(v => v + 1)
```

这意味着下面这些都不进入 canonical grammar：

- `count.value`
- `count++`
- `count = count + 1`
- `{count}` 裸 signal 插值

### 4. `memo`

`memo` 先固定成显式依赖形式：

```ts
const doubled = memo([count], count => count * 2)

doubled.get()
```

不属于 canonical grammar：

```ts
memo(() => count.get() * 2)
```

### 5. `resource`

`resource` 是正式 authoring 能力，但仍保持显式语法：

```ts
import { Lane } from "jue"

const userResource = resource({
  key: [userId],
  lane: Lane.VISIBLE_UPDATE,
  load: async ([id]) => fetchUser(id.get()),
})
```

规则：

- lane 在 authoring API 里优先使用枚举值
- 不把 `"VISIBLE_UPDATE"` 这类字符串字面量当成推荐写法

## 四、模板层语法

### 1. 模板层目标

模板层不是“能写大部分 JS 的地方”，而是“能静态分析的大部分 UI 表达层”。

它的任务只有：

- 描述结构
- 描述轻量绑定
- 描述事件绑定

### 2. 轻表达式子集

JSX 花括号里的 canonical expression 先固定为轻表达式：

- 标识符
- member access
- optional chaining
- nullish coalescing
- 布尔运算
- 比较运算
- 简单算术
- 三元表达式
- 少量纯调用

推荐：

```tsx
<Text>{count.get()}</Text>
<View class={active.get() ? "on" : "off"} />
<Text>{user.profile?.name ?? "Anonymous"}</Text>
```

不推荐作为模板层主语法：

- 长链复杂表达式
- 带副作用调用
- 需要读很多局部细节才能理解的内联逻辑

规则：

- 复杂逻辑先在脚本区算好
- 模板层只负责消费结果

### 3. 根结构

单个被编译组件的返回结果，在 `Current guaranteed subset` 中先要求单根 JSX。

例如：

```tsx
function Card() {
  return (
    <View>
      <Text>hello</Text>
    </View>
  )
}
```

fragments、根级多节点并列，不属于当前 guaranteed subset。

### 4. 属性绑定

属性绑定允许：

- 静态字面量
- 轻表达式

例如：

```tsx
<View class={active.get() ? "on" : "off"} />
<Image src={avatar.get()} />
```

不属于当前 guaranteed subset：

- spread props
- 任意复杂对象图
- 运行时再推断依赖的表达式

## 五、事件语法

### 1. 事件名

主 grammar 统一使用宿主无关事件名：

- `onPress`
- `onInput`
- `onFocus`
- `onBlur`
- `onScroll`

不把下面这些写回主 grammar：

- `onClick`
- `onChange`
- 宿主私有事件名

### 2. 事件处理器

current guaranteed subset 里，事件处理器优先固定成命名函数引用：

```tsx
function increment() {
  count.update(v => v + 1)
}

<Button onPress={increment} />
```

这样做的目的是先让 compiler/frontend 有稳定主路径，而不是把所有人体工学一次性吃下去。

下面这些不属于 current guaranteed subset：

```tsx
<Button onPress={() => count.update(v => v + 1)} />
```

future sugar 可以讨论 inline arrow，但不能先写成当前正式保证面。

### 3. `Input` payload

`Input` 的 current guaranteed subset 先固定成最小归一化事件对象：

```tsx
function handleNameInput(event: { value?: string }) {
  name.set(event.value ?? "")
}

<Input value={name.get()} onInput={handleNameInput} />
```

也就是说：

- `onInput` handler 参数是事件对象
- 不先把“值直传”写成 canonical grammar

## 六、结构原语语法

### 1. `Show`

结构条件通过 `Show` 表达：

```tsx
<Show when={ready.get()} fallback={<Text>loading</Text>}>
  <Text>done</Text>
</Show>
```

不把下面这些写成 current guaranteed subset：

- 根级 `cond ? <A /> : <B />`
- 多分支隐式 children 兜底

### 2. `List`

一般列表通过 `List` 表达：

```tsx
<List each={todos.get()} by={item => item.id}>
  {item => <TodoRow item={item} />}
</List>
```

硬规则：

1. `each` 必填
2. `by` 必填
3. item render callback 是正式结构的一部分

不把下面这些写法当成 current guaranteed subset：

```tsx
{todos.get().map(item => <TodoRow item={item} />)}
```

### 3. `VirtualList`

长列表通过 `VirtualList` 表达：

```tsx
<VirtualList
  each={rows.get()}
  by={row => row.id}
  estimateSize={44}
  overscan={8}
>
  {row => <Row item={row} />}
</VirtualList>
```

在 current guaranteed subset 里：

- `estimateSize` 先固定成数字
- `overscan` 先固定成数字

更复杂的测量策略留给 future sugar 或后续扩面。

### 4. `Portal` / `Boundary`

这两个名字保留在 canonical grammar 里，但当前不属于支持验收通过项。

这意味着：

- grammar 里可以出现它们的位置
- 现状文档不能把它们写成已支持

## 七、明确禁止的写法

下面这些写法不属于 canonical grammar 或 current guaranteed subset：

1. HTML 标签作为规范本体
2. 小写宿主标签作为规范本体
3. `.value`、裸 signal、赋值运算式 sugar
4. hooks 风格隐式依赖
5. `array.map()` 直接生成主结构
6. spread props
7. 平台 API 直接进入 authoring 文件
8. 全局 signal 充当消息总线
9. 异步结果手动直写宿主节点

## 八、Current Guaranteed Subset

当前仓库里应优先保证成立的 subset 是：

1. 临时 `render()` 入口识别
2. PascalCase 宿主原语
3. `Show / List / VirtualList`
4. signal 的 `.get() / .set() / .update()`
5. 命名函数事件处理器
6. 单根 JSX 返回
7. 轻表达式绑定

也就是说：

- canonical grammar 已经放宽到“普通 TSX 模块 + 调用方决定根组件”
- 但 current guaranteed subset 仍然更窄

当前 frontend/compiler 与 canonical grammar 之间的差距，必须在：

- `current-status.md`
- `compiler-strategy.md`

里明确写成实现差距，而不是写成 canonical grammar。

## 九、Future Sugar

下面这些可以作为 future sugar 讨论，但都不应先于 canonical grammar 成为事实：

- 默认导出入口
- inline event arrow
- 小写标签 sugar
- 更短的 signal 读写语法
- HTML 兼容标签层
- 更复杂的 `VirtualList` authoring 表达

原则：

- sugar 必须能静态 lower 回 canonical grammar
- sugar 不能迫使 runtime 回到隐式依赖收集
- sugar 不能把宿主私有语义写回主规范

## 结论

一句话总结：

`jue` 的 canonical authoring grammar 现在收敛成了：

- **逻辑层尽量接近普通严格 TS**
- **模板层保持轻表达式和结构原语优先**
- **根组件由调用方决定**
- **复杂性主要交给编译器，而不是运行时**
