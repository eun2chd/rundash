begin;
alter table public.runner_locations add column activity text not null default 'rest';
alter table public.runner_locations add column share_activity boolean not null default true;
alter table public.runner_locations add constraint runner_activity_valid check(activity in ('rest','loafing','coffee','nap','daydream','music','meditate','coding','design','work','meeting','planning','writing','debugging','editing','study','reading','lecture','language','exam','homework','research','gaming','watching','drawing','instrument','craft','journal','photo','meal','cooking','cleaning','commute','chat','pet','waiting','offwork'));
drop function public.running_social_tick(uuid,double precision,double precision,boolean,boolean,boolean);
create or replace function public.running_social_tick(p_run_id uuid,p_distance double precision,p_speed double precision,p_paused boolean,p_public boolean,p_invites boolean,p_activity text default 'rest',p_share_activity boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.training_sessions; v_group uuid; v_peers jsonb; v_invites jsonb; v_party jsonb; v_now timestamptz:=clock_timestamp(); begin
 perform public.require_active_account();
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
  select jsonb_build_object('id',g.id,'leader_id',g.leader_id,'memberCount',(select count(*) from public.running_pair_members where pair_id=g.id),
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
  select i.id,i.sender_id,i.recipient_id,i.status,i.expires_at,p.nickname,i.recipient_id=auth.uid() incoming
  from public.running_invites i join public.profiles p on p.id=case when i.sender_id=auth.uid() then i.recipient_id else i.sender_id end
  where (i.sender_id=auth.uid() or i.recipient_id=auth.uid()) and i.status='pending' and not public.runners_blocked(i.sender_id,i.recipient_id)
  order by i.created_at desc limit 20
 ) t;
 return jsonb_build_object('peers',v_peers,'invites',v_invites,'pair',v_party,'serverTime',v_now);
end; $$;
create or replace function public.locate_running_friend(p_target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row jsonb; begin
 perform public.require_active_account();
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or public.runners_blocked(auth.uid(),p_target) then return null; end if;
 select to_jsonb(t) into v_row from (
 select p.id,p.nickname,p.color,p.skin,p.hair,p.outfit,l.distance_m,l.speed,l.paused,l.updated_at,case when l.share_activity then l.activity else null end activity,
 public.active_running_pair(auth.uid(),p_target) paired, case when public.active_running_pair(auth.uid(),p_target) then (select slot from public.running_pair_members where user_id=p_target) else null end slot
 from public.runner_locations l join public.profiles p on p.id=l.user_id
 join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
 where l.user_id=p_target and l.updated_at>clock_timestamp()-interval '30 seconds'
 and not exists(select 1 from public.account_controls c where c.user_id=p_target and c.suspended)
 and (l.public_location or public.active_running_pair(auth.uid(),p_target))
 ) t; return v_row;
end; $$;
revoke all on function public.running_social_tick(uuid,double precision,double precision,boolean,boolean,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.running_social_tick(uuid,double precision,double precision,boolean,boolean,boolean,text,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
