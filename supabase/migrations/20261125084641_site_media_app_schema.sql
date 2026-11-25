-- Align the isolated media registry with QuickGuard's existing exposed app schema.
-- Move objects intact: versions, publication pointers, foreign keys and grants survive.
-- No Data API exposure settings or unrelated tables are changed.
ALTER TABLE public.site_media_slots SET SCHEMA app;
ALTER TABLE public.site_media_versions SET SCHEMA app;
ALTER TABLE public.site_media_publications SET SCHEMA app;
ALTER TABLE public.site_media_publication_events SET SCHEMA app;
ALTER FUNCTION public.change_site_media_publication(text,uuid,uuid,uuid) SET SCHEMA app;

CREATE OR REPLACE FUNCTION app.change_site_media_publication(p_slot text, p_version uuid, p_expected uuid, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_version uuid;
BEGIN
  PERFORM 1 FROM app.site_media_slots WHERE slot_key=p_slot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown media slot'; END IF;
  SELECT version_id INTO current_version FROM app.site_media_publications WHERE slot_key=p_slot;
  IF current_version IS DISTINCT FROM p_expected THEN RETURN false; END IF;
  IF current_version IS NOT DISTINCT FROM p_version THEN RETURN true; END IF;
  IF p_version IS NULL THEN
    DELETE FROM app.site_media_publications WHERE slot_key=p_slot;
  ELSE
    INSERT INTO app.site_media_publications(slot_key,version_id,published_by)
    VALUES(p_slot,p_version,p_actor)
    ON CONFLICT(slot_key) DO UPDATE SET version_id=EXCLUDED.version_id,published_by=EXCLUDED.published_by,published_at=now();
  END IF;
  INSERT INTO app.site_media_publication_events(slot_key,previous_version,next_version,actor)
    VALUES(p_slot,current_version,p_version,p_actor);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION app.change_site_media_publication(text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.change_site_media_publication(text,uuid,uuid,uuid) TO service_role;

DROP POLICY site_media_slots_admin_read ON app.site_media_slots;
CREATE POLICY site_media_slots_admin_read ON app.site_media_slots FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));

DROP POLICY site_media_versions_admin_read ON app.site_media_versions;
CREATE POLICY site_media_versions_admin_read ON app.site_media_versions FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));

DROP POLICY site_media_publications_admin_read ON app.site_media_publications;
CREATE POLICY site_media_publications_admin_read ON app.site_media_publications FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));

DROP POLICY site_media_events_admin_read ON app.site_media_publication_events;
CREATE POLICY site_media_events_admin_read ON app.site_media_publication_events FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));

NOTIFY pgrst, 'reload schema';
