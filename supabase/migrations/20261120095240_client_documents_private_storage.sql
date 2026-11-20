-- Private company files are mediated by manage-client-documents. No public
-- bucket and no browser/service-key access or object-table writes are added.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('client-files','client-files',false,10485760,array['application/pdf','image/png','image/jpeg','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Restrictive defense even if another bucket gains a broad browser policy.
drop policy if exists client_files_server_only on storage.objects;
create policy client_files_server_only on storage.objects as restrictive
for all to anon,authenticated
using(bucket_id <> 'client-files') with check(bucket_id <> 'client-files');

alter table app.client_documents add column if not exists content_sha256 text;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='app.client_documents'::regclass and conname='client_documents_content_sha256_check') then
    alter table app.client_documents add constraint client_documents_content_sha256_check check(content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end $$;
alter table app.client_documents enable row level security;
revoke all on app.client_documents from anon;
revoke insert,update,delete on app.client_documents from authenticated;
-- Existing owned SELECT and restrictive account-closure policies are retained.
-- The service-only endpoint verifies identity/active ownership/closure and
-- binds every metadata operation and Storage API path to that verified owner.
