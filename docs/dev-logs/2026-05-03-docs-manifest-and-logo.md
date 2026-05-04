# 2026-05-03 · 文档目录重排 / Logo / 待办框 / Docker 残留 / Skill Prompt

本日做六件事：

1. 文档目录两轮重排（系统架构 4 组按 MECE 重归类 + ① 总览精简）
2. 侧栏标签去括号 + 跨节迁移（mvp-scope / personal-vs-enterprise / gap-map）
3. Logo 设计文档上线 + favicon 挂载 + 整体 PRD §0.5
4. dev-log 待办框样式 bug 修复（根因 + 简化渲染）
5. Docker 构建上下文残留清理（`python/services` 被昨日删除后 Dockerfile 漏改）
6. Claude Skill Prompt 沉淀（`CLAUDE.md` + `.claude/skills/AI_Data_Engine_Skill.md` 进 git）

---

## 1. 文档目录重排（两轮）

### 1.1 第一轮：架构 4 组按 MECE 重新归类

之前 `② 领域模型` 混进了文件格式 / 代码组织内容；`③ 业务流程` 混进了 layering 边界；`④ 系统分层` 只挂了少量分层文档却漏掉 file-format / code-org 文档。按下面 MECE 重排：

| 子组 | 含义 | 主要内容 |
|---|---|---|
| ① 架构总览 | 高层视角 | 入口 + 全景图 |
| ② 领域模型 | 平台对象 / 字段 / 关系（"是什么"） | glossary / domain-model / dataset-design / tags-design |
| ③ 业务流程 | 横向闭环 / 数据如何流动（"如何流"） | business-flows / streaming-evolution / 物理数据集管理 |
| ④ 系统分层与代码组织 | 六层物理底座 + 代码住哪（"怎么实现"） | system-layers / clip-lance / fdl / core-adapters / layering-boundaries / system-directory / monorepo / web-bff / micro-frontend |

迁移 4 处：

| 文档 | 原位置 → 新位置 | 理由 |
|---|---|---|
| `clip-lance-data-model.md` | ② 领域模型 → ④ 系统分层 | Lance 文件 schema 是 ① 文件格式层细节，不是平台对象建模 |
| `core-adapters-profiles-workflows.md` | ② 领域模型 → ④ 系统分层 | python/ 四层是代码组织，与"平台管理什么对象"不同维度 |
| `system-directory-and-domain-design.md` | ② 领域模型 → ④ 系统分层 | monorepo 目录蓝图 + 领域落位建议——主语是代码 |
| `layering-and-orchestrator-boundaries.md` | ③ 业务流程 → ④ 系统分层 | python/workflows ⇄ apps/orchestrator 是代码边界，不是业务流 |

### 1.2 第二轮：① 架构总览精简 + 跨节迁移

`架构总览` 之前还混了 mvp-scope（产品范围）+ personal-vs-enterprise（路线图）+ gap-map（路线图），不像"总览"。再做三件事：

| 文档 | 原位置 → 新位置 | 理由 |
|---|---|---|
| `mvp-scope.md` | ① 架构总览 → 产品与需求 / 整体 PRD | "做什么 / 不做什么"是产品范围，不是架构 |
| `personal-vs-enterprise.md` | ① 架构总览 → 决策 & 路线图 | 演进路径 = 路线图主题 |
| `ai-data-platform-gap-map.md` | ① 架构总览 → 决策 & 路线图 | 能力差距分析 = 路线图主题 |

`架构总览` 现在只剩两份"真·总览"——`overview.md` + `mermaid-diagrams.md`。

### 1.3 标签去括号

侧栏标签里冗余的解释性副标题让 UI 视觉很拥挤，全部精简为名词短语：

| 旧 | 新 |
|---|---|
| `② 领域模型（平台管理什么对象）` | `② 领域模型` |
| `③ 业务流程（横向闭环 / 数据如何流动）` | `③ 业务流程` |
| `④ 系统分层与代码组织（六层底座 + 代码住哪）` | `④ 系统分层与代码组织` |

详细解释下沉到 section description 与 item hint，侧栏只露最小必要信息。

---

## 2. dev-log 待办框样式 bug

### 根因

[apps/web/src/styles/reset.css](../../apps/web/src/styles/reset.css) 的全局规则：

