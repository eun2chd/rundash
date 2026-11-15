import { LuFootprints } from 'react-icons/lu'
import Logo from './Logo'

// `overlay` covers the current screen while a request runs; it fades in after a short
// delay so fast responses don't flash.
export default function Loading({ text = '러닝 코스를 준비하고 있어요.', sub, progress, overlay = false }) {
  return (
    <div className={`loading-screen${overlay ? ' loading-overlay' : ''}`} role="status" aria-live="polite">
      <div className="loading-icon">
        <LuFootprints size={30} />
      </div>
      <h1 className="loading-title"><Logo /></h1>
      <p className="loading-text">{text}</p>
      <div className="loading-bar"><div style={{ width: progress != null ? `${progress}%` : undefined }} className={progress == null ? 'indeterminate' : ''} /></div>
      {sub && <p className="loading-sub">{sub}</p>}
    </div>
  )
}
