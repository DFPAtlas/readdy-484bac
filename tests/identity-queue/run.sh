#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
db="$(docker run -d --rm --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15-alpine)"
trap 'docker stop "$db" >/dev/null' EXIT
for ((attempt=0; attempt<20; attempt++)); do
  if docker exec "$db" pg_isready -q; then
    break
  fi
  sleep 1
done
docker exec -i "$db" psql -U postgres -v ON_ERROR_STOP=1 < tests/identity-queue/baseline.sql >/dev/null
docker exec -i "$db" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261124000100_identity_document_queue_v2.sql >/dev/null
python3 tests/identity-queue/regression.py "$db"
docker exec -i "$db" psql -U postgres -v ON_ERROR_STOP=1 < docs/identity-document-queue-phase-3a-rollback.sql >/dev/null
docker exec -i "$db" psql -XAtq -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if exists (select 1 from identity_queue_private.workers where enabled) or
     has_function_privilege('service_role','app.enqueue_identity_document_check(uuid,uuid,jsonb,jsonb)','EXECUTE') or
     has_function_privilege('authenticated','app.claim_identity_document_check()','EXECUTE') or
     (select count(*) from app.document_checks) <> 5 or
     (select count(*) from app.document_checks where submission_version is null and status='done'
        and attempts=2 and decision='review' and reasons='["legacy_review"]'::jsonb) <> 1 or
     (select count(*) from app.guard_verification_audit where id=100 and action='legacy_document_review') <> 1 then
    raise exception 'roll back did not fence the worker or retain queue rows';
  end if;
end $$;
SQL
echo 'PASS fail-closed rollback and queue retention'
