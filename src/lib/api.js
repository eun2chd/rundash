// ─────────────────────────────────────────────────────────────
// 목업 API (localStorage)
// 화면 코드는 이 파일의 함수만 호출하므로, 나중에 이 파일 내부만
// Supabase 호출로 바꾸면 됩니다. (주석에 대응되는 Supabase 코드)
// ─────────────────────────────────────────────────────────────
const KEY = 'rundash.mock.v1'
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
const save = (d) => {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* noop */ }
}
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms))
const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`)

export const api = {
  // supabase.auth.signInWithPassword({ email, password })
  // supabase.auth.signInWithOAuth({ provider: 'google' | 'kakao' })
  async signIn({ email, provider = 'email' }) {
    await wait(500)
    const d = load()
    const id = d.accounts?.[email] || uid()
    d.accounts = { ...d.accounts, [email]: id }
    d.session = { id, email, provider }
    save(d)
    return d.session
  },

  // supabase.auth.signOut()
  async signOut() {
    const d = load()
    delete d.session
    save(d)
  },

  // supabase.auth.getSession()
  async getSession() {
    await wait(150)
    return load().session || null
  },

  // supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  async getProfile(userId) {
    return load().profiles?.[userId] || null
  },

  // supabase.from('profiles').select('id').eq('nickname', nickname).neq('id', userId)
  async isNicknameTaken(nickname, userId) {
    await wait(300)
    const reserved = ['admin', '관리자', '운영자']
    if (reserved.includes(nickname.toLowerCase())) return true
    const d = load()
    return Object.values(d.profiles || {}).some((p) => p.nickname === nickname && p.userId !== userId)
  },

  // supabase.from('profiles').upsert({ id: userId, nickname, color, skin, hair })
  async saveProfile(profile) {
    await wait(300)
    const d = load()
    const saved = { ...profile, updatedAt: new Date().toISOString() }
    d.profiles = { ...d.profiles, [profile.userId]: saved }
    save(d)
    return saved
  },

  // supabase.from('runs').insert(run).select().single()
  async saveRun(run) {
    await wait(300)
    const d = load()
    const saved = { ...run, id: uid(), createdAt: new Date().toISOString() }
    d.runs = [saved, ...(d.runs || [])].slice(0, 50)
    save(d)
    return saved
  },

  // supabase.from('runs').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  async listRuns(userId) {
    return (load().runs || []).filter((r) => r.userId === userId)
  },
}