```css
input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-input);
  background: var(--color-bg-input);
  ...
}
```

把所有 `<input>` 当成"输入框"美化，包括 GFM 给 `- [ ] / - [x]` 渲染的 `<input type="checkbox" disabled>`，导致每个 todo 框被撑成一整行宽 + 20px padding，视觉上炸成一个个超大方块，与文字错位。

### 第一轮修复（不彻底）

[docs-viewer.css](../../apps/web/src/modules/docs/docs-viewer.css) 用 `display: flex + align-items: flex-start + > p { flex: 1 }` 试图对齐——但：

- `align-items: flex-start` 让 checkbox 顶到第一行字符 ascender，看上去飘
- `> p` 选择器在 tight list 模式下命中失败（GFM 不一定包 `<p>`）；loose list 下 `<p>` 又自带 `margin: 0 0 1em` 让每个 todo 之间空一行

### 第二轮修复（最简）

放弃 flex，回到最朴素的"checkbox 内联在文字前"渲染：

```css
.markdown-body li.task-list-item {
  margin: 0.15em 0;
  padding: 0;
  line-height: 1.6;
}

.markdown-body li.task-list-item > input[type='checkbox'] {
  appearance: auto;
  -webkit-appearance: checkbox;
  width: 13px; height: 13px; min-width: 13px;
  padding: 0; margin: 0 6px 0 0;
  border: none; background: transparent; border-radius: 0;
  vertical-align: -2px;
  cursor: default;
  box-sizing: content-box;
}

.markdown-body li.task-list-item > p {
  display: inline;
  margin: 0;
}
```

要点：

- 强制 `appearance: checkbox` 还原原生勾选框 13×13
- `vertical-align: -2px` 让方框基线下沉与文字 baseline 对齐
- `> p { display: inline }` 让 loose list 模式下被包了 `<p>` 的文字回到 checkbox 同一行
- 整个 li 不用 flex，按块级流式自然排列

---

## 3. Logo 上线

### 资产

| 文件 | 用途 |
|---|---|
| [`apps/web/public/logo.png`](../../apps/web/public/logo.png) | 主 logo（铲子 + 飞轮 + AI 节点） |
| [`apps/web/public/favicon.ico`](../../apps/web/public/favicon.ico) | 浏览器 tab 图标 |

### Web 挂载

[apps/web/index.html](../../apps/web/index.html) 加：

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/logo.png" />
```

Vite 把 `public/` 暴露在根，所以 `/favicon.ico` 与 `/logo.png` 直接可用。

### 设计文档

新增 [docs/prd/logo-design.md](../prd/logo-design.md)，挂在"产品与需求 → 使用与设计"组：

- §一 视觉
- §二 表达的故事——铲起 / 提纯 / 注入三动作 × 业务隐喻
- §三 设计原则——三角构图 / 冷蓝 + 暖橙配色（含 RGB）/ 纯白无边框 / 线性扁平
- §四 使用规范——5 个场景的资产位 + 不允许的改动清单
- §五 与产品定位的呼应
- §六 参考

### 整体 PRD §0.5

[docs/prd/ai-data-loop-infra-prd.md](../prd/ai-data-loop-infra-prd.md) 在 §0 全景图末尾追加 §0.5「产品视觉标识」，作为产品全景的视觉收尾——一段三动作叙事 + 配色构图说明 + "这个平台是 AI 背后的铲子与飞轮"的一句话定位，链向详细设计文档。

---

## 4. docs viewer 图片路径重写

### 问题

新增的 logo-design.md 在 Web 端打不开图。markdown 写的是 `../../apps/web/public/logo.png`（相对路径，便于 GitHub / IDE 预览）；Web 端是 SPA 路由 `/docs/prd/logo-design`，浏览器把相对路径解析成 `http://localhost:3000/apps/web/public/logo.png`——Vite 把 `public/` 暴露在**根**（`/logo.png`），不在那个 URL 上。结果：拿到 304 但不是图片。

### 修复

[docs-viewer.page.tsx](../../apps/web/src/modules/docs/pages/docs-viewer.page.tsx) 给 `markdownComponents` 加 `img` 处理器 + 路径重写函数：

