#!/bin/bash
set -e

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

start() {
  echo "Starting MinIO containers..."
  cd "$BASE_DIR/infra/minio"
  docker compose -p december-minio up -d

  echo "Starting Postgres containers..."
  cd "$BASE_DIR/infra/postgres"
  docker compose -p december-postgres up -d

  echo "All containers started successfully"
}

stop() {
  echo "Stopping Postgres containers..."
  cd "$BASE_DIR/infra/postgres"
  docker compose -p december-postgres down

  echo "Stopping MinIO containers..."
  cd "$BASE_DIR/infra/minio"
  docker compose -p december-minio down

  echo "All containers stopped"
}

case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  *)
    echo "Usage: $0 {start|stop}"
    exit 1
    ;;
esac