# 实现方案

## 目标

这份文档不是愿景 roadmap，也不是阶段口号。

它只回答一个问题：

**基于当前真实代码实现，`jue` 接下来到底要怎么改，才能把现有文档目标收口成可交付系统。**

这里的判断以当前仓库里的真实实现为准，不沿用旧计划里的阶段叙事。

## 当前实现基线

当前代码已经成立的东西：

1. `BlockIR -> lowering -> Blueprint -> runtime-core -> web host` 主链存在。
2. `Show / List / VirtualList` 已经有最小 compiler lowering 和 runtime path。
3. `router / query / stream` 已经有独立包和运行时 API。
4. examples 已经能走 `.component.tsx -> generated/page.generated.ts -> mount` 这条真实链路。

当前代码还明显没收口的地方：

1. compiler frontend 已经支持显式 `rootSymbol`，但默认根名和一部分 examples 仍带 `render()` 历史心智。
2. authoring grammar 已经放宽成“普通 TSX 模块 + 调用方决定根组件”，但 frontend 还没吃下去。
3. 模板表达式、事件处理器、结构原语支持面仍然偏 compiler-safe subset。
4. `router / query / stream` 还没有真正进入 authoring 主路径，而是停在 runtime API 层。
5. 文档已经开始按 canonical grammar 描述系统，但代码仍大量锁定在旧约束上。

## 当前代码与目标文档的关键差距

### 1. 入口模型不一致

文档已经收口成：

- authoring 文件是普通 TSX 模块
- 根组件由调用方决定

但当前代码仍然残留一部分旧世界：

- 未显式指定 `rootSymbol` 时，默认根名仍是 `render`
- 一部分 examples / scripts 还沿用 `render()` 作为默认根
- 文档里还有少量“render-only canary”残留说法

这意味着：

- frontend 已经不再是严格 render-only 的编译器
- 但入口模型还没有从“兼容旧世界”彻底收干净

### 2. signal authoring 面曾经不一致

文档已经收口成：

- authoring 层统一使用 `signal().get/set/update`

这条差距现在已经被消掉：

- `signal()` 返回真实对象
- `@jue/jsx` 已经不再把 `createSignal()` 暴露成正式作者 API
- compiler/frontend 已经围绕 `signal()` 收口

后续要继续守住的是：

- 不重新引入第二套作者侧状态入口
- 不重新接受裸 signal 读取 sugar

### 3. 逻辑层和模板层边界还没真正落地

文档现在的方向是：

- 逻辑层尽量贴近普通严格 TS
- 模板层维持轻表达式子集

但当前 frontend 实现还没有形成这套边界：

- 很多能力是“恰好支持了几种 AST”
- 而不是“明确支持一组 grammar，明确拒绝另一组 grammar”

### 4. stdlib 还停在“可用 API”，没进 authoring 主路径

当前 `router / query / stream` 包确实存在。

但它们当前更像：

- runtime helpers
- page-level glue helpers

还不是：

- compiler 能识别
- authoring grammar 能自然表达
- generated/runtime 能自动接住

### 5. examples 还在证明旧世界

当前 examples 能证明很多局部能力成立。

但它们大量仍在证明：

- `render()` 入口
- generated module 显式可见
- page-level mount glue

这和文档已经定下来的 canonical grammar 仍有偏差。

## 新的实现主线

后续实现不再按“Phase 1/2/3”切任务，而按下面五条主线推进。

### 一、先把 authoring 输入模型收口

目标：

- frontend 真正接受“普通 TSX 模块 + 调用方决定根组件”

要做的事：

1. 收掉 `render()` 作为默认根名的历史心智。
2. 编译入口改成显式接收根组件符号或外部配置。
3. 让 compiler 错误模型围绕“找不到指定根组件”“根组件返回结构不合法”展开，而不是“缺 render()”。
4. examples 和 authoring-check 跟着切到新入口模型。

完成标志：

- frontend 不再依赖固定导出名
- `render()` 只作为旧夹具或默认示例存在，而不是主路径心智

### 二、把 signal authoring 面统一成一套

目标：

- 只保留一套作者侧 signal 心智

要做的事：

1. 保持 `signal()` 作为唯一正式作者 API。
2. 不再把 `createSignal()` 重新引回 `@jue/jsx` 作者入口。
3. 让 compiler/frontend、examples、api draft、inspect 输出、generated runtime bridge 继续围绕同一套 signal API。

完成标志：

- 作者不需要理解两套 signal 入口
- compiler/frontend 不再同时照顾两种 authoring 信号源

### 三、把模板层 grammar 明确实现出来

目标：

- 模板层支持面不再是散乱特判，而是一套可解释的 grammar

要做的事：

