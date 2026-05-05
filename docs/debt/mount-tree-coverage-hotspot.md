# mount-tree coverage hotspot

`packages/host/web/src/mount-tree.ts` 目前把这些职责压在一个文件里：

- host tree 挂载/卸载
- conditional/nested/keyed/virtual 四类 region 生命周期
- 子树创建、重排、回滚、失败清理
- range mount/dispose

结果是：

- 文件体量过大，单文件覆盖率门槛容易长期卡在这里
- 很多错误分支只能通过非常绕的集成测试命中
- 一处改动很容易同时影响多个不相干的生命周期分支

如果后续决定动代码，建议优先考虑：

- 把 `nested` / `keyed-list` / `virtual-list` 的挂载与回滚逻辑拆到独立模块
- 把 `mountRange` / `disposeRange` / anchor/root 解析辅助函数拆出
- 让回滚辅助函数有更直接的单元测试入口，而不是只能经由 `mountTree()` 端到端触发
