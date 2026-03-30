#!/bin/sh
set -eu

npm run env:check
npm run db:bootstrap

exec /usr/bin/supervisord -c /app/supervisord.conf
