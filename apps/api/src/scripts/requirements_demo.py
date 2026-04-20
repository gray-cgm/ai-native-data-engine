"""需求管理系统 Demo 数据脚本

运行方式：
    make req-demo           # 创建 demo 需求 + 数据任务并打印结果
    make req-list           # 列出所有需求（表格）
    make req-sign-off       # 对首个 pending 任务执行 approve

脚本直接调用本地 FastAPI（默认 http://localhost:8000），
无需任何额外依赖，只需 API 服务已启动。
"""

import json
import sys
import urllib.request
import urllib.error

API_BASE = "http://localhost:8000"


# ─── HTTP helpers ─────────────────────────────────────────────────────────────


def _request(method: str, path: str, body: dict | None = None):
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode()
        print(f"  [HTTP {exc.code}] {method} {path}: {body_text}")
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(f"  [Connection error] {exc.reason}")
        print(f"  → Make sure the API is running: make dev-api")
        sys.exit(1)


def get(path: str):
    return _request("GET", path)


def post(path: str, body: dict):
    return _request("POST", path, body)


def patch(path: str, body: dict):
    return _request("PATCH", path, body)


# ─── Demo data ────────────────────────────────────────────────────────────────

REQUIREMENTS_SEED = [
    {
        "title": "夜间十字路口 VRU Hard-Case 补采",
        "description": "当前模型在夜间行人过街场景的 AP 低于阈值，需要补充 10k 帧标注数据提升覆盖率。",
        "priority": "high",
        "source": "algorithm",
        "dre_owner": "zhangsan@example.com",
        "target_scene": "夜间十字路口行人过街",
        "scene_tags": ["夜间", "十字路口", "VRU", "行人"],
        "vehicle_tags": ["L4", "乘用车"],
        "estimated_data_volume": 10000,
    },
    {
        "title": "隧道入口强光鬼影场景数据采集",
        "description": "隧道入口逆光和鬼影导致感知误检，需专项采集并标注 5k 帧。",
        "priority": "medium",
        "source": "dre",
        "dre_owner": "lisi@example.com",
        "target_scene": "隧道入口强光",
        "scene_tags": ["隧道", "强光", "逆光", "鬼影"],
        "vehicle_tags": ["L4"],
        "estimated_data_volume": 5000,
    },
    {
        "title": "雨天高速切入 Corner Case 闭环",
        "description": "雨天视觉降质 + 高速急切入，目标遮挡严重，补采 3k 帧进行 2D/3D 标注。",
        "priority": "high",
        "source": "product",
        "dre_owner": "wangwu@example.com",
        "target_scene": "雨天高速变道切入",
        "scene_tags": ["雨天", "高速", "切入", "遮挡"],
        "vehicle_tags": ["L2+", "L4", "乘用车"],
        "estimated_data_volume": 3000,
    },
]

DATA_TASKS_SEED = [
    # ── Req 0 tasks ──
    [
        {
            "title": "夜间 VRU 采集作业 - 北京四环",
            "task_type": "collection",
            "assigned_to": "collection-team@example.com",
            "target_count": 5000,
        },
        {
            "title": "夜间 VRU 2D Bbox 标注",
            "task_type": "annotation",
            "assigned_to": "annotation-vendor@example.com",
            "target_count": 5000,
        },
        {
            "title": "夜间 VRU 特征提取流水线",
            "task_type": "pipeline",
            "assigned_to": "pipeline-team@example.com",
            "target_count": 10000,
        },
    ],
    # ── Req 1 tasks ──
    [
        {
            "title": "隧道入口采集 - 沪蓉高速段",
            "task_type": "collection",
            "assigned_to": "collection-team@example.com",
            "target_count": 3000,
        },
        {
            "title": "隧道场景像素级分割标注",
            "task_type": "annotation",
            "assigned_to": "annotation-vendor@example.com",
            "target_count": 2000,
        },
    ],
    # ── Req 2 tasks ──
    [
        {
            "title": "雨天高速采集 - G2 京沪段",
            "task_type": "collection",
            "assigned_to": "collection-team@example.com",
            "target_count": 2000,
        },
        {
            "title": "雨天 3D 点云融合标注",
            "task_type": "annotation",
            "assigned_to": "annotation-vendor@example.com",
            "target_count": 1500,
        },
    ],
]


