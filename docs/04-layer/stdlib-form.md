# `@jue/form`

## 目标

`@jue/form` 是 `jue` 官方 stdlib 里的表单状态层。

它解决的是：

- field state 怎么组织
- validation 怎么进入统一调度
- submit lifecycle 怎么显式建模
- dirty / touched / error / pending 怎么稳定表达

它不解决：

- 表单布局
- 控件库
- schema 标准本体

## 为什么它不进 kernel

表单模型天然是策略层：

- 字段注册方式
- 校验时机
- submit 流程
- error 聚合方式

这些都存在大量合理变化，不该变成 kernel 不变量。

## 包含什么

- 字段注册
- 值管理
- 同步 / 异步校验
- submit lifecycle
- dirty / touched / error / pending 状态
- lane-aware 验证与提交
- 显式结果分发

## 不包含什么

- 表单布局
- 样式系统
- 控件库
- router
- transport client
- host adapter
- 全局状态总线
- 隐式依赖收集

## 和 `jue` 其他层的关系

### 与 kernel

form 应建立在：

- `signal`
- `memo`
- `resource`
- `channel`
- `lane`

之上运作。

校验和提交流程都要继续遵守 scheduler，不能绕过 kernel。

### 与 host layer

host 只负责：

- 输入事件归一化
- 焦点 / blur 等宿主细节

form 层只负责状态模型。

### 与 tooling

tooling 可以：

- inspect field state
- trace submit lifecycle
- bench 验证 / 提交路径

但不应定义 form 语义。

## 最小 API 草案

建议先有：

- `createForm(...)`
- `field(name)`
- `registerField(name)`
- `validateField(name)`
- `validateForm()`
- `submit(options?)`
- `dirty`
- `touched`
- `errors`
- `pending`

## 使用例子

下面的例子是边界草案，不是当前仓库里已经存在的 API。

### 例 1：创建 form

```ts
const form = createForm({
  lane: "VISIBLE_UPDATE",
  initialValues: { email: "", password: "" },
  onSubmit: async values => saveAccount(values)
})

form.field("email").set("a@b.com")
await form.submit()
```

### 例 2：提交成功后发 channel

```ts
const formSaved = channel<{ id: string }>("formSaved")

await form.submit({
  lane: "VISIBLE_UPDATE",
  onSuccess: value => publish(formSaved, value, { lane: "VISIBLE_UPDATE" })
})
```

### 例 3：显式校验

```ts
const form = createForm({
  lane: "VISIBLE_UPDATE",
  validate: async values => ({
    email: values.email.includes("@") ? null : "invalid email"
  })
})

await form.submit({ lane: "DEFERRED" })
```

## 明确边界

`@jue/form` 不应该偷偷长成：

- app framework
- schema framework
- UI component library

它应该只负责“表单状态与流程”，不负责“表单长什么样”。

## 阶段判断

- 所属层：Official Standard Library
- 阶段：Phase 3
- 优先级：中低

推进前提：

- query / router / primitives 基本稳定
- authoring 和 host 输入边界已经足够清楚
