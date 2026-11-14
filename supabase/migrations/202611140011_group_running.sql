begin;
-- Extend existing accepted companion sessions to four members without discarding them.
alter table public.running_pair_members add column run_id uuid references public.training_sessions(id);
alter table public.running_pair_members add column slot smallint;
update public.running_pair_members m set run_id=case when m.user_id=p.leader_id then p.leader_run_id else p.partner_run_id end,
 slot=case when m.user_id=p.leader_id then 0 else 1 end from public.running_pairs p where m.pair_id=p.id;
alter table public.running_pair_members alter column run_id set not null;
alter table public.running_pair_members alter column slot set not null;
alter table public.running_pair_members add constraint running_group_slot check(slot between 0 and 3);
alter table public.running_pair_members add constraint running_group_unique_slot unique(pair_id,slot) deferrable initially deferred;
alter table public.running_invites add column group_id uuid references public.running_pairs(id);

create function public.normalize_running_group(p_group uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_leader uuid; v_partner uuid; v_leader_run uuid; v_partner_run uuid; begin
 if p_group is null then return; end if;
 if (select count(*) from public.running_pair_members where pair_id=p_group)<2 then
  update public.running_pairs set ended_at=clock_timestamp() where id=p_group;
  delete from public.running_pair_members where pair_id=p_group;
  return;
 end if;
 with numbered as (select user_id,(row_number() over(order by slot)-1)::smallint new_slot from public.running_pair_members where pair_id=p_group) update public.running_pair_members m set slot=n.new_slot from numbered n where m.user_id=n.user_id and m.slot is distinct from n.new_slot;
 select m.user_id,m.run_id into v_leader,v_leader_run from public.running_pair_members m join public.running_pairs p on p.id=m.pair_id
 where m.pair_id=p_group order by (m.user_id=p.leader_id) desc,m.slot limit 1;
 select user_id,run_id into v_partner,v_partner_run from public.running_pair_members where pair_id=p_group and user_id<>v_leader order by slot limit 1;
 update public.running_pairs set leader_id=v_leader,leader_run_id=v_leader_run,partner_id=v_partner,partner_run_id=v_partner_run where id=p_group;
end; $$;
revoke all on function public.normalize_running_group(uuid) from public,anon,authenticated;

create function public.prune_running_group(p_group uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_group is null then return; end if;
 delete from public.running_pair_members m where m.pair_id=p_group and not exists(
  select 1 from public.runner_progress r join public.runner_locations l on l.user_id=r.user_id and l.run_id=r.active_run_id
  where r.user_id=m.user_id and r.active_run_id=m.run_id and l.updated_at>clock_timestamp()-interval '60 seconds'
  and not exists(select 1 from public.account_controls c where c.user_id=m.user_id and c.suspended));
 perform public.normalize_running_group(p_group);
end; $$;
revoke all on function public.prune_running_group(uuid) from public,anon,authenticated;

create or replace function public.active_running_pair(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.running_pair_members ma join public.running_pair_members mb on mb.pair_id=ma.pair_id
 join public.running_pairs g on g.id=ma.pair_id and g.ended_at is null
 join public.runner_progress ra on ra.user_id=ma.user_id and ra.active_run_id=ma.run_id
 join public.runner_progress rb on rb.user_id=mb.user_id and rb.active_run_id=mb.run_id
 join public.runner_locations la on la.user_id=ma.user_id and la.run_id=ma.run_id
 join public.runner_locations lb on lb.user_id=mb.user_id and lb.run_id=mb.run_id
 where ma.user_id=a and mb.user_id=b and la.updated_at>clock_timestamp()-interval '60 seconds' and lb.updated_at>clock_timestamp()-interval '60 seconds'
 and not public.runners_blocked(a,b));
$$;

create or replace function public.end_running_pair() returns void language plpgsql security definer set search_path='' as $$
declare v_group uuid; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 select pair_id into v_group from public.running_pair_members where user_id=auth.uid();
 delete from public.running_pair_members where user_id=auth.uid();
 perform public.normalize_running_group(v_group);
 update public.running_invites set status='cancelled' where sender_id=auth.uid() and status='pending';
end; $$;

create or replace function public.running_social_tick(p_run_id uuid,p_distance double precision,p_speed double precision,p_paused boolean,p_public boolean,p_invites boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.training_sessions; v_group uuid; v_peers jsonb; v_invites jsonb; v_party jsonb; v_now timestamptz:=clock_timestamp(); begin
 perform public.require_active_account();
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception '정식 계정으로 이용해 주세요.'; end if;
 select s.* into v_session from public.training_sessions s join public.runner_progress p on p.active_run_id=s.id
 where s.id=p_run_id and s.user_id=auth.uid() and s.finished_at is null;
 if not found then raise exception '활성 러닝을 찾을 수 없어요.'; end if;
 if p_distance is null or not(p_distance between 0 and v_session.target_km*1000) or p_speed is null or not(p_speed between 0 and 15)
 or p_paused is null or p_public is null or p_invites is null then raise exception '러너 위치 형식이 올바르지 않아요.'; end if;
 insert into public.runner_locations(user_id,run_id,distance_m,speed,paused,public_location,allow_invites,updated_at)
 values(auth.uid(),p_run_id,p_distance,p_speed,p_paused,p_public,p_invites,v_now)
 on conflict(user_id) do update set run_id=excluded.run_id,distance_m=excluded.distance_m,speed=excluded.speed,paused=excluded.paused,public_location=excluded.public_location,allow_invites=excluded.allow_invites,updated_at=v_now;
 perform pg_advisory_xact_lock(7138041);
 select pair_id into v_group from public.running_pair_members where user_id=auth.uid();
 perform public.prune_running_group(v_group);
 select pair_id into v_group from public.running_pair_members where user_id=auth.uid();
 if v_group is not null then
  select jsonb_build_object('id',g.id,'leader_id',g.leader_id,'memberCount',(select count(*) from public.running_pair_members where pair_id=g.id),
   'mySlot',(select slot from public.running_pair_members where user_id=auth.uid()),
   'members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'nickname',p.nickname,'slot',m.slot) order by m.slot) from public.running_pair_members m join public.profiles p on p.id=m.user_id where m.pair_id=g.id))
  into v_party from public.running_pairs g where g.id=v_group and g.ended_at is null;
 end if;
 update public.running_invites set status='expired' where status='pending' and expires_at<=v_now and (sender_id=auth.uid() or recipient_id=auth.uid());
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_peers from (
  select l.user_id id,p.nickname,p.color,p.skin,p.hair,p.outfit,l.distance_m,l.speed,l.paused,l.updated_at,
   public.active_running_pair(auth.uid(),l.user_id) paired,
   case when public.active_running_pair(auth.uid(),l.user_id) then (select slot from public.running_pair_members where user_id=l.user_id) else null end slot
  from public.runner_locations l join public.profiles p on p.id=l.user_id
  join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
  where l.user_id<>auth.uid() and l.updated_at>v_now-interval '30 seconds' and not public.runners_blocked(auth.uid(),l.user_id)
  and not exists(select 1 from public.account_controls c where c.user_id=l.user_id and c.suspended)
  and (l.public_location or public.active_running_pair(auth.uid(),l.user_id))
  order by paired desc,l.updated_at desc limit 30
 ) t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_invites from (
  select i.id,i.sender_id,i.recipient_id,i.status,i.expires_at,p.nickname,i.recipient_id=auth.uid() incoming
  from public.running_invites i join public.profiles p on p.id=case when i.sender_id=auth.uid() then i.recipient_id else i.sender_id end
  where (i.sender_id=auth.uid() or i.recipient_id=auth.uid()) and i.status='pending' and not public.runners_blocked(i.sender_id,i.recipient_id)
  order by i.created_at desc limit 20
 ) t;
 return jsonb_build_object('peers',v_peers,'invites',v_invites,'pair',v_party,'serverTime',v_now);
end; $$;

create or replace function public.invite_running_friend(p_target uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_group uuid; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 select pair_id into v_group from public.running_pair_members where user_id=auth.uid();
 perform public.prune_running_group(v_group);
 select pair_id into v_group from public.running_pair_members where user_id=auth.uid();
 if p_target=auth.uid() or public.runners_blocked(auth.uid(),p_target) then raise exception '초대할 수 없는 러너예요.'; end if;
 if exists(select 1 from public.running_pair_members where user_id=p_target) then raise exception '이미 동행 중이에요.'; end if;
 if (select count(*) from public.running_pair_members where pair_id=v_group)>=4 then raise exception '동행은 나를 포함해 최대 4명이에요.'; end if;
 if exists(select 1 from public.running_pair_members where pair_id=v_group and public.runners_blocked(user_id,p_target)) then raise exception '초대할 수 없는 러너예요.'; end if;
 if exists(select 1 from public.running_invites where sender_id=auth.uid() and created_at>clock_timestamp()-interval '5 seconds') then raise exception '잠시 후 다시 초대해 주세요.'; end if;
 if exists(select 1 from public.running_invites where status='pending' and expires_at>clock_timestamp() and sender_id=auth.uid() and recipient_id=p_target) then raise exception '이미 초대를 보냈어요.'; end if;
 if (select count(*) from public.runner_locations l join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
 where l.user_id in(auth.uid(),p_target) and l.updated_at>clock_timestamp()-interval '30 seconds' and (l.user_id=auth.uid() or l.allow_invites)
 and not exists(select 1 from public.account_controls c where c.user_id=l.user_id and c.suspended))<>2 then raise exception '두 러너가 러닝 화면에 접속해 있고 상대가 초대를 허용해야 해요.'; end if;
 insert into public.running_invites(sender_id,recipient_id,group_id) values(auth.uid(),p_target,v_group) returning id into v_id; return v_id;
end; $$;

create or replace function public.respond_running_invite(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare v_i public.running_invites; v_group uuid; v_leader uuid; v_slot smallint; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 select * into v_i from public.running_invites where id=p_id for update;
 if not found or not(auth.uid() in(v_i.sender_id,v_i.recipient_id)) then raise exception '초대를 찾을 수 없어요.'; end if;
 if v_i.status<>'pending' then raise exception '이미 처리된 초대예요.'; end if;
 if v_i.expires_at<=clock_timestamp() then update public.running_invites set status='expired' where id=p_id; return; end if;
 if p_action='cancel' and auth.uid()=v_i.sender_id then update public.running_invites set status='cancelled' where id=p_id; return; end if;
 if p_action='decline' and auth.uid()=v_i.recipient_id then update public.running_invites set status='declined' where id=p_id; return; end if;
 if p_action is distinct from 'accept' or auth.uid()<>v_i.recipient_id then raise exception '상대방만 초대를 수락할 수 있어요.'; end if;
 if public.runners_blocked(v_i.sender_id,v_i.recipient_id) then raise exception '초대할 수 없는 러너예요.'; end if;
 select pair_id into v_group from public.running_pair_members where user_id=v_i.sender_id;
 perform public.prune_running_group(v_group);
 select pair_id into v_group from public.running_pair_members where user_id=v_i.sender_id;
 if exists(select 1 from public.running_pair_members where user_id=v_i.recipient_id) then raise exception '이미 동행 중이에요.'; end if;
 if v_i.group_id is not null and v_i.group_id is distinct from v_group then raise exception '동행 구성이 바뀌었어요. 새 초대를 받아 주세요.'; end if;
 if v_group is not null then
  select leader_id into v_leader from public.running_pairs where id=v_group;
  if v_i.group_id is null and v_leader<>v_i.sender_id then raise exception '동행 구성이 바뀌었어요. 새 초대를 받아 주세요.'; end if;
  if (select count(*) from public.running_pair_members where pair_id=v_group)>=4 then raise exception '동행은 나를 포함해 최대 4명이에요.'; end if;
  if exists(select 1 from public.running_pair_members where pair_id=v_group and public.runners_blocked(user_id,v_i.recipient_id)) then raise exception '초대할 수 없는 러너예요.'; end if;
 end if;
 if (select count(*) from public.runner_locations l join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
 where l.user_id in(v_i.sender_id,v_i.recipient_id) and l.updated_at>clock_timestamp()-interval '30 seconds' and (l.user_id=v_i.sender_id or l.allow_invites)
 and not exists(select 1 from public.account_controls c where c.user_id=l.user_id and c.suspended))<>2 then raise exception '상대가 연결을 종료했거나 초대를 껐어요.'; end if;
 if v_group is null then
  insert into public.running_pairs(leader_id,partner_id,leader_run_id,partner_run_id) values(v_i.sender_id,v_i.recipient_id,
   (select run_id from public.runner_locations where user_id=v_i.sender_id),(select run_id from public.runner_locations where user_id=v_i.recipient_id)) returning id into v_group;
  insert into public.running_pair_members(user_id,pair_id,run_id,slot) values(v_i.sender_id,v_group,(select run_id from public.runner_locations where user_id=v_i.sender_id),0);
 end if;
 select n::smallint into v_slot from generate_series(0,3) n where not exists(select 1 from public.running_pair_members where pair_id=v_group and slot=n) order by n limit 1;
 if v_slot is null then raise exception '동행은 나를 포함해 최대 4명이에요.'; end if;
 insert into public.running_pair_members(user_id,pair_id,run_id,slot) values(v_i.recipient_id,v_group,(select run_id from public.runner_locations where user_id=v_i.recipient_id),v_slot);
 update public.running_invites set status='accepted' where id=p_id;
 update public.running_invites set status='cancelled' where id<>p_id and status='pending' and (recipient_id=v_i.recipient_id or sender_id=v_i.recipient_id);
end; $$;

create or replace function public.block_running_friend(p_target uuid,p_block boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_group uuid; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 if p_target is null or p_target=auth.uid() then raise exception '대상을 확인해 주세요.'; end if;
 if p_block then
  insert into public.runner_blocks values(auth.uid(),p_target) on conflict do nothing;
  update public.running_invites set status='cancelled' where status='pending' and ((sender_id=auth.uid() and recipient_id=p_target) or (recipient_id=auth.uid() and sender_id=p_target));
  select a.pair_id into v_group from public.running_pair_members a join public.running_pair_members b on b.pair_id=a.pair_id where a.user_id=auth.uid() and b.user_id=p_target;
  if v_group is not null then delete from public.running_pair_members where user_id=auth.uid(); perform public.normalize_running_group(v_group); end if;
 else delete from public.runner_blocks where owner_id=auth.uid() and target_id=p_target;
 end if;
end; $$;

create or replace function public.cleanup_finished_running() returns trigger language plpgsql security definer set search_path='' as $$
declare v_group uuid; begin
 if new.finished_at is not null then
  delete from public.running_checkpoints where run_id=new.id;
  delete from public.runner_locations where run_id=new.id;
  select pair_id into v_group from public.running_pair_members where run_id=new.id;
  delete from public.running_pair_members where run_id=new.id;
  perform public.normalize_running_group(v_group);
  update public.running_invites set status='cancelled' where status='pending' and (sender_id=new.user_id or recipient_id=new.user_id);
 end if;
 return new;
end; $$;

create or replace function public.locate_running_friend(p_target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row jsonb; begin
 perform public.require_active_account();
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or public.runners_blocked(auth.uid(),p_target) then return null; end if;
 select to_jsonb(t) into v_row from (
 select p.id,p.nickname,p.color,p.skin,p.hair,p.outfit,l.distance_m,l.speed,l.paused,l.updated_at,
 public.active_running_pair(auth.uid(),p_target) paired, case when public.active_running_pair(auth.uid(),p_target) then (select slot from public.running_pair_members where user_id=p_target) else null end slot
 from public.runner_locations l join public.profiles p on p.id=l.user_id
 join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
 where l.user_id=p_target and l.updated_at>clock_timestamp()-interval '30 seconds'
 and not exists(select 1 from public.account_controls c where c.user_id=p_target and c.suspended)
 and (l.public_location or public.active_running_pair(auth.uid(),p_target))
 ) t; return v_row;
end; $$;

-- Existing exposed functions retain their scoped grants; helpers stay private.
notify pgrst, 'reload schema';
commit;
