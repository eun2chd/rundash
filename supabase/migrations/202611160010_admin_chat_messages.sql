begin;
-- Admin chat management: browse every chat message (not only reported ones), search by text or
-- nickname, delete any message, and optionally suspend its author in the same step. Deleting
-- also closes the message's open reports as removed. Admin accounts are never suspended here.

create or replace function public.admin_chat_messages(p_query text default '', p_page integer default 0, p_filter text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_query text := left(btrim(coalesce(p_query, '')), 100); v_result jsonb;
begin
  perform public.require_admin();
  if p_filter not in ('', 'reported', 'anonymous', 'suspended') then raise exception '채팅 필터를 확인해 주세요.'; end if;
  with messages as (
    select m.id, m.user_id, m.nickname, m.is_anonymous, m.message, m.created_at,
      (select count(*) from public.race_message_reports r where r.message_id = m.id and r.status = 'open') open_reports,
      coalesce(c.suspended, false) author_suspended,
      exists(select 1 from public.admin_members a where a.user_id = m.user_id) author_admin,
      exists(select 1 from public.test_accounts t where t.user_id = m.user_id) is_test
    from public.race_messages m left join public.account_controls c on c.user_id = m.user_id
    where v_query = '' or m.message ilike '%' || v_query || '%' or m.nickname ilike '%' || v_query || '%'
  ), filtered as (
    select * from messages where p_filter = '' or (p_filter = 'reported' and open_reports > 0)
      or (p_filter = 'anonymous' and is_anonymous) or (p_filter = 'suspended' and author_suspended)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'summary', jsonb_build_object(
      'all', (select count(*) from public.race_messages),
      'today', (select count(*) from public.race_messages where created_at >= (((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul')),
      'reported', (select count(distinct message_id) from public.race_message_reports where status = 'open'),
      'authors', (select count(distinct user_id) from public.race_messages where created_at > now() - interval '7 days')),
    'items', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc, t.id) from
      (select * from filtered order by created_at desc, id limit 10 offset greatest(0, coalesce(p_page, 0)) * 10) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_delete_chat_message(p_message_id uuid, p_reason text, p_suspend boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_message public.race_messages; v_reason text := btrim(coalesce(p_reason, '')); v_suspended boolean := false;
begin
  perform public.require_admin();
  if length(v_reason) < 2 or length(v_reason) > 500 then raise exception '처리 사유를 2자 이상 입력해 주세요.'; end if;
  select * into v_message from public.race_messages where id = p_message_id for update;
  if not found then raise exception '이미 삭제된 메시지예요.'; end if;
  if p_suspend and exists(select 1 from public.admin_members where user_id = v_message.user_id) then raise exception '관리자 계정은 정지할 수 없어요.'; end if;
  update public.race_message_reports set status = 'removed', resolved_at = clock_timestamp() where message_id = p_message_id and status = 'open';
  delete from public.race_messages where id = p_message_id;
  insert into public.admin_audit(actor_id, action, target, details)
  values (auth.uid(), 'chat_remove', p_message_id::text, jsonb_build_object('reason', v_reason, 'author', v_message.user_id, 'nickname', v_message.nickname, 'message', v_message.message));
  if p_suspend then
    insert into public.account_controls(user_id, suspended, reason) values (v_message.user_id, true, v_reason)
    on conflict (user_id) do update set suspended = true, reason = excluded.reason, updated_at = now();
    insert into public.admin_audit(actor_id, action, target, details)
    values (auth.uid(), 'suspend', v_message.user_id::text, jsonb_build_object('reason', v_reason, 'message', p_message_id));
    v_suspended := true;
  end if;
  return jsonb_build_object('removed', true, 'suspended', v_suspended);
end;
$$;

revoke all on function public.admin_chat_messages(text, integer, text), public.admin_delete_chat_message(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_chat_messages(text, integer, text), public.admin_delete_chat_message(uuid, text, boolean) to authenticated;
commit;
