-- Normalize local metadata for subscriptions whose provider lifecycle has ended.
-- No provider calls, historical data sweep, status change or access grant.
CREATE FUNCTION app.normalize_terminal_subscription_renewal()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $renewal$
BEGIN
  IF NEW.status IN ('canceled','cancelled','incomplete_expired') THEN
    NEW.auto_renew := false;
  END IF;
  RETURN NEW;
END
$renewal$;
REVOKE ALL ON FUNCTION app.normalize_terminal_subscription_renewal() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app.normalize_terminal_subscription_renewal() TO service_role;

CREATE TRIGGER normalize_terminal_subscription_renewal
BEFORE INSERT OR UPDATE OF status,auto_renew ON app.subscriptions
FOR EACH ROW EXECUTE FUNCTION app.normalize_terminal_subscription_renewal();
