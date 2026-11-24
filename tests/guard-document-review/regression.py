"""Synthetic regression for the real migration on isolated PostgreSQL."""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

container = sys.argv[1]
cmd = ["docker", "exec", "-i", container, "psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-U", "postgres"]
admin, second, worker, owner, outsider, guard = [str(UUID(int=i)) for i in range(1, 7)]


def sql(query, role=None, actor="", aal="aal2", denied=None):
    prefix = f"set role {role};set request.jwt.claim.sub='{actor}';set request.jwt.claim.aal='{aal}';" if role else ""
    result = subprocess.run(cmd, input=prefix + query, text=True, capture_output=True, check=False)
    if denied:
        assert result.returncode and denied.lower() in result.stderr.lower(), result.stderr
    else:
        assert not result.returncode, result.stderr
    return result.stdout.strip()


def auth(query, actor=admin, aal="aal2", denied=None):
    return sql(query, "authenticated", actor, aal, denied)


def as_service(query, denied=None):
    return sql(query, "service_role", denied=denied)


def enqueue():
    d = json.loads(as_service(f"select app.identity_document_sources('{owner}');"))
    for kind, char in (("proof", "a"), ("licence", "b")):
        d[kind]["sha256"] = char * 64
    return as_service(f"select app.enqueue_identity_document_check('{guard}','{owner}',"
                      f"'{json.dumps(d['proof'])}','{json.dumps(d['licence'])}');")


def prepare(actor=admin):
    d = json.loads(as_service(f"select app.guard_review_sources('{guard}','{actor}');"))
    d["back"]["sha256"] = "c" * 64
    return as_service(f"select app.begin_guard_document_review('{guard}','{actor}','{json.dumps(d['back'])}');")


def open_all(review):
    for kind, char in (("proof", "a"), ("licence", "b"), ("back", "c")):
        as_service(f"select app.guard_review_document('{review}','{admin}','{kind}','{char * 64}');")


sql("insert into auth.users values "+",".join(f"('{a}')" for a in (admin, second, worker, owner, outsider))+";"
    f"insert into app.admin_users values ('{admin}',true,'admin'),('{second}',true,'super_admin');"
    f"insert into identity_queue_private.workers values ('{worker}',false);"
    f"insert into app.guards (id,user_id,profile_completed,proof_of_address_url,driving_licence_front_url,driving_licence_back_url)"
    f" values ('{guard}','{owner}',true,'{owner}/poa-1.pdf','{owner}/front-1.png','{owner}/back-1.png');"
    "insert into storage.buckets values ('guard-documents',false);"
    "insert into storage.objects(bucket_id,name,owner_id,version) values "+
    ",".join(f"('guard-documents','{owner}/{n}','{owner}','v1')" for n in ("poa-1.pdf","front-1.png","back-1.png"))+";")
# Missing object before snapshot preparation simulates a failed enqueue, and
# recovery relies on the existing idempotent request contract.
sql(f"update storage.objects set owner_id='{outsider}' where name='{owner}/poa-1.pdf';")
assert json.loads(as_service(f"select app.identity_document_sources('{owner}');"))["proof"] is None
as_service(f"select app.enqueue_identity_document_check('{guard}','{owner}',null,null);",denied="invalid")
sql(f"update storage.objects set owner_id='{owner}' where name='{owner}/poa-1.pdf';")
assert enqueue()==enqueue()
print("PASS failed enqueue leaves no job; idempotent snapshot retry")
review=prepare()
approve=f"select app.approve_guard_document_review('{guard}','{review}','approve');"
auth(approve,denied="attestation")
auth(approve,actor=outsider,denied="administrator")
auth(approve,actor=worker,denied="administrator")
auth(approve,aal="aal1",denied="AAL2")
auth(f"update app.guards set verification_status='approved',is_active=true where id='{guard}';",denied="version-bound")
as_service(f"update app.guards set verification_status='approved',is_active=true where id='{guard}';",denied="version-bound")
print("PASS no attestation, unauthorised actor, AAL1, worker and direct-route denial")
as_service(f"select app.guard_review_document('{review}','{second}','proof',null);",denied="unavailable")
auth(f"select app.guard_review_document('{review}','{admin}','proof',null);",denied="permission denied")
assert auth("select count(*) from storage.objects;")=="0"
assert auth("select count(*) from storage.objects;",actor=owner)=="3"
auth(f"select app.attest_guard_document_review('{review}');",denied="open all")
as_service(f"select app.guard_review_document('{review}','{admin}','proof','{'e'*64}');",denied="checksum mismatch")
print("PASS account-scoped broker, restricted storage, failed hash, and access audit requirement")
open_all(review)
auth(f"select app.attest_guard_document_review('{review}');")
sql(f"update storage.objects set version='v2' where name='{owner}/back-1.png';")
auth(approve,denied="Documents changed")
print("PASS replacement invalidates attestation, including the licence back")
review=prepare()
open_all(review)
auth(f"select app.attest_guard_document_review('{review}');")
approve=f"select app.approve_guard_document_review('{guard}','{review}','approve');"
# A competing object writer holds the row lock before committing the replacement.
updater=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
updater.stdin.write(f"begin; update storage.objects set version='v2' where name='{owner}/front-1.png';select 'locked';select pg_sleep(2);commit;\n")
updater.stdin.flush()
assert updater.stdout.readline().strip()=="locked"
auth(approve,denied="documents changed")
updater.stdin.close()
assert updater.wait(timeout=10)==0
auth(approve,denied="documents changed")
print("PASS concurrent storage write blocks approval and stale completion")
enqueue()
review=prepare()
open_all(review)
auth(f"select app.attest_guard_document_review('{review}');")
approve=f"select app.approve_guard_document_review('{guard}','{review}','approve');"
with ThreadPoolExecutor(2) as pool:
    decisions=list(pool.map(lambda _: json.loads(auth(approve)), range(2)))
assert sorted(x["replayed"] for x in decisions)==[False,True]
assert sql("select count(*) from identity_queue_private.human_review_audit where event='approved';")=="1"
assert sql(f"select verified_by from app.guards where id='{guard}';")==admin
assert sql("select count(*) from app.document_checks where status='done';")=="1"  # legacy fixture only
print("PASS manual approval with AI off, duplicate approval and reviewer audit")
