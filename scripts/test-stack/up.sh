#!/usr/bin/env bash
# Starts a minimal Supabase-compatible stack for end-to-end tests:
#   Postgres (yours) + GoTrue (auth) + PostgREST (API) + a tiny gateway on :54321
# Requires: Docker, psql, node, and a reachable Postgres (PGHOST/PGPORT/PGUSER/PGPASSWORD).
# Extra SQL files passed as arguments are applied after the seed.
# Prints the anon key on the last line.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=${KK_DB:-kandokids_e2e}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
SECRET=${KK_JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}
GOTRUE_IMAGE=${GOTRUE_IMAGE:-supabase/gotrue:v2.198.0}
POSTGREST_IMAGE=${POSTGREST_IMAGE:-postgrest/postgrest:v16.6}
LOGS=${KK_LOGS:-/tmp/kandokids-stack}
mkdir -p "$LOGS"

P="psql -U $PGUSER -qX -v ON_ERROR_STOP=1"
echo "→ fresh database $DB" >&2
$P -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
$P -d "$DB" -f scripts/test-stack/setup-db.sql >/dev/null

echo "→ GoTrue (auth)" >&2
docker rm -f kk-auth kk-rest >/dev/null 2>&1 || true
docker run -d --name kk-auth --network host \
  -e GOTRUE_API_HOST=127.0.0.1 -e PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_NAMESPACE=auth \
  -e DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:$PGPORT/$DB?sslmode=disable&search_path=auth" \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e GOTRUE_JWT_SECRET="$SECRET" -e GOTRUE_JWT_EXP=3600 \
  -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
  -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true \
  "$GOTRUE_IMAGE" >/dev/null
for i in $(seq 1 60); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:9999/health >/dev/null || { docker logs kk-auth >&2; exit 1; }

echo "→ migrations + seed" >&2
for f in supabase/migrations/*.sql supabase/seed.sql "$@"; do $P -d "$DB" -f "$f" >/dev/null; done
$P -d "$DB" -c "grant execute on function auth.uid() to anon, authenticated" >/dev/null

echo "→ PostgREST (API)" >&2
docker run -d --name kk-rest --network host \
  -e PGRST_DB_URI="postgres://authenticator:postgres@127.0.0.1:$PGPORT/$DB" -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SECRET" -e PGRST_SERVER_PORT=3001 \
  -e PGRST_DB_EXTRA_SEARCH_PATH=public,extensions "$POSTGREST_IMAGE" >/dev/null

echo "→ gateway :54321" >&2
pkill -f scripts/test-stack/gateway.mjs 2>/dev/null || true
nohup node scripts/test-stack/gateway.mjs > "$LOGS/gateway.log" 2>&1 &
ANON=$(node scripts/test-stack/jwt.mjs anon "$SECRET")
# Pronto quando a API responde (anónimos não têm acesso às tabelas, por isso basta haver resposta HTTP).
api_up() { [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:54321/rest/v1/features?limit=1" -H "apikey: $ANON")" != "000" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:54321/rest/v1/features?limit=1" -H "apikey: $ANON")" != "502" ]; }
for i in $(seq 1 30); do api_up && break; sleep 1; done
api_up || { docker logs kk-rest >&2; exit 1; }
echo "✔ stack ready" >&2
echo "$ANON"
