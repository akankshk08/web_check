#!/usr/bin/env bash
# DEV/TEST ONLY. Starts a local Supabase-compatible stack:
#   - Supabase Auth (GoTrue) in Docker, using your local Postgres (auth schema)
#   - the gateway (auth proxy + storage emulation) on :54321
# Requires: Docker, Postgres on localhost:5432 (user postgres/postgres), database $DB (default agencyos).
set -euo pipefail
DB="${DB:-agencyos}"
DIR="$(cd "$(dirname "$0")" && pwd)"
SECRET="$(node -e 'import("'"$DIR"'/keys.mjs").then(m=>console.log(m.JWT_SECRET))')"

PGPASSWORD=postgres psql -h localhost -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
SQL

docker rm -f agencyos-auth >/dev/null 2>&1 || true
docker run -d --name agencyos-auth --network host \
  -e GOTRUE_API_HOST=127.0.0.1 -e PORT=9999 \
  -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres \
  -e "GOTRUE_DB_DATABASE_URL=postgres://postgres:postgres@localhost:5432/${DB}?search_path=auth" \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e 'GOTRUE_URI_ALLOW_LIST=http://localhost:3000/**' \
  -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true \
  -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_JWT_EXP=3600 -e "GOTRUE_JWT_SECRET=${SECRET}" \
  -e GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 -e GOTRUE_SMTP_ADMIN_EMAIL=dev@localhost \
  supabase/gotrue:v2.177.0 >/dev/null

for i in $(seq 1 30); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:9999/health >/dev/null || { docker logs agencyos-auth | tail -20; exit 1; }
echo "[local-supabase] auth ready"
node "$DIR/keys.mjs"
