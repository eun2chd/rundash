begin;
-- Test accounts used to store the nickname only in the signup metadata, so the admin console showed
-- them as "러너 생성 전" and blocked XP adjustment until the tester created a runner in the app.
create or replace function public.admin_create_test_account(p_email text, p_password text, p_nickname text) returns uuid
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
  -- Create the runner right away with a default look so the nickname shows in the console and
  -- XP can be adjusted before the tester ever logs in. The look can be changed later in My Page.
  insert into public.profiles(id, nickname, color, skin) values (v_id, v_nickname, '#e07b39', '#f6d1b0');
  insert into public.test_accounts(user_id, created_by) values (v_id, auth.uid());
  insert into public.admin_audit(actor_id, action, target, details) values (auth.uid(), 'test_account_created', v_id::text, jsonb_build_object('nickname', v_nickname));
  return v_id;
end;
$$;

-- Backfill: give existing test accounts without a runner their saved nickname and a default look.
do $backfill$ begin
insert into public.profiles(id, nickname, color, skin)
select u.id, u.raw_user_meta_data->>'nickname', '#e07b39', '#f6d1b0'
from public.test_accounts t join auth.users u on u.id = t.user_id
where not exists (select 1 from public.profiles p where p.id = u.id)
  and coalesce(u.raw_user_meta_data->>'nickname', '') ~ '^[가-힣a-zA-Z0-9_]{2,10}$'
  and lower(u.raw_user_meta_data->>'nickname') not in ('admin', '관리자', '운영자')
  and not exists (select 1 from public.profiles p where lower(p.nickname) = lower(u.raw_user_meta_data->>'nickname'));
exception when undefined_column then null; -- local test schemas have no auth metadata column
end $backfill$;

-- Member directory: administrator accounts are listed at the very top.
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
    -- Admins first, then members, test accounts and anonymous runners.
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
    'items',coalesce((select jsonb_agg(to_jsonb(t) - 'kind' order by t.admin desc,t.kind,t.created_at desc,t.id) from
      (select * from filtered order by admin desc,kind,created_at desc,id limit 10 offset greatest(0,coalesce(p_page,0))*10) t),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

commit;
