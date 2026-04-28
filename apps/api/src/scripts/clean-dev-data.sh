#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
DRY_RUN=false
ASSUME_YES=false
CLEAN_DOCKER=false

DATA_DIRS=(
  "data/raw"
  "data/assets"
  # legacy stage dirs (ingest/curate/publish, bronze/silver/gold) — cleaned for backward compat
  "data/ingest"
  "data/curate"
  "data/publish"
  "data/bronze"
  "data/silver"
  "data/gold"
  "data/lance"
  "data/duckdb"
  "data/metadata"
  "data/exports"
)

usage() {
  cat <<'EOF'
Usage: bash apps/api/src/scripts/clean-dev-data.sh [options]

Clear local development dirty data under the repository data/ directory.

Options:
  --docker    Also run `docker compose down -v --remove-orphans` to clear local compose volumes.
  --dry-run   Print what would be removed without deleting anything.
  --yes       Skip the confirmation prompt.
  -h, --help  Show this help message.
EOF
}

log() {
  printf '%s\n' "$1"
}

clear_dir_contents() {
  local dir="$1"
  local abs_dir="$ROOT_DIR/$dir"

  if [[ ! -d "$abs_dir" ]]; then
    log "[skip] $dir does not exist"
    return 0
  fi

  log "[clean] $dir"
  if [[ "$DRY_RUN" == true ]]; then
    find "$abs_dir" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -print
    return 0
  fi

  find "$abs_dir" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec rm -rf {} +
}

confirm() {
  if [[ "$ASSUME_YES" == true ]]; then
    return 0
  fi

  log "This will remove local dev data from:"
  for dir in "${DATA_DIRS[@]}"; do
    log "  - $dir"
  done
  if [[ "$CLEAN_DOCKER" == true ]]; then
    log "  - docker compose volumes for this workspace"
  fi

  printf 'Continue? [y/N] '
  read -r answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    log "Aborted."
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker)
      CLEAN_DOCKER=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --yes)
      ASSUME_YES=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

confirm

for dir in "${DATA_DIRS[@]}"; do
  clear_dir_contents "$dir"
done

if [[ "$CLEAN_DOCKER" == true ]]; then
  if command -v docker >/dev/null 2>&1; then
    log "[clean] docker compose volumes"
    if [[ "$DRY_RUN" == true ]]; then
      log "[dry-run] docker compose down -v --remove-orphans"
    else
      (
        cd "$ROOT_DIR"
        docker compose down -v --remove-orphans
      )
    fi
  else
    log "[skip] docker is not installed"
  fi
fi

log "Done."