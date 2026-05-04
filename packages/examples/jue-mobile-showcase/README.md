# jue-mobile-showcase

这个示例证明一件事：

- 同一份 `TSX` authoring source
- 可以编译给浏览器用
- 也可以编译成微信小程序侧的 skyline scaffold

## 结构

- `src/app.component.tsx`
  共享 authoring source
- `src/mobile.css`
  共享视觉样式源
- `browser/`
  浏览器侧入口和 generated module
- `miniprogram/`
  生成出来的小程序 page scaffold
- `scripts/`
  两个 target 的编译脚本

## 命令

```bash
pnpm run compile:web
pnpm run compile:mp
pnpm run compile
pnpm run lint:generated
pnpm run build:web
pnpm run typecheck
```

## 当前边界

- 浏览器侧是可跑的
- 小程序侧当前是 **compile-time scaffold**
- `page.ts / page.wxml / page.wxss / artifact.json` 会生成出来
- 但这还不是完整微信工程，也还没有事件 bridge

也就是说：

- 这份示例已经能证明 `authoring -> browser` 和 `authoring -> skyline artifact`
- 还没有试图把它包装成“直接发布到微信开发者工具就能交互运行”的完整产品壳

## 怎么看 Web

```bash
pnpm --dir packages/examples/jue-mobile-showcase run dev:web
```

然后打开终端里 Vite 打印出来的本地地址。

## 怎么看微信小程序

1. 先生成小程序产物：

```bash
pnpm --dir packages/examples/jue-mobile-showcase run compile:mp
```

2. 打开微信开发者工具
3. 选择“导入项目”
4. 项目目录指向：

`packages/examples/jue-mobile-showcase`

5. 这个工程的 `project.config.json` 会把真正的小程序根目录指向：

`miniprogram`

当前生成出来的页面入口是：

`miniprogram/pages/showcase/index.*`

说明：

- 这些文件都是脚本生成的，不是手写 page scaffold
- 目前它更像“可打开的静态 skyline scaffold”
- 还没有补事件 bridge，所以现在主要看结构、样式和初始数据，不看交互
