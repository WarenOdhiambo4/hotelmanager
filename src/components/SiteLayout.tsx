import { Component, useEffect, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { supabaseConfigured } from '../lib/supabase'
import { hasTabBar, InstallPrompt, TabBar } from './AppBar'
import { CallUs } from './CallUs'
import { isStandalone } from '../lib/pwa'
import { RevealFooter } from './RevealFooter'
import { SiteHeader } from './SiteHeader'

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean; detail: string }> {
  state = { failed: false, detail: '' }
  static getDerivedStateFromError(error: unknown) { return { failed: true, detail: import.meta.env.DEV ? String((error as Error)?.stack ?? error) : '' } }
  componentDidCatch(error: unknown) { console.error('Campus Food page error:', error) }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="mx-auto max-w-xl px-6 py-32 text-center">
        <h1 className="sr-only">Something burnt</h1>
        <p className="mt-4 text-muted">This page hit a problem. Reload to try again; your cart is safe.</p>
        <button type="button" className="btn mt-8" onClick={() => window.location.reload()}>Reload</button>
        {this.state.detail ? <pre className="mt-8 whitespace-pre-wrap text-left text-xs text-danger">{this.state.detail}</pre> : null}
      </section>
    )
  }
}

/** Asked when a student adds food from a second hotel (one cart, one hotel, one M-Pesa prompt). */
function CartConflict() {
  const { conflict, cart, resolveConflict } = useCart()
  if (!conflict) return null
  return (
    <div className="drop-in fixed inset-x-0 bottom-0 z-[70] border-t-4 border-gold bg-canvas px-6 py-6 sm:py-8" role="alertdialog" aria-labelledby="conflict-title">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p id="conflict-title" className="headline text-2xl">One hotel per order</p>
          <p className="mt-1 text-muted">
            Your cart has food from <strong className="text-ink">{cart.vendorName}</strong>. Each order is paid straight to one hotel, so
            {' '}<strong className="text-ink">{conflict.item.name}</strong> from {conflict.vendorName} needs its own order.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button type="button" className="btn" onClick={() => resolveConflict('replace')}>Start a new cart</button>
          <button type="button" className="btn btn-ghost" onClick={() => resolveConflict('keep')}>Keep my cart</button>
        </div>
      </div>
    </div>
  )
}

function SetupBanner() {
  if (supabaseConfigured) return null
  return <p className="bg-gold px-4 py-2 text-center text-sm font-bold text-[#1c1917]">Not connected: copy .env.example to .env.local to load the live menu.</p>
}

export function SiteLayout() {
  const { pathname } = useLocation()
  const app = isStandalone()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return (
    <>
      <SetupBanner />
      <SiteHeader />
      {/* Only the home page ends with the revealing footer (it needs an opaque page above it);
          every other screen, and everything after sign-in, stays on task with no footer. */}
      <main className={`relative z-10 ${pathname === '/' ? 'page-backdrop' : 'min-h-[calc(100vh-4rem)]'} ${hasTabBar(pathname) ? 'max-sm:pb-[calc(4.5rem+env(safe-area-inset-bottom))]' : ''}`}>
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </main>
      {/* The installed app (Skool) has no footer, like any phone app. */}
      {pathname === '/' && !app ? <RevealFooter /> : null}
      <TabBar />
      <InstallPrompt />
      <CartConflict />
      <CallUs />
    </>
  )
}

export function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-6 py-32 text-center">
      <h1 className="sr-only">Plate not found</h1>
      <p className="mt-4 text-muted">That page is not on the menu.</p>
      <Link to="/menu" className="btn mt-8">See the menu</Link>
    </section>
  )
}
