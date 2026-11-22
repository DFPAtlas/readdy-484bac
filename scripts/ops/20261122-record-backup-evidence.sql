-- Inventory was independently checked in the Supabase provider dashboard.
-- A core-data logical restore was verified in the explicitly approved test project.
DO $evidence$
DECLARE prior app.security_backup_status%ROWTYPE;
BEGIN
  SELECT * INTO STRICT prior FROM app.security_backup_status WHERE backup_type='Database Backup' FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM app.admin_activity_log WHERE action_type='backup_evidence_verified'
    AND metadata->>'repair'='admin-operations-20261122') THEN
    UPDATE app.security_backup_status SET status='warning',
      last_backup_at='2026-11-21T07:25:18Z',retention_days=7,last_restore_test_at=now(),updated_at=now(),
      notes='Seven daily physical database backups verified in Supabase on 22 Nov 2026; PITR is not enabled. Core-only logical restore passed: eight booking/payment tables, 135 rows, SHA-256 and internal FK checks, in dnbvybmulsppfjntbsxz/qg_recovery_20261122. This does not verify a full provider-backup restore, Auth configuration or uploaded files. Storage objects are excluded from database backups.'
    WHERE id=prior.id;
    INSERT INTO app.admin_activity_log(admin_username,admin_name,action_type,action_description,target_type,target_name,metadata,changes)
    VALUES('codex-authorised-repair','Authorised admin repair','backup_evidence_verified',
      'Verified provider backup inventory and isolated core-data logical recovery; full DR and file recovery remain pending',
      'backup','Database Backup',jsonb_build_object('repair','admin-operations-20261122',
        'inventory_source','Supabase Database Backups dashboard','available_backups',7,'pitr_enabled',false,
        'restore_project','dnbvybmulsppfjntbsxz','restore_schema','qg_recovery_20261122',
        'source_snapshot_at','2026-11-22T01:19:34.599377Z','restored_tables',8,'restored_rows',135,
        'scope','core_booking_and_payment_data_only','hashes_verified',true,'internal_foreign_keys_validated',true),
      jsonb_build_object('previous_record',to_jsonb(prior),'status','warning'));
  END IF;
END
$evidence$;
