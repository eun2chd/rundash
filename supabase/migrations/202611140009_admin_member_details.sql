begin;
create or replace function public.admin_members_list(p_query text default '',p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rows jsonb; v_count bigint; begin
perform public.require_admin();
select count(*) into v_count from auth.users u left join public.profiles p on p.id=u.id where p_query='' or u.email ilike '%'||left(p_query,100)||'%' or p.nickname ilike '%'||left(p_query,100)||'%';
select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (select u.id,u.email,u.is_anonymous,u.created_at,u.last_sign_in_at,p.nickname,coalesce(r.xp,0) xp,coalesce(r.total_distance_km,0) total_distance_km,coalesce(r.run_count,0) run_count,r.active_run_id,coalesce(c.suspended,false) suspended,c.reason,exists(select 1 from public.admin_members a where a.user_id=u.id) admin from auth.users u left join public.profiles p on p.id=u.id left join public.runner_progress r on r.user_id=u.id left join public.account_controls c on c.user_id=u.id where p_query='' or u.email ilike '%'||left(p_query,100)||'%' or p.nickname ilike '%'||left(p_query,100)||'%' order by u.created_at desc limit 25 offset greatest(0,p_page)*25) t;
return jsonb_build_object('items',v_rows,'total',v_count); end; $$;

create or replace function public.admin_update_member(p_user_id uuid,p_action text,p_value bigint,p_reason text) returns void language plpgsql security definer set search_path='' as $$ declare v_old bigint; begin
perform public.require_admin();
if p_reason is null or length(btrim(p_reason))<2 or length(p_reason)>500 then raise exception '변경 사유를 입력해 주세요.'; end if;
if p_action in ('suspend','restore') then
 if exists(select 1 from public.admin_members where user_id=p_user_id) then raise exception '관리자 계정은 정지할 수 없어요.'; end if;
 insert into public.account_controls(user_id,suspended,reason) values(p_user_id,p_action='suspend',p_reason) on conflict(user_id) do update set suspended=excluded.suspended,reason=excluded.reason,updated_at=now();
elsif p_action='xp' then
 if p_value is null or p_value not between 0 and 1000000000 then raise exception 'XP 범위를 확인해 주세요.'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception '러너가 없는 계정이에요.'; end if;
 insert into public.runner_progress(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select xp into v_old from public.runner_progress where user_id=p_user_id for update;
 if exists(select 1 from public.runner_progress where user_id=p_user_id and active_run_id is not null) then raise exception '러닝 중에는 경험치를 변경할 수 없어요.'; end if;
 update public.runner_progress set xp=p_value,updated_at=now() where user_id=p_user_id;
else raise exception '지원하지 않는 작업이에요.'; end if;
insert into public.admin_audit(actor_id,action,target,details) values(auth.uid(),p_action,p_user_id::text,jsonb_build_object('beforeXp',v_old,'value',p_value,'reason',p_reason)); end; $$;

create function public.admin_member_runs(p_user_id uuid,p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rows jsonb; begin
perform public.require_admin();
select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (select id,details,created_at from public.runs where user_id=p_user_id order by created_at desc limit 10 offset greatest(0,p_page)*10) t;
return jsonb_build_object('items',v_rows,'total',(select count(*) from public.runs where user_id=p_user_id)); end; $$;
revoke all on function public.admin_member_runs(uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_member_runs(uuid,integer) to authenticated;
commit;
