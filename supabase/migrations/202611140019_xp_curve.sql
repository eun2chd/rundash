begin;
-- Slower levelling: Lv.5 about 20km, Lv.10 about 83km, Lv.20 about 333km, Lv.50 about 2,080km
-- (at ~120 XP per completed km). Levels are derived from XP, so existing runners keep their XP
-- and see the level it is worth under the new curve. Runs already in progress keep the rules
-- they started with.
update public.game_settings
set value = value || jsonb_build_object('xpBase', 300, 'xpStep', 100), version = version + 1, updated_at = now()
where id;
insert into public.admin_audit(actor_id, action, target, details)
values (null, 'settings', 'game_settings', jsonb_build_object('xpBase', 300, 'xpStep', 100, 'reason', '레벨업 난이도 상향'));
commit;
