import { useState } from 'react'
import Modal from 'react-modal'
import { LuX } from 'react-icons/lu'
import { ACTIVITIES, ACTIVITY_GROUPS, getActivity } from '../lib/activities'
import ActivityBubble from './ActivityBubble'

// Status bubble picker: what I am doing while my runner runs, shown as a cloud above the runner.
// Changes apply as they are picked; the footer only closes the dialog.
export default function ActivityDialog({ activity = 'rest', visible = true, onChange, onClose }) {
  const [group, setGroup] = useState(() => getActivity(activity).group)
  return <Modal isOpen onRequestClose={onClose} appElement={document.getElementById('root')}
    className="activity-modal" overlayClassName="app-modal-overlay" bodyOpenClassName="app-modal-open"
    aria={{ labelledby: 'activity-dialog-title' }}>
    <header className="activity-modal-header"><h2 id="activity-dialog-title">내 상태 말풍선</h2><button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}><LuX /></button></header>
    <div className="activity-modal-body activity-picker">
      <p>러너가 달리는 동안 지금 내가 무엇을 하는지 구름 말풍선으로 띄워요.</p>
      <button type="button" className="chip activity-visibility" aria-pressed={visible} onClick={() => onChange({ showActivity: !visible })}>{visible ? '구름 말풍선 숨기기' : '구름 말풍선 보이기'}</button>
      <div className="activity-groups" aria-label="활동 카테고리">{ACTIVITY_GROUPS.map((item) => <button type="button" key={item.id} className={`activity-group ${group === item.id ? 'on' : ''}`} aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>{item.label}</button>)}</div>
      <div className="activity-options">
        {ACTIVITIES.filter((item) => item.group === group).map((item) => <button type="button" key={item.id} className={`activity-option ${activity === item.id ? 'on' : ''}`} aria-pressed={activity === item.id} onClick={() => onChange({ activity: item.id })}>{item.label}<span aria-hidden="true">{activity === item.id ? '✓' : '+'}</span></button>)}
      </div>
      {visible && <div className="activity-sample"><ActivityBubble activity={activity} /></div>}
    </div>
    <footer className="activity-modal-footer"><button type="button" className="btn primary" onClick={onClose}>완료</button></footer>
  </Modal>
}
