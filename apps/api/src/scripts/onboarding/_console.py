"""统一的 console 打印工具：让 onboarding demos 看起来一致、易调试。

全部 demo 都用 ``banner()`` / ``step()`` / ``kv()`` / ``done()`` 这几个 helper，
新人一眼能看懂"现在跑到第几步、做了什么、产出了什么"。
"""

from __future__ import annotations

from typing import Any


_BAR = "═" * 72
_LINE = "─" * 72


def banner(title: str, subtitle: str = "") -> None:
    """大标题——每个 demo 开头打一次。"""
    print()
    print(_BAR)
    print(f"  📚  {title}")
    if subtitle:
        print(f"     {subtitle}")
    print(_BAR)


def step(num: int | str, title: str, hint: str = "") -> None:
    """小节标题——demo 内部分段时打。"""
    print()
    print(_LINE)
    print(f"▶ Step {num} · {title}")
    if hint:
        print(f"    💡 {hint}")
    print(_LINE)


def kv(label: str, value: Any, indent: int = 2) -> None:
    """打印 key: value，对齐美观。"""
    pad = " " * indent
    print(f"{pad}{label:<24}: {value}")


def info(msg: str) -> None:
    print(f"  ℹ  {msg}")


def warn(msg: str) -> None:
    print(f"  ⚠  {msg}")


def done(msg: str) -> None:
    print(f"  ✔  {msg}")


def hr() -> None:
    print(_LINE)


def end_banner(msg: str) -> None:
    print()
    print(_BAR)
    print(f"  ✅ {msg}")
    print(_BAR)
    print()
