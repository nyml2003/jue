# API 草案

## 目标

这份文档定义 `jue` 的作者侧 API。

这里先锁一个关键方向：

`jue` 的作者侧 API 不以 HTML 标签为规范本体。

原因很直接：

- 协调器和渲染器已经明确分离
- 框架目标不只覆盖 Web
- 如果 API 直接建立在 `div / span / button` 之上，Web 会变成事实标准，其他宿主只能被迫兼容 DOM 语义

所以 API 必须先定义宿主无关原语，再定义各宿主适配层。

## 三层 API

作者侧 API 分三层：

1. 核心协调层
2. 结构原语层
3. 宿主原语层

### 1. 核心协调层

负责状态、通信、异步和生命周期。

包含：

- `signal`
- `memo`
- `batch`
- `resource`
- `channel`
- `publish`
- `subscribe`
- `mount`
- `onMount`
- `onDispose`

### 2. 结构原语层

负责结构性动态。

包含：

- `Show`
- `List`
- `VirtualList`
- `Portal`
- `Boundary`

### 3. 宿主原语层

负责描述跨平台可映射的 UI 语义。

第一版先假定最小集合：

- `View`
- `Text`
- `Button`
- `Input`
- `Image`
- `ScrollView`

这些不是“样式系统组件”，而是宿主无关的 UI 原语。

## 模块入口

规范层入口：

```ts
import {
  signal,
  memo,
  batch,
  resource,
  channel,
  publish,
  subscribe,
  mount,
  onMount,
  onDispose,
  Show,
  List,
  VirtualList,
  Portal,
  Boundary,
  View,
  Text,
  Button,
  Input,
  Image,
  ScrollView,
} from "jue"
```

TSX 运行时入口：

```ts
import { jsx, jsxs, Fragment } from "jue/jsx-runtime"
```

Web 适配层入口：

```ts
import { View, Text, Button } from "jue/web"
```

未来可以继续有：

- `jue/native`
- `jue/canvas`
- `jue/terminal`

## 宿主原语

### 设计原则

宿主原语不是直接等价于某个平台标签。

它们表达的是跨宿主语义：

- `View`：容器
- `Text`：文本承载
- `Button`：可触发动作的控件
- `Input`：可编辑输入
- `Image`：图像资源
- `ScrollView`：可滚动容器

渲染器负责把这些语义原语映射到对应宿主。

例如：

- Web renderer
  - `View -> div`
  - `Text -> span / text node`
  - `Button -> button`
- Native renderer
  - `View -> native view`
  - `Text -> native text`
  - `Button -> native button`

## 核心协调层 API

### `signal`

用途：

- 保存可变状态

草案：

```ts
const count = signal(0)

count.get()
count.set(1)
count.update(v => v + 1)
```

约束：

- 作者侧只使用 `get / set / update`
- 编译器把读取点和写入点映射到 slot
- 运行时不在 `get()` 时做依赖收集

### `memo`

用途：

- 表达派生值

草案：

```ts
const doubled = memo([count], count => count * 2)

doubled.get()
```

约束：

- 依赖必须显式传入
- 不支持 `memo(() => ...)`

### `batch`

用途：

- 把多次同步写入合并进一个批次

草案：

```ts
batch(() => {
  count.set(1)
  total.set(2)
})
```

### `resource`

用途：

- 把异步数据纳入 lane 和版本控制

草案：

```ts
const userResource = resource({
  key: [userId],
  lane: "VISIBLE_UPDATE",
  load: async ([id]) => fetchUser(id.get()),
})
```

读取：

```ts
userResource.status()
userResource.value()
userResource.error()
userResource.reload()
```

约束：

- `key` 决定失效边界
- `lane` 决定提交优先级
- 返回结果进入 scheduler，不直接写宿主

## Result 语义

公开 API 和内部主路径默认优先 `Result`。

基础形状：

```ts
type Result<T, E> =
  | { ok: true; value: T; error: null }
  | { ok: false; value: null; error: E }
```

适用场景：

