import { useState } from 'react'
import { api } from '../lib/api'
import CharacterPreview from '../components/CharacterPreview'
import { randomNickname } from '../lib/nickname'
import { normalizeOutfit } from '../lib/outfit'
import Wardrobe from '../components/Wardrobe'

const SKINS = ['#fbe0c7', '#f6d1b0', '#e8b98f', '#c98f62', '#8d5a3b']
const HAIRS = [null, '#2b2420', '#6b4a2f', '#c9a063', '#8f8f8f']

const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,10}$/

export default function CharacterCreate({ user, initial, onDone }) {
  const [nickname, setNickname] = useState(() => initial?.nickname || (user.is_anonymous ? randomNickname() : user.user_metadata?.nickname || ''))
  const [color, setColor] = useState(initial?.color || '#f08a5d')
  const [outfit, setOutfit] = useState(() => normalizeOutfit(initial?.outfit))
  const [previewRunning, setPreviewRunning] = useState(true)
  const [skin, setSkin] = useState(initial?.skin || SKINS[1])
  const [hair, setHair] = useState(initial ? initial.hair ?? null : null)
  const [revealed, setRevealed] = useState(!!initial)
  const [popKey, setPopKey] = useState(0)
  const [status, setStatus] = useState('idle')
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(null)
  const [generatedNickname, setGeneratedNickname] = useState(user.is_anonymous && !initial)
  const editStyle = (setter, value) => {
    setter(value)
    setStatus('idle')
    setSaved(null)
    setErr('')
  }

  const changeNickname = (value, generated = false) => {
    setNickname(value)
    setGeneratedNickname(generated)
    setStatus('idle')
    setSaved(null)
    setErr('')
  }

  const valid = NICK_RE.test(nickname)

  const create = async (e) => {
    e.preventDefault()
    if (status === 'checking') return
    if (!valid) return setErr('2~10자, 한글/영문/숫자/_ 만 쓸 수 있어요.')
    setErr('')
    setStatus('checking')
    try {
    let candidate = nickname
    let p
    const autoRetry = user.is_anonymous && generatedNickname
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await api.isNicknameTaken(candidate)) {
        if (!autoRetry) throw new Error('이미 사용 중인 닉네임이에요.')
      } else {
        try {
          const runner = { userId: user.id, nickname: candidate, color, skin, hair, outfit }
          p = user.is_anonymous ? runner : await api.saveProfile(runner)
          break
        } catch (error) {
          if (!autoRetry || error.code !== '23505') throw error
        }
      }
      candidate = randomNickname()
      setNickname(candidate)
    }
    if (!p) throw new Error('닉네임을 생성하지 못했어요. 다시 시도해 주세요.')
    setNickname(p.nickname)
    setRevealed(true)
    setPopKey((k) => k + 1)
    setSaved(p)
    setStatus('done')
    } catch (error) {
      setErr(error.message || '저장하지 못했어요. 다시 시도해 주세요.')
      setStatus('idle')
    }
  }

  return (
    <div className="create-screen wardrobe-screen">
      <div className="create-stage">
        <div className="studio-heading"><span>RUNNER STUDIO</span><span>360° LIVE PREVIEW</span></div>
        <CharacterPreview color={color} skin={skin} hair={hair} outfit={outfit} nickname={nickname} revealed popKey={popKey} running={previewRunning} />
        <div className="studio-controls"><button type="button" className={`chip ${!previewRunning ? 'on' : ''}`} aria-pressed={!previewRunning} onClick={() => setPreviewRunning(false)}>서 있기</button><button type="button" className={`chip ${previewRunning ? 'on' : ''}`} aria-pressed={previewRunning} onClick={() => setPreviewRunning(true)}>달리기</button></div>
        <div className="stage-caption">
            {status === 'done' ? (
            <><b>{nickname}</b> 캐릭터가 생성됐어요!</>
          ) : revealed ? (
            '캐릭터를 수정하고 있어요'
          ) : (
            '장비를 골라 나만의 러너를 완성해요'
          )}
        </div>
      </div>

      <form className="card create-card" onSubmit={create}>
        <div className="eyebrow">STEP 1</div>
        <h2>{initial ? '나의 러너 스타일링' : '나의 러너 만들기'}</h2>
        <p className="studio-intro">머리부터 발끝까지, 나만의 페이스를 입혀보세요.</p>
        {user.is_anonymous && <p className="runner-storage-note">익명 체험 · 러너는 저장되지 않으며 새로고침하면 초기화돼요.</p>}

        <div className="field">
          <label htmlFor="character-nickname">닉네임</label>
          <div className="nickname-check-row">
          <input
            id="character-nickname"
            value={nickname}
            maxLength={10}
            readOnly={!user.is_anonymous}
            disabled={status === 'checking'}
            onChange={(e) => changeNickname(e.target.value.trim())}
            aria-describedby="character-nickname-help"
            placeholder="2~10자"
          />
          {user.is_anonymous && <button type="button" className="btn ghost" disabled={status === 'checking'} onClick={() => {
            let next = randomNickname()
            while (next === nickname) next = randomNickname()
            changeNickname(next, true)
          }}>랜덤 닉네임</button>}
          </div>
          <small id="character-nickname-help" className={nickname && !valid ? 'warn' : ''}>{user.is_anonymous ? '직접 입력하거나 랜덤으로 정해보세요. 2~10자 · 한글, 영문, 숫자, _' : '가입한 계정의 닉네임이에요. 이 화면에서는 변경할 수 없어요.'}</small>
        </div>

        <Wardrobe outfit={outfit} color={color} onChange={(value) => editStyle(setOutfit, value)} onColor={(value) => editStyle(setColor, value)} disabled={status === 'checking'} />
        <div className="appearance-fields">
        <div className="field">
          <span>피부톤</span>
          <div className="swatches">
            {SKINS.map((c) => (
              <button type="button" key={c} className={`swatch ${skin === c ? 'on' : ''}`} style={{ background: c }} disabled={status === 'checking'} onClick={() => editStyle(setSkin, c)} aria-pressed={skin === c} aria-label={`피부톤 ${c}`} />
            ))}
          </div>
        </div>
        <div className="field">
          <span>머리</span>
          <div className="swatches">
            {HAIRS.map((c) => (
              <button type="button" key={c ?? 'none'} className={`swatch ${hair === c ? 'on' : ''} ${c ? '' : 'none'}`} style={{ background: c ?? 'transparent' }} disabled={status === 'checking'} onClick={() => editStyle(setHair, c)} aria-pressed={hair === c} aria-label={`머리 ${c ?? '없음'}`}>
                {c ? '' : '없음'}
              </button>
            ))}
          </div>
        </div>
        </div>

        {err && <p className="error">{err}</p>}

        {status === 'done' ? (
          <button type="button" className="btn primary block" onClick={() => onDone(saved)}>러닝 설정으로 →</button>
        ) : (
          <button className="btn primary block" disabled={!valid || status === 'checking'}>
            {status === 'checking' ? '닉네임 확인 중…' : initial ? '저장하기' : '캐릭터 생성'}
          </button>
        )}
      </form>
    </div>
  )
}
