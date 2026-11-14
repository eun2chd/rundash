begin;
alter table public.profiles add column if not exists outfit jsonb not null default '{}'::jsonb;
alter table public.profiles add constraint profiles_outfit_object check (jsonb_typeof(outfit) = 'object');
commit;
