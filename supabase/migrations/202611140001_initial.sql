begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[가-힣a-zA-Z0-9_]{2,10}$' and lower(nickname) not in ('admin', '관리자', '운영자')),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  skin text not null check (skin ~ '^#[0-9a-fA-F]{6}$'),
  hair text check (hair ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_nickname_unique on public.profiles (lower(nickname));
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index runs_user_created on public.runs(user_id, created_at desc);
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
revoke all on public.profiles, public.runs from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.runs to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy runs_select_own on public.runs for select to authenticated using ((select auth.uid()) = user_id);
create policy runs_insert_own on public.runs for insert to authenticated with check ((select auth.uid()) = user_id);
-- Return availability only: other users' profiles remain private under RLS.
create function public.is_nickname_taken(candidate text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is null
    or lower(candidate) in ('admin', '관리자', '운영자')
    or exists (select 1 from public.profiles where lower(nickname) = lower(candidate) and id <> (select auth.uid()));
$$;
revoke all on function public.is_nickname_taken(text) from public, anon;
grant execute on function public.is_nickname_taken(text) to authenticated;
commit;
