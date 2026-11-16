begin;
-- 100 levels. Each level row now stores the cumulative XP needed to reach it (Lv.100 = 3,400,000),
-- so the curve can be tuned per level instead of by a formula. Each km earns a random XP between
-- xpPerKmMin and xpPerKmMax, the run score adds 1 XP per scorePointsPerXp points (never more than
-- the distance XP), and Lv.autoLevel unlocks AUTO running on the client. Runs already in progress
-- keep the rules snapshot they started with, so rules_level still understands the old formula.

-- Level for an XP total: the per-level xp column when present, otherwise the legacy formula.
create or replace function public.rules_level(p_xp bigint, p_rules jsonb) returns integer language sql immutable set search_path='' as $$
  select case when (p_rules->'levels'->0) ? 'xp' then
    coalesce((select max((e->>'level')::integer) from jsonb_array_elements(p_rules->'levels') e where (e->>'xp')::bigint <= greatest(0, p_xp)), 1)
  else
    coalesce((select max(l) from generate_series(1, 50) l where (p_rules->>'xpBase')::bigint*(l-1)+(p_rules->>'xpStep')::bigint*(l-1)*(l-2) <= greatest(0, p_xp)), 1)
  end::integer;
$$;

create or replace function public.rules_pace(p_level integer, p_intensity text, p_rules jsonb) returns integer language sql immutable set search_path='' as $$
  select (p_rules->'levels'->(greatest(1, least(jsonb_array_length(p_rules->'levels'), p_level))-1)->>'pace')::integer
    + (select (e->>'extraPace')::integer from jsonb_array_elements(p_rules->'intensities') e where e->>'id'=p_intensity);
$$;

-- Distance XP: every started km rolls its own XP between min and max, scaled by how much of that
-- km was run. Old snapshots without min/max fall back to their fixed xpPerKm.
create or replace function public.run_distance_xp(p_distance numeric, p_rules jsonb) returns bigint language plpgsql volatile set search_path='' as $$
declare
  v_low numeric := coalesce((p_rules->>'xpPerKmMin')::numeric, (p_rules->>'xpPerKm')::numeric, 0);
  v_high numeric := greatest(v_low, coalesce((p_rules->>'xpPerKmMax')::numeric, (p_rules->>'xpPerKm')::numeric, v_low));
begin
  if p_distance is null or p_distance <= 0 then return 0; end if;
  return coalesce((select sum(floor(least(1, p_distance - (k - 1)) * (v_low + floor(random() * (v_high - v_low + 1)))))
    from generate_series(1, ceil(p_distance)::integer) k), 0)::bigint;
end;
$$;

