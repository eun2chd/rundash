import { getSupabase } from './supabase'
const unwrap = ({ data, error }) => { if (error) throw error; return data }
const profileFromRow = (p) => p && ({ ...p, userId: p.id, updatedAt: p.updated_at })
const runFromRow = (r) => ({ ...r.details, id: r.id, userId: r.user_id, createdAt: r.created_at })
export const api = {
  async signIn({ email, password }) { return unwrap(await getSupabase().auth.signInWithPassword({ email, password })).user },
  async signUp({ email, password, nickname }) { return unwrap(await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { nickname } } })) },
  async signInAnonymously() { return unwrap(await getSupabase().auth.signInAnonymously()).user },
  async signOut() { unwrap(await getSupabase().auth.signOut()) },
  async getSession() {
    const { session } = unwrap(await getSupabase().auth.getSession())
    return session ? unwrap(await getSupabase().auth.getUser()).user : null
  },
  async getProfile(userId) { return profileFromRow(unwrap(await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle())) },
  async isNicknameTaken(nickname) { return unwrap(await getSupabase().rpc('is_nickname_taken', { candidate: nickname })) },
  async saveProfile({ userId, nickname, color, skin, hair }) {
    const { data, error } = await getSupabase().from('profiles').upsert({ id: userId, nickname, color, skin, hair, updated_at: new Date().toISOString() }).select().single()
    if (error?.code === '23505') throw new Error('이미 사용 중인 닉네임이에요.')
    if (error) throw error
    return profileFromRow(data)
  },
  async saveRun(run) {
    const response = await getSupabase().from('runs').insert({ id: run.id, user_id: run.userId, details: run }).select().single()
    // A retry after a lost response must not duplicate a finished run.
    if (response.error?.code === '23505') return runFromRow(unwrap(await getSupabase().from('runs').select('*').eq('id', run.id).single()))
    return runFromRow(unwrap(response))
  },
  async listRuns(userId) { return unwrap(await getSupabase().from('runs').select('*').eq('user_id', userId).order('created_at', { ascending: false })).map(runFromRow) },
}
