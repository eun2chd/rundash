begin;
-- Admins can permanently delete a member or anonymous account. The same social cleanup as
-- delete_my_account runs first so group runs cannot block the auth.users delete; everything
-- else cascades. The audit row (kept a year, see /privacy) records who deleted it and why.
create function public.admin_delete_member(p_user_id uuid, p_confirm text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user auth.users; v_nickname text; v_control public.account_controls;
begin
  perform public.require_admin();
  if p_user_id is null or p_user_id = auth.uid() then raise exception '내 계정은 여기서 삭제할 수 없어요.'; end if;
  if exists (select 1 from public.admin_members where user_id = p_user_id) then raise exception '관리자 계정은 삭제할 수 없어요. 먼저 관리자 권한을 해제해 주세요.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 500 then raise exception '삭제 사유를 입력해 주세요.'; end if;
  select * into v_user from auth.users where id = p_user_id;
  if not found then raise exception '이미 삭제된 계정이에요.'; end if;
  if btrim(coalesce(p_confirm, '')) <> '삭제' then raise exception '확인 문구로 "삭제"를 입력해 주세요.'; end if;
  select nickname into v_nickname from public.profiles where id = p_user_id;
  select * into v_control from public.account_controls where user_id = p_user_id;
  delete from public.running_invites
    where sender_id = p_user_id or recipient_id = p_user_id
      or offered_run_id in (select id from public.training_sessions where user_id = p_user_id)
      or group_id in (select id from public.running_pairs where leader_id = p_user_id or partner_id = p_user_id
        or leader_run_id in (select id from public.training_sessions where user_id = p_user_id)
        or partner_run_id in (select id from public.training_sessions where user_id = p_user_id));
  delete from public.running_pair_members where user_id = p_user_id or run_id in (select id from public.training_sessions where user_id = p_user_id);
  delete from public.running_pairs where leader_id = p_user_id or partner_id = p_user_id
    or leader_run_id in (select id from public.training_sessions where user_id = p_user_id)
    or partner_run_id in (select id from public.training_sessions where user_id = p_user_id);
  insert into public.admin_audit(actor_id, action, target, details)
    values (auth.uid(), 'account_deleted', p_user_id::text, jsonb_build_object('by', 'admin', 'reason', btrim(p_reason),
      'nickname', v_nickname, 'anonymous', coalesce(v_user.is_anonymous, false),
      'suspended', coalesce(v_control.suspended, false), 'suspend_reason', v_control.reason));
  delete from auth.users where id = p_user_id;
end;
$$;
revoke all on function public.admin_delete_member(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_delete_member(uuid, text, text) to authenticated;
commit;
