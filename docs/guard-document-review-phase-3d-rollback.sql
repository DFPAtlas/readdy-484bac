-- Fail closed. Preserve the database fence, existing guard decisions and review history.
begin;
set local lock_timeout = '5s';
revoke execute on function app.attest_guard_document_review(uuid),
  app.approve_guard_document_review(uuid,uuid,text) from authenticated;
revoke execute on function app.begin_guard_document_review(uuid,uuid,jsonb),
  app.guard_review_sources(uuid,uuid),app.guard_review_document(uuid,uuid,text,text) from service_role;
notify pgrst,'reload schema';
commit;
