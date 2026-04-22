"""Catalog-layer adapters.

Hosts the clip catalog index that backs the ``/clips`` REST routes with a
cached, filterable, paginated view over the Lance-on-disk dataset.
"""

from .sqlite_clip_index import ClipCatalogIndex

__all__ = ['ClipCatalogIndex']
