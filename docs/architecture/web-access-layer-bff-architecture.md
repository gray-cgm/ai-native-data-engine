# Web Access Layer BFF Architecture

## 为什么单独写这篇文档

`apps/bff` 现在已经不再只是几个轻量转发 route，而是开始吸收 gta-api-demo-ts 这类成熟后台服务的目录组织经验，逐步形成：

- Koa 应用启动骨架
- 中间件链路
- route -> handler -> engine -> service 分层
- 资源管理型接口组织方式
- 统一响应包装与错误语义
- 文档与 route manifest 输出

因此需要一份单独文档，明确 `apps/bff` 内部目录应该如何演进，避免后续继续把逻辑随意塞回 route 文件。

---

## 一句话结论

建议始终坚持下面这句边界原则：

- `routes/` 负责 HTTP 路由声明、入参/出参 schema、接口文档元数据
- `handlers/` 负责 Koa `ctx` 适配与 HTTP 层出入参整理
- `engines/` 负责面向页面或资源管理场景的业务编排，**所有 Platform API 调用、ViewModel 组装、缓存与聚合都在这里**
- `services/` **只封装外部系统客户端**（Platform API HTTP 客户端 / Kafka / Flink / OAuth / 对象存储等），保持薄、通用、无业务语义
- `middlewares/` 负责横切关注点
- `utils/` 只放无业务语义的通用工具

换句话说：

> BFF 可以做“面向页面和管理端体验的编排”，  
> 但不应该重新拥有 Platform domain fact，也不应该退化成一堆直接写 `fetch()` 的 route 文件。

---

## 1. BFF 在整体系统中的位置

当前推荐路径仍然是：

```text
Web
-> BFF
-> Platform API
-> RuntimeContainer / adapters
```

其中 `apps/bff` 的职责是：

- 接入浏览器请求
- 提供 app-facing API
- 补充页面聚合、资源管理列表整形、分页/排序/搜索体验
- 注入 requestId、统一响应包装、统一错误语义
- 保持对 Platform API 的稳定依赖，而不是直接碰 Python runtime

它不负责：

- 重新定义底层数据资产事实
- 直接访问 DuckDB / SQLite / Lance / filesystem provider
- 承载长期后台编排生命周期
- 替代 `apps/api` 成为平台资源事实层

---

## 2. 当前目录蓝图

截至当前代码状态，`apps/bff/src` 推荐按下面结构理解：

```text
apps/bff/src/
  app.ts
  index.ts
  server.ts
  config/
  const/
  dictionary/
  middlewares/
  routes/
  handlers/
  engines/
  services/
  utils/
  types/
  types.ts
  errors.ts
```

对应职责如下。

### `app.ts`

负责：

- 创建 Koa app
- 组装 middleware 顺序
- 加载 root route、API route、文档 route
- 绑定 app 级错误监听

不负责：

- 具体业务逻辑
- 外部资源请求
- 页面级 ViewModel 计算细节

### `server.ts`

负责：

- 真正启动监听端口
- 输出服务启动日志

### `index.ts`

负责：

- 进程入口
- 调用 `start()`
- 处理启动失败退出码

---

## 3. 各目录职责

### `config/`

负责：

- BFF 进程级配置
- host / port / upstream base url / body limit / appName 等运行参数

要求：

- 只放运行配置解析
- 不放业务开关判断分支的大量逻辑

### `const/`

负责：

- 稳定常量定义
- 错误码编号

### `dictionary/`

负责：

- 面向接口返回的 message 字典
- 错误码到多语言提示的映射

这层和 `const/` 配合，形成面向协议的一致错误语义体系：

- code 是稳定机器语义
- message 是面向客户端的可读语义

### `middlewares/`

负责横切关注点，例如：

- `exception.ts`：异常处理与错误响应包装
- `response.ts`：成功响应统一包装
- `pagination.ts`：统一分页参数归一化
- `clean-timestamp.ts`：清理浏览器缓存戳等噪音参数

放在这里的逻辑必须满足至少一条：

- 对多条 route 都有价值
- 明显属于 transport / protocol 层横切能力
- 不依赖具体业务资源语义

