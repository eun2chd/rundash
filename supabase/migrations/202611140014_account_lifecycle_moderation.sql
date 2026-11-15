begin;
-- Account deletion, chat reports and the retention periods promised in /privacy.

-- Chat reports keep a snapshot so admins can review a message even after it is deleted.
create table public.race_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid,
  author_nickname text not null,
  message text not null,
  message_created_at timestamptz not null,
  reason text not null check (reason in ('abuse','sexual','spam','privacy','other')),
  status text not null default 'open' check (status in ('open','removed','dismissed')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  unique (message_id, reporter_id)
);
create index race_message_reports_open on public.race_message_reports(status, created_at desc);
create index race_message_reports_reporter on public.race_message_reports(reporter_id, created_at desc);
alter table public.race_message_reports enable row level security;
revoke all on public.race_message_reports from public, anon, authenticated;

create function public.report_race_message(p_message_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_msg public.race_messages;
begin
  if v_uid is null then raise exception '신고하려면 로그인해 주세요.'; end if;
  if p_reason not in ('abuse','sexual','spam','privacy','other') then raise exception '신고 사유를 선택해 주세요.'; end if;
  select * into v_msg from public.race_messages where id = p_message_id;
  if not found then raise exception '이미 삭제된 메시지예요.'; end if;
  if v_msg.user_id = v_uid then raise exception '내 메시지는 신고할 수 없어요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 47));
  if (select count(*) from public.race_message_reports where reporter_id = v_uid and created_at > clock_timestamp() - interval '1 hour') >= 10 then
    raise exception '신고는 1시간에 10건까지 할 수 있어요.';
  end if;
  insert into public.race_message_reports(message_id, reporter_id, author_id, author_nickname, message, message_created_at, reason)
    values (v_msg.id, v_uid, v_msg.user_id, v_msg.nickname, v_msg.message, v_msg.created_at, p_reason)
    on conflict (message_id, reporter_id) do nothing;
end;
$$;

create function public.admin_chat_reports(p_status text default 'open', p_page integer default 0) returns jsonb
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
    group by r.message_id order by max(r.created_at) desc limit 25 offset greatest(0, p_page) * 25
  ) t;
  return jsonb_build_object('items', v_rows, 'total', v_count);
end;
$$;

create function public.admin_resolve_chat_report(p_message_id uuid, p_action text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_action not in ('remove','dismiss') then raise exception '처리 방법을 선택해 주세요.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 500 then raise exception '처리 사유를 입력해 주세요.'; end if;
  update public.race_message_reports set status = case when p_action = 'remove' then 'removed' else 'dismissed' end, resolved_at = clock_timestamp()
    where message_id = p_message_id and status = 'open';
  if not found then raise exception '처리할 신고가 없어요.'; end if;
  if p_action = 'remove' then delete from public.race_messages where id = p_message_id; end if;
  insert into public.admin_audit(actor_id, action, target, details)
    values (auth.uid(), 'chat_' || p_action, p_message_id::text, jsonb_build_object('reason', btrim(p_reason)));
end;
$$;

-- Self-service account deletion. Social rows that point at the user's runs without
-- ON DELETE CASCADE are cleared first so the auth.users delete cannot be blocked.
create function public.delete_my_account(p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_nickname text; v_control public.account_controls;
begin
  if v_uid is null then raise exception '로그인이 필요해요.'; end if;
  if exists (select 1 from public.admin_members where user_id = v_uid) then raise exception '관리자 계정은 직접 탈퇴할 수 없어요. 다른 관리자에게 권한 해제를 요청해 주세요.'; end if;
  select nickname into v_nickname from public.profiles where id = v_uid;
  if btrim(coalesce(p_confirm, '')) not in ('탈퇴', coalesce(v_nickname, '탈퇴')) then raise exception '확인 문구가 맞지 않아요.'; end if;
  select * into v_control from public.account_controls where user_id = v_uid;
  delete from public.running_invites
    where sender_id = v_uid or recipient_id = v_uid
      or offered_run_id in (select id from public.training_sessions where user_id = v_uid)
      or group_id in (select id from public.running_pairs where leader_id = v_uid or partner_id = v_uid
        or leader_run_id in (select id from public.training_sessions where user_id = v_uid)
        or partner_run_id in (select id from public.training_sessions where user_id = v_uid));
  delete from public.running_pair_members where user_id = v_uid or run_id in (select id from public.training_sessions where user_id = v_uid);
  delete from public.running_pairs where leader_id = v_uid or partner_id = v_uid
    or leader_run_id in (select id from public.training_sessions where user_id = v_uid)
    or partner_run_id in (select id from public.training_sessions where user_id = v_uid);
  -- Kept for one year after withdrawal (see /privacy section 3), then purged.
  insert into public.admin_audit(actor_id, action, target, details)
    values (null, 'account_deleted', v_uid::text, jsonb_build_object('suspended', coalesce(v_control.suspended, false), 'suspend_reason', v_control.reason));
  delete from auth.users where id = v_uid;
end;
$$;

-- Retention periods from /privacy section 3.
create function public.purge_expired_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_anonymous integer; v_messages integer; v_reports integer; v_audit integer;
begin
  delete from public.race_message_reports where status <> 'open' and resolved_at < now() - interval '90 days';
  get diagnostics v_reports = row_count;
  delete from public.race_messages m where m.created_at < now() - interval '90 days'
    and not exists (select 1 from public.race_message_reports r where r.message_id = m.id and r.status = 'open');
  get diagnostics v_messages = row_count;
  delete from auth.users u where u.is_anonymous
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
    and not exists (select 1 from public.race_messages m where m.user_id = u.id and m.created_at > now() - interval '30 days');
  get diagnostics v_anonymous = row_count;
  delete from public.admin_audit a where a.target in (
    select d.target from public.admin_audit d where d.action = 'account_deleted' and d.created_at < now() - interval '1 year');
  get diagnostics v_audit = row_count;
  return jsonb_build_object('anonymous_users', v_anonymous, 'messages', v_messages, 'reports', v_reports, 'audit_rows', v_audit);
end;
$$;

revoke all on function public.report_race_message(uuid, text), public.admin_chat_reports(text, integer), public.admin_resolve_chat_report(uuid, text, text),
  public.delete_my_account(text), public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.report_race_message(uuid, text), public.admin_chat_reports(text, integer), public.admin_resolve_chat_report(uuid, text, text),
  public.delete_my_account(text) to authenticated;

-- Daily purge at 03:17 KST (18:17 UTC). Skipped where pg_cron is unavailable (local tests).
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('rundash-purge-expired-data', '17 18 * * *', 'select public.purge_expired_data()');
  else
    raise notice 'pg_cron is not available; schedule public.purge_expired_data() manually.';
  end if;
end $$;
commit;
