-- Owners can close an open ticket or move it to review when replying.
-- Admins and the service role retain the existing support and sync workflows.
SET LOCAL lock_timeout = '500ms';

CREATE FUNCTION app.protect_support_ticket_owner_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog
AS $function$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR app.is_active_admin() THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'status' - 'updated_at')
      IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
    RAISE EXCEPTION 'You can only change the ticket status'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('resolved', 'closed')
      OR NEW.status IS NULL
      OR NEW.status NOT IN ('closed', 'under_review') THEN
      RAISE EXCEPTION 'This ticket status change is not allowed'
        USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := statement_timestamp();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_protect_support_ticket_owner_updates
BEFORE UPDATE ON app.support_tickets
FOR EACH ROW EXECUTE FUNCTION app.protect_support_ticket_owner_updates();
