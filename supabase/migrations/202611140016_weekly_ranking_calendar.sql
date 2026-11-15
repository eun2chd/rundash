begin;
-- Weekly distance ranking (Korean weeks, Monday 00:00 KST) and the monthly attendance calendar.

create index if not exists runs_created on public.runs(created_at);

-- p_offset 0 = this week, 1 = last week. Only saved, non-practice member runs count and
-- suspended accounts are left out. Ties go to whoever reached the distance first.
create function public.weekly_ranking(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_start date;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요해요.'; end if;
  if p_offset not between 0 and 1 then raise exception '이번 주와 지난주 랭킹만 볼 수 있어요.'; end if;
  v_start := date_trunc('week', clock_timestamp() at time zone 'Asia/Seoul')::date - 7 * p_offset;
  v_from := v_start::timestamp at time zone 'Asia/Seoul';
  v_to := (v_start + 7)::timestamp at time zone 'Asia/Seoul';
  with totals as (
    select r.user_id, round(sum((r.details->>'distanceKm')::numeric), 2) km, count(*)::integer runs, max(r.created_at) last_at
    from public.runs r
    where r.created_at >= v_from and r.created_at < v_to and not coalesce((r.details->>'practice')::boolean, false)
    group by r.user_id having sum((r.details->>'distanceKm')::numeric) > 0
  ), board as (
    select t.user_id, p.nickname, p.color, t.km, t.runs, t.last_at, public.training_level(coalesce(g.xp, 0)) level,
      rank() over (order by t.km desc, t.last_at asc)::integer rank
    from totals t
    join public.profiles p on p.id = t.user_id
    left join public.runner_progress g on g.user_id = t.user_id
    where not exists (select 1 from public.account_controls c where c.user_id = t.user_id and c.suspended)
  )
  select jsonb_build_object(
    'weekStart', v_start, 'weekEnd', v_start + 6,
    'resetsAt', (date_trunc('week', clock_timestamp() at time zone 'Asia/Seoul') + interval '7 days') at time zone 'Asia/Seoul',
    'participants', (select count(*) from board),
    'items', coalesce((select jsonb_agg(jsonb_build_object('rank', b.rank, 'nickname', b.nickname, 'color', b.color, 'km', b.km, 'runs', b.runs, 'level', b.level, 'me', b.user_id = v_uid) order by b.rank, b.last_at)
      from (select * from board order by rank, last_at limit 50) b), '[]'),
    'me', (select jsonb_build_object('rank', b.rank, 'nickname', b.nickname, 'color', b.color, 'km', b.km, 'runs', b.runs, 'level', b.level, 'me', true) from board b where b.user_id = v_uid))
  into v_result;
  return v_result;
end;
$$;

-- Days the caller checked in during one calendar month, for the stamp calendar.
create function public.attendance_month(p_year integer, p_month integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_first date;
begin
  if v_uid is null then raise exception '로그인이 필요해요.'; end if;
  if p_year not between 2026 and 2100 or p_month not between 1 and 12 then raise exception '날짜를 확인해 주세요.'; end if;
  v_first := make_date(p_year, p_month, 1);
  return jsonb_build_object('year', p_year, 'month', p_month,
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', a.day, 'streak', a.streak, 'xp', a.xp_awarded) order by a.day)
      from public.runner_attendance a where a.user_id = v_uid and a.day >= v_first and a.day < (v_first + interval '1 month')::date), '[]'),
    'longestStreak', coalesce((select max(streak) from public.runner_attendance where user_id = v_uid), 0));
end;
$$;

revoke all on function public.weekly_ranking(integer), public.attendance_month(integer, integer) from public, anon, authenticated;
grant execute on function public.weekly_ranking(integer), public.attendance_month(integer, integer) to authenticated;
commit;
