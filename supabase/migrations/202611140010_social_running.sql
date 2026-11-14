begin;

-- All social state is accessed through scoped RPCs; location is private by default.
create table public.runner_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  run_id uuid not null references public.training_sessions(id) on delete cascade,
  distance_m double precision not null default 0,
  speed double precision not null default 0,
  paused boolean not null default true,
  public_location boolean not null default false,
  allow_invites boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.runner_blocks (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  primary key(owner_id,target_id), check(owner_id<>target_id)
);
create table public.running_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '60 seconds'),
  check(sender_id<>recipient_id)
);
create index running_invites_sender on public.running_invites(sender_id,created_at desc);
create index running_invites_recipient on public.running_invites(recipient_id,created_at desc);
create table public.running_pairs (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  leader_run_id uuid not null references public.training_sessions(id),
  partner_run_id uuid not null references public.training_sessions(id),
  created_at timestamptz not null default now(),
  ended_at timestamptz, check(leader_id<>partner_id)
);
create table public.running_pair_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  pair_id uuid not null references public.running_pairs(id) on delete cascade
);
create table public.running_checkpoints (
  run_id uuid primary key references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create index running_checkpoints_user on public.running_checkpoints(user_id);
alter table public.runner_locations enable row level security;
alter table public.runner_blocks enable row level security;
alter table public.running_invites enable row level security;
alter table public.running_pairs enable row level security;
alter table public.running_pair_members enable row level security;
alter table public.running_checkpoints enable row level security;
revoke all on public.runner_locations,public.runner_blocks,public.running_invites,public.running_pairs,public.running_pair_members,public.running_checkpoints from public,anon,authenticated;

create function public.runners_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.runner_blocks where (owner_id=a and target_id=b) or (owner_id=b and target_id=a));
$$;
create function public.end_running_pair() returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
 perform public.require_active_account();
 perform pg_advisory_xact_lock(7138041);
 select pair_id into v_id from public.running_pair_members where user_id=auth.uid();
 if v_id is not null then
   update public.running_pairs set ended_at=clock_timestamp() where id=v_id;
   delete from public.running_pair_members where pair_id=v_id;
 end if;
end; $$;

