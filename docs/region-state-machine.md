# Region 状态机

## 目标

这份文档把 Region 从“一个抽象概念”落成可实现的状态机。

要解决三件事：

- 明确 Region 什么时候创建、激活、更新、销毁
- 明确不同 Region 类型的行为差异
- 明确哪些状态转移必须触发 patch、依赖切换和 disposal

这里的状态机不是为了把模型做复杂，而是为了防止后续实现时把 Region 写成一堆临时分支。

## 基本定义

Region 是结构性动态边界。

它的职责不是承载所有业务逻辑，而是承载这三件事：

1. 限定动态结构的边界
2. 限定局部依赖和局部 patch 的作用范围
3. 提供可清理的生命周期

Region 必须是局部可解释的。父 Block 不应该因为某个 Region 的局部变化而退回全量重算。

## 通用 Region 状态

所有 Region 都共享一层通用生命周期。

### 状态

- `UNINITIALIZED`
  - 还没有分配运行时状态
- `INACTIVE`
  - Region 已有状态槽位，但当前没有激活内容
- `ACTIVE`
  - Region 当前有可见内容，且局部依赖已接入
- `UPDATING`
  - Region 正在处理局部切换、局部协调或窗口更新
- `DISPOSING`
  - Region 正在释放局部状态、事件和 DOM 引用
- `DISPOSED`
  - Region 已彻底不可用，只能重新初始化

### 通用事件

- `INIT`
- `ACTIVATE`
- `UPDATE`
- `DEACTIVATE`
- `DISPOSE`
- `REINIT`

### 通用转移

| 当前状态 | 事件 | 下一状态 | 结果 |
| --- | --- | --- | --- |
| `UNINITIALIZED` | `INIT` | `INACTIVE` | 分配 Region 槽位，写入初始状态 |
| `INACTIVE` | `ACTIVATE` | `ACTIVE` | 创建局部内容，接入局部依赖 |
| `ACTIVE` | `UPDATE` | `UPDATING` | 进入局部更新流程 |
| `UPDATING` | `UPDATE` 完成 | `ACTIVE` | 提交 patch，状态稳定 |
| `ACTIVE` | `DEACTIVATE` | `DISPOSING` | 开始释放局部内容 |
| `DISPOSING` | `DISPOSE` 完成 | `INACTIVE` 或 `DISPOSED` | 可复用时回到 `INACTIVE`，不可复用时进入 `DISPOSED` |
| `DISPOSED` | `REINIT` | `INACTIVE` | 重新分配状态 |

### 通用不变量

1. `ACTIVE` 状态必须对应一段已接入的局部依赖。
2. `INACTIVE` 状态不能残留可提交的局部 dirty。
3. `DISPOSING` 状态必须最终落到 `INACTIVE` 或 `DISPOSED`，不能悬空。
4. Region 的局部 patch 不能越界修改其他 Region 的状态。

## Region 运行时数据

不管具体类型如何，Region 运行时至少要有这些字段：

- `regionSlot`
- `regionType`
- `lifecycleState`
- `anchorStart`
- `anchorEnd`
- `localDirty`
- `childStart`
- `childCount`

根据类型再加扩展字段。

## `CONDITIONAL`

### 作用

控制互斥分支的挂载、切换和清理。

典型来源：

- `if`
- `else if`
- `else`
- 条件渲染表达式

### 扩展字段

- `activeBranch`
- `targetBranch`
- `branchCount`

### 分支状态

- `NO_BRANCH`
- `BRANCH_ACTIVE`
- `BRANCH_SWITCHING`

### 事件

- `BRANCH_MATCH`
- `BRANCH_CHANGE`
- `BRANCH_CLEAR`

### 转移

