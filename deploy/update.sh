#!/usr/bin/env bash
# Updates the server to the latest version on GitHub (run by GitHub Actions, or by hand as 'deploy').
set -euo pipefail
cd /opt/kandokids
git fetch --depth 1 origin main
git reset --hard origin/main
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build --remove-orphans
docker image prune -f >/dev/null
echo "Kandokids atualizado para $(git rev-parse --short HEAD)"
