-- Authorised admin cleanup. Preserve applications, assignments and payment history.
DO $cleanup$
DECLARE
  ids uuid[] := ARRAY['cbd5411d-162b-4e59-9443-9e2a2f5a0ddf','2f56f739-3944-4571-a2e1-331cd4da0e71','f140deda-7e3b-4e7d-9ce1-ddf699607578','2e9ab1f2-c6a0-42ff-bbdf-4ae6dc71b019','12e04457-20af-47d5-afaf-207b02bb0dfe']::uuid[];
  job record;
BEGIN
  PERFORM 1 FROM app.jobs WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM app.jobs WHERE id=ANY(ids)
      AND job_title LIKE '[UAT launch-2026-11] Pub Door Supervisor %'
      AND end_date=DATE '2026-10-21' AND is_deleted=false AND status IN ('open','closed')) <> 5
     OR EXISTS(SELECT 1 FROM app.job_assignments WHERE job_id=ANY(ids)) THEN
    RAISE EXCEPTION 'UAT advert evidence changed; cleanup aborted';
  END IF;
  FOR job IN UPDATE app.jobs SET status='closed',updated_at=now()
      WHERE id=ANY(ids) AND status='open' RETURNING id,job_title LOOP
    INSERT INTO app.admin_activity_log
      (admin_username,admin_name,action_type,action_description,target_type,target_name,metadata,changes)
    VALUES ('codex-authorised-repair','Authorised admin repair','uat_advert_retired',
      'Closed expired, unassigned UAT advert; application and financial records retained',
      'job',job.job_title,jsonb_build_object('job_id',job.id,'repair','admin-operations-20261122'),
      jsonb_build_object('status',jsonb_build_object('old','open','new','closed')));
  END LOOP;
END
$cleanup$;
