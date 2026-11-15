import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static pages live in public/<name>/index.html. Mirror the vercel.json rewrites
// locally so /privacy, /terms and /guide don't fall through to the SPA.
const STATIC_PAGES = ['/privacy', '/terms', '/guide']
const rewriteStatic = (req, _res, next) => {
  const [rawPath, query] = req.url.split('?')
  const path = rawPath.replace(/\/$/, '')
  if (STATIC_PAGES.includes(path)) req.url = `${path}/index.html${query ? `?${query}` : ''}`
  next()
}
const staticPages = {
  name: 'static-pages',
  configureServer(server) { server.middlewares.use(rewriteStatic) },
  configurePreviewServer(server) { server.middlewares.use(rewriteStatic) },
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
