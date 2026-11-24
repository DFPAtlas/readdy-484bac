-- Keep every image object private; public delivery is mediated by a resolver
-- that may read only the currently selected version. No anonymous table grants.
CREATE TABLE public.site_media_publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL REFERENCES public.site_media_slots(slot_key),
  previous_version uuid,
  next_version uuid,
  actor uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (slot_key,previous_version) REFERENCES public.site_media_versions(slot_key,id),
  FOREIGN KEY (slot_key,next_version) REFERENCES public.site_media_versions(slot_key,id)
);
ALTER TABLE public.site_media_publication_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_media_publication_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_media_publication_events TO authenticated;
CREATE POLICY site_media_events_admin_read ON public.site_media_publication_events FOR SELECT TO authenticated USING ((SELECT public.is_active_admin()));

-- Atomic pointer change and audit event. The slot row serializes concurrent
-- changes; expected version prevents a stale admin tab overwriting newer work.
CREATE FUNCTION public.change_site_media_publication(p_slot text, p_version uuid, p_expected uuid, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_version uuid;
BEGIN
  PERFORM 1 FROM public.site_media_slots WHERE slot_key=p_slot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown media slot'; END IF;
  SELECT version_id INTO current_version FROM public.site_media_publications WHERE slot_key=p_slot;
  IF current_version IS DISTINCT FROM p_expected THEN RETURN false; END IF;
  IF current_version IS NOT DISTINCT FROM p_version THEN RETURN true; END IF;
  IF p_version IS NULL THEN
    DELETE FROM public.site_media_publications WHERE slot_key=p_slot;
  ELSE
    INSERT INTO public.site_media_publications(slot_key,version_id,published_by)
    VALUES(p_slot,p_version,p_actor)
    ON CONFLICT(slot_key) DO UPDATE SET version_id=EXCLUDED.version_id,published_by=EXCLUDED.published_by,published_at=now();
  END IF;
  INSERT INTO public.site_media_publication_events(slot_key,previous_version,next_version,actor)
    VALUES(p_slot,current_version,p_version,p_actor);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.change_site_media_publication(text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_site_media_publication(text,uuid,uuid,uuid) TO service_role;
GRANT SELECT, INSERT ON public.site_media_publication_events TO service_role;
