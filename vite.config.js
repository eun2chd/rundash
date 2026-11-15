import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static legal pages live in public/<name>/index.html. Mirror the vercel.json rewrites
// locally so /privacy and /terms don't fall through to the SPA.
const LEGAL_PAGES = ['/privacy', '/terms']
const rewriteLegal = (req, _res, next) => {
  const [rawPath, query] = req.url.split('?')
  const path = rawPath.replace(/\/$/, '')
  if (LEGAL_PAGES.includes(path)) req.url = `${path}/index.html${query ? `?${query}` : ''}`
  next()
}
const legalPages = {
  name: 'legal-pages',
  configureServer(server) { server.middlewares.use(rewriteLegal) },
  configurePreviewServer(server) { server.middlewares.use(rewriteLegal) },
}

export default defineConfig({
  plugins: [react(), legalPages],
  server: { port: 5173, open: true },
})
