import { getActivity } from '../lib/activities'

export default function ActivityBubble({ activity }) {
  return <div className="activity-bubble" aria-label={`현재 상태: ${getActivity(activity).status}`}>
    <svg viewBox="0 0 200 90" aria-hidden="true"><path d="M36 66C8 66 5 33 30 27C30 5 65 1 77 17C89-2 123 0 133 19C156 7 178 19 178 35C204 43 194 68 172 68H36Z" /><circle cx="49" cy="77" r="6" /><circle cx="38" cy="87" r="3" /></svg>
    <span><span className="activity-dots" aria-hidden="true">···</span> {getActivity(activity).status}</span>
  </div>
}
