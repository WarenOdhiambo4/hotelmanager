import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { useAuth } from '../../auth/AuthProvider'
import { Notice, TextField } from '../../components/form'
import { HeaderSlot } from '../../components/HeaderBar'
import { RailIcons, SideRail } from '../../components/SideRail'
import { Logo } from '../../components/Logo'
import { UserAvatar } from '../../components/UserAvatar'
import { ThemePicker } from '../../components/ThemePicker'
import { db, friendly } from '../../lib/supabase'

/**
 * Admin portal shell (deployed on its own subdomain). Lock 2 of 3: a Supabase TOTP check.
 * The database only honours admin powers on an MFA-verified session (lock 3), and Cloudflare
 * Access in front of the subdomain is lock 1.
 */
export function AdminLayout() {
  const { profile, signOut, session } = useAuth()
  const navigate = useNavigate()
  const [aal, setAal] = useState<'checking' | 'aal1' | 'aal2'>('checking')
  useEffect(() => {
    db().auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => setAal(data?.currentLevel === 'aal2' ? 'aal2' : 'aal1'))
  }, [session?.access_token])

  // Platform staff: administrators, finance/operations and customer support. Each sees only its tools.
  const role = profile?.role
  if (profile && role !== 'admin' && role !== 'finance' && role !== 'support') {
    return (
      <section className="mx-auto max-w-lg px-6 py-32 text-center">
        <h1 className="sr-only">Platform staff only</h1>
        <p className="mt-3 text-sm text-muted">This account is not an administrator, finance or support account.</p>
        <button type="button" className="btn mt-6" onClick={async () => { await signOut(); navigate('/login') }}>Sign in as someone else</button>
      </section>
    )
  }
  if (aal === 'checking') return <p className="px-6 py-32 text-center text-sm text-muted">Checking security…</p>
  if (aal === 'aal1') return <MfaGate onDone={() => setAal('aal2')} />

  const all = ['admin', 'finance', 'support']
  const groups: [string, string, keyof typeof RailIcons, string[]][][] = [
    [['/', 'Overview', 'home', all], ['/orders', 'Orders', 'orders', all], ['/refunds', 'Refunds', 'refunds', all], ['/payments', 'Payments', 'payments', all]],
    [['/finance', 'Finance', 'finance', ['admin', 'finance']], ['/mpesa', 'M-PESA', 'mpesa', ['admin', 'finance']]],
    [['/vendors', 'Hotels', 'hotels', ['admin']], ['/people', 'People', 'people', ['admin']], ['/settings', 'Fees, zones', 'settings', ['admin']],
     ['/content', 'Content', 'content', ['admin']], ['/images', 'Images', 'images', ['admin']]],
    [['/callbacks', 'Call-backs', 'phone', ['admin', 'support']], ['/answers', 'Answers', 'answers', ['admin', 'support']],
     ['/feedback', 'Feedback', 'feedback', ['admin', 'support']], ['/audit', 'Audit', 'audit', ['admin', 'support']]],
  ]
  const rail = groups.map((g) => g.filter(([, , , roles]) => roles.includes(role ?? '')).map(([to, label, icon]) => ({ to, label, icon: RailIcons[icon], end: to === '/' })))
    .filter((g) => g.length)
  return (
    <div className="min-h-screen text-sm">
      {/* Top navbar: logo and the staff avatar menu; the pages are in the sidebar. */}
      <div data-app-header className="glass sticky top-0 z-50 !border-x-0 !border-t-0">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-1.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <NavLink to="/" aria-label="Admin overview" className="shrink-0"><Logo size="sm" /></NavLink>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StaffMenu role={role ?? ''} avatarPath={profile?.avatarPath} onSignOut={async () => { await signOut(); navigate('/login') }} />
          </div>
        </header>
        <HeaderSlot />
      </div>
      <SideRail groups={rail} label="Admin pages" />
      <div className="lg:pl-[5.5rem]"><main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6"><Outlet /></main></div>
    </div>
  )
}

function MfaGate({ onDone }: { onDone: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await db().auth.mfa.listFactors()
      const verified = data?.totp?.find((f) => f.status === 'verified')
      if (verified) { setFactorId(verified.id); return }
      // Clear half-finished enrolments, then start a fresh one.
      for (const f of data?.all ?? []) if (f.status !== 'verified') await db().auth.mfa.unenroll({ factorId: f.id })
      const { data: en, error } = await db().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Campus Food admin' })
      if (error || !en) { setProblem(error ? friendly(error) : 'Could not start the authenticator setup. Reload to try again.'); return }
      setFactorId(en.id)
      setSecret(en.totp.secret)
      setQr(await QRCode.toDataURL(en.totp.uri, { margin: 1, width: 220 }))
    })().catch((e) => setProblem(friendly(e)))
  }, [])

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setBusy(true); setProblem(null)
    const { error } = await db().auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    setBusy(false)
    if (error) { setProblem('That code did not match. Use the current 6-digit code from your authenticator app.'); return }
    onDone()
  }
  return (
    <section className="mx-auto max-w-md px-6 py-24">
      <Logo />
      <h1 className="sr-only">{qr ? 'Set up two-step sign-in' : 'Two-step sign-in'}</h1>
      <p className="mt-3 text-muted">
        {qr ? 'Scan this with Google Authenticator, Microsoft Authenticator or 1Password, then type the code it shows.' : 'Type the 6-digit code from your authenticator app.'}
      </p>
      {qr ? <img src={qr} alt="QR code for your authenticator app" className="mt-8 h-52 w-52" /> : null}
      {secret ? <p className="mt-3 break-all text-xs text-muted">Or enter this key: <code className="font-bold text-ink">{secret}</code></p> : null}
      <form onSubmit={verify} className="mt-8 flex flex-col gap-6">
        <TextField label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={setCode} />
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        <button type="submit" className="btn py-3" disabled={busy || code.trim().length !== 6}>{busy ? 'Checking…' : 'Continue'}</button>
      </form>
    </section>
  )
}

/** Cartoon avatar menu for staff: role, theme and sign-out. */
function StaffMenu({ role, avatarPath, onSignOut }: { role: string; avatarPath?: string | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="Your staff menu"><UserAvatar path={avatarPath} className="h-9 w-9" /></button>
      {open ? (
        <div role="menu" className="glass drop-in absolute right-0 z-[70] mt-2 w-60 rounded-2xl p-3 text-sm">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-brand">{role === 'admin' ? 'Administrator' : role === 'finance' ? 'Finance / operations' : 'Customer support'}</p>
          <p className="mt-3 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-muted">Theme</p>
          <div className="mt-2"><ThemePicker compact /></div>
          <button type="button" role="menuitem" className="mt-4 text-xs font-bold text-danger" onClick={onSignOut}>Sign out</button>
        </div>
      ) : null}
    </div>
  )
}
