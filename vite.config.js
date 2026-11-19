import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { renderTopicLinks, renderTopicPage, topicPages } from './seo/public-pages.mjs'

// Mirror the clean URLs in vercel.json. The topic pages are generated at build time.
const topics = new Map(topicPages.map(page => ['/' + page.slug, page]))
const staticPaths = new Set(['/privacy', '/terms', '/guide', ...topics.keys()])
const rewriteStatic = (req, _res, next) => {
  const [rawPath, query] = req.url.split('?')
  const path = rawPath.replace(/\/$/, '')
  if (staticPaths.has(path)) req.url = `${path}/index.html${query ? `?${query}` : ''}`
  next()
}
const serveTopic = (req, res, next) => {
  const [path] = req.url.split('?')
  const topic = topics.get(path.replace(/(?:\/index\.html|\/)$/, ''))
  if (topic && (req.method === 'GET' || req.method === 'HEAD')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(req.method === 'HEAD' ? undefined : renderTopicPage(topic))
    return
  }
  next()
}
const staticPages = {
  name: 'static-pages',
  configureServer(server) {
    server.middlewares.use(serveTopic)
    server.middlewares.use(rewriteStatic)
  },
  configurePreviewServer(server) { server.middlewares.use(rewriteStatic) },
  transformIndexHtml(html) { return html.replace('<!-- PUBLIC_TOPIC_LINKS -->', renderTopicLinks()) },
  generateBundle() {
    for (const topic of topicPages) {
      this.emitFile({ type: 'asset', fileName: `${topic.slug}/index.html`, source: renderTopicPage(topic) })
    }
  },
}

// Vendor code changes far less often than app code, so give it stable chunks that stay
// cached across deploys. The 3D stack is only fetched once a runner screen is needed.
const VENDOR_CHUNKS = [
  ['vendor-3d', /node_modules\/(three|three-stdlib|@react-three|react-reconciler|its-fine|react-use-measure|suspend-react|zustand)\//],
  ['vendor-supabase', /node_modules\/(@supabase|iceberg-js|tslib)\//],
  ['vendor-react', /node_modules\/(react|react-dom|scheduler)\//],
]

export default defineConfig({
  plugins: [react(), staticPages],
  appType: 'mpa',
  server: { port: 5173, open: true },
  build: {
    chunkSizeWarningLimit: 900, // three.js alone is ~680 kB minified; it loads lazily.
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/')
          // The entry needs Vite's preload helper; left unassigned, Rollup folds it into
          // vendor-3d and the entry would then preload the whole 3D stack.
          if (normalized.includes('vite/preload-helper')) return 'vendor-react'
          return VENDOR_CHUNKS.find(([, pattern]) => pattern.test(normalized))?.[0]
        },
      },
    },
  },
})
