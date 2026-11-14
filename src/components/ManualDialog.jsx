import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuBookOpen } from 'react-icons/lu'

export default function ManualDialog({ onClose }) {
  const ref = useRef(null)
  const close = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const element = ref.current
    element.showModal(); close.current?.focus()
    return () => { element.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(<dialog ref={ref} className="manual-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header className="manual-heading"><div><span className="eyebrow">RUN DASH FIELD GUIDE</span><h2 id={titleId}><LuBookOpen /> 러너 매뉴얼</h2></div><button type="button" ref={close} className="icon-btn" aria-label="매뉴얼 닫기" onClick={onClose}><LuX /></button></header>
    <div className="manual-body">
      <p className="manual-lead">나는 나의 일을, 러너는 나만의 페이스로.<br />조작에 참여하면 점수를 더 얻고, 달린 거리만큼 러너가 성장해요.</p>
      <section><span className="eyebrow">01 · RHYTHM</span><h3>리듬 러닝은 어떻게 하나요?</h3><p>바 안의 커서가 <b>중앙 초록 구간</b>을 지날 때 <kbd>Space</kbd> 또는 리듬 바의 터치 버튼을 눌러요. 중앙의 밝은 구간은 PERFECT, 바깥 초록 구간은 GOOD예요. 한 번 지나갈 때 한 번만 판정합니다.</p><div className="manual-callout"><b>PERFECT +5pt · GOOD +2pt</b><span>연속 성공하면 콤보가 쌓여요. 아이템 점수는 콤보당 10% 증가하고, 10콤보부터 최대 2배예요.</span></div><p>MISS는 콤보만 초기화하고 체력은 깎지 않아요. 리듬을 하지 않아도 러너는 계속 달려요. 점수(pt)는 성장 경험치(XP)와 별개라서 리듬으로 레벨이 바로 오르지는 않아요.</p></section>
      <section><span className="eyebrow">02 · AID STATION</span><h3>보급소에서 체력을 채우려면?</h3><p>첫 보급소는 <b>600m</b> 지점, 이후 <b>1km마다</b> 나와요. 보급소 <b>40m 전부터 8m 지난 지점까지</b> 보급을 받을 수 있어요. 가까워지면 왼쪽에 보급 선택 박스가 나타납니다.</p><div className="manual-two-columns"><div><b>물 · 체력 +15</b><p>보급소마다 2개. 물 버튼 또는 테이블 위 물병을 클릭해요.</p></div><div><b>탄수화물 젤 · 체력 +25</b><p>보급소마다 1개. 젤 버튼 또는 테이블 위 젤을 클릭해요.</p></div></div><p><kbd>E</kbd>로 가까운 보급품을 하나씩 챙길 수도 있어요. 체력은 최대치를 넘지 않아요. 구간을 지나치면 남은 물품은 사라지고, 탈진 회복 중에는 챙길 수 없어요.</p></section>
      <section><span className="eyebrow">03 · STAMINA & BOOST</span><h3>체력과 부스터</h3><p>빠른 강도로 달릴수록 체력이 더 줄어요. 체력이 낮으면 느려지고, 0이 되면 멈춰서 회복합니다. 회복 후 최대 체력의 40%로 다시 출발해요.</p><p><b>Lv.5에서 부스터 해금.</b> 버튼 또는 <kbd>B</kbd>로 체력 12를 소비해 속도를 50% 높여요. Lv.5는 8초, Lv.20은 12초, Lv.30은 15초 동안 지속됩니다. 종료 후 90초 재충전하며 체력 12 이하·일시정지·탈진 중에는 쓸 수 없어요.</p></section>
      <section><span className="eyebrow">04 · GROWTH</span><h3>경험치와 러닝 강도</h3><p>가볍게·꾸준히·도전하기 중 하나를 선택해요. 레벨이 오르면 같은 강도에서도 페이스가 빨라지고, 최대 체력과 회복력이 좋아집니다.</p><p><b>1km당 100 XP + 완주 시 거리 XP의 20%</b>를 받아요. 중간 종료도 달린 거리만큼 XP를 받아요. 다음 해금 보상은 러닝 설정과 결과 화면에서 확인할 수 있어요.</p><p>정식 계정은 러너·기록·성장이 저장돼요. 익명 체험은 새로고침하면 초기화되고 XP는 저장되지 않아요.{import.meta.env.DEV && ' 개발용 배속을 한 번이라도 사용한 러닝은 XP가 지급되지 않아요.'}</p></section>
      <section><span className="eyebrow">05 · TOGETHER</span><h3>구름 말풍선과 실시간 채팅</h3><p>러닝 설정에서 현재 활동을 고르면 머리 오른쪽 구름에 표시돼요. 구름 버튼으로 언제든 보이거나 숨길 수 있어요.</p><p>오른쪽 ‘러너 라운지’는 실제 접속한 러너들이 함께 쓰는 채팅방이에요. <kbd>Enter</kbd>로 메시지를 보내며 최대 300자, 2초 간격으로 보낼 수 있어요. 채팅을 숨겨도 접속은 유지돼요. 접속 인원은 같은 계정을 중복 계산하지 않고, 일시정지한 러너는 ‘달리는 중’ 인원에서 빠져요. 코스의 연습 러너는 접속 인원에 포함하지 않아요.</p></section>
      <section><span className="eyebrow">06 · CONTROLS</span><h3>조작 한눈에 보기</h3><div className="manual-keys"><span><kbd>Space</kbd> 리듬 판정</span><span><kbd>E</kbd> 가까운 아이템</span><span><kbd>B</kbd> 부스터</span><span><kbd>C</kbd> 근처 연습 러너 응원</span><span><kbd>P</kbd> 일시정지 / 계속</span><span><kbd>Enter</kbd> 채팅 전송</span></div><p>채팅 입력 중에는 게임 단축키가 작동하지 않아요. 매뉴얼과 종료 확인창을 열면 러닝은 잠시 멈춰요. 종료·메뉴 이동은 확인 후 진행합니다.</p></section>
    </div>
    <footer className="manual-footer"><button type="button" className="btn primary" onClick={onClose}>알겠어요, 계속하기</button></footer>
  </dialog>, document.body)
}
