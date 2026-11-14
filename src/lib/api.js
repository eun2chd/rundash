import { isValidPassword } from './password'
import { getSupabase } from './supabase'
const unwrap = ({ data, error }) => { if (error) throw error; return data }
const profileFromRow = (p) => p && ({ ...p, userId: p.id, updatedAt: p.updated_at })
const runFromRow = (r) => ({ ...r.details, id: r.id, userId: r.user_id, createdAt: r.created_at })
export const api = {
  async signIn({ email, password }) { return unwrap(await getSupabase().auth.signInWithPassword({ email, password })).user },
  async signUp({ email, password, nickname }) { if (!isValidPassword(password)) throw new Error('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해 주세요.'); return unwrap(await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { nickname } } })) },
  async signInAnonymously() { return unwrap(await getSupabase().auth.signInAnonymously()).user },
  async requestPasswordReset(email) {
    unwrap(await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/?auth=reset-password` }))
  },
  async resendVerification(email) {
    unwrap(await getSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } }))
  },
  async updatePassword(password) { if (!isValidPassword(password)) throw new Error('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해 주세요.'); return unwrap(await getSupabase().auth.updateUser({ password })) },
  async signOut() { unwrap(await getSupabase().auth.signOut()) },
  async getSession() {
    const { session } = unwrap(await getSupabase().auth.getSession())
    return session ? unwrap(await getSupabase().auth.getUser()).user : null
  },
  async getProfile(userId) { return profileFromRow(unwrap(await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle())) },
  async getProgression(userId) {
    return unwrap(await getSupabase().from('runner_progress').select('xp,total_distance_km,run_count').eq('user_id', userId).maybeSingle()) || { xp: 0, total_distance_km: 0, run_count: 0 }
  },
  async startRun({ id, distanceKm, intensity }) {
    return unwrap(await getSupabase().rpc('start_training_run', { p_run_id: id, p_target_km: distanceKm, p_intensity: intensity }))
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
    return { run: runFromRow(data.run), progression: data.progression }
  },
  async listRuns(userId) { return unwrap(await getSupabase().from('runs').select('*').eq('user_id', userId).order('created_at', { ascending: false })).map(runFromRow) },
}
