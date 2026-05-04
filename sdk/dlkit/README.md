# dlkit · Data Loop Kit

面向**算法工程师**消费 AI Native Data Engine 出仓数据的最小 SDK。MVP 范围：
fetch snapshot + 迭代 sample + 上报消费事件。

## 安装

```bash
pip install dlkit  # 内部 PyPI（待上架）
# 或开发态
cd sdk/dlkit && pip install -e .
```

## 30 秒上手

```python
import dlkit

dlkit.configure(base_url="http://platform.local:8000")

with dlkit.run(snapshot_traces=["trace_e2e_xxx"], consumer="me@team") as r:
    for sample in dlkit.dataset("trace_e2e_xxx"):
        # ... 训练 ...
        r.report(sample_uid=sample["sample_uid"], epoch=0, step=42)
```

### Per-sample loss（hard sample mining 关键）

```python
with dlkit.run(snapshot_traces=["trace_e2e_xxx"]) as r:
    logger = dlkit.LossLogger(r)
    for epoch in range(num_epochs):
        for step, batch in enumerate(loader):
            x, y, sample_uids = batch
            logits = model(x)
            losses = loss_fn(logits, y)             # reduction='none' → shape [batch]
            logger.log(sample_uids, losses.detach().cpu().tolist(),
                       epoch=epoch, step=step)
            losses.mean().backward(); opt.step()
```

平台 Hard Samples Tab 自动按 `mean_loss * log(1 + consumed_count)` 排序，越上面越值得回流到下一轮 mining。

环境变量：`DLKIT_BASE_URL` / `DLKIT_TOKEN` / `MLFLOW_RUN_ID` / `WANDB_RUN_ID`
（自动 detect）。

## 设计取舍（MVP）

- **buffer 是普通 list + 后台 daemon thread**——失败仅 log warning，不本地落盘
  / 不重试（P3 再补）
- **dataset() 返回 list[dict]**——不依赖 PyTorch；要 IterableDataset 算工自包
- **不做 LossLogger**——P2 范围

详见 [`docs/dev-logs/2026-05-04-exports-sample-contribution-design.md`](../../docs/dev-logs/2026-05-04-exports-sample-contribution-design.md)。
