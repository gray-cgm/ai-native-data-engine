import os

import uvicorn


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def main() -> None:
    host = os.getenv('API_HOST', '127.0.0.1')
    port = int(os.getenv('API_PORT', '8000'))
    reload_enabled = _as_bool(os.getenv('API_RELOAD'), True)

    uvicorn.run('src.main:app', host=host, port=port, reload=reload_enabled)


if __name__ == '__main__':
    main()
