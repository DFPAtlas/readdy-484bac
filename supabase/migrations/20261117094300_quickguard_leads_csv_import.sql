CREATE FUNCTION app.import_quickguard_leads_csv(p_rows jsonb, p_expected jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  entry jsonb;
  fields jsonb;
  csv_row integer;
  action text;
  problem text;
  supplied_id uuid;
  matching_ids uuid[];
  existing app.quickguard_leads%ROWTYPE;
  lead app.quickguard_leads%ROWTYPE;
  contact_key text;
  known_ids uuid[] := '{}';
  known_websites text[] := '{}';
  known_contacts text[] := '{}';
  results jsonb := '[]'::jsonb;
  planned jsonb := '[]'::jsonb;
BEGIN
  IF app.is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'An active administrator session with MFA is required.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Upload an array of CSV rows.';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR octet_length(p_rows::text) > 2097152 THEN
    RAISE EXCEPTION 'Upload between 1 and 500 rows within the file size limit.';
  END IF;

  -- During confirmation, keep the preview check and writes consistent with other writers.
  IF p_expected IS NOT NULL THEN
    LOCK TABLE app.quickguard_leads IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    csv_row := (entry->>'row')::integer;
    fields := entry->'fields';
    action := 'skip';
    problem := NULL;
    supplied_id := NULL;
    existing := NULL;
    lead := NULL;

    IF jsonb_typeof(fields) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid CSV record.';
    END IF;
    IF EXISTS (SELECT FROM jsonb_each(fields) f WHERE jsonb_typeof(f.value) <> 'string'
      OR length(f.value #>> '{}') > 2048) THEN
      problem := 'Use text values of up to 2,048 characters.';
    ELSIF fields ? 'id' AND fields->>'id' !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' THEN
      problem := 'Lead ID is invalid.';
    ELSIF fields->>'email' ~ '[[:space:]]' OR fields->>'email' !~ '^[^@]+@[^@]+[.][^@]+$' THEN
      problem := 'Email address is invalid.';
    ELSIF EXISTS (
      SELECT FROM jsonb_each_text(fields) f
      WHERE f.key IN ('website_url', 'contact_page_url') AND
        (f.value !~* '^https?://[^/?#[:space:]]+' OR f.value ~ '[[:space:]]')
    ) THEN
      problem := 'Use a full HTTP or HTTPS URL.';
    ELSE
      supplied_id := (fields->>'id')::uuid;
      SELECT COALESCE(array_agg(l.id), '{}') INTO matching_ids
        FROM app.quickguard_leads l
        WHERE l.id = supplied_id
          OR l.website_url = nullif(btrim(fields->>'website_url'), '')
          OR (nullif(btrim(fields->>'company_name'), '') IS NOT NULL
            AND COALESCE(nullif(btrim(fields->>'email'), ''), nullif(btrim(fields->>'phone'), '')) IS NOT NULL
            AND lower(COALESCE(l.company_name, '')) = lower(btrim(fields->>'company_name'))
            AND lower(COALESCE(l.email, '')) = lower(COALESCE(btrim(fields->>'email'), ''))
            AND lower(COALESCE(l.phone, '')) = lower(COALESCE(btrim(fields->>'phone'), '')));

      IF cardinality(matching_ids) > 1 THEN
        problem := 'Identifiers match different leads.';
      ELSIF supplied_id IS NOT NULL AND matching_ids[1] IS DISTINCT FROM supplied_id THEN
        problem := 'Lead ID could not be found.';
      ELSIF cardinality(matching_ids) = 1 THEN
        SELECT * INTO existing FROM app.quickguard_leads l WHERE l.id = matching_ids[1];
        IF existing.deleted_at IS NOT NULL THEN
          problem := 'Matches a deleted lead.';
        END IF;
      END IF;

      lead.company_name := COALESCE(nullif(btrim(fields->>'company_name'), ''), existing.company_name);
      lead.website_url := COALESCE(nullif(btrim(fields->>'website_url'), ''), existing.website_url);
      lead.contact_page_url := COALESCE(nullif(btrim(fields->>'contact_page_url'), ''), existing.contact_page_url);
      lead.email := COALESCE(nullif(btrim(fields->>'email'), ''), existing.email);
      lead.phone := COALESCE(nullif(btrim(fields->>'phone'), ''), existing.phone);
      lead.sector := COALESCE(nullif(btrim(fields->>'sector'), ''), existing.sector);
      lead.location := COALESCE(nullif(btrim(fields->>'location'), ''), existing.location);
      lead.postcode := COALESCE(nullif(btrim(fields->>'postcode'), ''), existing.postcode);
      lead.decision_maker_name := COALESCE(nullif(btrim(fields->>'decision_maker_name'), ''), existing.decision_maker_name);
      contact_key := jsonb_build_array(lower(COALESCE(lead.company_name, '')),
        lower(COALESCE(lead.email, '')), lower(COALESCE(lead.phone, '')))::text;

      IF problem IS NULL THEN
        IF existing.id IS NULL AND (lead.company_name IS NULL
          OR COALESCE(lead.website_url, lead.email, lead.phone) IS NULL) THEN
          problem := 'New leads need a company name and a website, email or phone.';
        ELSIF existing.id = ANY(known_ids) OR lead.website_url = ANY(known_websites)
          OR contact_key = ANY(known_contacts) THEN
          problem := 'Duplicates an earlier accepted row in this file.';
        ELSIF EXISTS (
          SELECT FROM app.quickguard_leads l
          WHERE l.id IS DISTINCT FROM existing.id AND (
            l.website_url = lead.website_url OR
            (lower(COALESCE(l.company_name, '')) = lower(COALESCE(lead.company_name, ''))
              AND lower(COALESCE(l.email, '')) = lower(COALESCE(lead.email, ''))
              AND lower(COALESCE(l.phone, '')) = lower(COALESCE(lead.phone, '')))
          )
        ) THEN
          problem := 'Saved details conflict with another lead.';
        ELSE
          action := CASE WHEN existing.id IS NULL THEN 'add' ELSE 'update' END;
          IF existing.id IS NOT NULL THEN known_ids := array_append(known_ids, existing.id); END IF;
          IF lead.website_url IS NOT NULL THEN known_websites := array_append(known_websites, lead.website_url); END IF;
          known_contacts := array_append(known_contacts, contact_key);
          lead.id := existing.id;
          planned := planned || jsonb_build_array(to_jsonb(lead));
        END IF;
      END IF;
    END IF;

    results := results || jsonb_build_array(
      jsonb_build_object('row', csv_row, 'action', action, 'id', existing.id, 'message', problem)
    );
  END LOOP;

  IF p_expected IS NULL THEN RETURN results; END IF;
  IF p_expected IS DISTINCT FROM results THEN
    RAISE EXCEPTION 'Leads changed since the preview. Select the file again to review the latest matches.';
  END IF;

  FOR lead IN SELECT * FROM jsonb_populate_recordset(NULL::app.quickguard_leads, planned) LOOP
    IF lead.id IS NULL THEN
      INSERT INTO app.quickguard_leads (company_name, website_url, contact_page_url, email, phone,
        sector, location, postcode, decision_maker_name)
      VALUES (lead.company_name, lead.website_url, lead.contact_page_url, lead.email, lead.phone,
        lead.sector, lead.location, lead.postcode, lead.decision_maker_name);
    ELSE
      UPDATE app.quickguard_leads l SET company_name = lead.company_name, website_url = lead.website_url,
        contact_page_url = lead.contact_page_url, email = lead.email, phone = lead.phone,
        sector = lead.sector, location = lead.location, postcode = lead.postcode,
        decision_maker_name = lead.decision_maker_name
      WHERE l.id = lead.id AND l.deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Could not update a selected lead.'; END IF;
    END IF;
  END LOOP;
  RETURN results;
END;
$$;

REVOKE ALL ON FUNCTION app.import_quickguard_leads_csv(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.import_quickguard_leads_csv(jsonb, jsonb) TO authenticated;