| 当前状态 | 条件 | 下一状态 | 结果 |
| --- | --- | --- | --- |
| `INACTIVE` | `BRANCH_MATCH` | `ACTIVE` | 挂载目标分支，接入该分支局部依赖 |
| `ACTIVE` | 分支未变 | `ACTIVE` | 不做结构变更，只允许局部 binding 更新 |
| `ACTIVE` | `BRANCH_CHANGE` | `UPDATING` | 卸载旧分支，挂载新分支 |
| `UPDATING` | 切换完成 | `ACTIVE` | `activeBranch = targetBranch` |
| `ACTIVE` | `BRANCH_CLEAR` | `DISPOSING` | 卸载当前分支 |
| `DISPOSING` | 清理完成 | `INACTIVE` | `activeBranch = NO_BRANCH` |

### 关键规则

1. 分支未变时，不允许重复 mount。
2. 分支切换必须先断开旧分支局部依赖，再接入新分支。
3. 条件 Region 的 dirty 只能影响当前激活分支。

## `KEYED_LIST`

### 作用

处理一般 keyed 列表。

这里的目标是局部协调，不是全表重建。

### 扩展字段

- `itemCount`
- `keyToChildIndex`
- `reconcileStart`
- `reconcileCount`

### 子状态

- `EMPTY`
- `STABLE`
- `RECONCILING`

### 事件

- `LIST_ATTACH`
- `LIST_DIFF`
- `LIST_CLEAR`

### 转移

| 当前状态 | 条件 | 下一状态 | 结果 |
| --- | --- | --- | --- |
| `INACTIVE` | `LIST_ATTACH` | `ACTIVE` | 首次挂载子项 |
| `ACTIVE` | 列表未变 | `ACTIVE` | 只执行子项内部 binding patch |
| `ACTIVE` | `LIST_DIFF` | `UPDATING` | 进入 keyed reconcile |
| `UPDATING` | 协调完成 | `ACTIVE` | 更新 child 映射和顺序 |
| `ACTIVE` | `LIST_CLEAR` | `DISPOSING` | 清理所有子项 |
| `DISPOSING` | 清理完成 | `INACTIVE` | `itemCount = 0` |

### 关键规则

1. keyed reconcile 只在 Region 内进行。
2. 列表顺序变化不能触发父 Block 广域重算。
3. 删除子项时必须释放子项局部依赖和事件绑定。

## `NESTED_BLOCK`

### 作用

管理嵌套 Block 的挂载和卸载。

这类 Region 的关键不是列表协调，而是父子实例边界。

### 扩展字段

- `childBlockSlot`
- `childBlueprintSlot`
- `mountMode`

### 子状态

- `DETACHED`
- `MOUNTED`
- `REMOUNTING`

### 事件

- `BLOCK_ATTACH`
- `BLOCK_REPLACE`
- `BLOCK_DETACH`

### 转移

| 当前状态 | 条件 | 下一状态 | 结果 |
| --- | --- | --- | --- |
| `INACTIVE` | `BLOCK_ATTACH` | `ACTIVE` | 创建并挂载子 Block |
| `ACTIVE` | 子 Block 未变 | `ACTIVE` | 只允许子 Block 自己更新 |
| `ACTIVE` | `BLOCK_REPLACE` | `UPDATING` | 卸载旧子 Block，挂载新子 Block |
| `UPDATING` | 替换完成 | `ACTIVE` | 更新 `childBlockSlot` |
| `ACTIVE` | `BLOCK_DETACH` | `DISPOSING` | 卸载子 Block |
| `DISPOSING` | 清理完成 | `INACTIVE` | 清空父子引用 |

### 关键规则

1. 父 Block 不能直接改写子 Block 内部状态。
2. 嵌套 Block 替换必须走完整 disposal。
3. 子 Block 的 dirty 由子 Block 自己消费，父 Region 只负责边界状态。

## `VIRTUAL_LIST`

### 作用

处理超长列表和滚动窗口。

它不是普通 `KEYED_LIST` 的小改版，而是单独的状态机。

### 扩展字段

- `windowStart`
- `windowEnd`
- `overscanStart`
- `overscanEnd`
- `poolStart`
- `poolCount`
- `visibleCount`
- `itemToCellStart`
- `itemToCellCount`

### 子状态

- `IDLE`
- `WINDOW_DIRTY`
- `POOL_REBINDING`
- `LAYOUT_SYNC`

