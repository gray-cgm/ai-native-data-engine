# 模块 PRD · Tools（工具平台与微前端集成）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/tools` · `/tools/:toolId`
> 详细架构：[微前端工具平台](../architecture/web-microfrontend-tools-platform.md)

## 1. 模块定位

Tools 是**外部 / 内部工具的统一入口**——把第三方分析 / 标注 / BI 工具通过 iframe 或代理嵌入到本平台 workbench，避免用户在多个系统间切换。

> 简单记忆：**不该重复造的轮子，全在 Tools 里集成**。

## 2. 用户故事

| 角色 | 场景 | 通过 Tools 怎么做 |
|---|---|---|
| 数据分析师 | 跑 Superset 看报表 | Tools 列表 → Superset → 嵌入 iframe，自动带 dataset_id 上下文 |
| 标注主管 | 进 CVAT 看标注队列 | Tools → CVAT → 跳转或嵌入 |
| 算法 | Jupyter Lab 跑 notebook | Tools → Jupyter → 直通 |
| 平台 | 收编新工具上线 | 在 tool registry 加一行配置 + 走 BFF 网关代理 |

## 3. 主要功能

### 3.1 Tool Registry

- 字段：id · name · short_name · category · summary · description · integration_mode · base_url · gateway_path · health_path · workspace_path · contract_version · policy_profile · owner · capabilities · use_cases · notes
- `integration_mode`：
  - `direct-iframe`：浏览器直连工具的 base_url（同源 / 跨域 CORS 可控）
  - `proxy-iframe`：经 BFF gateway 反代，注入 auth header / 工作空间上下文

### 3.2 Tools 首页（`/tools`）

- 卡片墙：按 category 分组（BI / 标注 / Notebook / 模型评估）
- 每卡显示：health 状态（绿/黄/红）、capabilities 标签、最近一次访问时间
- 卡顶右上角的「Open in workspace」与「Open in new tab」

### 3.3 工作台子页（`/tools/:toolId`）

- 顶部 Toolbar：返回 / 工具状态 / 上下文（dataset / requirement / x_trace_id）
- 主区：iframe（带 onload health probe）
- 失败兜底：health = down 时显示 `<Alert>` + 提示运维 + 直跳原工具 URL

### 3.4 Workspace Context 传递

每次打开 tool，BFF 把当前 workspace context 注入：

```json
{
  "tool_id": "superset",
  "workspace_id": "wks_local",
  "dataset_id": "ea4894c8-...",
  "dataset_version_id": "v1",
  "request_id": "req_xxx",
  "actor": "alice@example.com"
}
```

工具方可解析 query string 或 postMessage 拿到上下文。

## 4. 与其他模块的关系

| 上游 | 描述 |
|---|---|
| Catalog | dataset_id 作为 context 传入 BI / 标注工具 |
| Requirement | requirement_id 让分析工具自动过滤 |
| Pipelines | 把某次 PipelineRun 的产物 deeplink 到 BI |

| 下游 | 描述 |
|---|---|
| Superset / CVAT / Jupyter / 自研工具 | iframe 或 proxy 嵌入 |

## 5. 关键设计决策

- **Tool registry 由 BFF 维护**（不是 Platform API）：因为它涉及 web 路由 + iframe 安全策略，与 Web 紧耦合。
- **proxy-iframe 模式优于 direct-iframe**：能注入 auth header / IP 白名单 / audit log；只在工具方不支持代理时退到 direct。
- **健康探测在 BFF 做**：`tool.health_path` 由 BFF 周期性 poll，前端只读结果，避免每个用户重复探。

## 6. 待办与扩展

- [ ] Tool ACL（按 workspace / role 控制可见集合）
- [ ] 嵌入工具的统一审计日志（所有 proxy 请求都进 audit）
- [ ] 工具间跳转（A 工具结果一键带到 B 工具）
- [ ] 工具版本治理（contract_version 不匹配自动降级）