-- Score XP: 1 XP per scorePointsPerXp points, capped at the distance XP so score never outweighs running.
create or replace function public.run_score_xp(p_score jsonb, p_distance_xp bigint, p_rules jsonb) returns bigint language sql immutable set search_path='' as $$
  select case when jsonb_typeof(p_score) = 'number' and coalesce((p_rules->>'scorePointsPerXp')::numeric, 0) > 0
    then least(greatest(0, p_distance_xp), floor(least(1000000000, greatest(0, (p_score#>>'{}')::numeric)) / (p_rules->>'scorePointsPerXp')::numeric))::bigint
    else 0 end;
$$;

create or replace function public.finish_training_run_base(p_run_id uuid, p_details jsonb) returns jsonb
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
  v_score_xp bigint := 0;
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
    v_distance_xp := public.run_distance_xp(v_distance, v_rules);
    v_completion_xp := case when v_completed then floor(v_distance_xp * (v_rules->>'completionBonus')::numeric) else 0 end;
    v_score_xp := public.run_score_xp(p_details->'score', v_distance_xp, v_rules);
    v_reward := v_distance_xp + v_completion_xp + v_score_xp;
  end if;
  v_before := v_progress.xp;
  v_growth := jsonb_build_object('xpEarned', v_reward, 'distanceXp', v_distance_xp, 'completionXp', v_completion_xp, 'scoreXp', v_score_xp,
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
revoke all on function public.finish_training_run_base(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.run_distance_xp(numeric,jsonb), public.run_score_xp(jsonb,bigint,jsonb) from public, anon, authenticated;

create or replace function public.admin_save_settings(p_value jsonb,p_version integer) returns integer language plpgsql security definer set search_path='' as $$ declare v_version integer; v_old jsonb; v_row jsonb; v_index integer:=0; v_prev_xp numeric; begin
perform public.require_admin();
if jsonb_typeof(p_value) is distinct from 'object' then raise exception '설정 형식을 확인해 주세요.'; end if;
if jsonb_typeof(p_value->'xpPerKmMin') is distinct from 'number' or not ((p_value->>'xpPerKmMin')::numeric between 0 and 10000) or (p_value->>'xpPerKmMin')::numeric <> trunc((p_value->>'xpPerKmMin')::numeric) then raise exception 'Invalid setting: xpPerKmMin'; end if;
if jsonb_typeof(p_value->'xpPerKmMax') is distinct from 'number' or not ((p_value->>'xpPerKmMax')::numeric between 0 and 10000) or (p_value->>'xpPerKmMax')::numeric <> trunc((p_value->>'xpPerKmMax')::numeric) then raise exception 'Invalid setting: xpPerKmMax'; end if;
if (p_value->>'xpPerKmMin')::numeric > (p_value->>'xpPerKmMax')::numeric then raise exception '1km당 최소 경험치는 최대 경험치 이하여야 해요.'; end if;
if jsonb_typeof(p_value->'scorePointsPerXp') is distinct from 'number' or not ((p_value->>'scorePointsPerXp')::numeric between 1 and 100000) or (p_value->>'scorePointsPerXp')::numeric <> trunc((p_value->>'scorePointsPerXp')::numeric) then raise exception 'Invalid setting: scorePointsPerXp'; end if;
if jsonb_typeof(p_value->'autoLevel') is distinct from 'number' or not ((p_value->>'autoLevel')::numeric between 1 and 100) or (p_value->>'autoLevel')::numeric <> trunc((p_value->>'autoLevel')::numeric) then raise exception 'Invalid setting: autoLevel'; end if;
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
if jsonb_typeof(p_value->'levels') is distinct from 'array' or jsonb_array_length(p_value->'levels')<>100 then raise exception '100개 레벨을 설정해 주세요.'; end if;
v_prev_xp:=-1;
for v_row in select value from jsonb_array_elements(p_value->'levels') loop
 v_index:=v_index+1;
 if not (v_row ?& array['level','xp','pace','stamina','recovery','boost']) or jsonb_typeof(v_row->'level') is distinct from 'number' or (v_row->>'level')::numeric<>v_index
 or jsonb_typeof(v_row->'xp') is distinct from 'number' or (v_row->>'xp')::numeric<>trunc((v_row->>'xp')::numeric) or not ((v_row->>'xp')::numeric between 0 and 1000000000000)
 or (v_index=1 and (v_row->>'xp')::numeric<>0) or (v_index>1 and (v_row->>'xp')::numeric<=v_prev_xp)
 or jsonb_typeof(v_row->'pace') is distinct from 'number' or jsonb_typeof(v_row->'stamina') is distinct from 'number' or jsonb_typeof(v_row->'recovery') is distinct from 'number' or jsonb_typeof(v_row->'boost') is distinct from 'number'
 or not ((v_row->>'pace')::numeric between 180 and 1800) or not ((v_row->>'stamina')::numeric between 10 and 1000) or not ((v_row->>'recovery')::numeric between 5 and 300) or not ((v_row->>'boost')::numeric between 0 and 60)
 or (v_row->>'pace')::numeric<>trunc((v_row->>'pace')::numeric) or (v_row->>'stamina')::numeric<>trunc((v_row->>'stamina')::numeric) or (v_row->>'recovery')::numeric<>trunc((v_row->>'recovery')::numeric) or (v_row->>'boost')::numeric<>trunc((v_row->>'boost')::numeric) then raise exception '레벨 설정 범위를 확인해 주세요. 누적 경험치는 Lv.1이 0이고 레벨마다 커져야 해요.'; end if;
 v_prev_xp:=(v_row->>'xp')::numeric;
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


-- Keep any admin-tuned pace/stamina/recovery/boost for Lv.1-50, add the xp column, and fill Lv.51-100.
update public.game_settings g
set value = (g.value - 'xpBase' - 'xpStep' - 'xpPerKm')
  || jsonb_build_object('xpPerKmMin', 10, 'xpPerKmMax', 100, 'scorePointsPerXp', 10, 'autoLevel', 80,
    'levels', (select jsonb_agg(coalesce(g.value->'levels'->(d.ordinality::integer - 1), d.value) || jsonb_build_object('level', d.ordinality, 'xp', d.value->'xp') order by d.ordinality)
      from jsonb_array_elements('[{"level":1,"xp":0,"pace":540,"stamina":100,"recovery":60,"boost":0},{"level":2,"xp":100,"pace":525,"stamina":103,"recovery":59,"boost":0},{"level":3,"xp":230,"pace":510,"stamina":106,"recovery":58,"boost":0},{"level":4,"xp":390,"pace":495,"stamina":109,"recovery":57,"boost":0},{"level":5,"xp":620,"pace":480,"stamina":112,"recovery":56,"boost":8},{"level":6,"xp":940,"pace":468,"stamina":115,"recovery":55,"boost":8},{"level":7,"xp":1350,"pace":456,"stamina":118,"recovery":54,"boost":8},{"level":8,"xp":1900,"pace":444,"stamina":121,"recovery":53,"boost":8},{"level":9,"xp":2590,"pace":432,"stamina":124,"recovery":52,"boost":8},{"level":10,"xp":3450,"pace":420,"stamina":127,"recovery":51,"boost":8},{"level":11,"xp":4490,"pace":414,"stamina":130,"recovery":50,"boost":8},{"level":12,"xp":5750,"pace":408,"stamina":133,"recovery":49,"boost":8},{"level":13,"xp":7240,"pace":402,"stamina":136,"recovery":48,"boost":8},{"level":14,"xp":8980,"pace":396,"stamina":139,"recovery":47,"boost":8},{"level":15,"xp":10990,"pace":390,"stamina":142,"recovery":46,"boost":8},{"level":16,"xp":13290,"pace":384,"stamina":145,"recovery":45,"boost":8},{"level":17,"xp":15910,"pace":378,"stamina":148,"recovery":44,"boost":8},{"level":18,"xp":18870,"pace":372,"stamina":151,"recovery":43,"boost":8},{"level":19,"xp":22180,"pace":366,"stamina":154,"recovery":42,"boost":8},{"level":20,"xp":25860,"pace":360,"stamina":157,"recovery":41,"boost":12},{"level":21,"xp":29950,"pace":354,"stamina":160,"recovery":40,"boost":12},{"level":22,"xp":34460,"pace":348,"stamina":163,"recovery":39,"boost":12},{"level":23,"xp":39400,"pace":342,"stamina":166,"recovery":38,"boost":12},{"level":24,"xp":44810,"pace":336,"stamina":169,"recovery":37,"boost":12},{"level":25,"xp":50700,"pace":330,"stamina":172,"recovery":36,"boost":12},{"level":26,"xp":57090,"pace":324,"stamina":175,"recovery":35,"boost":12},{"level":27,"xp":64010,"pace":318,"stamina":178,"recovery":34,"boost":12},{"level":28,"xp":71470,"pace":312,"stamina":181,"recovery":33,"boost":12},{"level":29,"xp":79500,"pace":306,"stamina":184,"recovery":32,"boost":12},{"level":30,"xp":88110,"pace":300,"stamina":187,"recovery":31,"boost":15},{"level":31,"xp":97330,"pace":300,"stamina":190,"recovery":30,"boost":15},{"level":32,"xp":107190,"pace":300,"stamina":193,"recovery":30,"boost":15},{"level":33,"xp":117690,"pace":300,"stamina":196,"recovery":30,"boost":15},{"level":34,"xp":128860,"pace":300,"stamina":199,"recovery":30,"boost":15},{"level":35,"xp":140720,"pace":300,"stamina":202,"recovery":30,"boost":15},{"level":36,"xp":153300,"pace":300,"stamina":205,"recovery":30,"boost":15},{"level":37,"xp":166610,"pace":300,"stamina":208,"recovery":30,"boost":15},{"level":38,"xp":180680,"pace":300,"stamina":211,"recovery":30,"boost":15},{"level":39,"xp":195520,"pace":300,"stamina":214,"recovery":30,"boost":15},{"level":40,"xp":211150,"pace":300,"stamina":217,"recovery":30,"boost":15},{"level":41,"xp":227610,"pace":300,"stamina":220,"recovery":30,"boost":15},{"level":42,"xp":244900,"pace":300,"stamina":223,"recovery":30,"boost":15},{"level":43,"xp":263050,"pace":300,"stamina":226,"recovery":30,"boost":15},{"level":44,"xp":282090,"pace":300,"stamina":229,"recovery":30,"boost":15},{"level":45,"xp":302020,"pace":300,"stamina":232,"recovery":30,"boost":15},{"level":46,"xp":322880,"pace":300,"stamina":235,"recovery":30,"boost":15},{"level":47,"xp":344680,"pace":300,"stamina":238,"recovery":30,"boost":15},{"level":48,"xp":367440,"pace":300,"stamina":241,"recovery":30,"boost":15},{"level":49,"xp":391190,"pace":300,"stamina":244,"recovery":30,"boost":15},{"level":50,"xp":415950,"pace":300,"stamina":247,"recovery":30,"boost":15},{"level":51,"xp":441730,"pace":300,"stamina":250,"recovery":30,"boost":15},{"level":52,"xp":468570,"pace":300,"stamina":253,"recovery":30,"boost":15},{"level":53,"xp":496470,"pace":300,"stamina":256,"recovery":30,"boost":15},{"level":54,"xp":525460,"pace":300,"stamina":259,"recovery":30,"boost":15},{"level":55,"xp":555560,"pace":300,"stamina":262,"recovery":30,"boost":15},{"level":56,"xp":586790,"pace":300,"stamina":265,"recovery":30,"boost":15},{"level":57,"xp":619180,"pace":300,"stamina":268,"recovery":30,"boost":15},{"level":58,"xp":652740,"pace":300,"stamina":271,"recovery":30,"boost":15},{"level":59,"xp":687500,"pace":300,"stamina":274,"recovery":30,"boost":15},{"level":60,"xp":723470,"pace":300,"stamina":277,"recovery":30,"boost":18},{"level":61,"xp":760680,"pace":300,"stamina":280,"recovery":30,"boost":18},{"level":62,"xp":799140,"pace":300,"stamina":283,"recovery":30,"boost":18},{"level":63,"xp":838890,"pace":300,"stamina":286,"recovery":30,"boost":18},{"level":64,"xp":879930,"pace":300,"stamina":289,"recovery":30,"boost":18},{"level":65,"xp":922300,"pace":300,"stamina":292,"recovery":30,"boost":18},{"level":66,"xp":966000,"pace":300,"stamina":295,"recovery":30,"boost":18},{"level":67,"xp":1011070,"pace":300,"stamina":298,"recovery":30,"boost":18},{"level":68,"xp":1057530,"pace":300,"stamina":301,"recovery":30,"boost":18},{"level":69,"xp":1105380,"pace":300,"stamina":304,"recovery":30,"boost":18},{"level":70,"xp":1154670,"pace":300,"stamina":307,"recovery":30,"boost":18},{"level":71,"xp":1205400,"pace":300,"stamina":310,"recovery":30,"boost":18},{"level":72,"xp":1257600,"pace":300,"stamina":313,"recovery":30,"boost":18},{"level":73,"xp":1311280,"pace":300,"stamina":316,"recovery":30,"boost":18},{"level":74,"xp":1366480,"pace":300,"stamina":319,"recovery":30,"boost":18},{"level":75,"xp":1423200,"pace":300,"stamina":322,"recovery":30,"boost":18},{"level":76,"xp":1481480,"pace":300,"stamina":325,"recovery":30,"boost":18},{"level":77,"xp":1541330,"pace":300,"stamina":328,"recovery":30,"boost":18},{"level":78,"xp":1602770,"pace":300,"stamina":331,"recovery":30,"boost":18},{"level":79,"xp":1665820,"pace":300,"stamina":334,"recovery":30,"boost":18},{"level":80,"xp":1730510,"pace":300,"stamina":337,"recovery":30,"boost":20},{"level":81,"xp":1796860,"pace":300,"stamina":340,"recovery":30,"boost":20},{"level":82,"xp":1864890,"pace":300,"stamina":343,"recovery":30,"boost":20},{"level":83,"xp":1934610,"pace":300,"stamina":346,"recovery":30,"boost":20},{"level":84,"xp":2006050,"pace":300,"stamina":349,"recovery":30,"boost":20},{"level":85,"xp":2079230,"pace":300,"stamina":352,"recovery":30,"boost":20},{"level":86,"xp":2154170,"pace":300,"stamina":355,"recovery":30,"boost":20},{"level":87,"xp":2230900,"pace":300,"stamina":358,"recovery":30,"boost":20},{"level":88,"xp":2309420,"pace":300,"stamina":361,"recovery":30,"boost":20},{"level":89,"xp":2389780,"pace":300,"stamina":364,"recovery":30,"boost":20},{"level":90,"xp":2471970,"pace":300,"stamina":367,"recovery":30,"boost":20},{"level":91,"xp":2556030,"pace":300,"stamina":370,"recovery":30,"boost":20},{"level":92,"xp":2641980,"pace":300,"stamina":373,"recovery":30,"boost":20},{"level":93,"xp":2729840,"pace":300,"stamina":376,"recovery":30,"boost":20},{"level":94,"xp":2819620,"pace":300,"stamina":379,"recovery":30,"boost":20},{"level":95,"xp":2911350,"pace":300,"stamina":382,"recovery":30,"boost":20},{"level":96,"xp":3005060,"pace":300,"stamina":385,"recovery":30,"boost":20},{"level":97,"xp":3100750,"pace":300,"stamina":388,"recovery":30,"boost":20},{"level":98,"xp":3198460,"pace":300,"stamina":391,"recovery":30,"boost":20},{"level":99,"xp":3298200,"pace":300,"stamina":394,"recovery":30,"boost":20},{"level":100,"xp":3400000,"pace":300,"stamina":397,"recovery":30,"boost":20}]'::jsonb) with ordinality d)),
  version = version + 1, updated_at = now()
where id;
insert into public.admin_audit(actor_id, action, target, details)
values (null, 'settings', 'game_settings', jsonb_build_object('levels', 100, 'maxLevelXp', 3400000, 'xpPerKm', '10~100', 'scorePointsPerXp', 10, 'autoLevel', 80, 'reason', '100레벨 확장과 AUTO'));
commit;
