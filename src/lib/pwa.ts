import { useEffect, useState } from 'react'
import { SURFACE } from './site'

/** The browser's install event (Chrome, Edge and Samsung Internet on Android; not iPhone Safari). */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

/** True when the site is running as the installed app (home-screen icon), not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Registers the service worker and keeps the install event for later. Public site only, never the admin portal. */
export function startPwa() {
  if (SURFACE === 'admin' || typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ }) })
  }
}

/** Whether the browser can show its own install dialog right now, and a function that opens it. */
export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => { const fn = () => force((n) => n + 1); listeners.add(fn); return () => { listeners.delete(fn) } }, [])
  return {
    canPrompt: deferred !== null,
    install: async () => {
      if (!deferred) return false
      const ev = deferred
      deferred = null
      await ev.prompt()
      const { outcome } = await ev.userChoice
      notify()
      return outcome === 'accepted'
    },
  }
}
