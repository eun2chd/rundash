begin;
alter table public.profiles add column if not exists avatar_image text;
alter table public.profiles add constraint profiles_avatar_image_valid check (
  avatar_image is null or (length(avatar_image) <= 60000 and avatar_image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')
);
create or replace function public.keep_profile_nickname() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.nickname is distinct from old.nickname then
    raise exception 'Nickname cannot be changed';
  end if;
  return new;
end;
$$;
create trigger profiles_keep_nickname before update on public.profiles
for each row execute function public.keep_profile_nickname();
commit;
