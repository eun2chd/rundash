import { LuFootprints } from 'react-icons/lu'

export default function Loading({ text = '러닝 코스를 준비하고 있어요.', sub, progress }) {
  return (
    <div className="loading-screen">
      <div className="loading-icon">
        <LuFootprints size={30} />
      </div>
      <h1 className="loading-title">런 대 시</h1>
      <p className="loading-text">{text}</p>
      <div className="loading-bar"><div style={{ width: progress != null ? `${progress}%` : undefined }} className={progress == null ? 'indeterminate' : ''} /></div>
      {sub && <p className="loading-sub">{sub}</p>}
    </div>
  )
}
