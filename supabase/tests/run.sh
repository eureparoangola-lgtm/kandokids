#!/usr/bin/env bash
# Cria uma base de dados limpa, aplica o stub + migrações + seed e corre os testes.
# Uso: PGHOST=/var/tmp/kkpg PGPORT=5499 ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=kandokids_test
psql -U postgres -qX -c "drop database if exists $DB" -c "create database $DB" >/dev/null
P="psql -U postgres -d $DB -qX -v ON_ERROR_STOP=1"
$P -f tests/_supabase_stub.sql >/dev/null
for f in migrations/*.sql; do echo "→ $f"; $P -f "$f" >/dev/null; done
echo "→ seed.sql"; $P -f seed.sql >/dev/null
echo "→ testes"; $P -o /dev/null -f tests/scenarios.sql 2>&1 | sed -E "s/^psql:[^ ]+ NOTICE:  //"
