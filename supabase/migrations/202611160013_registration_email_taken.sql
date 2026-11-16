begin;
create or replace function public.registration_email_taken(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email)) and not coalesce(is_anonymous, false)
  );
$$;
revoke all on function public.registration_email_taken(text) from public;
grant execute on function public.registration_email_taken(text) to anon, authenticated;
commit;
