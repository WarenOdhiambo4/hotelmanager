import { useCallback, useRef, useState, type ReactNode } from 'react'

/**
 * Cloudflare Turnstile for sign-in, registration and password reset. Supabase Auth (Attack Protection > Captcha,
 * provider "Turnstile by Cloudflare") rejects those requests unless they carry a fresh token; the secret key lives in
 * Supabase, the public site key here (VITE_TURNSTILE_SITE_KEY). Without a site key (local development) no widget is
 * shown and no token is sent, so Supabase must have captcha switched off there.
 */
const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''
export const captchaEnabled = Boolean(SITE_KEY)

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

let loader: Promise<Turnstile> | null = null
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loader ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not start')))
    s.onerror = () => { loader = null; reject(new Error('Turnstile could not load')) }
    document.head.appendChild(s)
  })
  return loader
}

/** True when Supabase refused the request because the captcha token was missing, used or expired. */
export const isCaptchaError = (message?: string) => Boolean(message && /captcha/i.test(message))

export const CAPTCHA_WAIT = 'Wait a moment for the security check under the form to finish, then try again.'
export const CAPTCHA_FAILED = 'The security check expired. It has been refreshed, so please try again.'

/**
 * One Turnstile widget per form. `token` is undefined until the check passes (always undefined when captcha is off);
 * call `reset()` after every auth request, because each token works only once.
 */
export function useCaptcha(): { widget: ReactNode; token: string | undefined; ready: boolean; reset: () => void } {
  const id = useRef<string | null>(null)
  const [token, setToken] = useState<string | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  // A callback ref, so the widget is drawn again whenever its form is shown again (for example after the code step).
  const attach = useCallback((el: HTMLDivElement | null) => {
    if (!captchaEnabled) return
    if (!el) {
      if (id.current && window.turnstile) window.turnstile.remove(id.current)
      id.current = null
      setToken(undefined)
      return
    }
    loadTurnstile().then((ts) => {
      if (!el.isConnected) return
      id.current = ts.render(el, {
        sitekey: SITE_KEY,
        theme: 'auto',
        size: 'flexible',
        action: 'auth',
        callback: (t: string) => { setToken(t); setFailed(false) },
        'expired-callback': () => setToken(undefined),
        'timeout-callback': () => setToken(undefined),
        'error-callback': () => { setToken(undefined); setFailed(true) },
      })
    }).catch(() => setFailed(true))
  }, [])

  const reset = useCallback(() => {
    setToken(undefined)
    if (id.current && window.turnstile) window.turnstile.reset(id.current)
  }, [])

  const widget = captchaEnabled ? (
    <div className="flex flex-col gap-1">
      <div ref={attach} className="min-h-[65px]" />
      {failed ? <p className="text-xs text-danger">The security check could not load. Check your connection and refresh the page.</p> : null}
    </div>
  ) : null

  return { widget, token, ready: !captchaEnabled || Boolean(token), reset }
}
