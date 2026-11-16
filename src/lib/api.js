import { isValidPassword } from './password'
import { getSupabase } from './supabase'
const unwrap = ({ data, error }) => { if (error) throw error; return data }
const profileFromRow = (p) => p && ({ ...p, userId: p.id, updatedAt: p.updated_at })
const runFromRow = (r) => ({ ...r.details, id: r.id, userId: r.user_id, createdAt: r.created_at })
// Supabase returns this when the Turnstile token is missing, expired or reused.
export function authErrorMessage(error) {
  return /captcha/i.test(error?.message || '') ? '보안 확인이 만료됐어요. 잠시 후 다시 시도해 주세요.' : error?.message
}

export const api = {
  async locateFriend(id) { return unwrap(await getSupabase().rpc('locate_running_friend', { p_target: id })) },
  async socialTick({ runId, distance, speed, paused, publicLocation, allowInvites, activity = 'rest', shareActivity = true }) {
    const args = { p_run_id: runId, p_distance: distance, p_speed: speed, p_paused: paused, p_public: publicLocation, p_invites: allowInvites }
    const result = await getSupabase().rpc('running_social_tick', { ...args, p_activity: activity, p_share_activity: shareActivity })
    if (result.error?.code === 'PGRST202') return unwrap(await getSupabase().rpc('running_social_tick', args))
    return unwrap(result)
  },
  async searchFriends(query) { return unwrap(await getSupabase().rpc('search_running_friends', { p_query: query.trim() })) },
  async listFriends() { return unwrap(await getSupabase().rpc('list_saved_running_friends')) },
  async saveFriend(id, save = true) { return unwrap(await getSupabase().rpc('save_running_friend', { p_target: id, p_save: save })) },
  async inviteFriend(id) { return unwrap(await getSupabase().rpc('invite_running_friend', { p_target: id })) },
  async respondInvite(id, action) { return unwrap(await getSupabase().rpc('respond_running_invite', { p_id: id, p_action: action })) },
  async endPair(runId) { return unwrap(await getSupabase().rpc('end_running_pair', runId ? { p_run_id: runId } : {})) },
  async pauseGroup(paused) { return unwrap(await getSupabase().rpc('pause_running_group', { p_paused: paused })) },
  async acceptInvite(id, details, newRunId) {
    const args = { p_id: id, p_details: details, p_new_run_id: newRunId }
    let result = await getSupabase().rpc('accept_running_invite', args)
    if (result.error && !result.error.code) result = await getSupabase().rpc('accept_running_invite', args)
    return unwrap(result)
  },
  async blockFriend(id, block) { return unwrap(await getSupabase().rpc('block_running_friend', { p_target: id, p_block: block })) },
  async listBlocks() { return unwrap(await getSupabase().rpc('list_running_blocks')) },
  async saveCheckpoint(id, payload) { return unwrap(await getSupabase().rpc('save_running_checkpoint', { p_run_id: id, p_payload: payload })) },
  async loadCheckpoint() { return unwrap(await getSupabase().rpc('load_running_checkpoint')) },
  async getSettings() { return unwrap(await getSupabase().from('game_settings').select('value,version,updated_at').eq('id', true).single()) },
  async accountStatus() { return unwrap(await getSupabase().rpc('account_status')) },
  async submitSupport({ category, title, body }) { return unwrap(await getSupabase().rpc('submit_support', { p_category: category, p_title: title, p_body: body })) },
  async listSupport() { return unwrap(await getSupabase().from('support_tickets').select('*').order('created_at', { ascending: false }).limit(100)) },
  async adminMembers(query = '', page = 0, type = '', status = '') { return unwrap(await getSupabase().rpc('admin_member_directory', { p_query: query, p_page: page, p_type: type, p_status: status })) },
  async adminCreateTestAccount({ email, password, nickname }) { return unwrap(await getSupabase().rpc('admin_create_test_account', { p_email: email, p_password: password, p_nickname: nickname })) },
  async adminResetPassword(id, reason) { unwrap(await getSupabase().rpc('admin_reset_password', { p_user_id: id, p_reason: reason })) },
  async adminSetAdmin(id, admin, reason) { unwrap(await getSupabase().rpc('admin_set_admin', { p_user_id: id, p_admin: admin, p_reason: reason })) },
  async adminDeleteMember(id, confirmText, reason) { unwrap(await getSupabase().rpc('admin_delete_member', { p_user_id: id, p_confirm: confirmText, p_reason: reason })) },
  async adminMemberAction(id, action, value, reason) { unwrap(await getSupabase().rpc('admin_update_member', { p_user_id: id, p_action: action, p_value: value, p_reason: reason })) },
  async adminMemberRuns(id, page = 0) { return unwrap(await getSupabase().rpc('admin_member_runs', { p_user_id: id, p_page: page })) },
  async adminSupport(status = '', page = 0) { return unwrap(await getSupabase().rpc('admin_support', { p_status: status, p_page: page })) },
  async adminReply(id, status, reply) { unwrap(await getSupabase().rpc('admin_reply_support', { p_id: id, p_status: status, p_reply: reply })) },
  async adminSaveSettings(value, version) { return unwrap(await getSupabase().rpc('admin_save_settings', { p_value: value, p_version: version })) },
  async adminAudit(page = 0) { return unwrap(await getSupabase().rpc('admin_audit_list', { p_page: page })) },
  async signIn({ email, password, captchaToken }) { return unwrap(await getSupabase().auth.signInWithPassword({ email, password, options: { captchaToken } })).user },
  async signUp({ email, password, nickname, consent, captchaToken }) { if (!isValidPassword(password)) throw new Error('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해 주세요.'); return unwrap(await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { nickname, consent }, captchaToken } })) },
  async signInAnonymously(captchaToken) { return unwrap(await getSupabase().auth.signInAnonymously({ options: { captchaToken } })).user },
  async requestPasswordReset(email, captchaToken) {
    unwrap(await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/?auth=reset-password`, captchaToken }))
  },
  async resendVerification(email, captchaToken) {
    unwrap(await getSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin, captchaToken } }))
  },
  async updatePassword(password) { if (!isValidPassword(password)) throw new Error('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해 주세요.'); return unwrap(await getSupabase().auth.updateUser({ password })) },
  async signOut() { unwrap(await getSupabase().auth.signOut()) },
  // The auth user is gone after the RPC, so only the local session can be cleared.
  async deleteAccount(confirmText) { unwrap(await getSupabase().rpc('delete_my_account', { p_confirm: confirmText })); await getSupabase().auth.signOut({ scope: 'local' }) },
  async reportMessage(id, reason) { unwrap(await getSupabase().rpc('report_race_message', { p_message_id: id, p_reason: reason })) },
  async adminChatReports(status = 'open', page = 0) { return unwrap(await getSupabase().rpc('admin_chat_reports', { p_status: status, p_page: page })) },
  async adminResolveChatReport(id, action, reason) { unwrap(await getSupabase().rpc('admin_resolve_chat_report', { p_message_id: id, p_action: action, p_reason: reason })) },
  async getSession() {
    const { session } = unwrap(await getSupabase().auth.getSession())
    return session ? unwrap(await getSupabase().auth.getUser()).user : null
  },
  async getProfile(userId) { return profileFromRow(unwrap(await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle())) },
  async saveAvatar(image) {
    const { user } = unwrap(await getSupabase().auth.getUser())
    if (!user || user.is_anonymous) throw new Error('정식 계정으로 로그인해 주세요.')
    return profileFromRow(unwrap(await getSupabase().from('profiles').update({ avatar_image: image, updated_at: new Date().toISOString() }).eq('id', user.id).select().single()))
  },
  async changePassword(currentPassword, password, captchaToken) {
    const { user } = unwrap(await getSupabase().auth.getUser())
    if (!user || user.is_anonymous) throw new Error('정식 계정으로 로그인해 주세요.')
    unwrap(await getSupabase().auth.signInWithPassword({ email: user.email, password: currentPassword, options: { captchaToken } }))
    return api.updatePassword(password)
  },
  async getProgression(userId) {
    return unwrap(await getSupabase().from('runner_progress').select('xp,total_distance_km,run_count').eq('user_id', userId).maybeSingle()) || { xp: 0, total_distance_km: 0, run_count: 0 }
  },
  async startRun({ id, distanceKm, intensity, customPace }) {
    return unwrap(await getSupabase().rpc('start_training_run', { p_run_id: id, p_target_km: distanceKm, p_intensity: intensity, ...(intensity === 'custom' ? { p_pace_sec: customPace } : {}) }))
  },
  async markPractice(id) {
    unwrap(await getSupabase().rpc('mark_training_practice', { p_run_id: id }))
  },
  async isNicknameTaken(nickname) { return unwrap(await getSupabase().rpc('is_nickname_taken', { candidate: nickname })) },
  async saveProfile({ userId, nickname, color, skin, hair, outfit }) {
    const { user } = unwrap(await getSupabase().auth.getUser())
    if (user.is_anonymous) throw new Error('러너를 저장하려면 정식 계정으로 로그인해 주세요.')
    const { data, error } = await getSupabase().from('profiles').upsert({ id: userId, nickname, color, skin, hair, outfit, updated_at: new Date().toISOString() }).select().single()
    if (error?.code === '23505') throw Object.assign(new Error('이미 사용 중인 닉네임이에요.'), { code: error.code })
    if (error) throw error
    return profileFromRow(data)
  },
  async saveRun(run) {
    const { user } = unwrap(await getSupabase().auth.getUser())
    if (user.is_anonymous) throw new Error('기록을 저장하려면 정식 계정으로 로그인해 주세요.')
    const data = unwrap(await getSupabase().rpc('finish_training_run', { p_run_id: run.id, p_details: run }))
    return { run: runFromRow(data.run), progression: data.progression, attendance: data.attendance || null }
  },
  async attendanceStatus() { return unwrap(await getSupabase().rpc('attendance_status')) },
  async attendanceMonth(year, month) { return unwrap(await getSupabase().rpc('attendance_month', { p_year: year, p_month: month })) },
  async ranking(board = 'week', offset = 0) { return unwrap(await getSupabase().rpc('runner_ranking', { p_board: board, p_offset: offset })) },
  async listRuns(userId) { return unwrap(await getSupabase().from('runs').select('*').eq('user_id', userId).order('created_at', { ascending: false })).map(runFromRow) },
}
