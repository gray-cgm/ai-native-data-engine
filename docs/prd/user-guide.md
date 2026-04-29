# 产品使用说明

> 目标读者：日常使用平台的最终用户（PM、DRE、算法、标注供应商、运维）。
> 本文按**角色 × 任务**给出操作路径，不讲架构。

---

## 1. 我是谁，看哪一节？

| 角色 | 典型任务 | 跳转 |
|---|---|---|
| **算法工程师** | 找 / 用 / 评估 official Dataset | [§ 3](#3-算法工程师工作流) |
| **DRE / 数据方** | 提需求 / 推进 sign-off / 看进度 | [§ 4](#4-dre--数据方工作流) |
| **标注供应商 / 标注主管** | 接 labeling / tagging 任务 | [§ 5](#5-标注供应商工作流) |
| **运维 / SRE** | 看 pipeline 健康 / 查失败 / 算成本 | [§ 6](#6-运维工作流) |
| **平台管理员** | 接入新工具 / 调整 profile | [§ 7](#7-平台管理员工作流) |

---

## 2. 通用约定

- **Web 入口**：`http://localhost:5173`（默认开发）
- **链路追踪**：每个核心对象都有 `x_trace_id`，所有视图都支持按 trace 过滤
- **Catalog 数据集**：只有 customized（工作集）+ official（可训练发版集）两类
- **保存即可见**：所有写操作落盘后 ≤ 1s 在 Web UI 可见（Vite HMR + React Query 缓存）

---

## 3. 算法工程师工作流

### 3.1 找一个可训练的数据集

1. 打开 Catalog（`/catalog`）→ Datasets Tab → Official 子 Tab
2. 用搜索框按需求关键词、tag_expr、requirement_id 检索
3. 点 dataset 进详情：看 sample 数 / version / 创建时间 / promoted_from
4. 拉 sample 列表确认覆盖（每行可跳 Explorer 看 clip 真容）

### 3.2 拿到 artifact 用于训练

```bash
# 方法 A：API 拉 sample（适合自己组装 dataloader）
curl 'http://localhost:8000/api/v1/datasets/<official_id>/samples?limit=2000' > samples.json

# 方法 B：直接用平台导出的 JSONL artifact
cat data/exports/<official_id>-<version>.jsonl | head
```

每行 JSON 包含：`{clip_id, ts, range_l, range_r, training_type, extra_meta}`。
- `clip_id` → 物理 clip 在 `data/lance/c-<uuid>/`
- `ts` → Lance 时间窗口中心（纳秒）
- `range_l/r` → 要取的帧范围（相对 ts，单位 = frame）
- `training_type` → train / test / holdout

### 3.3 反馈 cornercase 回数据闭环

发现模型 disagreement 的 clip 后：
1. 在 Explorer 找到对应 clip（关键字 / scenario）
2. Mark in / Mark out → Save Cut → 选「+ New Customized Dataset」（命名带 `cornercase_v<n>`）
3. 写一个 Mining ops_item：附 clip_ids + 标 `hard_case_v<n>` tag
4. 运维或 PM 推进后续 Labeling → Checking → Release

---

## 4. DRE / 数据方工作流

### 4.1 提一个新需求

1. Web → Requirements → 「+ New Requirement」
2. 填写：title / priority / source / target_scene / scene_tags / vehicle_tags / estimated_data_volume / due_date / feishu_doc_id
3. 创建后系统自动拆 4 条占位 DataTask（collection / annotation / quality_check / pipeline）

### 4.2 推动 Sign-off

1. 进 Requirement 详情 → DataTasks 列表
2. 大数据团队对每条 DataTask 做 sign-off：选 APPROVED / REJECTED + 写 comment
3. 全部 APPROVED 后 Requirement 状态从 PENDING_REVIEW → APPROVED

### 4.3 跟踪进度

- Requirement 详情页四层闭环：DataTasks / OpsTasks / PipelineRuns / Snapshot
- 状态汇总：每个对象的 status 标签 + 完成度
- Report 页（`/requirements/:id/report`）：交付指标 + Mermaid 链路图

---

## 5. 标注供应商工作流

### 5.1 接任务

1. Web → Operations · Labeling
2. 顶部按 requirement / data_task / x_trace_id / scenario 过滤到自己的批次
3. 状态过滤：`pending` / `in_progress`
4. 点 OpsItem 行打开 Drawer 看 clip_ids、payload、负责人

### 5.2 标注完成回流

1. 工具内完成标注（或在 OpsItem Drawer 直接编辑）
2. 状态切到 `review` → 提交给 QA
3. QA 通过则 `done`；不通过回到 `in_progress`

### 5.3 Tagging（系统打标）补充

如果是 hybrid 模式：先系统打 tag，再人工修订。Tagging 列表与 Labeling 流程类似，状态仅 `applied`。

---

## 6. 运维工作流

### 6.1 早会扫水位

1. 打开 Pipelines · Overview
2. 看 batch + streaming 综合态势：当日 run 数 / 失败率 / 队列长度
3. 关注红色卡片，点进 Runs Tab 钻取

### 6.2 查 trace 全链路

1. 复制问题 trace_id（出错告警 / 用户反馈）
2. Pipelines → Runs → 顶部过滤栏粘贴 trace_id
3. 看到该 trace 涉及的所有 PipelineRun
4. 切到 Lineage Tab 看 Mermaid DAG

### 6.3 算成本

1. Pipelines · Cost Tab
2. 按 Requirement / Pipeline / Stage / Purpose 切换分组维度
3. 抽离 GPU 成本最高的 step → 与算法 PM 复盘

### 6.4 清空 dev 数据

```bash
make clean-dev-data --yes          # 清 data/ 各阶段子目录
make e2e-demo-reset SCENARIO=...   # 重新跑一遍 e2e demo
```

---

## 7. 平台管理员工作流

### 7.1 接入新工具到 Tools 平台

1. 在 BFF tool registry 加一行配置（id / category / base_url / health_path / integration_mode）
2. 配 BFF gateway 代理（`proxy-iframe` 模式）+ 注入 auth
3. 上线后在 `/tools` 检查 health 卡

### 7.2 切换 profile（local / team / SaaS）

```bash
# 本地默认
PROFILE=local-dev pnpm dev

# 团队版 / SaaS（profile yaml 切 storage / metadata 后端）
PROFILE=team-pg-s3 pnpm dev
```

profile yaml 见 `infra/profiles/*.yaml`。

### 7.3 升级数据库 schema

```bash
make db-current      # 查看当前版本
make db-upgrade      # 升级到 head
make db-downgrade REV=-1   # 回退一步
make db-revision MSG="add foo column"   # 生成新迁移
```

---

## 8. 常见问题（FAQ）

**Q：找不到我的 Customized Dataset？**
看 Catalog → Customized Tab；可能你登记错 dataset_type。Operations · Release 行的 Promote 按钮在 dataset_type=customized 时才可用。

**Q：Promote 报 "Dataset not found"？**
你的 OpsItem.dataset_id 指向了一个不存在的字符串。回去 Catalog → 「+ New dataset」创建一个，或编辑 OpsItem 用 Dataset Picker 选已有的。

**Q：Explorer 视频播放失败？**
mp4 文件没缓存到 `data/raw/thumbnail_video/<clip_id>/<camera>.mp4`。clip 详情页右下显示 "Video not cached locally"，按提示路径放置即可。

**Q：怎么把 official dataset 给到外部团队？**
拿 `/api/v1/datasets/<id>/samples` 输出 + `data/exports/<id>-v<n>.jsonl` 文件。后续 SaaS 阶段会有签名 URL。

更多见 [E2E Demo 教程](../tutorials/e2e-demo.md) 与 [入门教程](../tutorials/beginner-guide.md)。