def cmd_seed():
    """创建全套 demo 需求与数据任务"""
    print("─" * 60)
    print("需求管理系统 Demo 数据初始化")
    print("─" * 60)

    req_ids = []
    for i, req_data in enumerate(REQUIREMENTS_SEED):
        resp = post("/api/v1/requirements", req_data)
        req_id = resp["id"]
        req_ids.append(req_id)
        print(f"\n[{i+1}] 需求已创建: {resp['title']}")
        print(f"    id       : {req_id}")
        print(f"    priority : {resp['priority']}")
        print(f"    status   : {resp['status']}")
        print(f"    scene_tags: {resp.get('scene_tags', [])}")

        for task_data in DATA_TASKS_SEED[i]:
            task_data["requirement_id"] = req_id
            task_resp = post("/api/v1/data-tasks", task_data)
            print(f"    ↳ 任务: [{task_resp['task_type']}] {task_resp['title']}")
            print(f"          id={task_resp['id'][:8]}… sign_off={task_resp['sign_off_status']}")

    print("\n" + "─" * 60)
    print(f"共创建 {len(req_ids)} 条需求，{sum(len(t) for t in DATA_TASKS_SEED)} 个数据任务。")
    print("\n后续可运行：")
    print("  make req-list      # 查看所有需求")
    print("  make req-sign-off  # 审批首个 pending 任务")
    print("  make req-stats     # 查看统计看板")
    print("─" * 60)


def cmd_list():
    """列出所有需求（表格格式）"""
    resp = get("/api/v1/requirements?page=1&page_size=50")
    items = resp.get("items", [])
    total = resp.get("total", 0)

    print("─" * 80)
    print(f"需求列表  (共 {total} 条)")
    print("─" * 80)
    print(f"{'#':<3} {'优先级':<8} {'状态':<14} {'任务数':<6} {'标题'}")
    print("─" * 80)
    for i, item in enumerate(items, 1):
        print(
            f"{i:<3} {item['priority']:<8} {item['status']:<14} "
            f"{item['task_count']:<6} {item['title']}"
        )
    print("─" * 80)


def cmd_stats():
    """打印需求统计"""
    stats = get("/api/v1/requirements/stats")
    print("─" * 40)
    print("需求统计")
    print("─" * 40)
    print(f"  总计: {stats['total']}")
    print("\n  按状态:")
    for k, v in sorted(stats.get("by_status", {}).items()):
        print(f"    {k:<20} {v}")
    print("\n  按优先级:")
    for k, v in sorted(stats.get("by_priority", {}).items()):
        print(f"    {k:<20} {v}")
    print("\n  按来源:")
    for k, v in sorted(stats.get("by_source", {}).items()):
        print(f"    {k:<20} {v}")
    print("─" * 40)


def cmd_sign_off():
    """对首个 pending sign-off 任务执行 approve"""
    resp = get("/api/v1/data-tasks?sign_off_status=pending&page_size=1")
    items = resp.get("items", [])
    if not items:
        print("没有 pending 的数据任务，请先运行 make req-demo 创建 demo 数据。")
        return

    task = items[0]
    task_id = task["id"]
    print(f"审批任务: {task['title']}")
    print(f"  id           : {task_id}")
    print(f"  sign_off_status (before): {task['sign_off_status']}")

    result = post(
        f"/api/v1/data-tasks/{task_id}/sign-off",
        {"approved": True, "sign_off_by": "admin@example.com", "comment": "demo approve"},
    )
    print(f"  sign_off_status (after) : {result['sign_off_status']}")
    print(f"  status (after)          : {result['status']}")
    print("审批完成。")


# ─── Entry point ──────────────────────────────────────────────────────────────

COMMANDS = {
    "seed": cmd_seed,
    "list": cmd_list,
    "stats": cmd_stats,
    "sign-off": cmd_sign_off,
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if cmd not in COMMANDS:
        print(f"Unknown command: {cmd}. Valid: {list(COMMANDS)}")
        sys.exit(1)
    COMMANDS[cmd]()
