"""Dagster resource：把 RuntimeContainer 的装配从 asset 体内挪到资源定义。

以前每个 asset 都自己 ``build_container(Path(...))``，既重复又把"profile 路径
来自哪里"这个 wiring 关切散在各个 asset 里。改为通过 Dagster resource 注入：
asset body 只用 ``context.resources.container`` 拿到容器，业务流程交给
``python/workflows`` 的纯函数。
"""

from __future__ import annotations

from pathlib import Path

from dagster import ConfigurableResource

from core.profiles.runtime import RuntimeContainer
from profiles import build_container


class RuntimeContainerResource(ConfigurableResource):
    """按 profile 路径懒加载 RuntimeContainer 的 Dagster resource。

    用法：
        @asset(required_resource_keys={'container'})
        def my_asset(context) -> dict:
            container = context.resources.container.get()
            return run_xxx_demo(container)
    """

    profile_path: str = 'infra/profiles/local-dev.yaml'

    def get(self) -> RuntimeContainer:
        return build_container(Path(self.profile_path))
