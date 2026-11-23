import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { homeHtml, legalHtml, privacyPolicy, termsOfService, type LegalSettings } from './src/lib/legal'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Two surfaces from one codebase, deployed as two Vercel projects on the same Supabase backend:
//   default mode -> the public site, students, hotels and riders (campus.waren.digital)
//   --mode admin -> the platform administrator portal only (admin.waren.digital, behind Cloudflare Access)

const SITE = 'https://campus.waren.digital'
/** Public pages for search engines (everything else is noindex in the app). */
const SITEMAP_PAGES: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/menu', priority: '0.9', changefreq: 'hourly' },
  { path: '/deals', priority: '0.8', changefreq: 'daily' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
]

/**
 * Search engines: the public site gets robots.txt and sitemap.xml; the admin portal gets a noindex page head and a
 * robots.txt that blocks everything, so it never appears in search results.
 */
function searchEngines(mode: string): Plugin {
  const admin = mode === 'admin'
  return {
    name: 'campus-search-engines',
    transformIndexHtml(html) {
      if (!admin) return html
      return html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/,
        '<title>Campus Food Admin</title>\n    <meta name="robots" content="noindex, nofollow, noarchive" />')
    },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset', fileName: 'robots.txt',
        source: admin
          ? 'User-agent: *\nDisallow: /\n'
          : `User-agent: *\nAllow: /\nDisallow: /r/\nDisallow: /cart\nDisallow: /account\nDisallow: /orders\nDisallow: /hotel\nDisallow: /rider\nDisallow: /login\nDisallow: /register\n\nSitemap: ${SITE}/sitemap.xml\n`,
      })
      if (!admin) {
        this.emitFile({
          type: 'asset', fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SITEMAP_PAGES.map((p) =>
            `  <url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join('\n')}\n</urlset>\n`,
        })
      }
    },
  }
}

/**
 * Home, privacy and terms as real HTML: Google's OAuth verification (and other crawlers) read the home page, /privacy and /terms without running
 * JavaScript, so the site build writes privacy.html and terms.html: the normal app page with the full text already
 * inside #root (the app replaces it on start). The fee, refund window and contact come from the live settings at
 * build time, falling back to the defaults if Supabase cannot be reached.
 */
function legalPages(mode: string): Plugin {
  let outDir = 'dist'
  return {
    name: 'campus-legal-pages',
    apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir) },
    async writeBundle() {
      if (mode === 'admin') return
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const settings: LegalSettings = { supportEmail: null, supportPhone: null, platformFee: 20, refundWindowMinutes: 5, draftLifetimeMinutes: 120 }
      try {
        if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
          const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/platformSettings?select=supportEmail,supportPhone,platformFee,refundWindowMinutes,draftLifetimeMinutes&limit=1`,
            { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }, signal: AbortSignal.timeout(8000) })
          const [row] = res.ok ? await res.json() as Partial<LegalSettings>[] : []
          if (row) Object.assign(settings, { ...row, platformFee: Number(row.platformFee ?? settings.platformFee) })
        }
      } catch { /* offline build: keep the defaults */ }
      const shell = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      // Every other route gets the empty app shell (vercel.json rewrites to /app); the home page carries readable text.
      writeFileSync(resolve(outDir, 'app.html'), shell)
      const home = shell.replace('<div id="root"></div>', `<div id="root">${homeHtml(settings)}</div>`)
      if (home === shell) throw new Error('legal pages: could not place the home text in index.html')
      writeFileSync(resolve(outDir, 'index.html'), home)
      for (const [file, path, doc] of [['privacy.html', '/privacy', privacyPolicy(settings)], ['terms.html', '/terms', termsOfService(settings)]] as const) {
        const title = `${doc.title} · Campus Food`
        const page = shell
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
          .replace(/(<meta name="description" content=")[^"]*(")/, `$1${doc.description}$2`)
          .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
          .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${doc.description}$2`)
          .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${SITE}${path}$2`)
          .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${SITE}${path}$2`)
          .replace('<div id="root"></div>', `<div id="root">${legalHtml(doc)}</div>`)
        if (!page.includes('id="root"><main')) throw new Error(`legal pages: could not place the text in ${file}`)
        writeFileSync(resolve(outDir, file), page)
      }
    },
  }
}

/** The site-wide headers from vercel.json (one source of truth for production and local preview). */
function vercelHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
  return Object.fromEntries((config.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]))
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), searchEngines(mode), legalPages(mode)],
  define: { __SURFACE__: JSON.stringify(mode === 'admin' ? 'admin' : 'site') },
  server: { port: mode === 'admin' ? 5181 : 5180, strictPort: true },
  // `vite preview` serves the build with the same security headers as Vercel, so the CSP can be tested locally.
  preview: { headers: vercelHeaders() },
  build: {
    sourcemap: false,
    // The ElevenLabs voice client (~620 kB) is loaded only when someone taps Call now, never on first visit.
    chunkSizeWarningLimit: 700,
    outDir: mode === 'admin' ? 'dist-admin' : 'dist',
    // Long-lived library chunks: they change rarely, so returning visitors keep them cached across releases.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (id.includes('@supabase')) return 'supabase'
          if (/[\\/]zod[\\/]/.test(id)) return 'zod'
          return undefined
        },
      },
    },
  },
}))
