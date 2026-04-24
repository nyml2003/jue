# Phase 3：世界扩面

这一阶段才讨论把 `jue` 的宿主和应用世界继续做大。

## 包范围

- `@jue/form`
- `@jue/animation`
- `@jue/gesture`
- `@jue/viewport`
- `@jue/language-tools`
- `@jue/create`
- `@jue/native`
- `@jue/web-html`

## 核心目标

1. 补完第二批 stdlib
2. 把 tooling 扩到 editor / scaffold
3. 扩宿主能力
4. 补 Web convenience layer

## 为什么这些放在最后

因为它们都依赖前两阶段的稳定地基：

- `form` 依赖 query / router / authoring / host 输入边界
- `animation / gesture / viewport` 依赖 host bridge 和 scheduler 足够稳定
- `language-tools` 依赖 authoring surface 足够稳定
- `create` 依赖官方包结构足够稳定
- `native` 依赖 kernel / host contract 足够清楚
- `web-html` 必须在主规范稳定后再做，不能抢定义权
