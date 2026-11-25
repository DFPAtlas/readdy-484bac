-- Public site media only. No existing assets or policies are changed.
-- Future server-side publishing must verify active admin/MFA and image bytes.
CREATE TABLE public.site_media_slots (
  slot_key text PRIMARY KEY CHECK (slot_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  page_label text NOT NULL,
  section_label text NOT NULL,
  recommended_width integer CHECK (recommended_width BETWEEN 1 AND 8192),
  recommended_height integer CHECK (recommended_height BETWEEN 1 AND 8192),
  CHECK ((recommended_width IS NULL) = (recommended_height IS NULL))
);

CREATE TABLE public.site_media_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL REFERENCES public.site_media_slots(slot_key),
  object_path text NOT NULL UNIQUE CHECK (object_path ~ '^[a-z0-9_-]+/[0-9a-f-]+[.](png|jpg|webp|avif)$'),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 8192),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 8192),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','image/avif')),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  alt_text text NOT NULL DEFAULT '' CHECK (length(alt_text) <= 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_key,id),
  CHECK (width::bigint * height <= 40000000)
);

-- Only explicitly published versions are exposed by the future public resolver.
-- Keep drafts, original metadata and actor identities out of anonymous queries.
CREATE TABLE public.site_media_publications (
  slot_key text PRIMARY KEY REFERENCES public.site_media_slots(slot_key),
  version_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid NOT NULL,
  FOREIGN KEY (slot_key,version_id) REFERENCES public.site_media_versions(slot_key,id)
);

ALTER TABLE public.site_media_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_media_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_media_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_media_slots, public.site_media_versions, public.site_media_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_media_slots, public.site_media_versions, public.site_media_publications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_media_slots, public.site_media_versions, public.site_media_publications TO service_role;
CREATE POLICY site_media_slots_admin_read ON public.site_media_slots FOR SELECT TO authenticated USING ((SELECT public.is_active_admin()));
CREATE POLICY site_media_versions_admin_read ON public.site_media_versions FOR SELECT TO authenticated USING ((SELECT public.is_active_admin()));
CREATE POLICY site_media_publications_admin_read ON public.site_media_publications FOR SELECT TO authenticated USING ((SELECT public.is_active_admin()));

-- Dedicated private storage; publishing delivery is deliberately deferred.
-- Do not reuse any customer or guard document bucket.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('site-media-staging','site-media-staging',false,10485760,ARRAY['image/png','image/jpeg','image/webp','image/avif']);
CREATE POLICY site_media_staging_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'site-media-staging')
WITH CHECK (bucket_id <> 'site-media-staging');

INSERT INTO public.site_media_slots (slot_key,page_label,section_label,recommended_width,recommended_height) VALUES
 ('homepage-hero','Homepage','Hero banner',1600,900),
 ('homepage-logo','Homepage','Homepage logo',600,200),
 ('brand-full-light','Shared branding','Full logo – light',NULL,NULL),
 ('brand-full-dark','Shared branding','Full logo – dark',NULL,NULL),
 ('brand-symbol-light','Shared branding','Symbol – light',NULL,NULL),
 ('brand-symbol-dark','Shared branding','Symbol – dark',NULL,NULL);
