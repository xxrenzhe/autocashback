#!/bin/sh
set -eu

npm run env:check
npm run db:bootstrap
export SKIP_RUNTIME_DB_INIT=true

exec /usr/bin/supervisord -c /app/supervisord.conf
