begin;
-- Test accounts: created by an admin with email verification already done, flagged here and
-- left out of every ranking and of member statistics. Admins can also grant or revoke the
-- admin role from the member list.
create table public.test_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.test_accounts enable row level security;
revoke all on public.test_accounts from public, anon, authenticated;

-- Writes a confirmed email/password user straight into GoTrue's tables (what auth.admin.createUser
-- does). Token columns must be '' rather than NULL or GoTrue fails to load the user.
create function public.admin_create_test_account(p_email text, p_password text, p_nickname text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(btrim(coalesce(p_email, ''))); v_nickname text := btrim(coalesce(p_nickname, ''));
begin
  perform public.require_admin();
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception '이메일 형식을 확인해 주세요.'; end if;
  if length(coalesce(p_password, '')) < 8 or p_password !~ '[^A-Za-z0-9]' then raise exception '비밀번호는 8자 이상, 특수문자를 1개 이상 포함해 주세요.'; end if;
  if v_nickname !~ '^[가-힣a-zA-Z0-9_]{2,10}$' or lower(v_nickname) in ('admin', '관리자', '운영자') then raise exception '닉네임은 2~10자, 한글·영문·숫자·_로 정해 주세요.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception '이미 가입된 이메일이에요.'; end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(v_nickname))
    or exists (select 1 from auth.users where lower(raw_user_meta_data->>'nickname') = lower(v_nickname)) then raise exception '이미 사용 중인 닉네임이에요.'; end if;
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nickname', v_nickname, 'test_account', true), now(), now());
  insert into auth.identities(id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  insert into public.test_accounts(user_id, created_by) values (v_id, auth.uid());
  insert into public.admin_audit(actor_id, action, target, details) values (auth.uid(), 'test_account_created', v_id::text, jsonb_build_object('nickname', v_nickname));
  return v_id;
end;
$$;

create function public.admin_set_admin(p_user_id uuid, p_admin boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user auth.users;
begin
  perform public.require_admin();
  if length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 500 then raise exception '변경 사유를 입력해 주세요.'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception '내 관리자 권한은 여기서 바꿀 수 없어요.'; end if;
  select * into v_user from auth.users where id = p_user_id;
  if not found then raise exception '계정을 찾을 수 없어요.'; end if;
  if p_admin then
    if coalesce(v_user.is_anonymous, false) or v_user.email is null then raise exception '이메일로 가입한 회원만 관리자로 지정할 수 있어요.'; end if;
    if exists (select 1 from public.account_controls where user_id = p_user_id and suspended) then raise exception '이용 정지된 계정은 관리자로 지정할 수 없어요.'; end if;
    insert into public.admin_members(user_id) values (p_user_id) on conflict (user_id) do nothing;
  else
    delete from public.admin_members where user_id = p_user_id;
  end if;
  insert into public.admin_audit(actor_id, action, target, details)
  values (auth.uid(), case when p_admin then 'admin_grant' else 'admin_revoke' end, p_user_id::text, jsonb_build_object('reason', btrim(p_reason)));
end;
$$;

create or replace function public.admin_member_directory(p_query text default '', p_page integer default 0, p_type text default '', p_status text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform public.require_admin();
  if p_type not in ('', 'member', 'anonymous', 'test') or p_status not in ('', 'active', 'suspended') then
    raise exception '회원 필터를 확인해 주세요.';
  end if;
  with members as (
    select u.id, u.email, coalesce(u.is_anonymous,false) is_anonymous, u.created_at, u.last_sign_in_at,
      p.nickname, coalesce(r.xp,0) xp, coalesce(r.total_distance_km,0) total_distance_km,
      coalesce(r.run_count,0) run_count, r.active_run_id, coalesce(c.suspended,false) suspended, c.reason,
      exists(select 1 from public.admin_members a where a.user_id=u.id) admin,
      exists(select 1 from public.test_accounts t where t.user_id=u.id) is_test
    from auth.users u left join public.profiles p on p.id=u.id
    left join public.runner_progress r on r.user_id=u.id left join public.account_controls c on c.user_id=u.id
  ), ranked as (
    -- Members first, then test accounts, then anonymous runners.
    select m.*, case when m.is_anonymous then 2 when m.is_test then 1 else 0 end kind from members m
  ), filtered as (
    select * from ranked m where
      (coalesce(p_query,'')='' or m.email ilike '%'||left(p_query,100)||'%' or m.nickname ilike '%'||left(p_query,100)||'%')
      and (p_type='' or (p_type='member' and m.kind=0) or (p_type='test' and m.kind=1) or (p_type='anonymous' and m.kind=2))
      and (p_status='' or (p_status='suspended')=m.suspended)
  )
  select jsonb_build_object(
    -- Test accounts are counted separately and never in the member statistics.
    'summary', (select jsonb_build_object('total',count(*) filter(where not is_test),'members',count(*) filter(where kind=0),
      'anonymous',count(*) filter(where kind=2),'suspended',count(*) filter(where suspended and not is_test),'test',count(*) filter(where is_test)) from ranked),
    'total',(select count(*) from filtered),
    'items',coalesce((select jsonb_agg(to_jsonb(t) - 'kind' order by t.kind,t.created_at desc,t.id) from
      (select * from filtered order by kind,created_at desc,id limit 10 offset greatest(0,coalesce(p_page,0))*10) t),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.runner_ranking(p_board text, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamp := clock_timestamp() at time zone 'Asia/Seoul';
  v_start date;
  v_end date;
  v_resets timestamptz;
  v_result jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요해요.'; end if;
  if p_board not in ('week', 'month', 'total', 'level') then raise exception '랭킹 종류를 확인해 주세요.'; end if;
  if p_offset not between 0 and 1 or (p_board in ('total', 'level') and p_offset <> 0) then raise exception '이번 기간과 지난 기간 랭킹만 볼 수 있어요.'; end if;
  if p_board = 'week' then
    v_start := date_trunc('week', v_now)::date - 7 * p_offset;
    v_end := v_start + 7;
    v_resets := (date_trunc('week', v_now) + interval '7 days') at time zone 'Asia/Seoul';
  elsif p_board = 'month' then
    v_start := (date_trunc('month', v_now) - make_interval(months => p_offset))::date;
    v_end := (v_start + interval '1 month')::date;
    v_resets := (date_trunc('month', v_now) + interval '1 month') at time zone 'Asia/Seoul';
  end if;

  with eligible as (
    select p.id user_id, p.nickname, p.color from public.profiles p
    where not exists (select 1 from public.admin_members a where a.user_id = p.id)
      and not exists (select 1 from public.account_controls c where c.user_id = p.id and c.suspended)
      -- Test accounts never appear on any board.
      and not exists (select 1 from public.test_accounts t where t.user_id = p.id)
  ), period_runs as (
    select r.user_id, round(sum((r.details->>'distanceKm')::numeric), 2) km, count(*)::integer runs, max(r.created_at) reached_at
    from public.runs r
    where p_board in ('week', 'month')
      and r.created_at >= v_start::timestamp at time zone 'Asia/Seoul' and r.created_at < v_end::timestamp at time zone 'Asia/Seoul'
      and not coalesce((r.details->>'practice')::boolean, false)
    group by r.user_id having sum((r.details->>'distanceKm')::numeric) > 0
  ), scores as (
    select e.user_id, e.nickname, e.color, pr.km, pr.runs, coalesce(g.xp, 0) xp, pr.reached_at
    from period_runs pr join eligible e using (user_id) left join public.runner_progress g using (user_id)
    where p_board in ('week', 'month')
    union all
    select e.user_id, e.nickname, e.color, round(g.total_distance_km, 2), g.run_count, g.xp, g.updated_at
    from public.runner_progress g join eligible e using (user_id)
    where p_board = 'total' and g.total_distance_km > 0
    union all
    select e.user_id, e.nickname, e.color, round(g.total_distance_km, 2), g.run_count, g.xp, g.updated_at
    from public.runner_progress g join eligible e using (user_id)
    where p_board = 'level' and g.xp > 0
  ), board as (
    -- Ties go to whoever reached the score first.
    select s.*, public.training_level(s.xp) level,
      rank() over (order by case when p_board = 'level' then s.xp else s.km end desc, s.reached_at asc)::integer rank
    from scores s
  )
  select jsonb_build_object(
    'board', p_board, 'offset', p_offset,
    'periodStart', v_start, 'periodEnd', v_end - 1, 'resetsAt', case when p_offset = 0 then v_resets end,
    'participants', (select count(*) from board),
    'excluded', exists (select 1 from public.admin_members a where a.user_id = v_uid),
    'items', coalesce((select jsonb_agg(jsonb_build_object('rank', b.rank, 'nickname', b.nickname, 'color', b.color, 'km', b.km, 'runs', b.runs, 'xp', b.xp, 'level', b.level, 'me', b.user_id = v_uid) order by b.rank, b.reached_at)
      from (select * from board order by rank, reached_at limit 50) b), '[]'),
    'me', (select jsonb_build_object('rank', b.rank, 'nickname', b.nickname, 'color', b.color, 'km', b.km, 'runs', b.runs, 'xp', b.xp, 'level', b.level, 'me', true) from board b where b.user_id = v_uid))
  into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_create_test_account(text, text, text), public.admin_set_admin(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_create_test_account(text, text, text), public.admin_set_admin(uuid, boolean, text) to authenticated;
commit;