- `resource`
- `channel`
- host adapter
- compiler

原则：

- 可预期失败返回 `Result`
- 不用 `throw` 当普通控制流

### `channel`

用途：

- 建立显式跨边界通信通道

草案：

```ts
const saveDone = channel<{ id: string; ok: boolean }>("saveDone")
```

### `publish`

用途：

- 向 channel 发送消息

草案：

```ts
publish(saveDone, { id, ok: true }, { lane: "DEFERRED" })
```

### `subscribe`

用途：

- 显式订阅 channel

草案：

```ts
subscribe(saveDone, message => {
  toast.set(message.ok ? "saved" : "failed")
})
```

约束：

- channel 只传消息，不开放共享可变状态
- 不支持“任意全局 signal 充当消息总线”

### `mount`

用途：

- 把根视图挂到指定宿主容器

草案：

```ts
mount(() => <App />, root)
```

可选项：

```ts
mount(() => <App />, root, {
  lane: "VISIBLE_UPDATE",
})
```

说明：

- `root` 的具体类型由宿主 adapter 决定
- Web 是 DOM 容器
- Native 是原生容器句柄

### `onMount`

用途：

- 注册挂载后的副作用

草案：

```ts
onMount(() => {
  console.log("mounted")
})
```

### `onDispose`

用途：

- 注册当前 block / region 的清理逻辑

草案：

```ts
onDispose(() => {
  stopTimer()
})
```

## 结构原语层 API

### `Show`

用途：

- 表达条件 Region

草案：

```tsx
<Show when={ready.get()} fallback={<Text>loading</Text>}>
  <Content />
</Show>
```

映射：

- `CONDITIONAL`

### `List`

用途：

- 表达一般 keyed list

草案：

```tsx
<List each={todos.get()} by={item => item.id}>
  {item => <TodoRow item={item} />}
</List>
```

映射：

- `KEYED_LIST`

约束：

- `by` 必填
- 优先表达普通列表，不处理超长视窗问题

### `VirtualList`

用途：

- 表达超长列表

草案：

```tsx
<VirtualList
  each={rows.get()}
  by={row => row.id}
  estimateSize={row => 44}
  overscan={8}
>
  {row => <Row item={row} />}
</VirtualList>
```

映射：

- `VIRTUAL_LIST`

约束：

- `by` 必填
- 应提供尺寸估计
- 窗口计算和节点复用由运行时负责

### `Portal`

用途：

- 把内容渲染到另一个宿主挂载点

草案：

```tsx
<Portal target={overlayRoot}>
  <Dialog />
</Portal>
```

### `Boundary`

用途：

- 作为错误、异步或隔离边界

草案：

```tsx
<Boundary fallback={<Text>failed</Text>}>
  <Content />
</Boundary>
```

## 宿主原语层 API

### `View`

用途：

- 表达通用容器

草案：

```tsx
<View direction="column" gap={12}>
  <Text>hello</Text>
</View>
```

建议 props：

- `id?`
- `class?` 或宿主等价物
- `style?`
- `direction?`
- `gap?`
- `align?`
- `justify?`
- `onClick?` 或宿主等价事件

注意：

- 这里只是作者侧草案，不代表这些 props 都会下沉成统一运行时字段
- 宿主 adapter 可以裁剪或扩展

### `Text`

用途：

- 承载文本和行内内容

草案：

```tsx
<Text weight="bold">{title.get()}</Text>
```

### `Button`

用途：

- 触发动作

草案：

```tsx
<Button onPress={() => save()}>
  <Text>Save</Text>
</Button>
```

说明：

- 事件名优先走跨宿主语义，如 `onPress`
- Web adapter 可以把它映射到 `click`

### `Input`

用途：

- 表达输入控件

草案：

```tsx
<Input
  value={name.get()}
  onInput={value => name.set(value)}
  placeholder="name"
/>
```

### `Image`

用途：

- 表达图像资源

草案：

```tsx
<Image src={avatar.get()} fit="cover" />
```