create function public.running_social_tick(p_run_id uuid,p_distance double precision,p_speed double precision,p_paused boolean,p_public boolean,p_invites boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.training_sessions; v_pair public.running_pairs; v_peers jsonb; v_invites jsonb; v_now timestamptz:=clock_timestamp(); begin
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
 -- Expire sessions whose member finished, started another run, or went offline.
 update public.running_pairs x set ended_at=v_now where x.ended_at is null and
 (x.leader_id=auth.uid() or x.partner_id=auth.uid()) and not exists (
  select 1 from public.runner_locations a join public.runner_locations b on b.user_id=x.partner_id
  join public.runner_progress pa on pa.user_id=a.user_id and pa.active_run_id=a.run_id
  join public.runner_progress pb on pb.user_id=b.user_id and pb.active_run_id=b.run_id
  where a.user_id=x.leader_id and a.run_id=x.leader_run_id and b.run_id=x.partner_run_id and a.updated_at>v_now-interval '60 seconds' and b.updated_at>v_now-interval '60 seconds'
  and not public.runners_blocked(a.user_id,b.user_id));
 delete from public.running_pair_members m using public.running_pairs x where m.pair_id=x.id and x.ended_at is not null;
 select x.* into v_pair from public.running_pairs x join public.running_pair_members m on m.pair_id=x.id where m.user_id=auth.uid() and x.ended_at is null;
 update public.running_invites set status='expired' where status='pending' and expires_at<=v_now and (sender_id=auth.uid() or recipient_id=auth.uid());
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_peers from (
  select l.user_id id,p.nickname,p.color,p.skin,p.hair,p.outfit,l.distance_m,l.speed,l.paused,l.updated_at,
    case when v_pair.id is not null and l.user_id in(v_pair.leader_id,v_pair.partner_id) then true else false end paired
  from public.runner_locations l join public.profiles p on p.id=l.user_id
  join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
  where l.user_id<>auth.uid() and l.updated_at>v_now-interval '30 seconds' and not public.runners_blocked(auth.uid(),l.user_id)
  and not exists(select 1 from public.account_controls c where c.user_id=l.user_id and c.suspended)
  and (l.public_location or (v_pair.id is not null and l.user_id in(v_pair.leader_id,v_pair.partner_id)))
  order by paired desc,l.updated_at desc limit 30
 ) t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_invites from (
  select i.id,i.sender_id,i.recipient_id,i.status,i.expires_at,p.nickname,
   i.recipient_id=auth.uid() incoming
  from public.running_invites i join public.profiles p on p.id=case when i.sender_id=auth.uid() then i.recipient_id else i.sender_id end
  where (i.sender_id=auth.uid() or i.recipient_id=auth.uid()) and i.status='pending'
   and not public.runners_blocked(i.sender_id,i.recipient_id)
  order by i.created_at desc limit 20
 ) t;
 return jsonb_build_object('peers',v_peers,'invites',v_invites,'pair',case when v_pair.id is null then null else to_jsonb(v_pair) end,'serverTime',v_now);
end; $$;

create function public.search_running_friends(p_query text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; begin
 perform public.require_active_account();
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception '정식 계정으로 이용해 주세요.'; end if;
 if length(btrim(p_query))<2 or length(p_query)>10 then raise exception '닉네임을 2~10자로 입력해 주세요.'; end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (
  select p.id,p.nickname,coalesce(l.updated_at>clock_timestamp()-interval '30 seconds' and r.active_run_id=l.run_id,false) online,
   coalesce(l.public_location,false) location_public,
   coalesce(l.allow_invites,false) allow_invites
  from public.profiles p left join public.runner_locations l on l.user_id=p.id
  left join public.runner_progress r on r.user_id=p.id
  where p.id<>auth.uid() and strpos(lower(p.nickname),lower(btrim(p_query)))>0
   and not public.runners_blocked(auth.uid(),p.id)
   and not exists(select 1 from public.account_controls c where c.user_id=p.id and c.suspended)
  order by lower(p.nickname)=lower(btrim(p_query)) desc,p.nickname limit 10
 ) t;
 return v_rows;
end; $$;

create function public.invite_running_friend(p_target uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 if p_target=auth.uid() or public.runners_blocked(auth.uid(),p_target) then raise exception '초대할 수 없는 러너예요.'; end if;
 if exists(select 1 from public.running_pair_members where user_id in(auth.uid(),p_target)) then raise exception '이미 동행 중이에요.'; end if;
 if exists(select 1 from public.running_invites where sender_id=auth.uid() and created_at>clock_timestamp()-interval '5 seconds') then raise exception '잠시 후 다시 초대해 주세요.'; end if;
 if exists(select 1 from public.running_invites where status='pending' and expires_at>clock_timestamp() and sender_id=auth.uid() and recipient_id=p_target) then raise exception '이미 초대를 보냈어요.'; end if;
 if (select count(*) from public.runner_locations l join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
   where l.user_id in(auth.uid(),p_target) and l.updated_at>clock_timestamp()-interval '30 seconds'
   and (l.user_id=auth.uid() or l.allow_invites)
   and not exists(select 1 from public.account_controls c where c.user_id=l.user_id and c.suspended))<>2 then raise exception '두 러너가 러닝 화면에 접속해 있고 상대가 초대를 허용해야 해요.'; end if;
 insert into public.running_invites(sender_id,recipient_id) values(auth.uid(),p_target) returning id into v_id; return v_id;
end; $$;

create function public.respond_running_invite(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare v_i public.running_invites; v_pair uuid; begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 select * into v_i from public.running_invites where id=p_id for update;
 if not found or not(auth.uid() in(v_i.sender_id,v_i.recipient_id)) then raise exception '초대를 찾을 수 없어요.'; end if;
 if v_i.status<>'pending' then raise exception '이미 처리된 초대예요.'; end if;
 if v_i.expires_at<=clock_timestamp() then update public.running_invites set status='expired' where id=p_id; return; end if;
 if p_action='cancel' and auth.uid()=v_i.sender_id then update public.running_invites set status='cancelled' where id=p_id; return; end if;
 if p_action='decline' and auth.uid()=v_i.recipient_id then update public.running_invites set status='declined' where id=p_id; return; end if;
 if p_action is distinct from 'accept' or auth.uid()<>v_i.recipient_id then raise exception '상대방만 초대를 수락할 수 있어요.'; end if;
 if public.runners_blocked(v_i.sender_id,v_i.recipient_id) then raise exception '초대할 수 없는 러너예요.'; end if;
 if exists(select 1 from public.running_pair_members where user_id in(v_i.sender_id,v_i.recipient_id)) then raise exception '이미 동행 중이에요.'; end if;
 if (select count(*) from public.runner_locations l join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
   where l.user_id in(v_i.sender_id,v_i.recipient_id) and l.updated_at>clock_timestamp()-interval '30 seconds'
   and (l.user_id=v_i.sender_id or l.allow_invites)
   and not exists(select 1 from public.account_controls c where c.user_id=l.user_id and c.suspended))<>2 then raise exception '상대가 연결을 종료했거나 초대를 껐어요.'; end if;
 insert into public.running_pairs(leader_id,partner_id,leader_run_id,partner_run_id) values(v_i.sender_id,v_i.recipient_id,(select run_id from public.runner_locations where user_id=v_i.sender_id),(select run_id from public.runner_locations where user_id=v_i.recipient_id)) returning id into v_pair;
 insert into public.running_pair_members(user_id,pair_id) values(v_i.sender_id,v_pair),(v_i.recipient_id,v_pair);
 update public.running_invites set status='accepted' where id=p_id;
 update public.running_invites set status='cancelled' where id<>p_id and status='pending' and
 (sender_id in(v_i.sender_id,v_i.recipient_id) or recipient_id in(v_i.sender_id,v_i.recipient_id));
end; $$;

create function public.block_running_friend(p_target uuid,p_block boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_active_account(); perform pg_advisory_xact_lock(7138041);
 if p_target is null or p_target=auth.uid() then raise exception '대상을 확인해 주세요.'; end if;
 if p_block then
  insert into public.runner_blocks values(auth.uid(),p_target) on conflict do nothing;
  update public.running_invites set status='cancelled' where status='pending' and
    ((sender_id=auth.uid() and recipient_id=p_target) or (recipient_id=auth.uid() and sender_id=p_target));
  update public.running_pairs set ended_at=clock_timestamp() where ended_at is null and
    ((leader_id=auth.uid() and partner_id=p_target) or (partner_id=auth.uid() and leader_id=p_target));
  delete from public.running_pair_members m using public.running_pairs p where m.pair_id=p.id and p.ended_at is not null;
 else delete from public.runner_blocks where owner_id=auth.uid() and target_id=p_target;
 end if;
end; $$;
create function public.list_running_blocks() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; begin perform public.require_active_account();
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname)),'[]') into v_rows
 from public.runner_blocks b join public.profiles p on p.id=b.target_id where b.owner_id=auth.uid(); return v_rows;
end; $$;

create function public.save_running_checkpoint(p_run_id uuid,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_active_account();
 if not exists(select 1 from public.training_sessions s join public.runner_progress r on r.active_run_id=s.id
   where s.id=p_run_id and s.user_id=auth.uid() and s.finished_at is null) then raise exception '활성 러닝을 찾을 수 없어요.'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>200000 then raise exception '체크포인트 형식을 확인해 주세요.'; end if;
 insert into public.running_checkpoints(run_id,user_id,payload) values(p_run_id,auth.uid(),p_payload)
 on conflict(run_id) do update set payload=excluded.payload,updated_at=clock_timestamp();
end; $$;
create function public.load_running_checkpoint() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row jsonb; begin
 perform public.require_active_account();
 select jsonb_build_object('payload',c.payload,'session',to_jsonb(s),'savedAt',c.updated_at) into v_row
 from public.training_sessions s join public.runner_progress p on p.active_run_id=s.id and p.user_id=auth.uid()
 left join public.running_checkpoints c on c.run_id=s.id and c.user_id=auth.uid()
 where s.user_id=auth.uid() and s.finished_at is null; return v_row;
end; $$;

revoke all on function public.runners_blocked(uuid,uuid),public.end_running_pair(),public.running_social_tick(uuid,double precision,double precision,boolean,boolean,boolean),public.search_running_friends(text),public.invite_running_friend(uuid),public.respond_running_invite(uuid,text),public.block_running_friend(uuid,boolean),public.list_running_blocks(),public.save_running_checkpoint(uuid,jsonb),public.load_running_checkpoint() from public,anon,authenticated;
grant execute on function public.end_running_pair(),public.running_social_tick(uuid,double precision,double precision,boolean,boolean,boolean),public.search_running_friends(text),public.invite_running_friend(uuid),public.respond_running_invite(uuid,text),public.block_running_friend(uuid,boolean),public.list_running_blocks(),public.save_running_checkpoint(uuid,jsonb),public.load_running_checkpoint() to authenticated;

-- Kept internal: location consent for an accepted pair expires with either run.
create function public.active_running_pair(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.running_pairs x
 join public.runner_progress pa on pa.user_id=x.leader_id and pa.active_run_id=x.leader_run_id
 join public.runner_progress pb on pb.user_id=x.partner_id and pb.active_run_id=x.partner_run_id
 join public.runner_locations la on la.user_id=x.leader_id and la.run_id=x.leader_run_id
 join public.runner_locations lb on lb.user_id=x.partner_id and lb.run_id=x.partner_run_id
 where x.ended_at is null and ((x.leader_id=a and x.partner_id=b) or (x.leader_id=b and x.partner_id=a))
 and la.updated_at>clock_timestamp()-interval '60 seconds' and lb.updated_at>clock_timestamp()-interval '60 seconds');
$$;
revoke all on function public.active_running_pair(uuid,uuid) from public,anon,authenticated;
create index running_pairs_active_leader on public.running_pairs(leader_id) where ended_at is null;
create index running_pairs_active_partner on public.running_pairs(partner_id) where ended_at is null;

create function public.cleanup_finished_running() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.finished_at is not null then
   delete from public.running_checkpoints where run_id=new.id;
   delete from public.runner_locations where run_id=new.id;
   update public.running_pairs set ended_at=clock_timestamp() where ended_at is null and (leader_run_id=new.id or partner_run_id=new.id);
   delete from public.running_pair_members m using public.running_pairs p where m.pair_id=p.id and p.ended_at is not null;
   update public.running_invites set status='cancelled' where status='pending' and (sender_id=new.user_id or recipient_id=new.user_id);
 end if;
 return new;
end; $$;
revoke all on function public.cleanup_finished_running() from public,anon,authenticated;
create trigger training_finished_social after update of finished_at on public.training_sessions for each row execute function public.cleanup_finished_running();

create function public.locate_running_friend(p_target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row jsonb; begin
 perform public.require_active_account();
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or public.runners_blocked(auth.uid(),p_target) then return null; end if;
 select to_jsonb(t) into v_row from (
 select p.id,p.nickname,p.color,p.skin,p.hair,p.outfit,l.distance_m,l.speed,l.paused,l.updated_at,
 public.active_running_pair(auth.uid(),p_target) paired
 from public.runner_locations l join public.profiles p on p.id=l.user_id
 join public.runner_progress r on r.user_id=l.user_id and r.active_run_id=l.run_id
 where l.user_id=p_target and l.updated_at>clock_timestamp()-interval '30 seconds'
 and not exists(select 1 from public.account_controls c where c.user_id=p_target and c.suspended)
 and (l.public_location or public.active_running_pair(auth.uid(),p_target))
 ) t; return v_row;
end; $$;
revoke all on function public.locate_running_friend(uuid) from public,anon,authenticated;
grant execute on function public.locate_running_friend(uuid) to authenticated;

commit;