1. 把轻表达式子集系统化实现。
2. 把不支持的模板表达式统一转成稳定错误，而不是 AST 漏网行为。
3. 继续只把复杂逻辑留在脚本区，不把模板层放宽成“任意 JS”。
4. 事件处理器先稳定支持命名函数引用，再决定是否引入 inline arrow sugar。
5. `List / VirtualList / Show` 的模板约束统一进 frontend。

完成标志：

- frontend 支持面能直接映射到 grammar spec
- 一个 authoring 例子能明确判断“支持 / 不支持 / 为什么”

### 四、把 stdlib 接进 authoring 主路径

目标：

- `router / query / stream` 不再只是 runtime 包，而是真正 authoring 能力

要做的事：

1. 先定义 authoring 层到底如何声明 route/query/stream 使用点。
2. 再决定这些能力是：
   - compiler 直接识别
   - 还是通过 canonical authoring API 间接 lower
3. 把 generated/runtime glue 从 page 级业务拼装收回到官方路径。
4. examples 改成“作者只写 TSX + canonical API”，不再靠页面级 glue 证明支持。

完成标志：

- `router-query-lab`、`stream-lab` 这类例子能走 authoring 主路径
- 没有业务级 glue 也能证明能力成立

### 当前进展补充

模板宿主这条线现在已经有了一个最小雏形：

- `packages/skyline` 已新增
- 已能把 `BlockIR` lower 成最小 Skyline artifact
- 已能从 `TSX source -> Skyline artifact`
- 已明确把 `@jue/skyline` 收成 **Node 侧 compile-time package**
- 已有 `examples/mobile/jue-mobile-showcase` 证明：
  - 同一份 authoring source 可生成 browser compiled module
  - 同一份 authoring source 可生成微信小程序 scaffold
- 当前只覆盖：
  - 静态节点模板
  - text / prop / style 绑定计划
  - `Show` 条件 region metadata
  - `List` keyed-list region metadata

当前示例生成物已经包含：

- `project.config.json`
- `miniprogram/app.js / app.json`
- `pages/showcase/index.js / .wxml / .wxss / .json`
- generated artifact data

这一步证明的是：

- 模板宿主路线已经从“文档方向”变成了“真实 compile-time backend”

但它还没有证明：

- 小程序交互 runtime 已完成
- `setData` bridge 已完成
- 事件主路径已经成立

这还不是完整小程序支持，但它已经把“模板宿主后端必须独立存在”这条架构路线从文档落到了代码。

### 五、最后再清 examples / docs / tooling

目标：

- 让 examples 和文档证明的是新系统，不是旧输入模型

要做的事：

1. examples 全部按新 authoring 入口和新 grammar 收口。
2. docsgen / inspect / authoring-check 输出围绕新 canonical grammar 和当前 guaranteed subset 更新。
3. 只保留“现状差距”说明，不再保留旧 roadmap 口径。

完成标志：

- 文档、示例、compiler 行为三者一致
- 新读者不会再看到两套 authoring 世界

## 实现顺序

推荐严格按下面顺序做：

1. frontend 入口模型重构
2. signal authoring API 合并
3. 模板 grammar 实现与错误模型重写
4. stdlib authoring 接入
5. examples 回归面重写
6. docsgen / authoring-check / inspect 收口

原因：

- 不先拆 `render()`，后面的 grammar 和 stdlib 接入都会继续被旧入口绑住
- 不先统一 signal，后面的 authoring API 都会继续两套心智并存
- 不先稳定模板 grammar，examples 和 docs 只会继续漂

## 验收标准

新的实现方案完成后，至少要满足下面这些条件：

1. compiler/frontend 可以处理普通 TSX 模块，不依赖固定导出名。
2. 根组件由调用方显式指定。
3. authoring 只暴露一套 signal 心智。
4. 模板 grammar 支持面和错误模型与文档一致。
5. `router / query / stream` 至少有一条真正零业务 glue 的 authoring 主路径。
6. examples 证明的是新路径，不是旧 glue。
7. docs 不再需要用“future grammar vs current render-only reality”解释核心入口冲突。

## 明确不做

这份实现方案里，暂时不把下面这些放进主线：

1. SSR / hydration
2. React 兼容层
3. 小写宿主标签主语法
4. 复杂模板表达式完全开放
5. `Portal / Boundary` 先行补完

这些东西现在只会继续放大主路径噪音。

## 结论

一句话总结：

`jue` 现在最需要的不是继续补更多包面，也不是继续画 Phase 图，而是把 **普通 TSX 模块输入、统一 signal 心智、模板 grammar、stdlib 主路径接入** 这四件事真正打通。

这才是把文档目标收成真实框架的最短路径。
