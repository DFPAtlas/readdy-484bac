-- Run only after the approved rollback has paused the worker and disabled v2
-- enqueue at the Edge Function. Leaves queue and submission evidence intact.
begin;
set local lock_timeout = '5s';
update identity_queue_private.workers set enabled = false where enabled;
revoke execute on function app.enqueue_identity_document_check(uuid,uuid,jsonb,jsonb),
  app.identity_document_sources(uuid) from service_role;
revoke execute on function app.claim_identity_document_check(),
  app.identity_document_access(uuid,uuid,text),
  app.finish_identity_document_check(uuid,uuid,text,text[]),
  app.identity_document_queue_ready() from authenticated;
notify pgrst, 'reload schema';
commit;
