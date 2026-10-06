#!/usr/bin/env bash
# Concurrency check for the journey-repair migrations against a throwaway local
# PostgreSQL 16 cluster (PGlite is single-connection, so it cannot prove this).
# Fires N simultaneous promo allocations, duplicate applications, invitation
# acceptances and limit-bound job posts, then asserts no duplicates or overruns.
# Usage: scripts/checks/journey-concurrency-check.sh   (needs initdb/pg_ctl/psql)
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
WORK=$(mktemp -d)
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(runuser -u postgres --); chown -R postgres "$WORK"; fi
PORT=${PG_PORT:-55432}
"${RUN_AS[@]}" "$BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null
trap '"${RUN_AS[@]}" "$BIN/pg_ctl" -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
PSQL=("$BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt)

node -e '
const f = require("./tests/helpers/journey-fixture.cjs");
let sql = f.setupSql() + "\n" + f.MIGRATIONS.map(f.migrationSql).join("\n");
sql += `
insert into app.promo_config values (1, now(), 3, 6, 9, 30, 5, false);
insert into app.guards(id, user_id) select gen_random_uuid(), gen_random_uuid() from generate_series(1, 20);
insert into app.plans values (\x27client_one\x27, 1) on conflict do nothing;
update app.user_entitlements set plan_slug = \x27client_one\x27 where user_id = \x27${f.CLIENT_USER}\x27;
insert into app.job_invites values (\x27${f.INVITE}\x27, \x27${f.JOB}\x27, \x27${f.GUARD}\x27, \x27${f.CLIENT}\x27, \x27pending\x27, null);
update app.plans set job_limit_per_month = 5 where slug = \x27guard_starter\x27;
`;
require("fs").writeFileSync(process.argv[1], sql);
' "$WORK/setup.sql"
"${PSQL[@]}" -f "$WORK/setup.sql" >/dev/null

source <(node -e 'const f=require("./tests/helpers/journey-fixture.cjs");for(const k of ["CLIENT","CLIENT_USER","JOB","GUARD","GUARD_USER","INVITE"])console.log(`${k}=${f[k]}`)')

pids=()
# Every guard (20 + fixtures) allocates a promo number at once.
for g in $("${PSQL[@]}" -c "select id from app.guards where signup_number is null"); do
  "${PSQL[@]}" -c "set role service_role; select app.assign_guard_promo_tier('$g')" >/dev/null 2>&1 & pids+=($!)
done
# 10 simultaneous applications for the same guard/job, plus 10 simultaneous invitation acceptances.
for i in $(seq 1 10); do
  "${PSQL[@]}" -c "set role service_role; select app.submit_job_application('$GUARD_USER','$GUARD','$JOB','x',null,false)" >/dev/null 2>&1 & pids+=($!)
  "${PSQL[@]}" -c "set role service_role; select app.submit_job_application('$GUARD_USER','$GUARD','$JOB','x','$INVITE',false)" >/dev/null 2>&1 & pids+=($!)
done
# 10 simultaneous job posts against a one-post plan.
for i in $(seq 1 10); do
  "${PSQL[@]}" -c "set role service_role; insert into app.jobs(client_id,start_date,start_time,end_time,number_of_days,hourly_rate) values ('$CLIENT','2026-12-01','09:00','17:00',1,15)" >/dev/null 2>&1 & pids+=($!)
done
for p in "${pids[@]}"; do wait "$p" || true; done

check() { local label=$1 sql=$2 want=$3; got=$("${PSQL[@]}" -c "$sql"); if [ "$got" = "$want" ]; then echo "PASS $label ($got)"; else echo "FAIL $label: got $got want $want"; fail=1; fi; }
fail=0
check "every eligible guard allocated" "select (count(*) filter (where signup_number is not null) = count(*))::text from app.guards" true
check "promo numbers unique and gap-free" "select (count(distinct signup_number) = count(*) and max(signup_number) = count(*))::text from app.guards" true
check "founding tier capped at 3" "select count(*) from app.guards where promo_tier = 'founding'" 3
check "one application despite 20 concurrent requests" "select count(*) from app.job_applications where guard_id = '$GUARD'" 1
check "one usage unit consumed" "select usage_count from app.user_feature_usage where user_id = '$GUARD_USER' and feature_key = 'guard_application'" 1
check "invitation accepted once" "select status from app.job_invites where id = '$INVITE'" accepted
check "job posts capped at plan limit" "select count(*) from app.jobs where client_id = '$CLIENT' and start_date = '2026-12-01'" 1
check "job post usage equals posts" "select usage_count from app.user_feature_usage where user_id = '$CLIENT_USER' and feature_key = 'client_job_post'" 1
exit $fail
