import Logo from './Logo'

export default function Header({ user, profile, screen, onNavigate, onLogout, onHelp }) {
  const busy = ['loading', 'saving', 'reset-password'].includes(screen)
  const home = user ? (profile ? 'setup' : 'character') : 'login'
  const item = (target, label, disabled = false) => <button type="button" className={`header-link${screen === target ? ' active' : ''}`} aria-current={screen === target ? 'page' : undefined} disabled={busy || disabled} onClick={() => onNavigate(target)}>{label}</button>
  return <header className="site-header"><div className="site-header-inner">
    <button type="button" className="header-logo" aria-label="Run dash 홈" disabled={busy} onClick={() => onNavigate(home)}><Logo small /></button>
    <nav className="header-nav" aria-label="공통 메뉴">
      {user ? <>
        {item('setup', '러닝', !profile)}
        {item('character', '캐릭터')}
        <span className="header-user">{profile?.nickname || user.user_metadata?.nickname || (user.is_anonymous ? '익명 러너' : '러너')}</span>
        <button type="button" className="header-link" disabled={busy} onClick={onLogout}>로그아웃</button>
      </> : <>{item('login', '로그인')}{item('signup', '회원가입')}</>}
      <button type="button" className="manual-trigger" aria-label="러닝 매뉴얼 열기" title="러닝 매뉴얼" disabled={busy} onClick={onHelp}>?</button>
    </nav>
  </div></header>
}
