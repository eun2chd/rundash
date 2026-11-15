begin;
-- Ranking boards: weekly and monthly distance (this or last period), all-time distance and
-- level (XP). Admin and suspended accounts never appear on any board.

create function public.runner_ranking(p_board text, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamp := clock_timestamp() at time zone 'Asia/Seoul';
  v_start date;
  v_end date;
  v_resets timestamptz;
  v_result jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요해요.'; end if;
  if p_board not in ('week', 'month', 'total', 'level') then raise exception '랭킹 종류를 확인해 주세요.'; end if;
  if p_offset not between 0 and 1 or (p_board in ('total', 'level') and p_offset <> 0) then raise exception '이번 기간과 지난 기간 랭킹만 볼 수 있어요.'; end if;
  if p_board = 'week' then
    v_start := date_trunc('week', v_now)::date - 7 * p_offset;
    v_end := v_start + 7;
    v_resets := (date_trunc('week', v_now) + interval '7 days') at time zone 'Asia/Seoul';
  elsif p_board = 'month' then
    v_start := (date_trunc('month', v_now) - make_interval(months => p_offset))::date;
    v_end := (v_start + interval '1 month')::date;
    v_resets := (date_trunc('month', v_now) + interval '1 month') at time zone 'Asia/Seoul';
  end if;

  with eligible as (
    select p.id user_id, p.nickname, p.color from public.profiles p
    where not exists (select 1 from public.admin_members a where a.user_id = p.id)
      and not exists (select 1 from public.account_controls c where c.user_id = p.id and c.suspended)
  ), period_runs as (
    select r.user_id, round(sum((r.details->>'distanceKm')::numeric), 2) km, count(*)::integer runs, max(r.created_at) reached_at
    from public.runs r
    where p_board in ('week', 'month')
      and r.created_at >= v_start::timestamp at time zone 'Asia/Seoul' and r.created_at < v_end::timestamp at time zone 'Asia/Seoul'
      and not coalesce((r.details->>'practice')::boolean, false)
    group by r.user_id having sum((r.details->>'distanceKm')::numeric) > 0
  ), scores as (
    select e.user_id, e.nickname, e.color, pr.km, pr.runs, coalesce(g.xp, 0) xp, pr.reached_at
    from period_runs pr join eligible e using (user_id) left join public.runner_progress g using (user_id)
    where p_board in ('week', 'month')
    union all
    select e.user_id, e.nickname, e.color, round(g.total_distance_km, 2), g.run_count, g.xp, g.updated_at
    from public.runner_progress g join eligible e using (user_id)
    where p_board = 'total' and g.total_distance_km > 0
    union all
    select e.user_id, e.nickname, e.color, round(g.total_distance_km, 2), g.run_count, g.xp, g.updated_at
    from public.runner_progress g join eligible e using (user_id)
    where p_board = 'level' and g.xp > 0
  ), board as (
    -- Ties go to whoever reached the score first.
    select s.*, public.training_level(s.xp) level,
      rank() over (order by case when p_board = 'level' then s.xp else s.km end desc, s.reached_at asc)::integer rank
    from scores s
  )
  select jsonb_build_object(
    'board', p_board, 'offset', p_offset,
    'periodStart', v_start, 'periodEnd', v_end - 1, 'resetsAt', case when p_offset = 0 then v_resets end,
    'participants', (select count(*) from board),
    'excluded', exists (select 1 from public.admin_members a where a.user_id = v_uid),
    'items', coalesce((select jsonb_agg(jsonb_build_object('rank', b.rank, 'nickname', b.nickname, 'color', b.color, 'km', b.km, 'runs', b.runs, 'xp', b.xp, 'level', b.level, 'me', b.user_id = v_uid) order by b.rank, b.reached_at)
      from (select * from board order by rank, reached_at limit 50) b), '[]'),
    'me', (select jsonb_build_object('rank', b.rank, 'nickname', b.nickname, 'color', b.color, 'km', b.km, 'runs', b.runs, 'xp', b.xp, 'level', b.level, 'me', true) from board b where b.user_id = v_uid))
  into v_result;
  return v_result;
end;
$$;

-- Kept for clients deployed before the boards; same data as the weekly board.
create or replace function public.weekly_ranking(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_board jsonb;
begin
  if p_offset not between 0 and 1 then raise exception '이번 주와 지난주 랭킹만 볼 수 있어요.'; end if;
  v_board := public.runner_ranking('week', p_offset);
  return v_board || jsonb_build_object('weekStart', v_board->'periodStart', 'weekEnd', v_board->'periodEnd');
end;
$$;

revoke all on function public.runner_ranking(text, integer), public.weekly_ranking(integer) from public, anon, authenticated;
grant execute on function public.runner_ranking(text, integer), public.weekly_ranking(integer) to authenticated;
commit;
