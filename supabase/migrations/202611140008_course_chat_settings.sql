begin;
update public.game_settings set value='{"xpBase":100,"xpStep":20,"xpPerKm":100,"completionBonus":0.2,"anonymousMaxKm":10,"maxDistanceKm":100,"anonymousPace":540,"anonymousStamina":100,"anonymousRecovery":60,"boostCooldown":90,"boostCost":12,"boostMultiplier":1.5,"staminaDrain":30,"staminaBasePace":360,"recoverRatio":0.4,"stationFirstM":600,"stationEveryM":1000,"stationGrabBeforeM":40,"stationGrabAfterM":8,"waterRestore":15,"gelRestore":25,"supplyPoints":5,"medalPoints":50,"rhythmPerfect":0.09,"rhythmGood":0.2,"perfectPoints":5,"goodPoints":2,"comboCap":10,"comboBonus":0.1,"cheerPoints":15,"cheerRadius":18,"medalFirstM":200,"medalIntervalMin":250,"medalIntervalJitter":250,"chatMaxLength":300,"chatInterval":2,"intensities":[{"id":"easy","label":"가볍게","description":"오래, 편안하게","extraPace":150,"drain":0.75},{"id":"steady","label":"꾸준히","description":"균형 잡힌 기본 훈련","extraPace":60,"drain":1},{"id":"challenge","label":"도전하기","description":"가장 빠르게, 보급은 필수","extraPace":0,"drain":1.35}],"levels":[{"level":1,"pace":540,"stamina":100,"recovery":60,"boost":0},{"level":2,"pace":525,"stamina":103,"recovery":59,"boost":0},{"level":3,"pace":510,"stamina":106,"recovery":58,"boost":0},{"level":4,"pace":495,"stamina":109,"recovery":57,"boost":0},{"level":5,"pace":480,"stamina":112,"recovery":56,"boost":8},{"level":6,"pace":468,"stamina":115,"recovery":55,"boost":8},{"level":7,"pace":456,"stamina":118,"recovery":54,"boost":8},{"level":8,"pace":444,"stamina":121,"recovery":53,"boost":8},{"level":9,"pace":432,"stamina":124,"recovery":52,"boost":8},{"level":10,"pace":420,"stamina":127,"recovery":51,"boost":8},{"level":11,"pace":414,"stamina":130,"recovery":50,"boost":8},{"level":12,"pace":408,"stamina":133,"recovery":49,"boost":8},{"level":13,"pace":402,"stamina":136,"recovery":48,"boost":8},{"level":14,"pace":396,"stamina":139,"recovery":47,"boost":8},{"level":15,"pace":390,"stamina":142,"recovery":46,"boost":8},{"level":16,"pace":384,"stamina":145,"recovery":45,"boost":8},{"level":17,"pace":378,"stamina":148,"recovery":44,"boost":8},{"level":18,"pace":372,"stamina":151,"recovery":43,"boost":8},{"level":19,"pace":366,"stamina":154,"recovery":42,"boost":8},{"level":20,"pace":360,"stamina":157,"recovery":41,"boost":12},{"level":21,"pace":354,"stamina":160,"recovery":40,"boost":12},{"level":22,"pace":348,"stamina":163,"recovery":39,"boost":12},{"level":23,"pace":342,"stamina":166,"recovery":38,"boost":12},{"level":24,"pace":336,"stamina":169,"recovery":37,"boost":12},{"level":25,"pace":330,"stamina":172,"recovery":36,"boost":12},{"level":26,"pace":324,"stamina":175,"recovery":35,"boost":12},{"level":27,"pace":318,"stamina":178,"recovery":34,"boost":12},{"level":28,"pace":312,"stamina":181,"recovery":33,"boost":12},{"level":29,"pace":306,"stamina":184,"recovery":32,"boost":12},{"level":30,"pace":300,"stamina":187,"recovery":31,"boost":15},{"level":31,"pace":300,"stamina":190,"recovery":30,"boost":15},{"level":32,"pace":300,"stamina":193,"recovery":30,"boost":15},{"level":33,"pace":300,"stamina":196,"recovery":30,"boost":15},{"level":34,"pace":300,"stamina":199,"recovery":30,"boost":15},{"level":35,"pace":300,"stamina":202,"recovery":30,"boost":15},{"level":36,"pace":300,"stamina":205,"recovery":30,"boost":15},{"level":37,"pace":300,"stamina":208,"recovery":30,"boost":15},{"level":38,"pace":300,"stamina":211,"recovery":30,"boost":15},{"level":39,"pace":300,"stamina":214,"recovery":30,"boost":15},{"level":40,"pace":300,"stamina":217,"recovery":30,"boost":15},{"level":41,"pace":300,"stamina":220,"recovery":30,"boost":15},{"level":42,"pace":300,"stamina":223,"recovery":30,"boost":15},{"level":43,"pace":300,"stamina":226,"recovery":30,"boost":15},{"level":44,"pace":300,"stamina":229,"recovery":30,"boost":15},{"level":45,"pace":300,"stamina":232,"recovery":30,"boost":15},{"level":46,"pace":300,"stamina":235,"recovery":30,"boost":15},{"level":47,"pace":300,"stamina":238,"recovery":30,"boost":15},{"level":48,"pace":300,"stamina":241,"recovery":30,"boost":15},{"level":49,"pace":300,"stamina":244,"recovery":30,"boost":15},{"level":50,"pace":300,"stamina":247,"recovery":30,"boost":15}]}'::jsonb || value where id;
create or replace function public.admin_save_settings(p_value jsonb,p_version integer) returns integer language plpgsql security definer set search_path='' as $$ declare v_version integer; v_old jsonb; v_row jsonb; v_index integer:=0; begin
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

create or replace function public.send_race_message(p_message text, p_nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, true);
  v_name text;
  v_text text := btrim(p_message);
  v_last timestamptz;
  v_now timestamptz := clock_timestamp();
  v_row public.race_messages;
  v_rules jsonb := public.current_game_settings();
begin
  if v_uid is null then raise exception '채팅하려면 로그인해 주세요.'; end if;
  if v_text is null or char_length(v_text) not between 1 and (v_rules->>'chatMaxLength')::integer then raise exception '메시지는 1~%자로 입력해 주세요.', v_rules->>'chatMaxLength'; end if;
  if v_anonymous then v_name := p_nickname;
  else select nickname into v_name from public.profiles where id = v_uid;
  end if;
  if v_name is null or v_name !~ '^[가-힣a-zA-Z0-9_]{2,10}$' or lower(v_name) in ('admin', '관리자', '운영자') then raise exception '러너의 닉네임을 먼저 정해 주세요.'; end if;
  if v_anonymous and exists (select 1 from public.profiles where lower(nickname) = lower(v_name) and id <> v_uid) then
    raise exception '이미 사용 중인 닉네임이에요. 러너 설정에서 다른 이름을 정해 주세요.';
  end if;
  insert into public.race_chat_limits(user_id) values(v_uid) on conflict(user_id) do nothing;
  select last_sent_at into v_last from public.race_chat_limits where user_id = v_uid for update;
  if v_now - v_last < make_interval(secs => (v_rules->>'chatInterval')::integer) then raise exception '메시지는 %초 간격으로 보낼 수 있어요.', v_rules->>'chatInterval'; end if;
  insert into public.race_messages(user_id, nickname, is_anonymous, message)
    values(v_uid, v_name, v_anonymous, v_text) returning * into v_row;
  update public.race_chat_limits set last_sent_at = v_now where user_id = v_uid;
  return to_jsonb(v_row);
end;
$$;

commit;