不应放在这里的内容：

- datasets / tasks / exports 的业务规则
- dashboard 组装逻辑
- 某个页面专属 ViewModel 转换

### `routes/`

负责：

- 路由路径与 method 定义
- Joi validate schema
- 文档元数据
- route 自动装配
- health/doc/swagger(manifest) 这类协议入口

推荐规则：

- route 文件只描述接口，不承载主要业务
- 一个 route 文件可以导出单个 route，也可以导出同域 route 数组
- route 名称按资源域或页面域组织，而不是按 HTTP method 组织

当前已有例子：

- `catalog.ts`
- `operations.ts`
- `dashboard.ts`
- `clips.ts`
- `exports.ts`
- `bootstrap.ts`

### `handlers/`

负责：

- 接收 `ctx`
- 从 `ctx.request` 中提取 params / query / body
- 调用 engine
- 把结果写回 `ctx.body`

handler 的定位是 HTTP adapter。它是 BFF 里最接近 Koa 的业务层，但仍然不应承担主要编排逻辑。

适合放在 handler 的内容：

- `ctx.request.params.datasetId` 提取
- 处理 request body 默认值
- 处理极轻量的 HTTP 适配逻辑

不适合放在 handler 的内容：

- 多接口聚合
- 复杂筛选/搜索/排序规则
- 多个 service 调用组合

### `engines/`

engine 是 BFF 内部真正承载业务逻辑的一层，**它应当是“胖”的**：

- 直接调用 `platformFetch` 访问 Platform API（路径拼接、query 归一化、错误翻译都在这里）
- 定义自己领域的 DTO / 类型别名 / 元数据（如 `MODULE_META`、枚举默认值）
- 做 filter push-down 与 BFF 侧 search/sort/paginate
- 管理端列表、详情、聚合 ViewModel 的组装
- 短 TTL 的查询缓存（例如 vocab、tag histogram）
- 跨模块聚合（例如 overview：合并多个子域统计 + 附加展示用的 label / accent / description）
- 业务级前置校验（例如 `assertOpsModule`、`title is required`）

不负责：

- 不拥有底层 domain fact（那是 `apps/api` + `python/*` 的职责）
- 不处理 HTTP 协议细节（那是 handler + middleware 的职责）
- 不承担长期编排与后台任务生命周期（那是 scheduler / orchestrator 的职责）

示例：

- `opsModulesEngine.ts`：**当前推荐的样板模式**。一个文件囊括 6 个运营模块的全部能力：模块注册表 + 类型定义 + 模块元数据 + vocab 缓存 + `queryOpsItems` / `createOpsItemForModule` / `patchOpsItemForModule` / `deleteOpsItemForModule` / `getOpsOverview`，全部直接调用 `platformFetch`，不经过任何 `services/ops-modules.ts` 中转层。
- `dashboardEngine.ts`：dashboard 聚合
- `catalogEngine.ts`：clip 聚合 dataset 视图的 filter + search + paginate
- `clipsEngine.ts`：clips 列表 / 详情 / 对齐帧 / 视频流的页面编排
- `operationsEngine.ts`：tasks / runs / exports 列表的管理端查询体验

### `services/`

`services/` 只放 **外部系统客户端**。它不承载任何业务语义，也不是 domain-specific 的 Platform API 包装层。判断一个文件是否属于 `services/`，问一个问题：

> “如果明天把它复制到另一个完全不同的 Node 服务里，它是否仍然有意义？”

是 → 属于 `services/`。否 → 属于对应领域的 `engines/`。

当前推荐放在这里的内容：

- `platform.ts`：**唯一的 Platform API 通信原语**。负责 `platformFetch(path, init)`、重试、错误映射为 `UpstreamHttpError`。不包含任何 resource URL / query 构造。
- `kafka.ts`（规划中）：Kafka 生产者/消费者封装
- `flink.ts`（规划中）：Flink REST Client
- `auth.ts`（规划中）：OAuth / IAM 客户端
- `object-storage.ts`（规划中）：S3 / OSS 客户端

