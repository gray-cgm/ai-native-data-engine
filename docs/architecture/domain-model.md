# 领域模型草图

## 核心对象

平台围绕“数据资产”组织，而不是围绕目录结构或零散脚本组织。

```text
Raw Data
-> RawRecord
-> Sample
-> Dataset
-> DatasetVersion
-> JobRun
-> ExportJob
-> LineageEvent
```

## 实体说明

### Raw Data
来自本地目录、传感器、日志，或未来对象存储的数据原始输入资产。
它们始终是事实来源。

### RawRecord
对原始输入 metadata 的统一归一化表达，使不同数据源布局都能用一致方式处理。

### Sample
平台内部最小的统一样本单元。
当前 MVP 中，Sample 主要来自图像文件和 JSON metadata。
未来可以扩展到点云、轨迹、视频，以及多模态传感器组合样本。

一个 Sample 通常关心：

- sample ID
- source URI
- scene / category tags
- annotation 或 labeling state
- embedding 或 retrieval vectors
- dataset membership

### Dataset
被平台统一管理的一组逻辑样本集合。
它是平台 UI、API 与导出流程中稳定的 catalog 对象。

### DatasetVersion
某个 Dataset 的版本化快照。
它存在的意义是让系统可以回答：

- 当前暴露给用户的是哪个数据版本？
- 训练使用的是哪一个版本？
- 这个版本背后对应的是哪张表 / 哪次物化结果？
- 哪些导出产物属于这个版本？

### JobRun
一次执行实例的记录，例如：

- ingestion run
- materialization run
- indexing run
- export run

### ExportJob
用户可见的导出请求及其结果。
当前支持的格式包括：

- Parquet
- CSV
- JSONL

### LineageEvent
连接运行、版本和数据产物的最小血缘记录。
即使在本地 MVP 中，这也是非常重要的对象，因为它能从一开始就建立正确的数据系统习惯。

## 访问模型映射

领域模型与访问模式刻意分离：

- metadata plane：datasets、versions、workspaces、tasks、runs、exports、lineage
- query plane：distribution、过滤、分析、聚合
- table plane：基于 Parquet 的样本物化表
- search plane：样本索引上的 preview 与 retrieval
- storage plane：原始文件 / 对象访问

## 为什么这个模型重要

这个模型让平台即使建立在文件之上，依然呈现出“类数据库”的使用体验。用户应该通过数据资产、API、SDK 来工作，而不是直接依赖底层文件路径或存储凭证。
