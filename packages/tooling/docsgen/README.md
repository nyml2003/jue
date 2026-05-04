# `@jue/docsgen`

文档生成器。负责从 workspace 状态生成 Support Matrix、Example Registry、Core Spec Index、Monorepo 拓扑报告和包大小报告。

## CLI

```bash
pnpm docsgen                  # 生成所有文档（status + topology + sizes）
pnpm docsgen topology --check # 校验 topology registry
pnpm docsgen topology --write # 写 topology 报告到 docs/
pnpm docsgen sizes            # 打印包大小报告
```
