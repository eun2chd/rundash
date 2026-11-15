// Legal pages open in a new tab so the running app and its unsaved state stay put.
export default function Footer() {
  return <footer className="site-footer"><div className="site-footer-inner">
    <nav className="site-footer-links" aria-label="정책 문서">
      <a href="/terms" target="_blank" rel="noopener">이용약관</a>
      <a href="/privacy" target="_blank" rel="noopener"><b>개인정보처리방침</b></a>
      <a href="mailto:rundashplus@gmail.com">이메일 문의</a>
    </nav>
    <p>Run dash 운영팀 · rundashplus@gmail.com</p>
    <p>© 2026 Run dash</p>
  </div></footer>
}
