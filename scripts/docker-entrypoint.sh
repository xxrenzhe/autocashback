#!/bin/sh
set -eu

log_json() {
  level="$1"
  msg="$2"
  printf '{"ts":"%s","service":"autocashback-entrypoint","level":"%s","msg":"%s"}\n' "$(date -Iseconds)" "$level" "$msg"
}

mkdir -p /app/tmp /app/logs

log_json info "entrypoint_start"
npm run env:check
log_json info "env_check_complete"
npm run db:bootstrap
log_json info "db_bootstrap_complete"
export SKIP_RUNTIME_DB_INIT=true
log_json info "runtime_db_init_disabled"

exec /usr/bin/supervisord -c /app/supervisord.conf
