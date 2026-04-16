# 读书笔记: DDIA2 Chapter-3，数据模型与查询语言在标注系统中的实践
在阅读《DDIA》第三章后，结合我们在标注系统（如[GTA数据底座改造](https://xiaopeng.feishu.cn/wiki/O8vfwXfEdiSBFskKfoFcH3PHnBf)中的讨论与实践），大家构思过用关系型数据模型，甚至guiming提过用Graph DB存储label的proposal[结构化存储标注数据](https://xiaopeng.feishu.cn/docx/Zb3FdSMOXoLeAHxbmrkcEt23n9F)，我深刻体会到：设计数据模型本质上是在一致性、可演化性、查询性能、读写成本以及系统复杂度之间寻找平衡。对于标注系统而言，最现实的答案往往是混合方案：用规范化管理稳定主数据，用文档承载复杂标注对象，用反规范化服务查询与展示
> 一些关于GTA数据结构 Data Model讨论文章
> 大数据技术方案调研/技术选型 https://xiaopeng.feishu.cn/docx/XLJedEJD2o1JNdx7f2zcSQv3nke
> 数据底座讨论纪要，https://xiaopeng.feishu.cn/docx/Jy7SdO3qjovwi7xIdG1cW5zZnpe
> 标注系统数据库分层设计，https://xiaopeng.feishu.cn/docx/UnN0dZ7l3odi2Ex948wcoSJmngd
> https://xiaopeng.feishu.cn/wiki/Bzj0waqeki0gAmkSpwmccInUnqe#share-Kengd2OUVojCc7x48nQcTFQQnYc

一、 核心取舍：关系型 vs 文档型
在标注系统中，不应盲目站队关系型或文档型，而是要区分数据的业务属性进行分层建模。
1. 管理性数据：适合关系型（Relational）
标注系统的管理侧数据是强结构化的，例如：项目、任务、用户、工作流节点、审核状态等。

特征：实体边界清晰、关系稳定，且常常涉及多对多关联（如用户与任务的分配）
优势：关系型数据库能很好地提供事务保障、数据约束，并支持复杂的统计、筛选和后台管理查询（Join 操作）。
2. 标注内容数据（labeledData）：适合文档型（Document）
标注结果本质上是一个复杂的“聚合对象”，通常包含深层嵌套的树状结构（one-to-many）、多模态数据（图片、点云、视频帧）、动态的几何形状（bbox、polygon）以及各种灵活的属性（properties）。

特征：层级深、结构变化频繁、每次读取时通常需要一次性加载全量数据。
优势：
局部性（Locality）：文档模型将相关数据存在一起，避免了将一棵树拆分成几十张表导致的“Join 爆炸”和极其痛苦的 Schema 演进。
读时模式（Schema-on-read）：文档数据库通常不强制校验写入数据的结构，这赋予了极大的灵活性。应对字段的新增，应用程序只需在读取时进行兼容解析，而不需要频繁执行沉重的数据库 Schema Migration（Schema-on-write）。


二、 规范化 vs 反规范化（Normalization vs. Denormalization）
规范化的核心是建立单一事实来源，而反规范化的核心是用空间（冗余）换取时间（查询性能）。在标注系统中，这两种手段需要配合使用。

1. 什么该规范化？
规范化适用于“会被全局复用、会变化、需要统一治理”的数据：

稳定字典和枚举：如分类标签定义（label class）、属性 Schema、设备/场景字典等。应独立存储并通过 ID 引用，修改时牵一发而动全身。
平台主数据：用户、组织、项目体系等独立实体。
2. 什么时候值得反规范化（冗余）？
对标注系统来说，反规范化常用于满足“历史证据”和“高效分析”的需求：

历史快照冗余：在 Annotation 中冗余写入时的 class_name、annotator_name、标注工具版本等。标注系统往往是“历史证据系统”，这种冗余能保证历史回放时语义不被后续的字典修改所破坏。
派生宽表与索引（OBT）：为了列表页展示或 TPI（产能）统计，如果每次都去解析海量的 JSON payload 会导致极大的性能灾难。更好的做法是通过异步计算构建大宽表（One Big Table, OBT）或搜索索引来满足 OLAP 分析需求

三、 数仓建模与高阶架构模式
在处理复杂的统计与事件追溯时，DDIA 提及的几种模式对标注系统也有很大启发：

1. 事实表（Fact Table） vs 拉链表（Zipper Table）
在星型模式（Star Schema）或雪花模式中：
事实表：像是一本“流水账日记”，记录瞬间发生的事件（如标注员提交、驳回），主要用于回答“发生了几次”（动词属性）。
拉链表：像是一份“档案变迁史”，记录实体的持续状态变更（如标注员从培训期、爬坡期到生产期的状态转移），主要用于追溯“那个时候它是什么状态”（名词/形容词属性）。
2. CQRS 与 Event Sourcing
事件溯源（Event Sourcing）将数据表示为不可变事件的追加日志（Append-only log）。写端负责处理业务逻辑并产生事件，读端（通过 CQRS）监听事件并实时更新专门用于高频查询的视图表（Materialized Views）。这在处理标注系统的复杂流转状态和行为追溯时非常契合。

四、 图模型与 DataFrame
随着自动驾驶与 AI 业务的发展，标注数据和分析场景也越来越复杂：

1. 图数据模型（Graph-Like Data Models）
当数据中的多对多关系变得非常普遍且复杂（例如标注员交互行为、复杂场景下的实体关联关系），传统关系型处理会非常吃力，此时将其建模为图是最自然的选择。图数据库（如 Neo4j）支持跨越多跳的递归查询，能够高效地检索高度关联的数据。

2. DataFrame 与机器学习
DataFrame 模型虽然不常用于在线事务处理（OLTP），但它是现代数据科学的基石。在标注系统下游，算法科学家（MLE）需要使用 DataFrame（如 Pandas, Spark）来进行数据探索、清洗以及为训练机器学习模型做准备。

总结
正如 DDIA 中所说，没有一种数据模型可以包打天下。现代数据系统的趋势是走向融合（Convergence）。对于标注系统而言：

关系型 + 规范化：管好人、事、物的主链路。
文档型 + 读时模式：装下复杂多变、树状结构的标注 Payload。
反规范化 + CQRS/宽表：解决看数据、查历史、算产能的痛点。