# jue-current-app

这是一个放在 `examples/isolated/jue-current-app` 下的**独立 jue 项目**，用来展示“如果今天单独用 jue 开发，一个最小项目是什么样”。

## 隔离方式

- 它不在 `examples/*` 的 workspace 命中范围里，因为目录是嵌套的。
- 它不参与 `examples/web-playground` 的 build、test、preview。
- 它有自己的 `package.json`、`tsconfig.json`、`vite.config.ts` 和本地 compile 脚本。
- 它只通过本项目自己的 alias 指向仓库里的 `@jue/*` 源码，不复用 playground 的 app glue。

## 当前开发流

1. 写 authoring 文件：
   `src/app.component.tsx`
2. 显式编译：
   `pnpm run compile`
3. 生成 compiled module：
   `src/generated/app.generated.ts`
4. 在入口里创建 runtime 实例并挂载：
   `src/main.ts`

这就是当前最真实的 jue 开发体验：

- TSX authoring 已经可用
- 需要显式 compile 一步
- 入口需要 `createRuntime() + mountCompiledModule(...)`
- 现在这份例子会把**同一个 compiled module 挂两次**，用来证明 per-mount runtime 已经隔离

## 命令

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

说明：

- 这个项目的目录、脚本和构建链已经独立。
- 但仓库根目录本身有 `pnpm-workspace.yaml`，所以如果你在这里直接跑 `pnpm install`，包管理器仍可能往上捡到根 workspace。
- 想看“把它当成一个独立 jue 项目来跑”的真实体验，当前更稳的是直接用 `npm`。

## 这个项目故意展示的能力

- `signal()` 驱动文本和状态
- `Button` 事件处理
- `Show` 条件分支
- 同一份 compiled module 多实例挂载

## 还没有试图包装掉的粗糙处

- compile 仍是显式脚本，不是无感 dev pipeline
- 没有 props / 路由 / query / list 这种更高阶的 authoring 体验演示
- `src/generated/app.generated.ts` 仍然是你会直接看到的产物