```ts
function rewriteImageSrc(src) {
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src
  const m = src.match(/(?:^|\/)apps\/web\/public\/(.+)$/)
  if (m) return '/' + m[1]   // /logo.png 命中 Vite 根服务
  return src
}
```

源 markdown 不用改（仍能在 GitHub / IDE 直接预览），Web docs viewer 自动把 `apps/web/public/<x>` 重写到根路径 `/<x>`。后续 `public/` 下任何资产引用都自动适配。

---

## 5. 验证

| 项 | 结果 |
|---|---|
| `tsc --noEmit`（apps/web） | ok |
| Manifest 与磁盘 md 计数 | 58 ↔ 58，零游离零重复 |
| 架构 4 组互斥穷尽（21 篇文档分组合理） | ok |
| `<link rel="icon">` 加载 favicon | ok |
| 文档页 logo 渲染（dev server）  | 待用户刷新页面验证（已修复路径） |
| dev-log 待办框 | 13×13 原生勾选框 + 文字内联同行 |
| `make up-deps` Docker 构建 | 修复 `python/services` 残留后通过 |
| `CLAUDE.md` + `.claude/skills/` git tracking | `git status` 显示为未追踪文件，等 `git add` 入仓 |

---

## 6. Docker 构建上下文残留（昨日重构的尾巴）

### 现象

`make up-deps` 失败：

```
COPY failed: file not found in build context or excluded by .dockerignore:
stat python/services/pyproject.toml: file does not exist
```

### 根因

2026-05-02 删除 `python/services/` workspace 包时，pyproject.toml / uv.lock / 文档都同步清理了，但 [docker/python-workspace.Dockerfile](../../docker/python-workspace.Dockerfile) 漏掉两行：

```dockerfile
# Stage 1
COPY python/services/pyproject.toml python/services/pyproject.toml

# Stage 2
COPY python/services/src python/services/src
```

源目录已被 `git rm`，但 Dockerfile 仍试图把它复制进 build context，因此 build 阶段直接失败。

### 修复

[docker/python-workspace.Dockerfile](../../docker/python-workspace.Dockerfile) 两条相关 `COPY` 直接删除。再 grep 一遍 `Dockerfile / Makefile / *.yml / *.yaml / *.toml / *.lock / *.sh` 确认全仓没有 `python/services` 或 `ad-services` 的残留引用。

### 教训

下次删 workspace 包时，除了改 Python 侧的 `pyproject.toml` / `uv.lock` / 业务代码 / 文档，还要扫：

- [x] 根 `pyproject.toml` workspace members
- [x] 各 app `pyproject.toml` dependencies
- [x] `uv.lock`
- [x] `docker/*.Dockerfile`（**这次漏掉的**）
- [x] `docker-compose.yml`
- [x] `Makefile` / `*.sh`

后续可考虑在 CI 加一个 "git ls-files | xargs grep deleted_pkg_name" 的 sentinel job 防回归。

## 7. Claude 提效心得：把项目知识"教给 AI"

每次新开会话都被迫重讲一遍背景是最大的隐性成本。今天把项目积累的隐性约束沉淀成一份硬核 skill prompt，让任何加入项目的工程师（人或 AI）都能秒级进入状态。

### 7.1 落地

新增两个文件：

| 文件 | 作用 |
|---|---|
| [`CLAUDE.md`](../../CLAUDE.md) | 项目根目录入口；Claude Code 新会话**自动加载** |
| [`.claude/skills/AI_Data_Engine_Skill.md`](../../.claude/skills/AI_Data_Engine_Skill.md) | 硬核约束与 SOP 全文 |

两份都进 git，团队成员 `git pull` 后本地的 Claude / Cursor / Copilot 也能读到同一份基线，不需要每个人各自配置。

### 7.2 Skill Prompt 的 9 个板块（结构化记忆）

1. **核心世界观**——4 层闭环对象、Snowflake 事件中心、易混名词精确定义
2. **分层边界**——python/ ⇄ apps/ 判定测试与各目录硬约束
3. **数据库速查**——ORM 位置、`x_trace_id` 贯穿规则、Asset 血缘 FK
4. **六大模块**——Catalog / Requirement / Explorer / Operations / Pipelines / Tools 一句话职责
5. **任务执行 SOP**——6 步标准作业程序
6. **红线**——10 条非协商性禁止行为
7. **关键文件入口**——10 个文件按顺序看就懂代码
8. **沟通约定**——回复格式与精炼度
9. **维护规则**——架构变更时如何同步刷新本文件

