begin;
-- Signup can check availability without a session. No profile data is returned.
create or replace function public.is_nickname_taken(candidate text) returns boolean
language sql stable security definer set search_path = '' as $$
  select candidate is null
    or candidate !~ '^[가-힣a-zA-Z0-9_]{2,10}$'
    or lower(candidate) in ('admin', '관리자', '운영자')
    or exists (
      select 1 from public.profiles
      where lower(nickname) = lower(candidate)
        and id is distinct from (select auth.uid())
    );
$$;
revoke all on function public.is_nickname_taken(text) from public;
grant execute on function public.is_nickname_taken(text) to anon, authenticated;
-- Table grants and ownership RLS remain unchanged.
commit;
