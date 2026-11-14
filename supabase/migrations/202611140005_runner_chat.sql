begin;
create table public.race_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[가-힣a-zA-Z0-9_]{2,10}$'),
  is_anonymous boolean not null,
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default clock_timestamp()
);
create index race_messages_created_at on public.race_messages(created_at desc);
create table public.race_chat_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null default '1970-01-01 00:00:00+00'
);
alter table public.race_messages enable row level security;
alter table public.race_chat_limits enable row level security;
revoke all on public.race_messages, public.race_chat_limits from public, anon, authenticated;
grant select on public.race_messages to authenticated;
create policy race_chat_read on public.race_messages for select to authenticated using ((select auth.uid()) is not null);

create function public.send_race_message(p_message text, p_nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, true);
  v_name text;
  v_text text := btrim(p_message);
  v_last timestamptz;
  v_now timestamptz := clock_timestamp();
  v_row public.race_messages;
begin
  if v_uid is null then raise exception '채팅하려면 로그인해 주세요.'; end if;
  if v_text is null or char_length(v_text) not between 1 and 300 then raise exception '메시지는 1~300자로 입력해 주세요.'; end if;
  if v_anonymous then v_name := p_nickname;
  else select nickname into v_name from public.profiles where id = v_uid;
  end if;
  if v_name is null or v_name !~ '^[가-힣a-zA-Z0-9_]{2,10}$' or lower(v_name) in ('admin', '관리자', '운영자') then raise exception '러너의 닉네임을 먼저 정해 주세요.'; end if;
  if v_anonymous and exists (select 1 from public.profiles where lower(nickname) = lower(v_name) and id <> v_uid) then
    raise exception '이미 사용 중인 닉네임이에요. 러너 설정에서 다른 이름을 정해 주세요.';
  end if;
  insert into public.race_chat_limits(user_id) values(v_uid) on conflict(user_id) do nothing;
  select last_sent_at into v_last from public.race_chat_limits where user_id = v_uid for update;
  if v_now - v_last < interval '2 seconds' then raise exception '메시지는 2초 간격으로 보낼 수 있어요.'; end if;
  insert into public.race_messages(user_id, nickname, is_anonymous, message)
    values(v_uid, v_name, v_anonymous, v_text) returning * into v_row;
  update public.race_chat_limits set last_sent_at = v_now where user_id = v_uid;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.send_race_message(text, text) from public, anon;
grant execute on function public.send_race_message(text, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'race_messages') then
    alter publication supabase_realtime add table public.race_messages;
  end if;
end $$;
commit;
