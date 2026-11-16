begin;
-- Admin dashboard: one call that summarises today, the last 14 days, what is happening right now,
-- what is waiting for an admin, how runners are spread across levels, and whether the nightly
-- data purge ran. Days are counted in Korea time. Test accounts are left out of every number.
--
-- Each source table is read once: recent runs are aggregated by day/hour with GROUP BY and joined
-- onto the calendar, and levels are bucketed by XP thresholds instead of resolving every runner's level.

-- Indexes for the date-bounded and status lookups the dashboard (and admin lists) make.
create index if not exists runs_created on public.runs(created_at desc);
create index if not exists runner_attendance_day on public.runner_attendance(day);
create index if not exists support_tickets_status on public.support_tickets(status);
create index if not exists training_sessions_unfinished on public.training_sessions(started_at) where finished_at is null;
create index if not exists runner_locations_updated on public.runner_locations(updated_at desc);

create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from timestamptz := ((v_today - 13)::timestamp at time zone 'Asia/Seoul');
  v_rules jsonb := public.current_game_settings();
  v_auto integer := coalesce((v_rules->>'autoLevel')::integer, 80);
  v_purge jsonb;
  v_result jsonb;
begin
  perform public.require_admin();

  -- pg_cron may be missing (local databases); then the purge card says it cannot be checked.
  begin
    execute $q$
      select coalesce((select jsonb_build_object('available', true, 'status', d.status, 'at', d.end_time)
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
        where j.jobname = 'rundash-purge-expired-data' order by d.start_time desc limit 1),
        jsonb_build_object('available', true, 'status', null, 'at', null))
    $q$ into v_purge;
  exception when others then
    v_purge := jsonb_build_object('available', false, 'status', null, 'at', null);
  end;

  with real_users as materialized (
    select u.id, coalesce(u.is_anonymous, false) is_anonymous, (u.created_at at time zone 'Asia/Seoul')::date as day
    from auth.users u where not exists (select 1 from public.test_accounts t where t.user_id = u.id)
  ), real_runs as materialized (
    select r.user_id, (r.created_at at time zone 'Asia/Seoul')::date as day,
      extract(hour from r.created_at at time zone 'Asia/Seoul')::integer as hour,
      coalesce((r.details->>'practice')::boolean, false) practice,
      coalesce((r.details->>'completed')::boolean, false) completed,
      coalesce((r.details->>'distanceKm')::numeric, 0) km,
      coalesce((r.details->'growth'->>'xpEarned')::numeric, 0) xp,
      coalesce(r.details->>'intensity', 'steady') intensity,
      coalesce((r.details->>'elapsedSec')::numeric, 0) elapsed, coalesce((r.details->>'score')::numeric, 0) score
    from public.runs r
    where r.created_at >= v_from and not exists (select 1 from public.test_accounts t where t.user_id = r.user_id)
  ), saved as materialized (
    select * from real_runs where not practice
  ), days as (
    select d::date as day from generate_series(v_today - 13, v_today, interval '1 day') d
  ), run_days as (
    select day, count(*) runs, count(*) filter (where completed) completed, count(distinct user_id) runners,
      round(sum(km), 2) km, sum(xp) xp, round(avg(km) filter (where km > 0), 2) avg_km,
      round(sum(elapsed) filter (where km > 0) / nullif(sum(km) filter (where km > 0), 0)) avg_pace
    from saved group by day
  ), join_days as (
    select day, count(*) filter (where not is_anonymous) signups, count(*) filter (where is_anonymous) anonymous
    from real_users where day >= v_today - 13 group by day
  ), attendance_days as (
    select a.day, count(*) attendance from public.runner_attendance a
    where a.day >= v_today - 13 and not exists (select 1 from public.test_accounts t where t.user_id = a.user_id) group by a.day
  ), progress as materialized (
    select p.xp, p.total_distance_km, p.run_count from public.runner_progress p
    where not exists (select 1 from public.test_accounts t where t.user_id = p.user_id)
  ), level_xp as (
    -- Cumulative XP needed for the level that starts each bucket.
    select b.label, b.low, coalesce((v_rules->'levels'->(b.low - 1)->>'xp')::bigint, 0) xp_from,
      coalesce((v_rules->'levels'->b.high->>'xp')::bigint, 9223372036854775807) xp_to
    from (values ('Lv.1-9', 1, 9), ('Lv.10-29', 10, 29), ('Lv.30-49', 30, 49), ('Lv.50-79', 50, 79), ('Lv.80-100', 80, 100)) b(label, low, high)
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'today', jsonb_build_object(
      'signups', coalesce((select signups from join_days where day = v_today), 0),
      'anonymous', coalesce((select anonymous from join_days where day = v_today), 0),
      'runs', coalesce((select runs from run_days where day = v_today), 0),
      'completed', coalesce((select completed from run_days where day = v_today), 0),
      'practice', (select count(*) from real_runs where day = v_today and practice),
      'km', coalesce((select km from run_days where day = v_today), 0),
      'xp', coalesce((select xp from run_days where day = v_today), 0),
      'attendance', coalesce((select attendance from attendance_days where day = v_today), 0),
      'messages', (select count(*) from public.race_messages m
        where m.created_at >= (v_today::timestamp at time zone 'Asia/Seoul')
          and not exists (select 1 from public.test_accounts t where t.user_id = m.user_id))
    ),
    'daily', (select jsonb_agg(jsonb_build_object(
        'day', d.day, 'signups', coalesce(j.signups, 0), 'anonymous', coalesce(j.anonymous, 0),
        'runs', coalesce(r.runs, 0), 'completed', coalesce(r.completed, 0), 'km', coalesce(r.km, 0), 'xp', coalesce(r.xp, 0),
        'attendance', coalesce(a.attendance, 0), 'runners', coalesce(r.runners, 0), 'avgKm', r.avg_km, 'avgPaceSec', r.avg_pace
      ) order by d.day)
      from days d left join run_days r on r.day = d.day left join join_days j on j.day = d.day left join attendance_days a on a.day = d.day),
    'hours', (select jsonb_agg(jsonb_build_object('hour', h, 'runs', coalesce(c.runs, 0)) order by h)
      from generate_series(0, 23) h left join (select hour, count(*) runs from saved where day > v_today - 7 group by hour) c on c.hour = h),
    'intensity', (select jsonb_build_object(
        'easy', count(*) filter (where intensity = 'easy'), 'steady', count(*) filter (where intensity = 'steady'),
        'challenge', count(*) filter (where intensity = 'challenge'), 'custom', count(*) filter (where intensity not in ('easy', 'steady', 'challenge')))
      from saved where day > v_today - 7),
    -- Averages over the last 14 days of saved (non-practice) runs. Pace is total time / total km.
    'averages', (select jsonb_build_object(
        'runs', count(*), 'runners', count(distinct user_id),
        'km', round(avg(km), 2), 'paceSec', round(sum(elapsed) / nullif(sum(km), 0)),
        'elapsedSec', round(avg(elapsed)), 'score', round(avg(score)), 'xp', round(avg(xp)),
        'completionRate', round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 1),
        'runsPerRunner', round(count(*)::numeric / nullif(count(distinct user_id), 0), 1))
      from saved where km > 0),
    'distances', (select jsonb_agg(jsonb_build_object('label', b.label, 'runs', coalesce(c.runs, 0)) order by b.low)
      from (values ('1km 미만', 0, 1), ('1-3km', 1, 3), ('3-5km', 3, 5), ('5-10km', 5, 10), ('10-21km', 10, 21), ('21km 이상', 21, 1000)) b(label, low, high)
      left join lateral (select count(*) runs from saved s where s.km > 0 and s.km >= b.low and s.km < b.high) c on true),
    'paces', (select jsonb_agg(jsonb_build_object('label', b.label, 'runs', coalesce(c.runs, 0)) order by b.low)
      from (values ('5분 미만', 0, 300), ('5-6분', 300, 360), ('6-7분', 360, 420), ('7-8분', 420, 480), ('8-9분', 480, 540), ('9분 이상', 540, 100000)) b(label, low, high)
      left join lateral (select count(*) runs from saved s where s.km > 0 and s.elapsed / s.km >= b.low and s.elapsed / s.km < b.high) c on true),
    'topRunners', (select coalesce(jsonb_agg(t order by t.km desc), '[]'::jsonb) from (
        select p.nickname, round(sum(s.km), 2) km, count(*) runs, round(sum(s.elapsed) / nullif(sum(s.km), 0)) "paceSec"
        from saved s join public.profiles p on p.id = s.user_id
        where s.day > v_today - 7 group by p.nickname order by sum(s.km) desc limit 5) t),
    'now', (select jsonb_build_object(
        'running', count(*) filter (where not l.paused), 'paused', count(*) filter (where l.paused),
        'groups', (select count(*) from public.running_pairs p where p.ended_at is null),
        'staleSessions', (select count(*) from public.training_sessions s where s.finished_at is null and s.started_at < now() - interval '24 hours'))
      from public.runner_locations l
      where l.updated_at > now() - interval '2 minutes' and not exists (select 1 from public.test_accounts t where t.user_id = l.user_id)),
    'pending', jsonb_build_object(
      'support', (select count(*) from public.support_tickets where status = 'open'),
      'supportReviewing', (select count(*) from public.support_tickets where status = 'reviewing'),
      'reports', (select count(distinct message_id) from public.race_message_reports where status = 'open')
    ),
    'totals', (select jsonb_build_object(
        'members', count(*) filter (where not is_anonymous), 'anonymous', count(*) filter (where is_anonymous),
        'runners', (select count(*) from progress),
        'km', (select coalesce(round(sum(total_distance_km), 2), 0) from progress),
        'runs', (select coalesce(sum(run_count), 0) from progress),
        'suspended', (select count(*) from public.account_controls c where c.suspended
          and not exists (select 1 from public.test_accounts t where t.user_id = c.user_id)),
        'autoRunners', (select count(*) from progress where xp >= coalesce((v_rules->'levels'->(v_auto - 1)->>'xp')::bigint, 9223372036854775807)))
      from real_users),
    'levels', (select jsonb_agg(jsonb_build_object('label', b.label, 'runners',
        (select count(*) from progress p where p.xp >= b.xp_from and p.xp < b.xp_to)) order by b.low)
      from level_xp b),
    'purge', v_purge
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_dashboard() from public, anon, authenticated;
grant execute on function public.admin_dashboard() to authenticated;
commit;