**不应再出现**的文件：`catalog.ts` / `clips.ts` / `operations.ts` / `ops-modules.ts` 这类“按资源域包装 Platform API”的 service。这些只是给 `platformFetch` 套一层 URL 拼接，本质上是业务编排语义，应该直接写在对应 engine 里。

规则：

- service 必须是“薄而稳定”的客户端层，不暴露领域 DTO
- 不把页面级聚合或筛选/排序规则堆进 service
- 不把 Koa `ctx` 传进 service
- 不把 Platform API 的具体路径常量泄露出 service 之外 —— 路径字符串由 engine 构造，service 只负责 HTTP 传输本身

**迁移背书**：现有 `catalog.ts` / `clips.ts` / `operations.ts` 是旧形态遗留，新模块一律按 `opsModulesEngine.ts` 的方式写 —— 即由 engine 直接调用 `platformFetch`。存量 service 会在各自模块演进时逐步合并进对应 engine。

### `utils/`

负责：

- 无业务语义的纯工具
- collection filter/sort/page 通用逻辑
- object 清理
- logger 辅助能力

判断标准：

- 如果把文件复制到另一个 Node 服务里仍然有意义，它更像 `utils/`
- 如果只服务于 dataset/task/export 等领域语义，它通常不应落在 `utils/`

### `types/` 与 `types.ts`

负责：

- TypeScript 侧共享类型
- 第三方库补充类型声明
- BFF route / response / resource item 的通用类型定义

推荐做法：

- 第三方声明放 `types/`
- 项目内部共享业务类型放 `types.ts` 或后续拆到 `types/*.ts`

---

## 4. 推荐请求流

推荐请求流固定为：

```text
route
-> handler
-> engine
-> services/platform.ts (platformFetch)
-> Platform API
```

关键点：**engine 和 service 之间是“业务 ↔ 传输”的边界，不是“业务 A ↔ 业务 A 的 HTTP 版”**。engine 需要什么 URL 就自己拼什么 URL，`platformFetch` 只负责把 request 发出去和把 response 读回来。

如果是聚合型接口：

```text
route
-> handler
-> engine
   ├─ platformFetch(/api/v1/...)
   ├─ platformFetch(/api/v1/...)
   └─ 本地缓存 / MODULE_META / applyCollectionQuery
-> 聚合成前端友好的 ViewModel
```

如果有外部系统（Kafka / Flink / OAuth / 对象存储）要接入：

```text
route
-> handler
-> engine
   ├─ services/kafka.ts
   ├─ services/flink.ts
   └─ services/platform.ts
-> 返回聚合结果
```

这里依然建议保留 engine 层，即使有些接口暂时只是薄转发。原因是：

- 它给后续规则（缓存、ViewModel、权限）增加预留稳定位置
- 避免 handler 越写越胖
- 保持 route / handler / engine / service 四层语义清晰

---

## 5. 统一响应与错误语义应该放在哪里

当前 BFF 已经采用统一 envelope：

- 成功响应由 `middlewares/response.ts` 统一包装
- 失败响应由 `middlewares/exception.ts` 统一包装

推荐返回语义：

```json
{
  "status": 200,
  "code": 0,
  "success": true,
  "detailMessage": null,
  "message": {
    "cn": "请求成功",
    "en": "success"
  },
  "requestId": "...",
  "data": {}
}
```

错误返回保持同样顶层结构，只是：

- `success = false`
- `data = null`
- `code` 与 `message` 来自错误码体系

因此：

- route / handler / engine / service 都只关心原始业务数据
- envelope 统一在 middleware 层完成

这也是 gta 风格里最值得迁移的地方之一，因为它能显著减少重复包装代码。

---

## 6. 哪些东西不该放进 BFF

### 1) 平台底层 provider

不应把以下实现塞进 BFF：

- DuckDB 查询实现
- SQLite 元数据实现
- Lance / filesystem 读写实现
- Python runtime container 装配

这些都属于 `apps/api` + `python/*` 边界。

### 2) 平台核心领域事实重写

BFF 可以：

- 聚合
- 过滤
- 排序
- 改造成页面友好的 ViewModel

但不应该：

- 重新发明 dataset version 事实模型
- 在 Node 侧再造一套任务状态机
- 脱离 Platform API 单独维护数据资产真相

