-- Keep the existing cancellation transaction and its execute grants.
ALTER FUNCTION public.cancel_client_job(uuid, text, text, text, text)
  SET SCHEMA app;

NOTIFY pgrst, 'reload schema';
