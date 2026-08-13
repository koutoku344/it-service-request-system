#!/bin/bash

set -euo pipefail

PROJECT_DIR="/opt/it-service-request-system"
BACKUP_DIR="/opt/backups/postgresql"
DB_NAME="appdb"
DB_USER="appuser"
BACKUP_BUCKET="it-service-request-system-dev-backup-006635110954"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

cd "${PROJECT_DIR}"

echo "PostgreSQL backup started: $(date)"

docker compose exec -T postgres \
  pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -Fc \
  > "${BACKUP_FILE}"

if [ ! -s "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file is empty."
  exit 1
fi

aws s3 cp \
  "${BACKUP_FILE}" \
  "s3://${BACKUP_BUCKET}/postgresql/"

# Delete local backup files older than 7 days
find "${BACKUP_DIR}" \
  -type f \
  -name "${DB_NAME}_*.dump" \
  -mtime +6 \
  -delete

echo "Backup completed: ${BACKUP_FILE}"
echo "PostgreSQL backup finished: $(date)"
