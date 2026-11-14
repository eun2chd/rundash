begin;

create table public.runner_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  total_distance_km numeric not null default 0 check (total_distance_km >= 0),
  run_count integer not null default 0 check (run_count >= 0),
  active_run_id uuid,
  updated_at timestamptz not null default now()
);
create table public.training_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  xp_at_start bigint not null,
  intensity text not null check (intensity in ('easy', 'steady', 'challenge')),
  target_km numeric not null check (target_km between 0.5 and 100),
  pace_sec integer not null,
  practice boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index training_sessions_user_id on public.training_sessions(user_id);
alter table public.runner_progress enable row level security;
alter table public.training_sessions enable row level security;
revoke all on public.runner_progress, public.training_sessions from public, anon, authenticated;
grant select on public.runner_progress, public.training_sessions to authenticated;
create policy progress_read_own on public.runner_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy training_read_own on public.training_sessions for select to authenticated using ((select auth.uid()) = user_id);
-- XP and run records can only be written by the transaction below.
revoke insert, update, delete on public.runs from anon, authenticated;

create function public.training_level(p_xp bigint) returns integer
language sql immutable set search_path = '' as $$
  select coalesce(max(l), 1)::integer from generate_series(1, 50) as l
  where 100::bigint * (l - 1) + 20::bigint * (l - 1) * (l - 2) <= greatest(0, p_xp);
$$;
create function public.training_pace(p_level integer, p_intensity text) returns integer
language sql immutable set search_path = '' as $$
  select (case when p_level <= 5 then 540 - (p_level - 1) * 15
    when p_level <= 10 then 480 - (p_level - 5) * 12
    when p_level <= 30 then 420 - (p_level - 10) * 6 else 300 end)
    + case p_intensity when 'easy' then 150 when 'challenge' then 0 else 60 end;
$$;
revoke all on function public.training_level(bigint), public.training_pace(integer, text) from public, anon, authenticated;

create function public.start_training_run(p_run_id uuid, p_target_km numeric, p_intensity text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_progress public.runner_progress;
  v_session public.training_sessions;
  v_level integer;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception '성장을 저장하려면 정식 계정으로 로그인해 주세요.';
  end if;
  if p_run_id is null or p_target_km is null or not (p_target_km between 0.5 and 100)
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
      'intensity', v_session.intensity, 'distanceKm', v_session.target_km);
  end if;
  v_level := public.training_level(v_progress.xp);
  insert into public.training_sessions(id, user_id, xp_at_start, intensity, target_km, pace_sec)
    values(p_run_id, v_uid, v_progress.xp, p_intensity, p_target_km, public.training_pace(v_level, p_intensity));
  update public.runner_progress set active_run_id = p_run_id, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('id', p_run_id, 'xp', v_progress.xp, 'intensity', p_intensity, 'distanceKm', p_target_km);
end;
$$;

create function public.mark_training_practice(p_run_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  update public.training_sessions set practice = true
    where id = p_run_id and user_id = auth.uid() and finished_at is null;
  if not found then raise exception '진행 중인 러닝을 찾지 못했어요.'; end if;
end;
$$;

create function public.finish_training_run(p_run_id uuid, p_details jsonb) returns jsonb
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
begin
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
  v_distance := (p_details->>'distanceKm')::numeric;
  v_elapsed := (p_details->>'elapsedSec')::numeric;
  if v_distance is null or v_elapsed is null or v_elapsed::text in ('NaN', 'Infinity', '-Infinity')
    or not (v_distance between 0 and v_session.target_km) or v_elapsed < 0 or v_elapsed > 1000000 then
    raise exception '러닝 거리와 시간을 확인해 주세요.';
  end if;
  v_level := public.training_level(v_session.xp_at_start);
  v_wall := greatest(0, extract(epoch from clock_timestamp() - v_session.started_at));
  v_practice := v_session.practice or coalesce((p_details->>'practice')::boolean, false);
  if not v_practice then
    -- Maximum physically possible distance including unlocked boost windows.
    -- Bound rewards by server wall time, not by client timeScale or submitted XP.
    if v_level >= 5 then
      v_duration := case when v_level >= 30 then 15 when v_level >= 20 then 12 else 8 end;
      v_boost_seconds := floor(v_elapsed / (90 + v_duration)) * v_duration
        + least(v_duration, mod(v_elapsed, 90 + v_duration));
    end if;
    v_allowed_distance := (v_elapsed + .5 * v_boost_seconds) / v_session.pace_sec;
    if v_elapsed > v_wall + 2 or v_distance > v_allowed_distance + 0.002 then
      v_practice := true;
    end if;
  end if;
  v_completed := coalesce((p_details->>'completed')::boolean, false) and v_distance >= v_session.target_km - .001;
  if not v_practice then
    v_distance_xp := floor(v_distance * 100);
    v_completion_xp := case when v_completed then floor(v_distance_xp * .2) else 0 end;
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
revoke all on function public.start_training_run(uuid, numeric, text), public.mark_training_practice(uuid), public.finish_training_run(uuid, jsonb) from public, anon;
grant execute on function public.start_training_run(uuid, numeric, text), public.mark_training_practice(uuid), public.finish_training_run(uuid, jsonb) to authenticated;

commit;
