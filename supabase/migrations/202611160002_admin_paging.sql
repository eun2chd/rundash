begin;
-- Admin lists page by 10 to match the shared pagination component, and the member
-- directory lists registered members before anonymous runners.

create or replace function public.admin_member_directory(p_query text default '', p_page integer default 0, p_type text default '', p_status text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform public.require_admin();
  if p_type not in ('', 'member', 'anonymous') or p_status not in ('', 'active', 'suspended') then
    raise exception '회원 필터를 확인해 주세요.';
  end if;
  with members as (
    select u.id, u.email, coalesce(u.is_anonymous,false) is_anonymous, u.created_at, u.last_sign_in_at,
      p.nickname, coalesce(r.xp,0) xp, coalesce(r.total_distance_km,0) total_distance_km,
      coalesce(r.run_count,0) run_count, r.active_run_id, coalesce(c.suspended,false) suspended, c.reason,
      exists(select 1 from public.admin_members a where a.user_id=u.id) admin
    from auth.users u left join public.profiles p on p.id=u.id
    left join public.runner_progress r on r.user_id=u.id left join public.account_controls c on c.user_id=u.id
  ), filtered as (
    select * from members m where
      (coalesce(p_query,'')='' or m.email ilike '%'||left(p_query,100)||'%' or m.nickname ilike '%'||left(p_query,100)||'%')
      and (p_type='' or (p_type='anonymous')=m.is_anonymous)
      and (p_status='' or (p_status='suspended')=m.suspended)
  )
  select jsonb_build_object(
    'summary', (select jsonb_build_object('total',count(*),'members',count(*) filter(where not is_anonymous),
      'anonymous',count(*) filter(where is_anonymous),'suspended',count(*) filter(where suspended)) from members),
    'total',(select count(*) from filtered),
    'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.is_anonymous,t.created_at desc,t.id) from
      (select * from filtered order by is_anonymous,created_at desc,id limit 10 offset greatest(0,coalesce(p_page,0))*10) t),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_support(p_status text default '',p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rows jsonb; v_count bigint; begin
perform public.require_admin();
select count(*) into v_count from public.support_tickets where p_status='' or status=p_status;
select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (select s.*,u.email,p.nickname from public.support_tickets s join auth.users u on u.id=s.user_id left join public.profiles p on p.id=s.user_id where p_status='' or s.status=p_status order by s.created_at desc limit 10 offset greatest(0,p_page)*10) t;
return jsonb_build_object('items',v_rows,'total',v_count); end; $$;

create or replace function public.admin_audit_list(p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$ declare v_rows jsonb; begin perform public.require_admin(); select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_rows from (select a.id,a.action,a.target,a.details,a.created_at,u.email actor from public.admin_audit a left join auth.users u on u.id=a.actor_id order by a.id desc limit 10 offset greatest(0,p_page)*10) t; return jsonb_build_object('items',v_rows,'total',(select count(*) from public.admin_audit)); end; $$;

create or replace function public.admin_chat_reports(p_status text default 'open', p_page integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb; v_count bigint;
begin
  perform public.require_admin();
  select count(distinct message_id) into v_count from public.race_message_reports where p_status = '' or status = p_status;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.last_reported_at desc), '[]') into v_rows from (
    select r.message_id, (array_agg(r.author_id))[1] author_id, min(r.author_nickname) author_nickname, min(r.message) message,
      min(r.message_created_at) message_created_at, count(*) report_count, jsonb_agg(distinct r.reason) reasons,
      max(r.created_at) last_reported_at, min(r.status) status, max(r.resolved_at) resolved_at,
      exists(select 1 from public.race_messages m where m.id = r.message_id) message_exists,
      coalesce((select c.suspended from public.account_controls c where c.user_id = (array_agg(r.author_id))[1]), false) author_suspended
    from public.race_message_reports r where p_status = '' or r.status = p_status
    group by r.message_id order by max(r.created_at) desc limit 10 offset greatest(0, p_page) * 10
  ) t;
  return jsonb_build_object('items', v_rows, 'total', v_count);
end;
$$;
commit;
