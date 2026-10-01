-- Resolve account type from trusted app metadata first, while retaining
-- compatibility with older sign-up flows that stored role in user metadata.
-- This prevents client registrations from receiving an unintended guard row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_role := COALESCE(
    NULLIF(NEW.raw_app_meta_data->>'account_type', ''),
    NULLIF(NEW.raw_app_meta_data->>'role', ''),
    NULLIF(NEW.raw_user_meta_data->>'role', ''),
    'guard'
  );

  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(concat_ws(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  IF v_role = 'client' THEN
    INSERT INTO app.clients (
      user_id, email, contact_name, profile_completed, verification_status
    )
    VALUES (
      NEW.id, NEW.email, v_full_name, false, 'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'guard' THEN
    INSERT INTO app.guards (
      user_id, email, full_name, profile_image_url,
      is_active, profile_completed, verification_status,
      sia_verified, bank_account_verified
    )
    VALUES (
      NEW.id, NEW.email, v_full_name,
      NEW.raw_user_meta_data->>'avatar_url',
      true, false, 'pending', false, false
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for user_id=% email=% role=%: %',
      NEW.id, NEW.email, v_role, SQLERRM;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
