#!/bin/sh
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
./node_modules/.bin/prisma migrate deploy
exec node dist/src/main.js
