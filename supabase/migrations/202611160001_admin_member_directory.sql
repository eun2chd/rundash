begin;

-- A separate RPC keeps the existing member-list contract working during rollout.
create function public.admin_member_directory(p_query text default '', p_page integer default 0, p_type text default '', p_status text default '')
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
    'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from
      (select * from filtered order by created_at desc,id limit 25 offset greatest(0,coalesce(p_page,0))*25) t),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_member_directory(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.admin_member_directory(text,integer,text,text) to authenticated;
commit;
