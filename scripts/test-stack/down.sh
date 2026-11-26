#!/usr/bin/env bash
docker rm -f kk-auth kk-rest >/dev/null 2>&1 || true
pkill -f scripts/test-stack/gateway.mjs 2>/dev/null || true
echo "stack stopped"