### `ScrollView`

用途：

- 表达可滚动容器

草案：

```tsx
<ScrollView direction="vertical">
  <VirtualList ... />
</ScrollView>
```

说明：

- `VirtualList` 不强依赖 `ScrollView`
- 但滚动宿主通常需要显式表达

## Web 适配层

Web 不是规范本体，但可以有兼容适配层。

### `jue/web`

用途：

- 提供宿主原语到 DOM 的标准映射

例如：

- `View -> div`
- `Text -> span / text node`
- `Button -> button`
- `Input -> input`
- `Image -> img`
- `ScrollView -> div[overflow]`

### `jue/web-html`

这是可选层，不是规范本体。

可以考虑提供 HTML 标签兼容入口：

```tsx
import { div, span, button } from "jue/web-html"
```

或者 TSX 标签兼容模式。

但这层的定位只能是：

- Web 便利层

不能反过来定义主 API。

## 推荐写法

### 推荐 1：状态和结构都写显式边界

```tsx
const count = signal(0)
const doubled = memo([count], count => count * 2)

<Show when={count.get() > 0} fallback={<Text>zero</Text>}>
  <Text>{doubled.get()}</Text>
</Show>
```

### 推荐 2：普通列表和长列表分开写

```tsx
<List each={items.get()} by={item => item.id}>
  {item => <Row item={item} />}
</List>
```

```tsx
<VirtualList each={rows.get()} by={row => row.id} estimateSize={() => 40}>
  {row => <Row item={row} />}
</VirtualList>
```

### 推荐 3：跨边界通信只走 channel

```ts
const closeDialog = channel<void>("closeDialog")
publish(closeDialog, undefined, { lane: "VISIBLE_UPDATE" })
```

### 推荐 4：异步只走 resource

```ts
const todosResource = resource({
  key: [filter],
  lane: "VISIBLE_UPDATE",
  load: async ([filter]) => fetchTodos(filter.get()),
})
```

## 明确不支持

### 1. HTML 标签作为规范本体

不把这些写法当主规范：

```tsx
<div>
  <span />
  <button />
</div>
```

Web 可以兼容，但主规范不是它。

### 2. hooks 风格隐式依赖

不支持：

```ts
const doubled = memo(() => count.get() * 2)
```

### 3. 运行时任意 map children

草案阶段不保证支持：

```tsx
{items.get().map(item => <Row item={item} />)}
```

优先使用 `List` 或 `VirtualList`。

### 4. 全局 signal 直连通信

不支持：

```ts
export const bus = signal(null)
```

然后在任意地方把它当消息总线。

### 5. 异步结果手动直写宿主

不支持：

```ts
fetchUser(id).then(user => {
  nativeNode.setText(user.name)
})
```

## 最小例子

```tsx
import {
  signal,
  memo,
  resource,
  mount,
  Show,
  List,
  View,
  Text,
  Button,
} from "jue"

function App() {
  const count = signal(0)
  const total = memo([count], count => count * 2)

  const todos = resource({
    key: [count],
    lane: "VISIBLE_UPDATE",
    load: async () => fetchTodos(),
  })

  return (
    <View direction="column" gap={12}>
      <Button onPress={() => count.update(v => v + 1)}>
        <Text>+</Text>
      </Button>

      <Text>{count.get()}</Text>
      <Text>{total.get()}</Text>

      <Show when={todos.status() === "ready"} fallback={<Text>loading</Text>}>
        <List each={todos.value()} by={item => item.id}>
          {item => <Text>{item.title}</Text>}
        </List>
      </Show>
    </View>
  )
}

mount(() => <App />, root)
```

## 待定问题

下面这些问题留到下一轮收敛：

1. 宿主原语的最小集合是否还要更小
2. `Button` 是否保留 children 形式，还是改成 `label`
3. `Input` 的事件名是否统一成 `onInput` 或 `onChangeText`
4. `Portal` 和 `Boundary` 是否进入第一版实现
5. Web 兼容层是否提供 HTML 标签直写模式
