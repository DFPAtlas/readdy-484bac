-- Reviewed existing synthetic identities only. Do not run the seed to repair flags.
DO $repair$
DECLARE
  target record;
  guard app.guards%rowtype;
  origin record;
  repaired app.guards%rowtype;
  repair_key constant text := 'uat-guard-test-classification-20261123';
BEGIN
  perform pg_advisory_xact_lock(hashtext(repair_key));
  for target in select * from (values
    ('185321ee-ce17-4ec9-9509-081d7cb50961'::uuid,'185321ee-ce17-4ec9-9509-081d7cb50961'::uuid,'guard-cctv','UAT CCTV Guard'),
    ('2a02fca1-4d56-4ffe-a12b-a4a5d27f97d4'::uuid,'a48d6a29-69a1-4744-af4e-e4d8698f680f'::uuid,'client-pro','UAT Pro Client'),
    ('3779eb9f-b56f-4e1e-b7f0-e5ff7d585c52'::uuid,'3779eb9f-b56f-4e1e-b7f0-e5ff7d585c52'::uuid,'guard-expired','UAT Expired Guard'),
    ('84251c62-50cf-4aa5-a2c7-92df7a83dcca'::uuid,'fd3a6ffd-494d-4955-817b-e67b3bbaf710'::uuid,'client-free','UAT Free Client'),
    ('bb69018f-073e-4fa7-b39b-6c4648438b6c'::uuid,'bb69018f-073e-4fa7-b39b-6c4648438b6c'::uuid,'guard-pending','UAT Pending Guard'),
    ('dfcd50f6-d05a-45e9-846c-11087c7d2762'::uuid,'dfcd50f6-d05a-45e9-846c-11087c7d2762'::uuid,'guard-door','UAT Door Supervisor')
  ) as targets(guard_id,user_id,persona,full_name) loop
    select * into strict guard from app.guards where id=target.guard_id for update;
    select id,email,raw_app_meta_data into strict origin from auth.users where id=target.user_id for share;
    if guard.user_id is distinct from origin.id
      or origin.raw_app_meta_data->>'uat_run_id' is distinct from 'launch-2026-11'
      or origin.raw_app_meta_data->>'uat_persona' is distinct from target.persona
      or guard.full_name is distinct from target.full_name
      or guard.email is null or origin.email is null or lower(guard.email) is distinct from lower(origin.email)
      or exists(select 1 from app.account_closures where user_id=guard.user_id)
      or (target.persona like 'guard-%' and (
        guard.bio is distinct from 'Synthetic QuickGuard UAT persona '||target.persona
        or guard.sia_licence_number is distinct from 'UAT-'||upper(target.persona))) then
      raise exception 'Protected UAT provenance changed; classification aborted';
    end if;
    if guard.is_test_account is true then
      if not exists(select 1 from app.admin_activity_log where entity_id=guard.id
        and action_type='uat_test_account_classified' and metadata->>'repair'=repair_key) then
        raise exception 'Classification changed without this repair audit';
      end if;
      continue;
    end if;
    update app.guards set is_test_account=true where id=guard.id and user_id=origin.id and is_test_account=false
      returning * into repaired;
    if not found or (to_jsonb(repaired)-'is_test_account'-'updated_at')
      is distinct from (to_jsonb(guard)-'is_test_account'-'updated_at') then
      raise exception 'Unconfirmed classification or protected profile changed';
    end if;
    insert into app.admin_activity_log(admin_username,admin_name,action_type,action_description,target_type,target_name,
      entity_type,entity_id,metadata,changes)
    values('codex-authorised-repair','Authorised UAT classification repair','uat_test_account_classified',
      'Marked an existing protected-metadata UAT guard profile as test-only; approval and billing preserved',
      'guard',target.full_name,'guard',guard.id,
      jsonb_build_object('repair',repair_key,'source','auth.app_metadata','run_id','launch-2026-11',
        'persona',target.persona,'user_id',origin.id,'approval_changed',false,'billing_changed',false),
      jsonb_build_object('before',jsonb_build_object('is_test_account',false),'after',jsonb_build_object('is_test_account',true)));
  end loop;
END
$repair$;
