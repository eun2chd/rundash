import { runningTopics } from './running-topics.mjs'
import { focusTopics } from './focus-topics.mjs'
import { topicGroups } from './navigation.mjs'

const origin = 'https://www.rundash.run'
const shareImage = origin + '/thumbnail.jpg'
const bySlug = new Map([...runningTopics, ...focusTopics].map(topic => [topic.slug, topic]))
const labels = new Map(topicGroups.flatMap(group => group.links))
export const topicPages = Array.from(labels.keys(), slug => bySlug.get(slug))

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = value => value.replace(/[&<>"']/g, character => entities[character])

export function renderTopicLinks(currentSlug) {
  const groups = topicGroups.map(({ label, links }) => `
    <div class="topic-link-group">
      <span class="topic-link-label">${escapeHtml(label)}</span>
      <ul>${links.map(([slug, name]) => `<li><a href="/${slug}"${slug === currentSlug ? ' aria-current="page"' : ''}>${escapeHtml(name)}</a></li>`).join('')}</ul>
    </div>`).join('')
  return `<nav class="topic-links" aria-label="주제별 가이드">${groups}</nav>`
}

function renderSection({ heading, paragraphs = [], items, ordered }) {
  const listTag = ordered ? 'ol' : 'ul'
  return `<section>
      <h2>${escapeHtml(heading)}</h2>
      ${paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      ${items ? `<${listTag}>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</${listTag}>` : ''}
    </section>`
}

function renderTimer() {
  return `<section class="pomodoro" aria-label="온라인 집중 타이머" data-pomodoro>
      <div class="pomodoro-modes" role="group" aria-label="시간 모드">
        <button type="button" data-mode="focus" data-minutes="25" aria-pressed="true" disabled>집중 25분</button>
        <button type="button" data-mode="short" data-minutes="5" aria-pressed="false" disabled>짧은 휴식 5분</button>
        <button type="button" data-mode="long" data-minutes="15" aria-pressed="false" disabled>긴 휴식 15분</button>
      </div>
      <div class="pomodoro-clock" role="timer" aria-label="남은 시간" data-time>25:00</div>
      <div class="pomodoro-actions">
        <button type="button" data-toggle disabled>시작</button>
        <button type="button" data-reset disabled>초기화</button>
      </div>
      <p class="pomodoro-count" data-count>완료한 집중 0회</p>
      <p class="pomodoro-status" role="status" data-status></p>
      <noscript><p>타이머를 사용하려면 자바스크립트를 켜 주세요.</p></noscript>
    </section>`
}

export function renderTopicPage(topic) {
  const { slug, title, heading, description, intro, sections, related, sources = [] } = topic
  const canonical = `${origin}/${slug}`
  const isTimer = slug === 'pomodoro-timer'
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: heading,
    description,
    url: canonical,
    inLanguage: 'ko-KR',
    isPartOf: { '@type': 'WebSite', name: 'Run dash 런대시', url: origin + '/' },
  }).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#efebe3">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="${isTimer ? 'website' : 'article'}">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="Run dash 런대시">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${shareImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="628">
  <meta property="og:image:alt" content="공원 트랙을 함께 달리는 Run dash 캐릭터">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${shareImage}">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="/legal.css">
  <link rel="stylesheet" href="/topics.css">
  <script type="application/ld+json">${schema}</script>
  ${isTimer ? '<script type="module" src="/pomodoro.js"></script>' : ''}
</head>
<body class="topic-page">
  <header class="legal-header"><div class="legal-header-inner">
    <a class="legal-home" href="/">Run dash</a>
    <nav class="legal-nav" aria-label="사이트 메뉴"><a href="/guide">게임 가이드</a><a href="/">게임 시작</a></nav>
  </div></header>
  ${renderTopicLinks(slug)}
  <main class="legal-doc topic-doc">
    <h1>${escapeHtml(heading)}</h1>
    <p class="topic-intro">${escapeHtml(intro)}</p>
    ${isTimer ? renderTimer() : ''}
    ${sections.map(renderSection).join('\n')}
    ${sources.length ? `<section class="topic-sources"><h2>참고 자료</h2><ul>${sources.map(({ label, url }) => `<li><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></li>`).join('')}</ul></section>` : ''}
    <nav class="topic-related" aria-labelledby="related-heading">
      <h2 id="related-heading">이어 읽기</h2>
      <ul>${related.map(id => `<li><a href="/${id}">${escapeHtml(labels.get(id))}</a></li>`).join('')}</ul>
    </nav>
  </main>
  <footer class="legal-footer"><nav class="legal-nav" aria-label="정책 문서"><a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a></nav></footer>
</body>
</html>
`
}