### 事件

- `WINDOW_INIT`
- `SCROLL`
- `DATA_CHANGE`
- `POOL_EXHAUSTED`
- `WINDOW_CLEAR`

### 转移

| 当前状态 | 条件 | 下一状态 | 结果 |
| --- | --- | --- | --- |
| `INACTIVE` | `WINDOW_INIT` | `ACTIVE` | 建立首屏窗口和节点池 |
| `ACTIVE` | `SCROLL` | `UPDATING` | 计算新窗口 |
| `ACTIVE` | `DATA_CHANGE` | `UPDATING` | 重新评估可见项和局部绑定 |
| `UPDATING` | 只需窗口平移 | `ACTIVE` | 复用节点并重绑定数据 |
| `UPDATING` | 节点池不足 | `UPDATING` | 扩容或回收池 |
| `ACTIVE` | `WINDOW_CLEAR` | `DISPOSING` | 释放窗口内容和节点池 |
| `DISPOSING` | 清理完成 | `INACTIVE` | 清空窗口状态 |

### 关键规则

1. 滚动更新优先复用节点，不优先销毁再创建。
2. item 数据变了，不代表要替换 cell 节点；优先做局部重绑定。
3. 编译器只固定 Region 边界和 slot，窗口大小、overscan、池策略由运行时决定。
4. `VIRTUAL_LIST` 不应该退化成每次滚动都做整段 keyed reconcile。

## Region 事件处理顺序

同一批次内，Region 事件按这个顺序处理：

1. 读取 Region 自身 dirty
2. 读取结构性事件
3. 计算状态转移
4. 执行局部 patch 或局部协调
5. 执行 disposal
6. 写回稳定状态

这样做的目的是避免：

- 先 patch 旧结构，再切换结构
- 先接入新依赖，再清理旧依赖
- disposal 和 patch 交错导致状态不一致

## Disposal 规则

所有 Region 类型都遵守这套清理顺序：

1. 停止接收新的局部更新
2. 移除局部事件绑定
3. 释放局部依赖和局部 dirty
4. 释放子实例或子项引用
5. 释放不再使用的 DOM 引用
6. 回写 `INACTIVE` 或 `DISPOSED`

禁止跳过中间步骤直接删 DOM。

如果只删 DOM，不清理局部依赖，后面一定会留下悬空更新。

## 与 Scheduler 的关系

Region 状态机不自己做调度决策。

它只消费 scheduler 交给它的结构性事件。

调度层负责：

- 什么时候处理某个 Region
- Region 更新属于哪个 lane
- 是否与 channel 或 async resource 一起提交

Region 自己负责：

- 当前该转到哪个状态
- 需要 patch 什么
- 需要释放什么

## 与 Channel、Async Resource 的关系

Region 可以接收 channel 消息，也可以消费 async resource 结果。

但规则不变：

- channel 只触发显式定义过的 Region 入口事件
- async resource 只在版本校验通过后才能触发 Region 更新

Region 不能自己绕过 scheduler 去直接消费外部事件。

## 实现优先级

实现顺序建议是：

1. `CONDITIONAL`
2. `NESTED_BLOCK`
3. `KEYED_LIST`
4. `VIRTUAL_LIST`

原因：

- `CONDITIONAL` 最容易验证 lifecycle 和 disposal
- `NESTED_BLOCK` 最容易暴露父子边界问题
- `KEYED_LIST` 开始引入局部协调
- `VIRTUAL_LIST` 最复杂，应该建立在前面三类 Region 已经稳定的基础上

## 验证清单

每种 Region 至少要覆盖这些测试：

1. 初始化后状态是否正确
2. 激活后局部依赖是否接入
3. 更新时是否只影响 Region 局部
4. 切换或清理后是否释放局部依赖
5. 高频切换下是否残留悬空 DOM 引用或 dirty

`VIRTUAL_LIST` 还要额外验证：

1. 滚动时节点是否复用
2. 节点池不足时是否稳定扩容
3. 数据变更时是否优先重绑定而不是重建节点
