#!/bin/sh
# 수동 백업 스크립트 (crontab 등록 예시 아래)
# crontab: 0 3 * * * /path/to/smartfarm/backend/scripts/backup.sh

set -e
DB_PATH="${DB_PATH:-$(dirname "$0")/../data/smartfarm.db}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
KEEP=${KEEP:-14}

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M)
OUT="$BACKUP_DIR/smartfarm-$STAMP.db"

sqlite3 "$DB_PATH" ".backup '$OUT'"
echo "[backup] $OUT"

# 오래된 백업 정리
ls -1t "$BACKUP_DIR"/smartfarm-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
