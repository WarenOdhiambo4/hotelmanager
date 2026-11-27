import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import './index.css'
import { SURFACE } from './lib/site'
import { startPwa } from './lib/pwa'

if (SURFACE === 'admin') document.title = 'Campus Food · Admin'
startPwa()

// After a new deploy, an old tab may ask for code files that no longer exist; reload once.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('reloadedForUpdate') ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('reloadedForUpdate', String(Date.now()))
  } catch { /* storage blocked: still reload once */ }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel Web Analytics: cookieless page-view counts, served from this site (/_vercel/insights). */}
    <Analytics />
  </StrictMode>,
)
