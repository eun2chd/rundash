begin;
alter table public.running_pairs add column paused boolean not null default false;
alter table public.running_invites add column offered_run_id uuid references public.training_sessions(id);
alter table public.running_invites add column offered_pace integer;
alter table public.running_invites add column offered_distance numeric;
alter table public.running_invites add column offered_intensity text;

alter function public.invite_running_friend(uuid) rename to invite_running_friend_base;
revoke all on function public.invite_running_friend_base(uuid) from public,anon,authenticated;
create function public.invite_running_friend(p_target uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
 v_id:=public.invite_running_friend_base(p_target);
 update public.running_invites i set offered_run_id=s.id,offered_pace=s.pace_sec,offered_distance=s.target_km,offered_intensity=s.intensity
 from public.training_sessions s join public.runner_progress p on p.active_run_id=s.id where i.id=v_id and s.user_id=auth.uid() and p.user_id=auth.uid();
 return v_id;
end; $$;
revoke all on function public.invite_running_friend(uuid) from public,anon,authenticated;
grant execute on function public.invite_running_friend(uuid) to authenticated;

alter function public.respond_running_invite(uuid,text) rename to respond_running_invite_base;
revoke all on function public.respond_running_invite_base(uuid,text) from public,anon,authenticated;
create function public.respond_running_invite(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_action='accept' then raise exception '새로고침한 뒤 초대 조건을 확인하고 수락해 주세요.'; end if;
 perform public.respond_running_invite_base(p_id,p_action);
end; $$;
revoke all on function public.respond_running_invite(uuid,text) from public,anon,authenticated;
grant execute on function public.respond_running_invite(uuid,text) to authenticated;

-- Serialize finish cleanup with social membership operations to avoid lock inversion.
alter function public.finish_training_run(uuid,jsonb) rename to finish_training_run_base;
revoke all on function public.finish_training_run_base(uuid,jsonb) from public,anon,authenticated;
create function public.finish_training_run(p_run_id uuid,p_details jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pg_advisory_xact_lock(7138041); return public.finish_training_run_base(p_run_id,p_details); end; $$;
revoke all on function public.finish_training_run(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_training_run(uuid,jsonb) to authenticated;
-- Retry-safe, atomic handover: save the recipient's current run and start a fresh
-- run matching the visible offer. Joining never awards the inviter's distance.
create function public.accept_running_invite(p_id uuid,p_details jsonb,p_new_run_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_i public.running_invites; v_host public.training_sessions; v_old uuid; v_ticket jsonb; v_saved jsonb; v_new public.training_sessions; v_location public.runner_locations; v_paused boolean; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 select * into v_i from public.running_invites where id=p_id for update;
 if not found or v_i.recipient_id<>auth.uid() then raise exception '초대를 찾을 수 없어요.'; end if;
 if v_i.status='accepted' then
  select s.* into v_new from public.training_sessions s join public.runner_progress p on p.active_run_id=s.id where s.id=p_new_run_id and s.user_id=auth.uid();
  if found then return jsonb_build_object('ticket',jsonb_build_object('id',v_new.id,'xp',v_new.xp_at_start,'intensity',v_new.intensity,'distanceKm',v_new.target_km,'paceSec',v_new.pace_sec,'settings',v_new.rules)); end if;
  raise exception '이미 처리된 초대예요.';
 end if;
 if v_i.status<>'pending' or v_i.expires_at<=clock_timestamp() then raise exception '초대가 만료됐어요. 새 초대를 받아 주세요.'; end if;
 select s.* into v_host from public.training_sessions s join public.runner_progress p on p.active_run_id=s.id
 where s.id=v_i.offered_run_id and s.user_id=v_i.sender_id and s.finished_at is null;
 if not found or v_host.pace_sec is distinct from v_i.offered_pace or v_host.target_km is distinct from v_i.offered_distance then raise exception '초대 조건이 바뀌었어요. 새 초대를 받아 주세요.'; end if;
 if p_new_run_id is null or exists(select 1 from public.training_sessions where id=p_new_run_id) then raise exception '새 러닝을 준비하지 못했어요. 다시 시도해 주세요.'; end if;
 select active_run_id into v_old from public.runner_progress where user_id=auth.uid() for update;
 if v_old is null or p_details is null or p_details->>'id' is distinct from v_old::text then raise exception '현재 러닝을 확인한 뒤 다시 시도해 주세요.'; end if;
 select * into v_location from public.runner_locations where user_id=auth.uid();
 v_saved:=public.finish_training_run(v_old,p_details || jsonb_build_object('completed',false));
 v_ticket:=public.start_training_run(p_new_run_id,v_host.target_km,v_host.intensity);
 update public.training_sessions set pace_sec=v_host.pace_sec,rules=v_host.rules where id=p_new_run_id and user_id=auth.uid();
 v_ticket:=v_ticket || jsonb_build_object('paceSec',v_host.pace_sec,'settings',v_host.rules);
 -- Finishing the old run cancelled its pending invitations. Restore only this
 -- locked, previously valid invitation before the normal membership checks.
 update public.running_invites set status='pending' where id=p_id;
 insert into public.runner_locations(user_id,run_id,distance_m,speed,paused,public_location,allow_invites,updated_at,activity,share_activity)
 values(auth.uid(),p_new_run_id,0,0,true,coalesce(v_location.public_location,false),coalesce(v_location.allow_invites,true),clock_timestamp(),coalesce(v_location.activity,'rest'),coalesce(v_location.share_activity,true));
 perform public.respond_running_invite_base(p_id,'accept');
 select g.paused into v_paused from public.running_pairs g join public.running_pair_members m on m.pair_id=g.id where m.user_id=auth.uid();
 v_ticket:=v_ticket || jsonb_build_object('groupPaused',coalesce(v_paused,false));
 return jsonb_build_object('ticket',v_ticket,'previousRun',v_saved);
end; $$;
revoke all on function public.accept_running_invite(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.accept_running_invite(uuid,jsonb,uuid) to authenticated;

alter function public.end_running_pair() rename to end_running_pair_base;
revoke all on function public.end_running_pair_base() from public,anon,authenticated;
create function public.end_running_pair(p_run_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_active_account();
 if p_run_id is not null and not exists(select 1 from public.running_pair_members where user_id=auth.uid() and run_id=p_run_id) then return; end if;
 perform public.end_running_pair_base();
end; $$;
revoke all on function public.end_running_pair(uuid) from public,anon,authenticated;
grant execute on function public.end_running_pair(uuid) to authenticated;

create function public.pause_running_group(p_paused boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare v_group uuid; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 if p_paused is null then raise exception '일시정지 상태를 확인해 주세요.'; end if;
 select g.id into v_group from public.running_pairs g join public.running_pair_members m on m.pair_id=g.id
 join public.runner_progress r on r.user_id=m.user_id and r.active_run_id=m.run_id
 where m.user_id=auth.uid() and g.leader_id=auth.uid() and g.ended_at is null;
 if not found then raise exception '방장만 일시정지하거나 다시 시작할 수 있어요.'; end if;
 update public.running_pairs set paused=p_paused where id=v_group;
 return p_paused;
end; $$;
revoke all on function public.pause_running_group(boolean) from public,anon,authenticated;
grant execute on function public.pause_running_group(boolean) to authenticated;

create or replace function public.running_social_tick(p_run_id uuid,p_distance double precision,p_speed double precision,p_paused boolean,p_public boolean,p_invites boolean,p_activity text default 'rest',p_share_activity boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.training_sessions; v_group uuid; v_peers jsonb; v_invites jsonb; v_party jsonb; v_now timestamptz:=clock_timestamp(); begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception '정식 계정으로 이용해 주세요.'; end if;
 select s.* into v_session from public.training_sessions s join public.runner_progress p on p.active_run_id=s.id
 where s.id=p_run_id and s.user_id=auth.uid() and s.finished_at is null;
 if not found then raise exception '활성 러닝을 찾을 수 없어요.'; end if;
 if p_distance is null or not(p_distance between 0 and v_session.target_km*1000) or p_speed is null or not(p_speed between 0 and 15)
 or p_paused is null or p_public is null or p_invites is null then raise exception '러너 위치 형식이 올바르지 않아요.'; end if;
 if p_activity is null or p_share_activity is null then raise exception '활동 공개 설정을 확인해 주세요.'; end if;
 insert into public.runner_locations(user_id,run_id,distance_m,speed,paused,public_location,allow_invites,updated_at,activity,share_activity)
 values(auth.uid(),p_run_id,p_distance,p_speed,p_paused,p_public,p_invites,v_now,p_activity,p_share_activity)
 on conflict(user_id) do update set run_id=excluded.run_id,distance_m=excluded.distance_m,speed=excluded.speed,paused=excluded.paused,public_location=excluded.public_location,allow_invites=excluded.allow_invites,updated_at=v_now,activity=excluded.activity,share_activity=excluded.share_activity;
 perform pg_advisory_xact_lock(7138041);
 select pair_id into v_group from public.running_pair_members where user_id=auth.uid();
 perform public.prune_running_group(v_group);
 select pair_id into v_group from public.running_pair_members where user_id=auth.uid();
 if v_group is not null then
  select jsonb_build_object('id',g.id,'leader_id',g.leader_id,'paused',g.paused,'memberCount',(select count(*) from public.running_pair_members where pair_id=g.id),
   'mySlot',(select slot from public.running_pair_members where user_id=auth.uid()),
   'members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'nickname',p.nickname,'slot',m.slot) order by m.slot) from public.running_pair_members m join public.profiles p on p.id=m.user_id where m.pair_id=g.id))
  into v_party from public.running_pairs g where g.id=v_group and g.ended_at is null;
 end if;
 update public.running_invites set status='expired' where status='pending' and expires_at<=v_now and (sender_id=auth.uid() or recipient_id=auth.uid());
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_peers from (
  select l.user_id id,p.nickname,p.color,p.skin,p.hair,p.outfit,l.distance_m,l.speed,l.paused,l.updated_at,case when l.share_activity then l.activity else null end activity,
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
  select i.id,i.sender_id,i.recipient_id,i.status,i.expires_at,i.offered_pace,i.offered_distance,p.nickname,i.recipient_id=auth.uid() incoming
  from public.running_invites i join public.profiles p on p.id=case when i.sender_id=auth.uid() then i.recipient_id else i.sender_id end
  where (i.sender_id=auth.uid() or i.recipient_id=auth.uid()) and i.status='pending' and not public.runners_blocked(i.sender_id,i.recipient_id)
  order by i.created_at desc limit 20
 ) t;
 return jsonb_build_object('peers',v_peers,'invites',v_invites,'pair',v_party,'serverTime',v_now);
end; $$;
notify pgrst, 'reload schema';
commit;
