"""Run against a freshly migrated, isolated synthetic PostgreSQL container."""
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import sys
from uuid import UUID

container = sys.argv[1]
worker, other_worker, customer, applicant, reviewer = [str(UUID(int=i)) for i in range(1, 6)]
guard = str(UUID(int=11))
other_guard = str(UUID(int=12))


def sql(query, *, role=None, user=None, denied=False):
    if role:
        query = f"set role {role}; set request.jwt.claim.sub = '{user or ''}';" + query
    result = subprocess.run(["docker", "exec", "-i", container, "psql", "-XAtq",
                             "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
                            input=query, capture_output=True, text=True, check=False)
    if denied:
        assert result.returncode and "ERROR:" in result.stderr, result.stdout
    else:
        assert not result.returncode, result.stderr
    return result.stdout.strip()


def run_as(user, query, **options):
    return sql(query, role="authenticated", user=user, **options)


def job(as_user=worker):
    value = run_as(as_user, "select app.claim_identity_document_check();")
    return json.loads(value) if value else None


def enqueue(owner=customer, gid=guard, digest="a"):
    sources = json.loads(sql(f"select app.identity_document_sources('{owner}');", role="service_role"))
    proof, licence = sources["proof"], sources["licence"]
    proof["sha256"], licence["sha256"] = digest * 64, "b" * 64
    return sql(f"select app.enqueue_identity_document_check('{gid}','{owner}',"
               f"'{json.dumps(proof)}','{json.dumps(licence)}');", role="service_role")


def finish(lease, outcome="review", as_user=worker, denied=False):
    return run_as(as_user, f"select app.finish_identity_document_check('{lease['id']}',"
                  f"'{lease['token']}', '{outcome}',array['fixture_review']);", denied=denied)


sql("insert into auth.users values " + ",".join(f"('{u}')" for u in
    (worker, other_worker, customer, applicant, reviewer)) + ";"
    f"insert into identity_queue_private.workers values ('{worker}',true),('{other_worker}',true);"
    f"insert into app.admin_users values ('{reviewer}',true);"
    f"insert into app.guards (id,user_id,profile_completed,full_name,proof_of_address_url,driving_licence_front_url)"
    f" values ('{guard}','{customer}',true,'Fictional Applicant','{customer}/poa-1.pdf','{customer}/front-1.png'),"
    f" ('{other_guard}','{applicant}',true,'Another Fictional Applicant','{applicant}/poa-1.pdf','{applicant}/front-1.png');"
    "insert into storage.buckets values ('guard-documents',false);"
    "insert into storage.objects(bucket_id,name,owner_id,version) values "
    + ",".join(f"('guard-documents','{u}/{name}','{u}','fixture-v1')"
               for u in (customer, applicant) for name in ("poa-1.pdf", "front-1.png")) + ";")
assert run_as(worker, "select app.identity_document_queue_ready();") == "t"
assert sql("select count(*) from app.document_checks;") == "0"

with ThreadPoolExecutor(2) as pool:
    duplicates = list(pool.map(lambda _: enqueue(), range(2)))
assert duplicates[0] == duplicates[1]
assert sql("select count(*) from app.document_checks;") == "1"
print("PASS duplicate submissions")

with ThreadPoolExecutor(2) as pool:
    claimed = list(pool.map(lambda _: job(), range(2)))
assert sum(x is not None for x in claimed) == 1
first = next(x for x in claimed if x)
assert first["id"] == duplicates[0]
assert job() is None
print("PASS simultaneous claimers and active lease exclusion")

run_as(customer, "select app.claim_identity_document_check();", denied=True)
run_as(customer, "select app.identity_document_queue_ready();", denied=True)
run_as(worker, f"select app.request_document_check('{guard}');", denied=True)
run_as(worker, "select * from app.claim_document_check();", denied=True)
sql("select app.claim_identity_document_check();", role="anon", denied=True)
assert run_as(worker, "select count(*) from storage.objects;") == "0"
assert run_as(worker, "select count(*) from app.document_checks;") == "0"
run_as(customer, f"update app.guards set id_docs_submission_version=99 where id='{guard}';", denied=True)
assert run_as(worker, "select count(*) from app.admin_users;") == "0"
assert run_as(worker, f"update app.guards set verification_status='approved' where id='{guard}' returning id;") == ""
sql(f"insert into app.admin_users values ('{worker}',true);", denied=True)
sql(f"insert into identity_queue_private.workers values ('{reviewer}',true);", denied=True)
assert sql(f"select is_active from app.admin_users where user_id='{reviewer}';") == "t"
print("PASS missing permissions and worker cannot become a human approver")

access = f"select app.identity_document_access('{first['id']}','{first['token']}','proof');"
assert json.loads(run_as(worker, access))["path"] == customer + "/poa-1.pdf"
run_as(other_worker, access, denied=True)
run_as(applicant, access, denied=True)
sql(f"update app.guards set proof_of_address_url='{customer}/poa-1.pdf' where id='{other_guard}';")
assert json.loads(sql(f"select app.identity_document_sources('{applicant}');", role="service_role"))["proof"] is None
print("PASS cross-account storage and cross-worker token isolation")

sql(f"update app.document_checks set lease_expires_at=clock_timestamp()-interval '1 second' where id='{first['id']}';")
second = job()
assert second["id"] == first["id"] and second["token"] != first["token"]
finish(first, denied=True)
print("PASS crash recovery and stale completion denial")

assert finish(second, "retry") == "pending"
assert finish(second, "retry") == "pending"
assert job() is None
sql(f"update app.document_checks set available_at=clock_timestamp()-interval '1 second' where id='{second['id']}';")
third = job()
assert third["token"] != second["token"]
assert finish(third, "retry") == "failed"
assert finish(third, "retry") == "failed"
assert job() is None
print("PASS scheduled bounded retries and idempotent retry completion")

sql(f"update storage.objects set version='fixture-v2' where name='{customer}/poa-1.pdf';")
replacement_ref = enqueue(digest="c")
assert replacement_ref != first["id"]
replacement = job()
sql(f"insert into storage.objects(bucket_id,name,owner_id,version) values"
    f"('guard-documents','{customer}/poa-2.pdf','{customer}','fixture-v3');"
    f"update app.guards set proof_of_address_url='{customer}/poa-2.pdf' where id='{guard}';")
assert sql(f"select id_docs_check_status from app.guards where id='{guard}';") == "pending"
new_job = enqueue(digest="d")
assert new_job != replacement_ref
finish(replacement, denied=True)
assert sql(f"select status from app.document_checks where id='{replacement_ref}';") == "superseded"
assert sql(f"select count(*) from app.document_checks where guard_id='{guard}' and status in ('pending','processing');") == "1"
latest = job()
assert latest["id"] == new_job
assert finish(latest) == "done"
assert finish(latest) == "done"
finish(latest, "reject", denied=True)
assert sql(f"select id_docs_check_status || ':' || id_docs_decision || ':' || verification_status"
           f" || ':' || is_active || ':' || dashboard_access from app.guards where id='{guard}';") == "done:review:pending:false:false"
print("PASS reupload during processing, idempotent completion and approval preservation")

sql(f"update storage.objects set version='fixture-v4' where name='{customer}/poa-2.pdf';")
assert sql(f"select id_docs_check_status || ':' || coalesce(id_docs_decision,'null') from app.guards where id='{guard}';") == "pending:null"
sql(f"delete from storage.objects where name='{customer}/poa-2.pdf';")
assert sql(f"select id_docs_check_status || ':' || coalesce(id_docs_decision,'null') from app.guards where id='{guard}';") == "pending:null"
print("PASS same-path overwrite and deletion invalidate advisory evidence")

sql(f"update app.guards set proof_of_address_url='{applicant}/poa-1.pdf' where id='{other_guard}';")
other = enqueue(applicant, other_guard, "e")
for _ in range(3):
    lease = job()
    assert lease["id"] == other
    sql(f"update app.document_checks set lease_expires_at=clock_timestamp()-interval '1 second' where id='{other}';")
assert job() is None
assert sql(f"select status || ':' || attempts from app.document_checks where id='{other}';") == "failed:3"
print("PASS exhausted crash recovery is terminal")
