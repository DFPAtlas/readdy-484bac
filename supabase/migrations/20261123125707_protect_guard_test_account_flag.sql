-- Keep fixture classification controlled by trusted backend/admin operations.
-- JWT role remains relevant inside security-definer profile RPCs as well.
create or replace function app.protect_guard_test_account_flag()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role', current_user::text) in ('anon','authenticated')
    and not coalesce(app.is_active_admin(),false) then
    if (tg_op='INSERT' and new.is_test_account is true)
      or (tg_op='UPDATE' and new.is_test_account is distinct from old.is_test_account) then
      raise exception 'Test-account classification requires an active admin with MFA'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app.protect_guard_test_account_flag() from public, anon, authenticated;

create or replace trigger trg_protect_guard_test_account_flag
before insert or update of is_test_account on app.guards
for each row execute function app.protect_guard_test_account_flag();
