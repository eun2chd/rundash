import { useState } from 'react'
import { api } from '../lib/api'
import CharacterPreview from '../components/CharacterPreview'

const SHIRTS = ['#f08a5d', '#e8c547', '#8cc56b', '#6fb7d6', '#a993d6', '#e98fb0', '#f4f1e8', '#5d6b4a']
const SKINS = ['#fbe0c7', '#f6d1b0', '#e8b98f', '#c98f62', '#8d5a3b']
const HAIRS = [null, '#2b2420', '#6b4a2f', '#c9a063', '#8f8f8f']

const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,10}$/

export default function CharacterCreate({ user, initial, onDone }) {
  const [nickname, setNickname] = useState(initial?.nickname || '')
  const [color, setColor] = useState(initial?.color || SHIRTS[0])
  const [skin, setSkin] = useState(initial?.skin || SKINS[1])
  const [hair, setHair] = useState(initial ? initial.hair ?? null : null)
  const [revealed, setRevealed] = useState(!!initial)
  const [popKey, setPopKey] = useState(0)
  const [status, setStatus] = useState('idle')
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(null)

  const valid = NICK_RE.test(nickname)

  const create = async (e) => {
    e.preventDefault()
    if (!valid) return setErr('2~10자, 한글/영문/숫자/_ 만 쓸 수 있어요.')
    setErr('')
    setStatus('checking')
    if (await api.isNicknameTaken(nickname, user.id)) {
      setStatus('idle')
      return setErr('이미 사용 중인 닉네임이에요.')
    }
    const p = await api.saveProfile({ userId: user.id, nickname, color, skin, hair })
    setRevealed(true)
    setPopKey((k) => k + 1)
    setSaved(p)
    setStatus('done')
  }

  return (
    <div className="create-screen">
      <div className="create-stage">
        <CharacterPreview color={color} skin={skin} hair={hair} nickname={nickname} revealed={revealed} popKey={popKey} />
        <div className="stage-caption">
          {status === 'done' ? (
            <><b>{nickname}</b> 캐릭터가 생성됐어요!</>
          ) : revealed ? (
            '캐릭터를 수정하고 있어요'
          ) : (
            '닉네임을 정하면 캐릭터가 깨어나요'
          )}
        </div>
      </div>

      <form className="card create-card" onSubmit={create}>
        <div className="eyebrow">STEP 1</div>
        <h2>{initial ? '캐릭터 수정' : '나의 러너 만들기'}</h2>

        <label className="field">
          <span>닉네임</span>
          <input
            value={nickname}
            maxLength={10}
            onChange={(e) => { setNickname(e.target.value.trim()); setStatus((s) => (s === 'done' ? 'idle' : s)) }}
            placeholder="2~10자"
            autoFocus
          />
          <small className={nickname && !valid ? 'warn' : ''}>{nickname.length}/10 · 한글 · 영문 · 숫자 · _</small>
        </label>

        <div className="field">
          <span>러닝복</span>
          <div className="swatches">
            {SHIRTS.map((c) => (
              <button type="button" key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="field">
          <span>피부톤</span>
          <div className="swatches">
            {SKINS.map((c) => (
              <button type="button" key={c} className={`swatch ${skin === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setSkin(c)} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="field">
          <span>머리</span>
          <div className="swatches">
            {HAIRS.map((c) => (
              <button type="button" key={c ?? 'none'} className={`swatch ${hair === c ? 'on' : ''} ${c ? '' : 'none'}`} style={{ background: c ?? 'transparent' }} onClick={() => setHair(c)} aria-label={c ?? '없음'}>
                {c ? '' : '없음'}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="error">{err}</p>}

        {status === 'done' ? (
          <button type="button" className="btn primary block" onClick={() => onDone(saved)}>러닝 설정으로 →</button>
        ) : (
          <button className="btn primary block" disabled={!nickname || status === 'checking'}>
            {status === 'checking' ? '닉네임 확인 중…' : initial ? '저장하기' : '캐릭터 생성'}
          </button>
        )}
      </form>
    </div>
  )
}
