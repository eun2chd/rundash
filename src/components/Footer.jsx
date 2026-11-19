import { topicGroups } from '../../seo/navigation.mjs'

// Static pages open in a new tab so the running app and its unsaved state stay put.
export default function Footer() {
  return <footer className="site-footer"><div className="site-footer-inner">
    <nav className="topic-links" aria-label="주제별 가이드">
      {topicGroups.map(({ label, links }) => <div className="topic-link-group" key={label}>
        <span className="topic-link-label">{label}</span>
        <ul>{links.map(([slug, name]) => <li key={slug}><a href={`/${slug}`} target="_blank" rel="noopener">{name}</a></li>)}</ul>
      </div>)}
    </nav>
    <nav className="site-footer-links" aria-label="안내 문서">
      <a href="/guide" target="_blank" rel="noopener">게임 가이드</a>
      <a href="/terms" target="_blank" rel="noopener">이용약관</a>
      <a href="/privacy" target="_blank" rel="noopener"><b>개인정보처리방침</b></a>
      <a href="mailto:rundashplus@gmail.com">이메일 문의</a>
    </nav>
    <p>Run dash 운영팀 · rundashplus@gmail.com</p>
    <p>배경음악 「Leafy Trail」은 Google Gemini로 생성했어요.</p>
    <p>© 2026 Run dash</p>
  </div></footer>
}
