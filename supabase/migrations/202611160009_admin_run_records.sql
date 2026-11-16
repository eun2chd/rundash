begin;
-- Admin run records: every saved run across all runners (searchable, filterable, 10 per page),
-- the runs that are still open, and a way to close a run that was abandoned so it stops counting
-- as active. Closing marks the session as practice (no XP), clears the runner's active run, its
-- live location, checkpoint and any group it was part of, and writes an audit entry.

create or replace function public.admin_run_records(p_query text default '', p_page integer default 0, p_type text default '', p_view text default 'saved')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_query text := left(btrim(coalesce(p_query, '')), 100); v_result jsonb;
begin
  perform public.require_admin();
  if p_view not in ('saved', 'active') or p_type not in ('', 'normal', 'completed', 'partial', 'practice', 'auto', 'stale') then
    raise exception '러닝 기록 필터를 확인해 주세요.';
  end if;

  if p_view = 'active' then
    with open_runs as (
      select s.id, s.user_id, p.nickname, s.started_at, s.target_km, s.intensity, s.pace_sec, s.practice,
        s.started_at < now() - interval '24 hours' stale,
        l.distance_m, l.paused, l.updated_at location_at,
        exists(select 1 from public.test_accounts t where t.user_id = s.user_id) is_test
      from public.training_sessions s join public.profiles p on p.id = s.user_id
      left join public.runner_locations l on l.run_id = s.id
      where s.finished_at is null
        and (v_query = '' or p.nickname ilike '%' || v_query || '%')
        and (p_type <> 'stale' or s.started_at < now() - interval '24 hours')
    )
    select jsonb_build_object(
      'total', (select count(*) from open_runs),
      'summary', jsonb_build_object('open', (select count(*) from open_runs), 'stale', (select count(*) from open_runs where stale)),
      'items', coalesce((select jsonb_agg(to_jsonb(t) order by t.started_at desc) from
        (select * from open_runs order by started_at desc limit 10 offset greatest(0, coalesce(p_page, 0)) * 10) t), '[]'::jsonb)
    ) into v_result;
    return v_result;
  end if;

  with saved as (
    select r.id, r.user_id, p.nickname, r.created_at, r.details,
      coalesce((r.details->>'practice')::boolean, false) practice,
      coalesce((r.details->>'completed')::boolean, false) completed,
      coalesce((r.details->>'autoUsed')::boolean, false) auto_used,
      exists(select 1 from public.test_accounts t where t.user_id = r.user_id) is_test
    from public.runs r join public.profiles p on p.id = r.user_id
    where v_query = '' or p.nickname ilike '%' || v_query || '%'
  ), filtered as (
    select * from saved where
      p_type = '' or (p_type = 'normal' and not practice) or (p_type = 'completed' and completed and not practice)
      or (p_type = 'partial' and not completed and not practice) or (p_type = 'practice' and practice)
      or (p_type = 'auto' and auto_used)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'summary', (select jsonb_build_object('all', count(*), 'practice', count(*) filter (where practice),
      'completed', count(*) filter (where completed and not practice), 'auto', count(*) filter (where auto_used)) from saved),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'user_id', t.user_id, 'nickname', t.nickname, 'is_test', t.is_test,
        'created_at', t.created_at, 'details', t.details - 'items' - 'stations' - 'closedStations') order by t.created_at desc, t.id) from
      (select * from filtered order by created_at desc, id limit 10 offset greatest(0, coalesce(p_page, 0)) * 10) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_close_run(p_run_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_session public.training_sessions;
begin
  perform public.require_admin();
  if length(btrim(coalesce(p_reason, ''))) < 2 then raise exception '처리 사유를 2자 이상 입력해 주세요.'; end if;
  select * into v_session from public.training_sessions where id = p_run_id for update;
  if not found then raise exception '러닝을 찾을 수 없어요.'; end if;
  if v_session.finished_at is not null then raise exception '이미 끝난 러닝이에요.'; end if;
  update public.training_sessions set finished_at = now(), practice = true where id = p_run_id;
  update public.runner_progress set active_run_id = null, updated_at = now() where active_run_id = p_run_id;
  delete from public.runner_locations where run_id = p_run_id;
  delete from public.running_checkpoints where run_id = p_run_id;
  update public.running_pairs set ended_at = now() where ended_at is null and (leader_run_id = p_run_id or partner_run_id = p_run_id);
  insert into public.admin_audit(actor_id, action, target, details)
  values (auth.uid(), 'run_closed', p_run_id::text, jsonb_build_object('user_id', v_session.user_id, 'started_at', v_session.started_at,
    'target_km', v_session.target_km, 'reason', btrim(p_reason)));
end;
$$;

revoke all on function public.admin_run_records(text, integer, text, text), public.admin_close_run(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_run_records(text, integer, text, text), public.admin_close_run(uuid, text) to authenticated;
commit;
