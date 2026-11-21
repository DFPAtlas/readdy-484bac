-- Client and guard messaging already subscribe to app.messages INSERT/UPDATE.
-- Publish those changes; existing SELECT grants and RLS continue to authorize recipients.
-- Re-running after a dashboard toggle or a previous application is a no-op.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'supabase_realtime publication is required';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'app' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table app.messages;
  end if;
end
$$;
