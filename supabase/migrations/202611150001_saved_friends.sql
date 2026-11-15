create table public.saved_running_friends (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id, friend_id),
  check(owner_id <> friend_id)
);
alter table public.saved_running_friends enable row level security;
revoke all on public.saved_running_friends from anon, authenticated;
create index saved_running_friends_target on public.saved_running_friends(friend_id);

create function public.save_running_friend(p_target uuid, p_save boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.require_active_account();
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception '정식 계정으로 이용해 주세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 9001));
  if not p_save then
    delete from public.saved_running_friends where owner_id=auth.uid() and friend_id=p_target;
    return;
  end if;
  if p_target=auth.uid() or public.runners_blocked(auth.uid(),p_target)
     or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_target and not coalesce(u.is_anonymous,false))
     or exists(select 1 from public.account_controls where user_id=p_target and suspended)
  then raise exception '친구로 추가할 수 없는 러너예요.'; end if;
  if exists(select 1 from public.saved_running_friends where owner_id=auth.uid() and friend_id=p_target) then return; end if;
  if (select count(*) from public.saved_running_friends where owner_id=auth.uid())>=200 then raise exception '친구는 최대 200명까지 추가할 수 있어요.'; end if;
  insert into public.saved_running_friends(owner_id,friend_id) values(auth.uid(),p_target) on conflict do nothing;
end; $$;

create function public.list_saved_running_friends() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; begin
  perform public.require_active_account();
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception '정식 계정으로 이용해 주세요.'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.online desc,t.nickname),'[]') into v_rows from (
    select p.id,p.nickname,
      coalesce(l.updated_at>clock_timestamp()-interval '30 seconds' and r.active_run_id=l.run_id,false) online,
      coalesce(l.public_location,false) location_public,coalesce(l.allow_invites,false) allow_invites
    from public.saved_running_friends f join public.profiles p on p.id=f.friend_id
    left join public.runner_locations l on l.user_id=p.id left join public.runner_progress r on r.user_id=p.id
    where f.owner_id=auth.uid() and not public.runners_blocked(auth.uid(),p.id)
      and not exists(select 1 from public.account_controls c where c.user_id=p.id and c.suspended)
  ) t;
  return v_rows;
end; $$;

create function public.remove_blocked_saved_friends() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from public.saved_running_friends where (owner_id=new.owner_id and friend_id=new.target_id) or (owner_id=new.target_id and friend_id=new.owner_id);
  return new;
end; $$;
create trigger remove_blocked_saved_friends after insert on public.runner_blocks for each row execute function public.remove_blocked_saved_friends();
revoke all on function public.save_running_friend(uuid,boolean), public.list_saved_running_friends(), public.remove_blocked_saved_friends() from public, anon, authenticated;
grant execute on function public.save_running_friend(uuid,boolean), public.list_saved_running_friends() to authenticated;
