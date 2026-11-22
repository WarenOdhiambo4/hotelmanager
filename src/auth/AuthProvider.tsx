import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { applyTheme } from '../lib/theme'
import type { AppRole, Profile } from '../lib/types'

export type Membership = { vendorId: string; memberRole: 'manager' | 'staff'; vendors: { name: string; isActive: boolean; mpesaVerified: boolean } | null }

type AuthState = {
  session: Session | null
  profile: Profile | null
  memberships: Membership[]
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase || !s) { setProfile(null); setMemberships([]); return }
    const [p, m] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('vendorMembers').select('vendorId,memberRole,vendors(name,isActive,mpesaVerified)').eq('userId', s.user.id),
    ])
    const prof = (p.data as Profile | null) ?? null
    setProfile(prof)
    setMemberships(((m.data ?? []) as unknown) as Membership[])
    if (prof?.appearance?.theme) applyTheme(prof.appearance.theme)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session).catch(() => undefined)
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // Defer database calls out of the auth callback (recommended by supabase-js).
      setTimeout(() => { void loadProfile(next).finally(() => setLoading(false)) }, 0)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const value = useMemo<AuthState>(() => ({
    session,
    profile,
    memberships,
    loading,
    refresh: () => loadProfile(session),
    signOut: async () => { await supabase?.auth.signOut() },
  }), [session, profile, memberships, loading, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

function Checking() {
  return <p className="px-4 py-32 text-center text-muted">Checking your session…</p>
}

/** Signed-in pages. Optional roles narrow them further (admin, rider, hotel staff). */
export function RequireAuth({ roles, vendor }: { roles?: AppRole[]; vendor?: boolean }) {
  const { session, profile, memberships, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Checking />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!profile) return <Checking />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />
  if (vendor && memberships.length === 0 && profile.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

export function RedirectIfAuthed({ to = '/' }: { to?: string }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  if (!loading && session) return <Navigate to={from && from.startsWith('/') && !from.startsWith('//') ? from : to} replace />
  return <Outlet />
}
