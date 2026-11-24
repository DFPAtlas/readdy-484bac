#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
db="$(docker run -d --rm --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15-alpine)"
trap 'docker stop "$db" >/dev/null' EXIT
for ((attempt=0; attempt<20; attempt++)); do
  if docker exec "$db" pg_isready -q; then break; fi
  sleep 1
done
for script in tests/identity-queue/baseline.sql tests/guard-document-review/schema.sql \
    supabase/migrations/20261124000100_identity_document_queue_v2.sql \
    supabase/migrations/20261124000200_guard_document_human_review.sql; do
  docker exec -i "$db" psql -U postgres -v ON_ERROR_STOP=1 < "$script" >/dev/null
done
python3 tests/guard-document-review/regression.py "$db"

docker exec -i "$db" psql -XAtq -U postgres -v ON_ERROR_STOP=1 < docs/guard-document-review-phase-3d-rollback.sql >/dev/null
docker exec -i "$db" psql -XAtq -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if has_function_privilege('authenticated','app.approve_guard_document_review(uuid,uuid,text)','EXECUTE')
    or (select count(*) from identity_queue_private.human_review_audit where event='approved')<>1
    or not exists (select 1 from pg_trigger where tgname='zz_guard_document_review_fence') then
    raise exception 'unsafe review rollback';
  end if;
end $$;
SQL
echo 'PASS rollback preserves decision audit and keeps the approval fence'
