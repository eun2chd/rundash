export default function Logo({ small = false }) {
  return <span className={`brand-mark${small ? ' small' : ''}`} aria-label="Run dash"><span>Run</span> <span className="brand-dash">dash</span></span>
}
