-- Existing snapshots are immutable here: refuse duplicates instead of deleting or
-- rewriting history. No snapshot is generated or backfilled by this migration.
CREATE UNIQUE INDEX IF NOT EXISTS finance_snapshots_month_unique
  ON app.finance_snapshots (snapshot_month);

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid = idx.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attname = 'snapshot_month'
    WHERE ns.nspname = 'app' AND idx.relname = 'finance_snapshots_month_unique'
      AND i.indrelid = 'app.finance_snapshots'::regclass
      AND i.indisunique AND i.indisvalid AND i.indnkeyatts = 1
      AND i.indkey[0] = a.attnum AND i.indpred IS NULL AND i.indexprs IS NULL
  ) THEN
    RAISE EXCEPTION 'Monthly snapshot uniqueness could not be verified';
  END IF;
END
$verify$;
