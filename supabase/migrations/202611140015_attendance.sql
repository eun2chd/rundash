begin;
-- Daily attendance: the first saved, non-practice run of at least 0.5km on a Korean
-- calendar day checks the runner in and grants bonus XP. Every 7th consecutive day
-- adds a streak bonus.
create table public.runner_attendance (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  run_id uuid not null,
  streak integer not null check (streak >= 1),
  xp_awarded integer not null check (xp_awarded >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.runner_attendance enable row level security;
revoke all on public.runner_attendance from public, anon, authenticated;
grant select on public.runner_attendance to authenticated;
create policy attendance_read_own on public.runner_attendance for select to authenticated using (user_id = (select auth.uid()));

create function public.attendance_rules() returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('minKm', 0.5, 'dailyXp', 50, 'streakEvery', 7, 'streakBonusXp', 300, 'timeZone', 'Asia/Seoul');
$$;
create function public.attendance_today() returns date language sql stable set search_path = '' as $$
  select (clock_timestamp() at time zone 'Asia/Seoul')::date;
$$;

-- Applies attendance for a saved run. Idempotent per (user, day): a retried save or a
-- second run on the same day returns the existing check-in without more XP.
create function public.apply_run_attendance(p_user uuid, p_run jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_rules jsonb := public.attendance_rules();
  v_today date := public.attendance_today();
  v_row public.runner_attendance;
  v_prev public.runner_attendance;
  v_streak integer;
  v_xp integer;
begin
  select * into v_row from public.runner_attendance where user_id = p_user and day = v_today;
  if found then
    return jsonb_build_object('checked', true, 'new', false, 'day', v_row.day, 'streak', v_row.streak, 'xp', case when v_row.run_id = (p_run->>'id')::uuid then v_row.xp_awarded else 0 end);
  end if;
  -- A retried save that lands after midnight must not check in the old run for a new day.
  if coalesce((p_run->'details'->>'practice')::boolean, false) or coalesce((p_run->'details'->>'distanceKm')::numeric, 0) < (v_rules->>'minKm')::numeric
    or ((p_run->>'created_at')::timestamptz at time zone 'Asia/Seoul')::date <> v_today then
    return jsonb_build_object('checked', false, 'new', false, 'day', v_today, 'streak', 0, 'xp', 0);
  end if;
  select * into v_prev from public.runner_attendance where user_id = p_user and day = v_today - 1;
  v_streak := coalesce(v_prev.streak, 0) + 1;
  v_xp := (v_rules->>'dailyXp')::integer + case when v_streak % (v_rules->>'streakEvery')::integer = 0 then (v_rules->>'streakBonusXp')::integer else 0 end;
  insert into public.runner_attendance(user_id, day, run_id, streak, xp_awarded) values (p_user, v_today, (p_run->>'id')::uuid, v_streak, v_xp);
  update public.runner_progress set xp = xp + v_xp, updated_at = now() where user_id = p_user;
  return jsonb_build_object('checked', true, 'new', true, 'day', v_today, 'streak', v_streak, 'xp', v_xp);
end;
$$;

create or replace function public.finish_training_run(p_run_id uuid, p_details jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_attendance jsonb;
begin
  perform pg_advisory_xact_lock(7138041);
  v_result := public.finish_training_run_base(p_run_id, p_details);
  v_attendance := public.apply_run_attendance(auth.uid(), v_result->'run');
  return v_result || jsonb_build_object('attendance', v_attendance,
    'progression', (select to_jsonb(p) from public.runner_progress p where p.user_id = auth.uid()));
end;
$$;

create function public.attendance_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_today date := public.attendance_today(); v_last public.runner_attendance;
begin
  if v_uid is null then raise exception '로그인이 필요해요.'; end if;
  select * into v_last from public.runner_attendance where user_id = v_uid order by day desc limit 1;
  return jsonb_build_object(
    'today', v_today,
    'checkedToday', coalesce(v_last.day = v_today, false),
    'streak', case when v_last.day >= v_today - 1 then v_last.streak else 0 end,
    'week', (select jsonb_agg(jsonb_build_object('day', d::date, 'checked', a.user_id is not null) order by d)
      from generate_series(v_today - 6, v_today, interval '1 day') d
      left join public.runner_attendance a on a.user_id = v_uid and a.day = d::date),
    'total', (select count(*) from public.runner_attendance where user_id = v_uid),
    'rules', public.attendance_rules());
end;
$$;

revoke all on function public.attendance_rules(), public.attendance_today(), public.apply_run_attendance(uuid, jsonb), public.attendance_status() from public, anon, authenticated;
revoke all on function public.finish_training_run(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finish_training_run(uuid, jsonb), public.attendance_status() to authenticated;
commit;
