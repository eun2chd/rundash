import { useEffect, useRef, useState } from 'react'
import { LuUser, LuLock, LuActivity, LuCamera, LuTrash2 } from 'react-icons/lu'
import { api } from '../lib/api'
import { isValidPassword, PASSWORD_RULE } from '../lib/password'
import GrowthCard from '../components/GrowthCard'
import { fmtPace, fmtTime } from '../lib/pace'

async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요.')
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'; context.fillRect(0, 0, 256, 256)
    const side = Math.min(bitmap.width, bitmap.height)
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256)
    const image = canvas.toDataURL('image/jpeg', .75)
    if (image.length > 60000) throw new Error('사진이 복잡해 저장할 수 없어요. 다른 사진을 선택해 주세요.')
    return image
  } finally { bitmap.close() }
}

export default function MyPage({ user, profile, onProfile, confirmAction, onNavigate }) {
  const [tab, setTab] = useState('info')
  const [photo, setPhoto] = useState(profile?.avatar_image || null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const fileInput = useRef(null)
  const anonymous = user.is_anonymous
  const nickname = profile?.nickname || user.user_metadata?.nickname || '익명 러너'
  const photoChanged = photo !== (profile?.avatar_image || null)
  useEffect(() => {
    if (anonymous || !profile) return
    let live = true
    setLoadError(false)
    Promise.all([api.getProgression(user.id), api.listRuns(user.id)]).then(([growth, runs]) => { if (live) setData({ growth, runs }) }).catch(() => { if (live) setLoadError(true) })
    return () => { live = false }
  }, [user.id, anonymous, !!profile, refresh])
  const chooseTab = async (next) => {
    if (busy || tab === next) return
    if ((photo !== (profile?.avatar_image || null) || current || password || repeat) && !await confirmAction({ title: '메뉴를 이동할까요?', description: '저장하지 않은 변경사항은 사라져요.' })) return
    setPhoto(profile?.avatar_image || null); setCurrent(''); setPassword(''); setRepeat(''); setError(''); setNotice(''); setTab(next)
  }
  const pickPhoto = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setBusy(true); setError(''); setNotice('')
    try { setPhoto(await preparePhoto(file)) } catch (err) { setError(err.message || '사진을 읽지 못했어요.') } finally { setBusy(false) }
  }
  const savePhoto = async () => {
    setBusy(true); setError(''); setNotice('')
    try { onProfile(await api.saveAvatar(photo)); setNotice('프로필 사진을 저장했어요.') } catch { setError('사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.') } finally { setBusy(false) }
  }
  const changePassword = async (event) => {
    event.preventDefault()
    if (busy || !current || !isValidPassword(password) || password !== repeat) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (!await confirmAction({ title: '비밀번호를 변경할까요?', description: '다음 로그인부터 새 비밀번호를 사용해 주세요.', confirmLabel: '변경하기' })) return
      await api.changePassword(current, password)
      setCurrent(''); setPassword(''); setRepeat(''); setNotice('비밀번호를 변경했어요.')
    } catch { setError('변경하지 못했어요. 현재 비밀번호와 새 비밀번호 규칙을 확인해 주세요.') } finally { setBusy(false) }
  }
  return <div className="mypage-screen">
    <div className="mypage-layout">
      <aside className="card mypage-sidebar"><div className="account-mini">{profile?.avatar_image ? <img src={profile.avatar_image} alt="내 프로필" /> : <span className="account-avatar"><LuUser /></span>}<strong>{nickname}</strong><span>{anonymous ? '익명 러너' : '나의 러너 계정'}</span></div><nav aria-label="마이페이지 메뉴">{[['info', '기본정보', LuUser], ['password', '비밀번호 변경', LuLock], ['records', '러닝 기록', LuActivity]].map(([key, label, Icon]) => <button type="button" key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} disabled={busy} onClick={() => chooseTab(key)}><Icon />{label}</button>)}</nav></aside>
      <section className="card mypage-content" aria-busy={busy}>
        <div className="eyebrow">{tab === 'info' ? 'PROFILE' : tab === 'password' ? 'SECURITY' : 'RUNNING HISTORY'}</div><h2>{tab === 'info' ? '기본정보' : tab === 'password' ? '비밀번호 변경' : '러닝 기록'}</h2>
        {error && <p className="error" role="alert">{error}</p>}{notice && <p className="account-notice" role="status">{notice}</p>}
        {anonymous ? <div className="account-empty"><LuUser /><h3>익명으로 가볍게 달리는 중</h3><p>익명 계정은 사진, 비밀번호와 러닝 기록을 저장하지 않아요. 회원 계정에서 나만의 프로필과 성장을 관리할 수 있어요.</p><button className="btn primary" onClick={() => onNavigate('signup')}>회원가입으로 이동</button></div> : <>
          {tab === 'info' && <>
            <div className="photo-editor">
              {photo ? <img src={photo} alt="프로필 사진 미리보기" /> : <span className="account-avatar large"><LuUser /></span>}
              <div className="photo-edit-content">
                <h3>프로필 사진</h3>
                <p>JPG, PNG, WebP · 최대 5MB<br />정사각형으로 자동 맞춤해요.</p>
                <div className="photo-edit-actions">
                  <button type="button" className="btn ghost" disabled={busy || !profile} onClick={() => fileInput.current?.click()}><LuCamera />{photo ? '사진 변경' : '사진 등록'}</button>
                  {photo && <button type="button" className="btn ghost photo-delete" disabled={busy || !profile} onClick={() => { setPhoto(null); setNotice(''); setError('') }}><LuTrash2 />사진 삭제</button>}
                </div>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="프로필 사진 선택" onChange={pickPhoto} disabled={busy} />
              </div>
            </div>
            {!profile && <p>먼저 러너를 만들어 주세요. <button className="link" onClick={() => onNavigate('character')}>러너 만들기</button></p>}
            <div className="account-fields">
              <label className="field"><span>닉네임</span><input value={nickname} readOnly /><small>가입할 때 정한 닉네임은 변경할 수 없어요.</small></label>
              <label className="field"><span>이메일</span><input value={user.email || ''} readOnly /></label>
            </div>
            <div className="account-details">
              <div><span>이메일 인증</span><strong>{user.email_confirmed_at ? '인증 완료' : '인증 대기'}</strong>{!user.email_confirmed_at && <button className="link" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api.resendVerification(user.email); setNotice('인증 이메일을 다시 보냈어요.') } catch { setError('메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.') } finally { setBusy(false) } }}>인증 메일 다시 받기</button>}</div>
              <div><span>가입일</span><strong>{new Date(user.created_at).toLocaleDateString('ko-KR')}</strong></div>
            </div>
            <div className="account-actions">
              <p className="photo-save-status" role="status">{photoChanged ? '사진 변경 후 저장을 눌러주세요.' : '저장할 변경사항이 없어요.'}</p>
              <div className="account-action-buttons">
                <button type="button" className="btn ghost" disabled={busy || !photoChanged} onClick={() => { setPhoto(profile?.avatar_image || null); setNotice(''); setError('') }}>변경 취소</button>
                <button type="button" className="btn primary" disabled={busy || !profile || !photoChanged} onClick={savePhoto}>{busy ? '처리 중…' : '사진 저장'}</button>
              </div>
            </div>
          </>}
          {tab === 'password' && <form className="account-password" onSubmit={changePassword}><p>계정을 안전하게 지킬 새 비밀번호를 정해 주세요.</p><label className="field"><span>현재 비밀번호</span><input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required disabled={busy} /></label><label className="field"><span>새 비밀번호</span><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /><small>{PASSWORD_RULE}</small></label><label className="field"><span>새 비밀번호 확인</span><input type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} required disabled={busy} />{repeat && password !== repeat && <small role="status">비밀번호가 일치하지 않아요.</small>}</label><button className="btn primary" disabled={busy || !current || !isValidPassword(password) || password !== repeat}>{busy ? '변경 중…' : '비밀번호 변경'}</button></form>}
          {tab === 'records' && (loadError ? <div className="account-empty"><p>기록을 불러오지 못했어요.</p><button className="btn ghost" onClick={() => setRefresh(v => v + 1)}>다시 불러오기</button></div> : !profile ? <p>러너를 만들고 첫 러닝을 시작해 보세요.</p> : !data ? <p role="status">러닝 기록을 불러오고 있어요…</p> : <><div className="account-stats"><div><span>누적 거리</span><strong>{Number(data.growth.total_distance_km || 0).toFixed(2)}<small> km</small></strong></div><div><span>러닝 횟수</span><strong>{data.growth.run_count || 0}<small> 회</small></strong></div></div><GrowthCard xp={data.growth.xp} />{data.runs.length ? <div className="account-runs">{data.runs.map(run => <article key={run.id}><div><strong>{run.completed ? '완주한 러닝' : '여기까지 달렸어요'}</strong><time>{new Date(run.createdAt).toLocaleDateString('ko-KR')}</time></div><p>{Number(run.distanceKm || 0).toFixed(2)}km · {fmtTime(run.elapsedSec || 0)} · {fmtPace(run.paceSec || 0)}/km</p></article>)}</div> : <div className="account-empty"><LuActivity /><h3>첫 발걸음을 기다리고 있어요</h3><p>러닝을 마치면 이곳에 기록이 쌓여요.</p><button className="btn primary" onClick={() => onNavigate('setup')}>러닝 준비하기</button></div>}</>)}
        </>}
      </section>
    </div>
  </div>
}
