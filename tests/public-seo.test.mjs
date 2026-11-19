import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { renderTopicLinks, renderTopicPage, topicPages } from '../seo/public-pages.mjs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const origin = 'https://www.rundash.run'

test('public topics are discoverable through routing, the sitemap, and real links', () => {
  const { rewrites } = JSON.parse(read('vercel.json'))
  const sitemap = [...read('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)
  const publicPaths = ['/', '/guide', '/terms', '/privacy', ...topicPages.map(page => '/' + page.slug)]
  assert.deepEqual(new Set(sitemap), new Set(publicPaths.map(path => origin + path)))
  assert.equal(sitemap.length, publicPaths.length)
  assert.match(read('public/robots.txt'), /Sitemap: https:\/\/www\.rundash\.run\/sitemap\.xml/)
  const homeLinks = renderTopicLinks()
  const gameGuide = read('public/guide/index.html')
  for (const { slug } of topicPages) {
    assert.ok(rewrites.some(rule => rule.source === '/' + slug && rule.destination === '/' + slug + '/index.html'), slug)
    assert.ok(homeLinks.includes(`href="/${slug}"`), slug)
    assert.ok(gameGuide.includes(`href="/${slug}"`), slug)
  }
})

test('every topic has unique metadata and readable HTML at its canonical URL', () => {
  for (const field of ['slug', 'title', 'description', 'heading']) {
    assert.equal(new Set(topicPages.map(page => page[field])).size, topicPages.length, field)
  }
  for (const page of topicPages) {
    const html = renderTopicPage(page)
    const canonical = origin + '/' + page.slug
    assert.equal((html.match(/<h1>/g) || []).length, 1, page.slug)
    assert.ok(html.includes('<h1>' + page.heading + '</h1>'), page.slug)
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`), page.slug)
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`), page.slug)
    assert.ok(html.includes(`href="/${page.slug}" aria-current="page"`), page.slug)
    assert.ok(page.sections.length >= 2, page.slug)
    assert.ok(page.sections.every(section => (section.paragraphs?.length || section.items?.length) && html.includes(section.heading)), page.slug)
    assert.equal(html.includes('src="/pomodoro.js"'), page.slug === 'pomodoro-timer')
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])
    assert.equal(schema.url, canonical)
    assert.equal(schema.name, page.heading)
  }
})
