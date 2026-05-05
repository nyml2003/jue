# my-demo

`jue` 的独立 mock 登录页示例。

它保留一个最小但完整的浏览器运行链：

- `src/app.component.tsx`：authoring source
- `browser/src/generated/app.generated.ts`：编译产物
- `browser/src/main.ts`：浏览器挂载入口

页面行为：

- 两个输入框：邮箱、密码
- 一个登录按钮
- 一个本地 mock 接口，故意延迟返回
- 成功/失败状态反馈

## 开发

```bash
pnpm run dev:web
```

## 构建

```bash
pnpm run build:web
```
