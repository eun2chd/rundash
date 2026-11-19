begin;
-- Level stamina grows evenly from 100 at Lv.1 to 9,900 at Lv.100: round(100 + (level - 1) * 9800 / 99).
-- The admin limit for a level's stamina rises from 1,000 to 100,000 so these values can be saved and
-- tuned. Pace, recovery, boost and XP rows stay as they are. Runs already in progress keep the
-- settings snapshot taken when they started.

create or replace function public.admin_save_settings(p_value jsonb,p_version integer) returns integer language plpgsql security definer set search_path='' as $$ declare v_version integer; v_old jsonb; v_row jsonb; v_index integer:=0; v_prev_xp numeric; begin
perform public.require_admin();
if jsonb_typeof(p_value) is distinct from 'object' then raise exception '설정 형식을 확인해 주세요.'; end if;
if jsonb_typeof(p_value->'xpPerKmMin') is distinct from 'number' or not ((p_value->>'xpPerKmMin')::numeric between 0 and 10000) or (p_value->>'xpPerKmMin')::numeric <> trunc((p_value->>'xpPerKmMin')::numeric) then raise exception 'Invalid setting: xpPerKmMin'; end if;
if jsonb_typeof(p_value->'xpPerKmMax') is distinct from 'number' or not ((p_value->>'xpPerKmMax')::numeric between 0 and 10000) or (p_value->>'xpPerKmMax')::numeric <> trunc((p_value->>'xpPerKmMax')::numeric) then raise exception 'Invalid setting: xpPerKmMax'; end if;
if (p_value->>'xpPerKmMin')::numeric > (p_value->>'xpPerKmMax')::numeric then raise exception '1km당 최소 경험치는 최대 경험치 이하여야 해요.'; end if;
if jsonb_typeof(p_value->'scorePointsPerXp') is distinct from 'number' or not ((p_value->>'scorePointsPerXp')::numeric between 1 and 100000) or (p_value->>'scorePointsPerXp')::numeric <> trunc((p_value->>'scorePointsPerXp')::numeric) then raise exception 'Invalid setting: scorePointsPerXp'; end if;
if jsonb_typeof(p_value->'autoLevel') is distinct from 'number' or not ((p_value->>'autoLevel')::numeric between 1 and 100) or (p_value->>'autoLevel')::numeric <> trunc((p_value->>'autoLevel')::numeric) then raise exception 'Invalid setting: autoLevel'; end if;
if jsonb_typeof(p_value->'attendanceMinKm') is distinct from 'number' or not ((p_value->>'attendanceMinKm')::numeric between 0.1 and 100) then raise exception 'Invalid setting: attendanceMinKm'; end if;
if jsonb_typeof(p_value->'attendanceDailyXp') is distinct from 'number' or not ((p_value->>'attendanceDailyXp')::numeric between 0 and 100000) or (p_value->>'attendanceDailyXp')::numeric <> trunc((p_value->>'attendanceDailyXp')::numeric) then raise exception 'Invalid setting: attendanceDailyXp'; end if;
if jsonb_typeof(p_value->'attendanceStreakEvery') is distinct from 'number' or not ((p_value->>'attendanceStreakEvery')::numeric between 2 and 365) or (p_value->>'attendanceStreakEvery')::numeric <> trunc((p_value->>'attendanceStreakEvery')::numeric) then raise exception 'Invalid setting: attendanceStreakEvery'; end if;
if jsonb_typeof(p_value->'attendanceStreakBonusXp') is distinct from 'number' or not ((p_value->>'attendanceStreakBonusXp')::numeric between 0 and 1000000) or (p_value->>'attendanceStreakBonusXp')::numeric <> trunc((p_value->>'attendanceStreakBonusXp')::numeric) then raise exception 'Invalid setting: attendanceStreakBonusXp'; end if;
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
 or not ((v_row->>'pace')::numeric between 180 and 1800) or not ((v_row->>'stamina')::numeric between 10 and 100000) or not ((v_row->>'recovery')::numeric between 5 and 300) or not ((v_row->>'boost')::numeric between 0 and 60)
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

update public.game_settings g
set value = g.value || jsonb_build_object('levels', (
    select jsonb_agg(e.value || jsonb_build_object('stamina', round(100 + ((e.value->>'level')::numeric - 1) * 9800 / 99)::integer) order by e.ordinality)
    from jsonb_array_elements(g.value->'levels') with ordinality e)),
  version = version + 1, updated_at = now()
where id;

insert into public.admin_audit(actor_id, action, target, details)
values (null, 'settings', 'game_settings', jsonb_build_object('stamina', 'Lv.1 100 → Lv.100 9900 균등 배분', 'staminaMax', 100000, 'reason', '레벨별 체력 상향'));
commit;
