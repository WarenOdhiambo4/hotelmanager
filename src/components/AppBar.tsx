import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { isIos, isStandalone, useInstall } from '../lib/pwa'
import { CartIcon, ReceiptIcon } from './Icons'

type I = { className?: string }
const HomeIcon = ({ className = 'h-6 w-6' }: I) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" /></svg>
)
const PlateIcon = ({ className = 'h-6 w-6' }: I) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v8a2 2 0 0 1-2 2M7 3v5" /><path d="M17 21V3c-2 1.5-3 4-3 7s1 4 3 4" /></svg>
)
const ChatIcon = ({ className = 'h-6 w-6' }: I) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></svg>
)

/** Pages that are dashboards for hotels and riders: no student tab bar there. */
const noBar = (path: string) => /^\/(hotel|rider|r)(\/|$)/.test(path)

/** Phone-only tab bar fixed to the bottom, like a native app: Home, Menu, Cart, Orders and Messages. */
export function TabBar() {
  const { pathname } = useLocation()
  const { count } = useCart()
  if (noBar(pathname)) return null
  const tabs = [
    { to: '/', label: 'Home', icon: <HomeIcon />, end: true },
    { to: '/menu', label: 'Menu', icon: <PlateIcon /> },
    { to: '/cart', label: 'Cart', icon: <CartIcon className="h-6 w-6" />, badge: count },
    { to: '/orders', label: 'Orders', icon: <ReceiptIcon className="h-6 w-6" /> },
    { to: '/contact', label: 'Messages', icon: <ChatIcon /> },
  ]
  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink to={t.to} end={t.end}
              className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold transition-colors ${isActive ? 'text-brand' : 'text-muted'}`}>
              {t.icon}
              <span>{t.label}</span>
              {t.badge ? (
                <span className="absolute left-1/2 top-1 ml-2 min-w-[1.1rem] rounded-full bg-[#d7263d] px-1 text-center text-[0.65rem] leading-[1.1rem] text-white">{t.badge > 9 ? '9+' : t.badge}</span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Space so page content and floating buttons clear the tab bar on phones. */
export const hasTabBar = (path: string) => !noBar(path)

const DISMISS_KEY = 'skoolInstallDismissedAt'
const REMIND_AFTER = 14 * 24 * 60 * 60 * 1000

/**
 * First visit on a phone: offer to install Skool. Android shows the browser's own install dialog; iPhone gets the two
 * Safari steps. Hidden in the installed app, on computers, and for two weeks after "Not now".
 */
export function InstallPrompt() {
  const { canPrompt, install } = useInstall()
  const [show, setShow] = useState(false)
  const ios = isIos()
  useEffect(() => {
    if (isStandalone() || !window.matchMedia('(max-width: 639px)').matches) return
    let last = 0
    try { last = Number(localStorage.getItem(DISMISS_KEY) ?? 0) } catch { /* storage blocked */ }
    if (Date.now() - last < REMIND_AFTER) return
    const t = window.setTimeout(() => setShow(true), 1500)
    return () => window.clearTimeout(t)
  }, [])
  if (!show || (!canPrompt && !ios)) return null
  const close = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ } }
  return (
    <div role="dialog" aria-labelledby="install-title" className="drop-in fixed inset-x-3 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-[60] rounded-2xl border border-line bg-canvas p-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] sm:hidden">
      <div className="flex items-center gap-3">
        <img src="/app/skool-192.png" alt="" width="52" height="52" className="h-13 w-13 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p id="install-title" className="font-bold text-ink">Get the Skool app</p>
          <p className="text-sm text-muted">{ios ? 'Tap Share, then "Add to Home Screen".' : 'Order in one tap from your home screen.'}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost !px-4 !py-2 text-sm" onClick={close}>Not now</button>
        {ios ? null : (
          <button type="button" className="btn !px-4 !py-2 text-sm" onClick={async () => { const ok = await install(); if (ok) setShow(false); else close() }}>Install</button>
        )}
      </div>
    </div>
  )
}
