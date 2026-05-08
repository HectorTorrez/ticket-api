#!/bin/sh
set -e
pnpm exec prisma migrate deploy
exec node dist/src/main.js
