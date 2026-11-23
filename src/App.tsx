import { lazy, Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { HeaderSlotProvider } from './components/HeaderBar'
import { ConfirmHost } from './components/Confirm'
import { ErrorBoundary } from './components/SiteLayout'
import { CartProvider } from './lib/cart'

declare const __SURFACE__: 'site' | 'admin'

// __SURFACE__ is replaced by a literal at build time (vite.config.ts), so the bundler drops the
// other surface entirely: the site build ships no admin pages and the admin build ships only the
// administrator UI (admin.md: a separate project containing only the Platform Administrator UI).
const SurfaceRoutes = __SURFACE__ === 'admin'
  ? lazy(() => import('./routes/AdminRoutes'))
  : lazy(() => import('./routes/SiteRoutes'))

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <HeaderSlotProvider>
            <Suspense fallback={<p className="px-4 py-32 text-center text-muted">Loading…</p>}>
              <SurfaceRoutes />
            </Suspense>
            </HeaderSlotProvider>
            <ConfirmHost />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
