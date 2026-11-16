begin;
-- Admins reset a member's password to the fixed temporary password rundash123! and tell the
-- member to change it after logging in. Existing sessions are signed out so the old password
-- cannot keep an old login alive.
create function public.admin_reset_password(p_user_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user auth.users;
begin
  perform public.require_admin();
  if length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 500 then raise exception '초기화 사유를 입력해 주세요.'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception '내 비밀번호는 마이페이지에서 변경해 주세요.'; end if;
  if exists (select 1 from public.admin_members where user_id = p_user_id) then raise exception '관리자 계정의 비밀번호는 초기화할 수 없어요.'; end if;
  select * into v_user from auth.users where id = p_user_id;
  if not found then raise exception '계정을 찾을 수 없어요.'; end if;
  if coalesce(v_user.is_anonymous, false) or v_user.email is null then raise exception '이메일로 가입한 계정만 비밀번호를 초기화할 수 있어요.'; end if;
  update auth.users set encrypted_password = extensions.crypt('rundash123!', extensions.gen_salt('bf')), updated_at = now() where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  insert into public.admin_audit(actor_id, action, target, details)
  values (auth.uid(), 'password_reset', p_user_id::text, jsonb_build_object('reason', btrim(p_reason)));
end;
$$;
revoke all on function public.admin_reset_password(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
commit;
