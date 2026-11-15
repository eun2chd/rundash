begin;
-- Custom pace: members pick a preset pace their level has reached, and from Lv.20 any
-- pace in 5 second steps. Never faster than the level's fastest pace, never slower than 15'00".
alter table public.training_sessions drop constraint if exists training_sessions_intensity_check;
alter table public.training_sessions add constraint training_sessions_intensity_check check (intensity in ('easy', 'steady', 'challenge', 'custom'));

create function public.custom_pace_rules() returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('presets', jsonb_build_array(720, 660, 600, 540, 510, 480, 450, 420, 390, 360, 330, 300),
    'freeLevel', 20, 'slowest', 900, 'step', 5);
$$;

-- Server copy of src/lib/pacePlans.js validCustomPace().
create function public.valid_custom_pace(p_pace integer, p_level integer, p_rules jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p_pace is not null
    and p_pace >= public.rules_pace(p_level, 'challenge', p_rules)
    and p_pace <= (public.custom_pace_rules()->>'slowest')::integer
    and p_pace % (public.custom_pace_rules()->>'step')::integer = 0
    and (p_level >= (public.custom_pace_rules()->>'freeLevel')::integer or public.custom_pace_rules()->'presets' @> to_jsonb(p_pace));
$$;

-- The 3 argument version is replaced; existing callers (the app and accept_running_invite)
-- resolve to this one through the default.
drop function public.start_training_run(uuid, numeric, text);
create function public.start_training_run(p_run_id uuid, p_target_km numeric, p_intensity text, p_pace_sec integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_progress public.runner_progress;
  v_session public.training_sessions;
  v_level integer;
  v_pace integer;
  v_rules jsonb := public.current_game_settings();
begin
  perform public.require_active_account();
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception '성장을 저장하려면 정식 계정으로 로그인해 주세요.';
  end if;
  if p_run_id is null or p_target_km is null or not (p_target_km between 0.5 and (v_rules->>'maxDistanceKm')::numeric)
    or p_intensity is null or p_intensity not in ('easy', 'steady', 'challenge', 'custom') then
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
    return jsonb_build_object('id', v_session.id, 'xp', v_session.xp_at_start, 'intensity', v_session.intensity,
      'distanceKm', v_session.target_km, 'paceSec', v_session.pace_sec, 'settings', v_session.rules);
  end if;
  v_level := public.training_level(v_progress.xp);
  if p_intensity = 'custom' then
    -- A companion join passes no pace; accept_running_invite overwrites it with the host's.
    v_pace := coalesce(p_pace_sec, public.rules_pace(v_level, 'challenge', v_rules));
    if p_pace_sec is not null and not public.valid_custom_pace(p_pace_sec, v_level, v_rules) then
      raise exception '아직 고를 수 없는 페이스예요. 레벨을 확인해 주세요.';
    end if;
  else
    v_pace := public.rules_pace(v_level, p_intensity, v_rules);
  end if;
  insert into public.training_sessions(id, user_id, xp_at_start, intensity, target_km, pace_sec, rules)
    values(p_run_id, v_uid, v_progress.xp, p_intensity, p_target_km, v_pace, v_rules);
  update public.runner_progress set active_run_id = p_run_id, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('id', p_run_id, 'xp', v_progress.xp, 'intensity', p_intensity, 'distanceKm', p_target_km, 'paceSec', v_pace, 'settings', v_rules);
end;
$$;
revoke all on function public.custom_pace_rules(), public.valid_custom_pace(integer, integer, jsonb), public.start_training_run(uuid, numeric, text, integer) from public, anon, authenticated;
grant execute on function public.start_training_run(uuid, numeric, text, integer) to authenticated;
commit;