### 7.3 用 Claude 高效协作的几条经验

| 经验 | 解释 |
|---|---|
| **先把约束写下来，再让 Claude 写代码** | 含糊指令 → 不可控产出。架构边界 / 红线 / 命名规范一次性沉淀到 `CLAUDE.md`，比每次都临时纠正高效一个数量级 |
| **历史下沉到 dev-log，架构文档只描设当下** | Claude 读架构文档时不会被"曾经 / 未来 / placeholder"的语义噪声干扰 |
| **判定规则比清单更长寿** | "如果 FastAPI 与 Dagster 都不存在，这段代码还应存在吗？"这种判定测试，比"X 类放 Y 目录"的清单更鲁棒——新增模块自动适用 |
| **关键文件入口编号** | 让 Claude 按 1→10 顺序看 10 个核心文件，比让它自由探索代码库要快得多，且产出质量稳定 |
| **每次任务结束让 Claude 给精炼总结** | "做了什么 / 影响哪些文件 / 验证结果"三段式，避免反复描述需求；下次会话直接 read 这一段就能续上 |
| **变更后立刻更新基线** | 重构（如删 workspace 包、改枚举）后第一时间 sync `CLAUDE.md` + skill；不更新 = 下次会话仍按旧约束行事，等于没重构 |
| **dev-log 是 Claude 的"短期记忆"** | 含糊需求来时让 Claude 先翻最近 3 篇 dev-log，绝大多数"为什么这样"都能找到 |

### 7.4 反例（曾踩过的坑）

- ❌ "把 SQLAlchemy ORM 也放 `python/core` 让大家共享"——Claude 真的会照做，但这破了 §2 分层边界
- ❌ "保留 `da_tags` 字段不动，新加一个 `tags_v2` 字段"——Claude 真的会做，但产生历史债且语义重叠
- ❌ "改一下文档，顺便把过去的演进史也写上"——Claude 真的会写，但架构文档会被噪音稀释

**对应对策**：把"不要这样"的红线（§6）写到 skill 里，而不是希望 Claude 自己悟。

### 7.5 沉淀到团队规范的好处

- **新人 onboarding 1 分钟**：read CLAUDE.md → read skill → 直接干活
- **AI 协作零启动成本**：所有 AI 工具（Claude Code / Cursor / Copilot Workspace）都能读 `CLAUDE.md`
- **架构约束变成 living document**：每次重构都迫使 sync skill，反过来推动文档保持新鲜
- **跨工程师产出一致性**：人和 AI 看同一份硬约束，代码风格 / 边界遵循自然趋同

## 8. 待办

- [ ] 全站还有部分老 markdown 用 `<img>` 直接写绝对路径或第三方 URL，下一轮可在 docs viewer 加 link 检查器扫游离引用
- [ ] favicon 当前是 16958 bytes 的单尺寸 ICO，未来可生成 multi-size（16/32/48）以适配高 DPI tab 视觉
- [ ] `personal-vs-enterprise.md` 与 `ai-data-platform-gap-map.md` 后续可考虑合并为一份"演进路线图与能力差距"，目前先并列在 ADR 节相邻位置
- [ ] dev-log 待办框可考虑补一个"已勾选" `:checked` 态（暗灰色 + 删除线）让 ✓ 的事项更弱化
- [ ] 把 `CLAUDE.md` + `.claude/skills/architecture/SKILL.md` `git add` 入仓后通知团队 `git pull`；建议同时在 README "如何加入项目"小节链一下这两个文件
- [ ] CI 加一个 sentinel job：`grep -rn "python/services\|TaskType.ANNOTATION\|TaskType.QUALITY_CHECK\|TaskType.PIPELINE\|da_tags" --include="*.py" --include="*.yaml" --include="Dockerfile*"` 命中即失败，防止已 deprecated 的命名回潜
- [ ] Skill prompt 维护节奏：每个 dev-log 末尾问一句"本次变更是否需要更新 skill"，养成肌肉记忆
