begin;
create table public.account_controls(user_id uuid primary key references auth.users(id) on delete cascade, suspended boolean not null default false, reason text not null default '', updated_at timestamptz not null default now());
create table public.admin_members(user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table public.admin_audit(id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null, target text, details jsonb, created_at timestamptz not null default now());
create table public.game_settings(id boolean primary key default true check(id), value jsonb not null, version integer not null default 1, updated_at timestamptz not null default now());
insert into public.game_settings(value) values('{"xpBase":100,"xpStep":20,"xpPerKm":100,"completionBonus":0.2,"anonymousMaxKm":10,"maxDistanceKm":100,"anonymousPace":540,"anonymousStamina":100,"anonymousRecovery":60,"boostCooldown":90,"boostCost":12,"boostMultiplier":1.5,"staminaDrain":30,"staminaBasePace":360,"recoverRatio":0.4,"stationFirstM":600,"stationEveryM":1000,"stationGrabBeforeM":40,"stationGrabAfterM":8,"waterRestore":15,"gelRestore":25,"supplyPoints":5,"medalPoints":50,"rhythmPerfect":0.09,"rhythmGood":0.2,"perfectPoints":5,"goodPoints":2,"comboCap":10,"comboBonus":0.1,"cheerPoints":15,"cheerRadius":18,"medalFirstM":200,"medalIntervalMin":250,"medalIntervalJitter":250,"chatMaxLength":300,"chatInterval":2,"intensities":[{"id":"easy","label":"가볍게","description":"오래, 편안하게","extraPace":150,"drain":0.75},{"id":"steady","label":"꾸준히","description":"균형 잡힌 기본 훈련","extraPace":60,"drain":1},{"id":"challenge","label":"도전하기","description":"가장 빠르게, 보급은 필수","extraPace":0,"drain":1.35}],"levels":[{"level":1,"pace":540,"stamina":100,"recovery":60,"boost":0},{"level":2,"pace":525,"stamina":103,"recovery":59,"boost":0},{"level":3,"pace":510,"stamina":106,"recovery":58,"boost":0},{"level":4,"pace":495,"stamina":109,"recovery":57,"boost":0},{"level":5,"pace":480,"stamina":112,"recovery":56,"boost":8},{"level":6,"pace":468,"stamina":115,"recovery":55,"boost":8},{"level":7,"pace":456,"stamina":118,"recovery":54,"boost":8},{"level":8,"pace":444,"stamina":121,"recovery":53,"boost":8},{"level":9,"pace":432,"stamina":124,"recovery":52,"boost":8},{"level":10,"pace":420,"stamina":127,"recovery":51,"boost":8},{"level":11,"pace":414,"stamina":130,"recovery":50,"boost":8},{"level":12,"pace":408,"stamina":133,"recovery":49,"boost":8},{"level":13,"pace":402,"stamina":136,"recovery":48,"boost":8},{"level":14,"pace":396,"stamina":139,"recovery":47,"boost":8},{"level":15,"pace":390,"stamina":142,"recovery":46,"boost":8},{"level":16,"pace":384,"stamina":145,"recovery":45,"boost":8},{"level":17,"pace":378,"stamina":148,"recovery":44,"boost":8},{"level":18,"pace":372,"stamina":151,"recovery":43,"boost":8},{"level":19,"pace":366,"stamina":154,"recovery":42,"boost":8},{"level":20,"pace":360,"stamina":157,"recovery":41,"boost":12},{"level":21,"pace":354,"stamina":160,"recovery":40,"boost":12},{"level":22,"pace":348,"stamina":163,"recovery":39,"boost":12},{"level":23,"pace":342,"stamina":166,"recovery":38,"boost":12},{"level":24,"pace":336,"stamina":169,"recovery":37,"boost":12},{"level":25,"pace":330,"stamina":172,"recovery":36,"boost":12},{"level":26,"pace":324,"stamina":175,"recovery":35,"boost":12},{"level":27,"pace":318,"stamina":178,"recovery":34,"boost":12},{"level":28,"pace":312,"stamina":181,"recovery":33,"boost":12},{"level":29,"pace":306,"stamina":184,"recovery":32,"boost":12},{"level":30,"pace":300,"stamina":187,"recovery":31,"boost":15},{"level":31,"pace":300,"stamina":190,"recovery":30,"boost":15},{"level":32,"pace":300,"stamina":193,"recovery":30,"boost":15},{"level":33,"pace":300,"stamina":196,"recovery":30,"boost":15},{"level":34,"pace":300,"stamina":199,"recovery":30,"boost":15},{"level":35,"pace":300,"stamina":202,"recovery":30,"boost":15},{"level":36,"pace":300,"stamina":205,"recovery":30,"boost":15},{"level":37,"pace":300,"stamina":208,"recovery":30,"boost":15},{"level":38,"pace":300,"stamina":211,"recovery":30,"boost":15},{"level":39,"pace":300,"stamina":214,"recovery":30,"boost":15},{"level":40,"pace":300,"stamina":217,"recovery":30,"boost":15},{"level":41,"pace":300,"stamina":220,"recovery":30,"boost":15},{"level":42,"pace":300,"stamina":223,"recovery":30,"boost":15},{"level":43,"pace":300,"stamina":226,"recovery":30,"boost":15},{"level":44,"pace":300,"stamina":229,"recovery":30,"boost":15},{"level":45,"pace":300,"stamina":232,"recovery":30,"boost":15},{"level":46,"pace":300,"stamina":235,"recovery":30,"boost":15},{"level":47,"pace":300,"stamina":238,"recovery":30,"boost":15},{"level":48,"pace":300,"stamina":241,"recovery":30,"boost":15},{"level":49,"pace":300,"stamina":244,"recovery":30,"boost":15},{"level":50,"pace":300,"stamina":247,"recovery":30,"boost":15}]}'::jsonb);
create table public.support_tickets(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, category text not null check(category in ('bug','feature','account','running','other')), title text not null check(length(title) between 2 and 100), body text not null check(length(body) between 10 and 4000), status text not null default 'open' check(status in ('open','reviewing','planned','resolved','closed')), reply text not null default '' check(length(reply)<=4000), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index support_tickets_user_created on public.support_tickets(user_id,created_at desc);
create index support_tickets_created on public.support_tickets(created_at desc);
alter table public.account_controls enable row level security;
alter table public.admin_members enable row level security;
alter table public.admin_audit enable row level security;
alter table public.game_settings enable row level security;
alter table public.support_tickets enable row level security;
revoke all on public.account_controls,public.admin_members,public.admin_audit,public.game_settings,public.support_tickets from public,anon,authenticated;
grant select on public.game_settings to anon,authenticated;
create policy settings_read on public.game_settings for select to anon,authenticated using(true);
grant select on public.support_tickets to authenticated;
create policy support_read_own on public.support_tickets for select to authenticated using(user_id=(select auth.uid()));
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from public.admin_members where user_id=auth.uid()) and not exists(select 1 from public.account_controls where user_id=auth.uid() and suspended); $$;
create function public.require_admin() returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_admin() then raise exception '관리자 권한이 필요해요.'; end if; end; $$;
create function public.require_active_account() returns void language plpgsql security definer set search_path='' as $$ begin if auth.uid() is null or exists(select 1 from public.account_controls where user_id=auth.uid() and suspended) then raise exception '이용이 제한된 계정이에요. 문의하기로 연락해 주세요.'; end if; end; $$;
create function public.account_status() returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('admin',public.is_admin(),'suspended',coalesce((select suspended from public.account_controls where user_id=auth.uid()),false)); $$;
create function public.current_game_settings() returns jsonb language sql stable security definer set search_path='' as $$ select value from public.game_settings where id; $$;
create function public.rules_level(p_xp bigint,p_rules jsonb) returns integer language sql immutable set search_path='' as $$ select coalesce(max(l),1)::integer from generate_series(1,50) l where (p_rules->>'xpBase')::bigint*(l-1)+(p_rules->>'xpStep')::bigint*(l-1)*(l-2)<=greatest(0,p_xp); $$;
create function public.rules_pace(p_level integer,p_intensity text,p_rules jsonb) returns integer language sql immutable set search_path='' as $$ select (p_rules->'levels'->(greatest(1,least(50,p_level))-1)->>'pace')::integer + (select (e->>'extraPace')::integer from jsonb_array_elements(p_rules->'intensities') e where e->>'id'=p_intensity); $$;
create or replace function public.training_level(p_xp bigint) returns integer language sql stable set search_path='' as $$ select public.rules_level(p_xp,public.current_game_settings()); $$;
create or replace function public.training_pace(p_level integer,p_intensity text) returns integer language sql stable set search_path='' as $$ select public.rules_pace(p_level,p_intensity,public.current_game_settings()); $$;
alter table public.training_sessions add column rules jsonb;
update public.training_sessions set rules=public.current_game_settings();
alter table public.training_sessions alter column rules set not null;
create or replace function public.start_training_run(p_run_id uuid, p_target_km numeric, p_intensity text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_progress public.runner_progress;
  v_session public.training_sessions;
  v_level integer;
  v_rules jsonb := public.current_game_settings();
begin
  perform public.require_active_account();
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception '성장을 저장하려면 정식 계정으로 로그인해 주세요.';
  end if;
  if p_run_id is null or p_target_km is null or not (p_target_km between 0.5 and (v_rules->>'maxDistanceKm')::numeric)
    or p_intensity is null or p_intensity not in ('easy', 'steady', 'challenge') then
    raise exception '러닝 설정을 확인해 주세요.';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception '먼저 러너를 만들어 주세요.';
  end if;
  insert into public.runner_progress(user_id) values(v_uid) on conflict(user_id) do nothing;
  select * into v_progress from public.runner_progress where user_id = v_uid for update;
  select * into v_session from public.training_sessions where id = p_run_id;
  if found then
    if v_session.user_id <> v_uid or v_session.finished_at is not null or v_progress.active_run_id is distinct from p_run_id then
      raise exception '이미 종료된 러닝이에요. 새로 시작해 주세요.';
    end if;
    return jsonb_build_object('id', v_session.id, 'xp', v_session.xp_at_start,
      'intensity', v_session.intensity, 'distanceKm', v_session.target_km, 'settings', v_session.rules);
  end if;
  v_level := public.training_level(v_progress.xp);
  insert into public.training_sessions(id, user_id, xp_at_start, intensity, target_km, pace_sec, rules)
    values(p_run_id, v_uid, v_progress.xp, p_intensity, p_target_km, public.rules_pace(v_level, p_intensity, v_rules), v_rules);
  update public.runner_progress set active_run_id = p_run_id, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('id', p_run_id, 'xp', v_progress.xp, 'intensity', p_intensity, 'distanceKm', p_target_km, 'settings', v_rules);
end;
$$;


create or replace function public.finish_training_run(p_run_id uuid, p_details jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_progress public.runner_progress;
  v_session public.training_sessions;
  v_run public.runs;
  v_distance numeric;
  v_elapsed numeric;
  v_wall numeric;
  v_allowed_distance numeric;
  v_boost_seconds numeric := 0;
  v_duration integer;
  v_practice boolean;
  v_completed boolean;
  v_distance_xp bigint := 0;
  v_completion_xp bigint := 0;
  v_reward bigint := 0;
  v_before bigint;
  v_level integer;
  v_growth jsonb;
  v_rules jsonb;
begin
  perform public.require_active_account();
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception '기록을 저장하려면 정식 계정으로 로그인해 주세요.';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then raise exception '기록 형식을 확인해 주세요.'; end if;
  select * into v_progress from public.runner_progress where user_id = v_uid for update;
  if not found then raise exception '러닝 시작 정보가 없어요.'; end if;
  -- Retried responses return the original reward; XP is never applied twice.
  select * into v_run from public.runs where id = p_run_id and user_id = v_uid;
  if found then return jsonb_build_object('run', to_jsonb(v_run), 'progression', to_jsonb(v_progress)); end if;
  select * into v_session from public.training_sessions where id = p_run_id and user_id = v_uid for update;
  if not found or v_progress.active_run_id is distinct from p_run_id or v_session.finished_at is not null then
    raise exception '다른 창에서 새 러닝을 시작했거나 이미 종료된 러닝이에요.';
  end if;
  v_rules := v_session.rules;
  v_distance := (p_details->>'distanceKm')::numeric;
  v_elapsed := (p_details->>'elapsedSec')::numeric;
  if v_distance is null or v_elapsed is null or v_elapsed::text in ('NaN', 'Infinity', '-Infinity')
    or not (v_distance between 0 and v_session.target_km) or v_elapsed < 0 or v_elapsed > 1000000 then
    raise exception '러닝 거리와 시간을 확인해 주세요.';
  end if;
  v_level := public.rules_level(v_session.xp_at_start, v_rules);
  v_wall := greatest(0, extract(epoch from clock_timestamp() - v_session.started_at));
  v_practice := v_session.practice or coalesce((p_details->>'practice')::boolean, false);
  if not v_practice then
    -- Maximum physically possible distance including unlocked boost windows.
    -- Bound rewards by server wall time, not by client timeScale or submitted XP.
    if (v_rules->'levels'->(v_level-1)->>'boost')::integer > 0 then
      v_duration := (v_rules->'levels'->(v_level-1)->>'boost')::integer;
      v_boost_seconds := floor(v_elapsed / ((v_rules->>'boostCooldown')::numeric + v_duration)) * v_duration
        + least(v_duration, mod(v_elapsed, (v_rules->>'boostCooldown')::numeric + v_duration));
    end if;
    v_allowed_distance := (v_elapsed + ((v_rules->>'boostMultiplier')::numeric - 1) * v_boost_seconds) / v_session.pace_sec;
    if v_elapsed > v_wall + 2 or v_distance > v_allowed_distance + 0.002 then
      v_practice := true;
    end if;
  end if;
  v_completed := coalesce((p_details->>'completed')::boolean, false) and v_distance >= v_session.target_km - .001;
  if not v_practice then
    v_distance_xp := floor(v_distance * (v_rules->>'xpPerKm')::numeric);
    v_completion_xp := case when v_completed then floor(v_distance_xp * (v_rules->>'completionBonus')::numeric) else 0 end;
    v_reward := v_distance_xp + v_completion_xp;
  end if;
  v_before := v_progress.xp;
  v_growth := jsonb_build_object('xpEarned', v_reward, 'distanceXp', v_distance_xp, 'completionXp', v_completion_xp,
    'xpBefore', v_before, 'xpAfter', v_before + v_reward, 'levelBefore', public.training_level(v_before),
    'levelAfter', public.training_level(v_before + v_reward), 'reason', case when v_practice then 'practice' else 'training' end);
  insert into public.runs(id, user_id, details) values(p_run_id, v_uid,
    p_details || jsonb_build_object('distanceKm', v_distance, 'elapsedSec', v_elapsed,
      'paceSec', case when v_distance > 0 then v_elapsed / v_distance else v_session.pace_sec end,
      'targetKm', v_session.target_km, 'targetPaceSec', v_session.pace_sec, 'intensity', v_session.intensity,
      'completed', v_completed, 'practice', v_practice, 'growth', v_growth)) returning * into v_run;
  update public.training_sessions set finished_at = now(), practice = v_practice where id = p_run_id;
  update public.runner_progress set xp = xp + v_reward,
    total_distance_km = total_distance_km + case when v_practice then 0 else v_distance end,
    run_count = run_count + case when v_practice then 0 else 1 end,
    active_run_id = null, updated_at = now() where user_id = v_uid returning * into v_progress;
  return jsonb_build_object('run', to_jsonb(v_run), 'progression', to_jsonb(v_progress));
end;
$$;

create function public.submit_support(p_category text,p_title text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,31));
  if exists(select 1 from public.support_tickets where user_id=auth.uid() and created_at>clock_timestamp()-interval '60 seconds') then raise exception '문의는 1분 간격으로 접수할 수 있어요.'; end if;
  insert into public.support_tickets(user_id,category,title,body) values(auth.uid(),p_category,btrim(p_title),btrim(p_body)) returning id into v_id; return v_id;
end; $$;
create function public.admin_support(p_status text default '',p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rows jsonb; v_count bigint; begin
perform public.require_admin();
select count(*) into v_count from public.support_tickets where p_status='' or status=p_status;
select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (select s.*,u.email,p.nickname from public.support_tickets s join auth.users u on u.id=s.user_id left join public.profiles p on p.id=s.user_id where p_status='' or s.status=p_status order by s.created_at desc limit 25 offset greatest(0,p_page)*25) t;
return jsonb_build_object('items',v_rows,'total',v_count); end; $$;
create function public.admin_reply_support(p_id uuid,p_status text,p_reply text) returns void language plpgsql security definer set search_path='' as $$ begin
perform public.require_admin(); update public.support_tickets set status=p_status,reply=btrim(p_reply),updated_at=now() where id=p_id;
if not found then raise exception '문의를 찾을 수 없어요.'; end if;
insert into public.admin_audit(actor_id,action,target,details) values(auth.uid(),'support_reply',p_id::text,jsonb_build_object('status',p_status)); end; $$;
create function public.admin_members_list(p_query text default '',p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rows jsonb; v_count bigint; begin
perform public.require_admin();
select count(*) into v_count from auth.users u left join public.profiles p on p.id=u.id where u.email ilike '%'||left(p_query,100)||'%' or p.nickname ilike '%'||left(p_query,100)||'%';
select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (select u.id,u.email,u.is_anonymous,u.created_at,u.last_sign_in_at,p.nickname,coalesce(r.xp,0) xp,coalesce(r.total_distance_km,0) total_distance_km,coalesce(r.run_count,0) run_count,r.active_run_id,coalesce(c.suspended,false) suspended,c.reason,exists(select 1 from public.admin_members a where a.user_id=u.id) admin from auth.users u left join public.profiles p on p.id=u.id left join public.runner_progress r on r.user_id=u.id left join public.account_controls c on c.user_id=u.id where u.email ilike '%'||left(p_query,100)||'%' or p.nickname ilike '%'||left(p_query,100)||'%' order by u.created_at desc limit 25 offset greatest(0,p_page)*25) t;
return jsonb_build_object('items',v_rows,'total',v_count); end; $$;
create function public.admin_update_member(p_user_id uuid,p_action text,p_value bigint,p_reason text) returns void language plpgsql security definer set search_path='' as $$ declare v_old bigint; begin
perform public.require_admin();
if length(btrim(p_reason))<2 or length(p_reason)>500 then raise exception '변경 사유를 입력해 주세요.'; end if;
if p_action in ('suspend','restore') then
 if exists(select 1 from public.admin_members where user_id=p_user_id) then raise exception '관리자 계정은 정지할 수 없어요.'; end if;
 insert into public.account_controls(user_id,suspended,reason) values(p_user_id,p_action='suspend',p_reason) on conflict(user_id) do update set suspended=excluded.suspended,reason=excluded.reason,updated_at=now();
elsif p_action='xp' then
 if p_value is null or p_value not between 0 and 1000000000 then raise exception 'XP 범위를 확인해 주세요.'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception '러너가 없는 계정이에요.'; end if;
 insert into public.runner_progress(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select xp into v_old from public.runner_progress where user_id=p_user_id for update;
 if exists(select 1 from public.runner_progress where user_id=p_user_id and active_run_id is not null) then raise exception '러닝 중에는 경험치를 변경할 수 없어요.'; end if;
 update public.runner_progress set xp=p_value,updated_at=now() where user_id=p_user_id;
else raise exception '지원하지 않는 작업이에요.'; end if;
insert into public.admin_audit(actor_id,action,target,details) values(auth.uid(),p_action,p_user_id::text,jsonb_build_object('beforeXp',v_old,'value',p_value,'reason',p_reason)); end; $$;
create function public.admin_save_settings(p_value jsonb,p_version integer) returns integer language plpgsql security definer set search_path='' as $$ declare v_version integer; v_old jsonb; v_row jsonb; v_index integer:=0; begin
perform public.require_admin();
if jsonb_typeof(p_value) is distinct from 'object' then raise exception '설정 형식을 확인해 주세요.'; end if;
if jsonb_typeof(p_value->'xpBase') is distinct from 'number' or not ((p_value->>'xpBase')::numeric between 1 and 100000) or (p_value->>'xpBase')::numeric <> trunc((p_value->>'xpBase')::numeric) then raise exception 'Invalid setting: xpBase'; end if;
if jsonb_typeof(p_value->'xpStep') is distinct from 'number' or not ((p_value->>'xpStep')::numeric between 0 and 10000) or (p_value->>'xpStep')::numeric <> trunc((p_value->>'xpStep')::numeric) then raise exception 'Invalid setting: xpStep'; end if;
if jsonb_typeof(p_value->'xpPerKm') is distinct from 'number' or not ((p_value->>'xpPerKm')::numeric between 0 and 10000) or (p_value->>'xpPerKm')::numeric <> trunc((p_value->>'xpPerKm')::numeric) then raise exception 'Invalid setting: xpPerKm'; end if;
if jsonb_typeof(p_value->'completionBonus') is distinct from 'number' or not ((p_value->>'completionBonus')::numeric between 0 and 5) then raise exception 'Invalid setting: completionBonus'; end if;
if jsonb_typeof(p_value->'maxDistanceKm') is distinct from 'number' or not ((p_value->>'maxDistanceKm')::numeric between 0.5 and 100) then raise exception 'Invalid setting: maxDistanceKm'; end if;
if jsonb_typeof(p_value->'anonymousMaxKm') is distinct from 'number' or not ((p_value->>'anonymousMaxKm')::numeric between 0.5 and 10) then raise exception 'Invalid setting: anonymousMaxKm'; end if;
if jsonb_typeof(p_value->'anonymousPace') is distinct from 'number' or not ((p_value->>'anonymousPace')::numeric between 180 and 1800) or (p_value->>'anonymousPace')::numeric <> trunc((p_value->>'anonymousPace')::numeric) then raise exception 'Invalid setting: anonymousPace'; end if;
if jsonb_typeof(p_value->'anonymousStamina') is distinct from 'number' or not ((p_value->>'anonymousStamina')::numeric between 10 and 1000) or (p_value->>'anonymousStamina')::numeric <> trunc((p_value->>'anonymousStamina')::numeric) then raise exception 'Invalid setting: anonymousStamina'; end if;
if jsonb_typeof(p_value->'anonymousRecovery') is distinct from 'number' or not ((p_value->>'anonymousRecovery')::numeric between 5 and 300) or (p_value->>'anonymousRecovery')::numeric <> trunc((p_value->>'anonymousRecovery')::numeric) then raise exception 'Invalid setting: anonymousRecovery'; end if;
if jsonb_typeof(p_value->'boostCooldown') is distinct from 'number' or not ((p_value->>'boostCooldown')::numeric between 1 and 600) or (p_value->>'boostCooldown')::numeric <> trunc((p_value->>'boostCooldown')::numeric) then raise exception 'Invalid setting: boostCooldown'; end if;
if jsonb_typeof(p_value->'boostCost') is distinct from 'number' or not ((p_value->>'boostCost')::numeric between 1 and 100) or (p_value->>'boostCost')::numeric <> trunc((p_value->>'boostCost')::numeric) then raise exception 'Invalid setting: boostCost'; end if;
if jsonb_typeof(p_value->'boostMultiplier') is distinct from 'number' or not ((p_value->>'boostMultiplier')::numeric between 1 and 3) then raise exception 'Invalid setting: boostMultiplier'; end if;
if jsonb_typeof(p_value->'staminaDrain') is distinct from 'number' or not ((p_value->>'staminaDrain')::numeric between 1 and 200) or (p_value->>'staminaDrain')::numeric <> trunc((p_value->>'staminaDrain')::numeric) then raise exception 'Invalid setting: staminaDrain'; end if;
if jsonb_typeof(p_value->'staminaBasePace') is distinct from 'number' or not ((p_value->>'staminaBasePace')::numeric between 180 and 1800) or (p_value->>'staminaBasePace')::numeric <> trunc((p_value->>'staminaBasePace')::numeric) then raise exception 'Invalid setting: staminaBasePace'; end if;
if jsonb_typeof(p_value->'recoverRatio') is distinct from 'number' or not ((p_value->>'recoverRatio')::numeric between 0.1 and 1) then raise exception 'Invalid setting: recoverRatio'; end if;
if jsonb_typeof(p_value->'stationFirstM') is distinct from 'number' or not ((p_value->>'stationFirstM')::numeric between 100 and 5000) then raise exception 'Invalid setting: stationFirstM'; end if;
if jsonb_typeof(p_value->'stationEveryM') is distinct from 'number' or not ((p_value->>'stationEveryM')::numeric between 100 and 10000) then raise exception 'Invalid setting: stationEveryM'; end if;
if jsonb_typeof(p_value->'stationGrabBeforeM') is distinct from 'number' or not ((p_value->>'stationGrabBeforeM')::numeric between 5 and 100) or (p_value->>'stationGrabBeforeM')::numeric <> trunc((p_value->>'stationGrabBeforeM')::numeric) then raise exception 'Invalid setting: stationGrabBeforeM'; end if;
if jsonb_typeof(p_value->'stationGrabAfterM') is distinct from 'number' or not ((p_value->>'stationGrabAfterM')::numeric between 1 and 50) or (p_value->>'stationGrabAfterM')::numeric <> trunc((p_value->>'stationGrabAfterM')::numeric) then raise exception 'Invalid setting: stationGrabAfterM'; end if;
if jsonb_typeof(p_value->'waterRestore') is distinct from 'number' or not ((p_value->>'waterRestore')::numeric between 1 and 200) or (p_value->>'waterRestore')::numeric <> trunc((p_value->>'waterRestore')::numeric) then raise exception 'Invalid setting: waterRestore'; end if;
if jsonb_typeof(p_value->'gelRestore') is distinct from 'number' or not ((p_value->>'gelRestore')::numeric between 1 and 200) or (p_value->>'gelRestore')::numeric <> trunc((p_value->>'gelRestore')::numeric) then raise exception 'Invalid setting: gelRestore'; end if;
if jsonb_typeof(p_value->'supplyPoints') is distinct from 'number' or not ((p_value->>'supplyPoints')::numeric between 0 and 1000) or (p_value->>'supplyPoints')::numeric <> trunc((p_value->>'supplyPoints')::numeric) then raise exception 'Invalid setting: supplyPoints'; end if;
if jsonb_typeof(p_value->'medalPoints') is distinct from 'number' or not ((p_value->>'medalPoints')::numeric between 0 and 1000) or (p_value->>'medalPoints')::numeric <> trunc((p_value->>'medalPoints')::numeric) then raise exception 'Invalid setting: medalPoints'; end if;
if jsonb_typeof(p_value->'rhythmPerfect') is distinct from 'number' or not ((p_value->>'rhythmPerfect')::numeric between 0.01 and 0.2) then raise exception 'Invalid setting: rhythmPerfect'; end if;
if jsonb_typeof(p_value->'rhythmGood') is distinct from 'number' or not ((p_value->>'rhythmGood')::numeric between 0.02 and 0.4) then raise exception 'Invalid setting: rhythmGood'; end if;
if jsonb_typeof(p_value->'perfectPoints') is distinct from 'number' or not ((p_value->>'perfectPoints')::numeric between 1 and 100) or (p_value->>'perfectPoints')::numeric <> trunc((p_value->>'perfectPoints')::numeric) then raise exception 'Invalid setting: perfectPoints'; end if;
if jsonb_typeof(p_value->'goodPoints') is distinct from 'number' or not ((p_value->>'goodPoints')::numeric between 1 and 100) or (p_value->>'goodPoints')::numeric <> trunc((p_value->>'goodPoints')::numeric) then raise exception 'Invalid setting: goodPoints'; end if;
if jsonb_typeof(p_value->'comboCap') is distinct from 'number' or not ((p_value->>'comboCap')::numeric between 1 and 50) or (p_value->>'comboCap')::numeric <> trunc((p_value->>'comboCap')::numeric) then raise exception 'Invalid setting: comboCap'; end if;
if jsonb_typeof(p_value->'comboBonus') is distinct from 'number' or not ((p_value->>'comboBonus')::numeric between 0 and 1) then raise exception 'Invalid setting: comboBonus'; end if;
if jsonb_typeof(p_value->'cheerPoints') is distinct from 'number' or not ((p_value->>'cheerPoints')::numeric between 0 and 1000) or (p_value->>'cheerPoints')::numeric <> trunc((p_value->>'cheerPoints')::numeric) then raise exception 'Invalid setting: cheerPoints'; end if;
if jsonb_typeof(p_value->'cheerRadius') is distinct from 'number' or not ((p_value->>'cheerRadius')::numeric between 5 and 100) or (p_value->>'cheerRadius')::numeric <> trunc((p_value->>'cheerRadius')::numeric) then raise exception 'Invalid setting: cheerRadius'; end if;
if jsonb_typeof(p_value->'medalFirstM') is distinct from 'number' or not ((p_value->>'medalFirstM')::numeric between 50 and 5000) then raise exception 'Invalid setting: medalFirstM'; end if;
if jsonb_typeof(p_value->'medalIntervalMin') is distinct from 'number' or not ((p_value->>'medalIntervalMin')::numeric between 50 and 5000) then raise exception 'Invalid setting: medalIntervalMin'; end if;
if jsonb_typeof(p_value->'medalIntervalJitter') is distinct from 'number' or not ((p_value->>'medalIntervalJitter')::numeric between 0 and 5000) then raise exception 'Invalid setting: medalIntervalJitter'; end if;
if jsonb_typeof(p_value->'chatMaxLength') is distinct from 'number' or not ((p_value->>'chatMaxLength')::numeric between 10 and 300) or (p_value->>'chatMaxLength')::numeric <> trunc((p_value->>'chatMaxLength')::numeric) then raise exception 'Invalid setting: chatMaxLength'; end if;
if jsonb_typeof(p_value->'chatInterval') is distinct from 'number' or not ((p_value->>'chatInterval')::numeric between 1 and 60) or (p_value->>'chatInterval')::numeric <> trunc((p_value->>'chatInterval')::numeric) then raise exception 'Invalid setting: chatInterval'; end if;
if (p_value->>'rhythmPerfect')::numeric > (p_value->>'rhythmGood')::numeric then raise exception 'GOOD 판정은 PERFECT 이상이어야 해요.'; end if;
if (p_value->>'anonymousMaxKm')::numeric > (p_value->>'maxDistanceKm')::numeric then raise exception '익명 거리는 회원 거리 이하여야 해요.'; end if;
if jsonb_typeof(p_value->'levels') is distinct from 'array' or jsonb_array_length(p_value->'levels')<>50 then raise exception '50개 레벨을 설정해 주세요.'; end if;
for v_row in select value from jsonb_array_elements(p_value->'levels') loop
 v_index:=v_index+1;
 if not (v_row ?& array['level','pace','stamina','recovery','boost']) or jsonb_typeof(v_row->'level') is distinct from 'number' or (v_row->>'level')::numeric<>v_index
 or jsonb_typeof(v_row->'pace') is distinct from 'number' or jsonb_typeof(v_row->'stamina') is distinct from 'number' or jsonb_typeof(v_row->'recovery') is distinct from 'number' or jsonb_typeof(v_row->'boost') is distinct from 'number'
 or not ((v_row->>'pace')::numeric between 180 and 1800) or not ((v_row->>'stamina')::numeric between 10 and 1000) or not ((v_row->>'recovery')::numeric between 5 and 300) or not ((v_row->>'boost')::numeric between 0 and 60)
 or (v_row->>'pace')::numeric<>trunc((v_row->>'pace')::numeric) or (v_row->>'stamina')::numeric<>trunc((v_row->>'stamina')::numeric) or (v_row->>'recovery')::numeric<>trunc((v_row->>'recovery')::numeric) or (v_row->>'boost')::numeric<>trunc((v_row->>'boost')::numeric) then raise exception '레벨 설정 범위를 확인해 주세요.'; end if;
end loop;
if jsonb_typeof(p_value->'intensities') is distinct from 'array' or jsonb_array_length(p_value->'intensities')<>3 then raise exception '강도 3개가 필요해요.'; end if;
v_index:=0;
for v_row in select value from jsonb_array_elements(p_value->'intensities') loop
 v_index:=v_index+1;
 if not (v_row ?& array['id','label','description','extraPace','drain']) or jsonb_typeof(v_row->'id') is distinct from 'string' or jsonb_typeof(v_row->'label') is distinct from 'string' or jsonb_typeof(v_row->'description') is distinct from 'string' or jsonb_typeof(v_row->'extraPace') is distinct from 'number' or jsonb_typeof(v_row->'drain') is distinct from 'number' or v_row->>'id'<>(array['easy','steady','challenge'])[v_index] or not (length(v_row->>'label') between 1 and 20) or not (length(v_row->>'description') between 1 and 100) or not ((v_row->>'extraPace')::numeric between 0 and 600) or not ((v_row->>'drain')::numeric between 0.1 and 5) or (v_row->>'extraPace')::numeric<>trunc((v_row->>'extraPace')::numeric) then raise exception '강도 설정을 확인해 주세요.'; end if;
end loop;
select value,version into v_old,v_version from public.game_settings where id for update;
if v_version<>p_version then raise exception '다른 관리자가 설정을 바꿨어요. 다시 불러온 뒤 수정해 주세요.'; end if;
update public.game_settings set value=p_value,version=version+1,updated_at=now() where id returning version into v_version;
insert into public.admin_audit(actor_id,action,target,details) values(auth.uid(),'settings','game',jsonb_build_object('before',v_old,'after',p_value,'version',v_version)); return v_version; end; $$;
create function public.admin_audit_list(p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rows jsonb; begin perform public.require_admin(); select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (select a.id,a.action,a.target,a.details,a.created_at,u.email actor from public.admin_audit a left join auth.users u on u.id=a.actor_id order by a.id desc limit 25 offset greatest(0,p_page)*25) t; return jsonb_build_object('items',v_rows,'total',(select count(*) from public.admin_audit)); end; $$;
-- Server-side suspension checks cover runs, profile writes and chat even with existing sessions.
create function public.guard_active_write() returns trigger language plpgsql security definer set search_path='' as $$ begin if auth.uid() is not null then perform public.require_active_account(); end if; return new; end; $$;
create trigger profiles_active_account before insert or update on public.profiles for each row execute function public.guard_active_write();
create trigger chat_active_account before insert on public.race_messages for each row execute function public.guard_active_write();
revoke all on function public.is_admin(),public.require_admin(),public.require_active_account(),public.account_status(),public.current_game_settings(),public.rules_level(bigint,jsonb),public.rules_pace(integer,text,jsonb),public.submit_support(text,text,text),public.admin_support(text,integer),public.admin_reply_support(uuid,text,text),public.admin_members_list(text,integer),public.admin_update_member(uuid,text,bigint,text),public.admin_save_settings(jsonb,integer),public.admin_audit_list(integer),public.guard_active_write() from public,anon,authenticated;
grant execute on function public.is_admin(),public.account_status(),public.submit_support(text,text,text),public.admin_support(text,integer),public.admin_reply_support(uuid,text,text),public.admin_members_list(text,integer),public.admin_update_member(uuid,text,bigint,text),public.admin_save_settings(jsonb,integer),public.admin_audit_list(integer) to authenticated;
commit;
