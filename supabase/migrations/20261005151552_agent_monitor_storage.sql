-- n8n registry reads and snapshot writes were returning missing-relation errors.
-- State is private automation data: only service-role callers have table access.
CREATE TABLE IF NOT EXISTS app.agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  site text NOT NULL DEFAULT 'quickguard.uk',
  name text,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site, agent_id)
);
CREATE TABLE IF NOT EXISTS app.agent_state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  site text NOT NULL DEFAULT 'quickguard.uk',
  health text NOT NULL DEFAULT 'unknown',
  state jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_state_snapshots_site_agent_created
  ON app.agent_state_snapshots(site, agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_state_snapshots_site_created
  ON app.agent_state_snapshots(site, created_at DESC);
ALTER TABLE app.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agent_state_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.agent_registry, app.agent_state_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.agent_registry, app.agent_state_snapshots TO service_role;

-- Support the existing unqualified REST URLs while retaining app as canonical storage.
CREATE OR REPLACE VIEW public.agent_registry WITH (security_invoker = true) AS
  SELECT * FROM app.agent_registry;
CREATE OR REPLACE VIEW public.agent_state_snapshots WITH (security_invoker = true) AS
  SELECT * FROM app.agent_state_snapshots;
REVOKE ALL ON public.agent_registry, public.agent_state_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_registry, public.agent_state_snapshots TO service_role;
NOTIFY pgrst, 'reload schema';