### 3) 长期后台任务生命周期

BFF 不应该承担：

- scheduler daemon
- worker loop
- callback 消费
- 独立编排控制器

这些后续如果存在，应放到 `apps/scheduler`、`apps/orchestrator` 或 Python services/workflows。

---

## 7. 当前目录和未来目标目录的关系

当前 `apps/bff` 已经比最初版本多了：

- `handlers/`
- `engines/`
- 更完整的 `services/`
- 更明确的 `middlewares/`
- 资源域路由拆分

这说明 BFF 已经从“单纯聚合脚本”演进到“轻量后台管理服务”。

但它仍然不是最终形态。未来可以继续演进为：

```text
apps/bff/src/
  routes/
    catalog/
    operations/
    dashboard/
    auth/
    query/
  handlers/
    catalog/
    operations/
    dashboard/
  engines/
    catalog/
    operations/
    dashboard/
    auth/
    query/
  services/
    platform/
    auth/
    viewmodels/
  viewmodels/
  middlewares/
  config/
  utils/
  types/
```

也就是说，随着模块继续增多，可以从“平铺文件”进一步演进到“按能力域分目录”。

---

## 8. 推荐演进原则

### 1) 先按职责分层，再按领域分目录

当前规模下，先把 route / handler / engine / service 分清楚最重要。等模块数量进一步增加，再做二级目录拆分。

### 2) handler 永远不要变胖

如果 handler 里开始出现：

- 多个 service 调用
- 搜索/排序规则
- 页面状态拼装

说明逻辑应该下沉到 engine。

### 3) service 只做外部系统客户端

service 如果出现 dataset / clip / ops 这类领域语言，或者返回大段页面专用 ViewModel，说明已经越界到了 engine，需要搬迁。service 里应当只有 Platform / Kafka / Flink / OAuth / 对象存储 这类外部系统的薄客户端。

### 4) middleware 只做横切，不做业务

pagination / response / exception 适合 middleware。dataset 特殊规则不适合 middleware。

### 5) BFF 面向体验，不面向真相

这个原则最关键。

`apps/bff` 的价值是：

- 让 Web 更轻
- 让 app-facing contract 更稳定
- 让管理端查询体验更好

不是再造一层平台真相。

---

## 9. 最终建议

如果只保留一句可执行建议，应该是：

> 让 `apps/bff` 成为“浏览器友好的 app-facing orchestration layer”，  
> 而不是“直接写在 route 里的 fetch 集合”或“第二套平台后端”。

这意味着：

- route 只声明接口
- handler 只适配 Koa
- engine 组织管理端与页面逻辑，**并直接调用 `platformFetch`**
- service 只封装外部系统的薄客户端（Platform / Kafka / Flink / OAuth / OSS …）
- middleware 统一响应、错误、日志与协议细节

这样既能吸收 gta-api-demo-ts 的成熟后台管理服务组织方式，又不会破坏当前仓库 Web -> BFF -> Platform API 的主边界。

---

## 10. 样板模式：Ops Modules

`apps/bff/src/engines/opsModulesEngine.ts` 是当前仓库推荐的 BFF 模块写法，后续新模块应当参考它而不是旧的 `services/clips.ts` / `services/operations.ts` 等。

关键特征：

1. 单文件包含模块注册表、DTO、`MODULE_META`、vocab 缓存、CRUD + stats + overview 的全部行为。
2. 直接调用 `services/platform.ts#platformFetch`，不再新建 `services/ops-modules.ts` 转发层。
3. 自己维护业务级校验（`assertOpsModule`、空 title 报 400、vocab 缓存 30s）。
4. filter push-down 下沉到 Platform，`q` / sort / skip / limit 由 `applyCollectionQuery` 在 BFF 侧统一处理。
5. Handler 只写几行 —— `assertOpsModule(ctx.params.module)` 后直接调入 engine 函数，所有异常由全局 `handleException` 中间件统一包装。

当需要新增一类资源（例如 datasets-v2、annotation-projects）时，优先在 engine 里开新文件；只有需要接入新的外部系统（如 Kafka、Flink）时，才在 `services/` 里新增对应的客户端。