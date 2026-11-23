// Sign in, sign up, forgot and reset password: the COMPLIANCE365 flows (generic answers that never
// reveal which emails have accounts, resend with rate-limit messages, bait field for bots), with
// Campus Food's email codes: Supabase Auth emails a 6-digit code. Every request Supabase protects with captcha
// (sign in, email code, register, resend, password reset) carries a Cloudflare Turnstile token.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CAPTCHA_FAILED, CAPTCHA_WAIT, isCaptchaError, useCaptcha } from '../../components/Captcha'
import { Logo } from '../../components/Logo'
import { Bait, Notice, TextField } from '../../components/form'
import { setTitle, SURFACE } from '../../lib/site'
import { authProviderEnabled, db, supabase, supabaseConfigured } from '../../lib/supabase'
import {
  codeSchema, emailOnlySchema, fieldErrors, loginSchema, newPasswordSchema, signUpSchema, type FieldErrors,
} from '../../lib/validation'

const origin = () => window.location.origin
const rateLimited = (m?: string) => Boolean(m && /rate|seconds|too many/i.test(m))

/** Page frame: a small drawing and one line of copy above a flat form. No panel, no heading. */
function AuthFrame({ title, note, children }: { title: string; note?: string; children: ReactNode; drawing?: 'burger' | 'chai' }) {
  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-md flex-col justify-center px-4 py-10 text-sm">
      <h1 className="sr-only">{title}</h1>
      {/* The Campus Food logo, centred, opens every sign-in screen. */}
      <Link to="/" aria-label="Campus Food home" className="mx-auto"><Logo size="lg" /></Link>
      {note ? <p className="mt-4 text-center text-muted">{note}</p> : null}
      {!supabaseConfigured ? <Notice tone="error">Sign-in is not connected yet (missing Supabase settings).</Notice> : null}
      {children}
    </div>
  )
}

/** "Continue with Google": signs in, or registers on first use. Customers only, never the admin portal. */
function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  if (SURFACE === 'admin') return null
  async function go() {
    setProblem(null)
    setBusy(true)
    // Before the Google keys are added at deployment, say so instead of opening Supabase's error page.
    if (!(await authProviderEnabled('google'))) {
      setBusy(false)
      setProblem('Google sign-in is not switched on yet. Use your email for now.')
      return
    }
    const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/menu'
    const { error } = await db().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin()}${safe}`, queryParams: { prompt: 'select_account' } },
    })
    if (error) { setBusy(false); setProblem(error.message) }
  }
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={go} disabled={busy || !supabaseConfigured}
        className="flex w-full items-center justify-center gap-3 rounded-[0.7rem] border-2 border-ink/15 bg-white py-3.5 font-extrabold text-[#1f1f1f] transition-colors hover:border-ink/40 disabled:opacity-60">
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
        </svg>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-ink/15" />or<span className="h-px flex-1 bg-ink/15" />
      </p>
    </div>
  )
}

/** Shared step: type the 6-digit code from the email. */
function CodeStep({ email, type, onBack, onDone }: { email: string; type: 'signup' | 'email'; onBack: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const captcha = useCaptcha()
  async function verify(e: FormEvent) {
    e.preventDefault()
    const parsed = codeSchema.safeParse({ code })
    if (!parsed.success) { setError(parsed.error.issues[0]!.message); return }
    setBusy(true); setError(null)
    const { error } = await db().auth.verifyOtp({ email, token: parsed.data.code, type })
    setBusy(false)
    if (error) { setError(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Request a new one.' : error.message); return }
    onDone()
  }
  async function resend() {
    setInfo(null); setError(null)
    if (!captcha.ready) { setError(CAPTCHA_WAIT); return }
    const captchaToken = captcha.token
    const { error } = type === 'signup'
      ? await db().auth.resend({ type: 'signup', email, options: { emailRedirectTo: origin(), captchaToken } })
      : await db().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: origin(), captchaToken } })
    captcha.reset()
    if (isCaptchaError(error?.message)) { setError(CAPTCHA_FAILED); return }
    if (rateLimited(error?.message)) { setError('Too many requests. Wait a minute, then try again.'); return }
    setInfo('A new code is on its way. Check spam too.')
  }
  return (
    <form onSubmit={verify} noValidate className="mt-10 flex flex-col gap-7">
      <p>We sent a 6-digit code to <strong>{email}</strong>.</p>
      <TextField label="Code from the email" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={setCode} error={error ?? undefined} />
      {info ? <Notice tone="success">{info}</Notice> : null}
      <button type="submit" className="btn w-full py-4" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
      <div className="flex justify-between text-sm font-bold">
        <button type="button" className="link" onClick={resend}>Send a new code</button>
        <button type="button" className="link" onClick={onBack}>Use a different email</button>
      </div>
      {captcha.widget}
    </form>
  )
}

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const target = from && from.startsWith('/') && !from.startsWith('//') ? from : '/menu'
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<typeof form>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codeFor, setCodeFor] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [bait, setBait] = useState('')
  const captcha = useCaptcha()
  useEffect(() => setTitle('Sign in'), [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setProblem(null)
    const parsed = loginSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<typeof form>(parsed.error)); return }
    setErrors({})
    if (bait) { setBusy(true); setTimeout(() => { setBusy(false); setProblem('Email or password is incorrect.') }, 2000); return }
    if (!captcha.ready) { setProblem(CAPTCHA_WAIT); return }
    setBusy(true)
    const { error } = await db().auth.signInWithPassword({ ...parsed.data, options: { captchaToken: captcha.token } })
    setBusy(false)
    captcha.reset()
    if (isCaptchaError(error?.message)) { setProblem(CAPTCHA_FAILED); return }
    if (error) {
      const notConfirmed = /not confirmed/i.test(error.message)
      setUnconfirmed(notConfirmed)
      setProblem(notConfirmed ? 'Confirm your email first. We can send a new code.' : 'Email or password is incorrect.')
      return
    }
    navigate(target, { replace: true })
  }

  async function emailMeACode() {
    setProblem(null)
    const parsed = emailOnlySchema.safeParse({ email: form.email })
    if (!parsed.success) { setErrors({ email: parsed.error.issues[0]!.message }); return }
    if (!captcha.ready) { setProblem(CAPTCHA_WAIT); return }
    setBusy(true)
    // shouldCreateUser: false: a code never creates an account; new people use Sign up.
    const { error } = await db().auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false, emailRedirectTo: origin(), captchaToken: captcha.token } })
    setBusy(false)
    captcha.reset()
    if (isCaptchaError(error?.message)) { setProblem(CAPTCHA_FAILED); return }
    if (rateLimited(error?.message)) { setProblem('Too many requests. Wait a minute, then try again.'); return }
    setCodeFor(parsed.data.email)
  }

  async function resendConfirmation() {
    if (!captcha.ready) { setProblem(CAPTCHA_WAIT); return }
    const { error } = await db().auth.resend({ type: 'signup', email: form.email.trim().toLowerCase(), options: { emailRedirectTo: origin(), captchaToken: captcha.token } })
    captcha.reset()
    if (isCaptchaError(error?.message)) { setProblem(CAPTCHA_FAILED); return }
    if (rateLimited(error?.message)) { setProblem('Too many requests. Wait a minute, then try again.'); return }
    setUnconfirmed(false)
    setCodeFor(form.email.trim().toLowerCase())
  }

  return (
    <AuthFrame title={SURFACE === 'admin' ? 'Admin portal' : 'Welcome back'}>
      {codeFor ? (
        <CodeStep email={codeFor} type={unconfirmed ? 'signup' : 'email'} onBack={() => setCodeFor(null)} onDone={() => navigate(target, { replace: true })} />
      ) : (
        <form onSubmit={submit} noValidate className="relative mt-10 flex flex-col gap-7">
          <GoogleButton next={target} />
          <Bait value={bait} onChange={setBait} />
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} error={errors.email} />
          <div className="flex flex-col gap-2">
            <TextField label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} error={errors.password} />
            <Link to="/forgot-password" className="link self-end text-sm font-bold">Forgot password?</Link>
          </div>
          {captcha.widget}
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          {unconfirmed ? <button type="button" className="link self-start font-bold" onClick={resendConfirmation}>Send me a new confirmation code</button> : null}
          <button type="submit" className="btn w-full py-4" disabled={busy || !supabaseConfigured}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="btn btn-ghost w-full" disabled={busy || !supabaseConfigured} onClick={emailMeACode}>Email me a sign-in code</button>
          {SURFACE === 'admin' ? null : <p className="text-center text-muted">New here? <Link to="/signup" state={location.state} className="link font-bold">Register</Link></p>}
        </form>
      )}
    </AuthFrame>
  )
}

export function SignUp() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', hostel: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors<typeof form>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codeFor, setCodeFor] = useState<string | null>(null)
  const [bait, setBait] = useState('')
  const captcha = useCaptcha()
  useEffect(() => setTitle('Register'), [])
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setProblem(null)
    const parsed = signUpSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<typeof form>(parsed.error)); return }
    setErrors({})
    if (bait) { setCodeFor(parsed.data.email); return }
    if (!captcha.ready) { setProblem(CAPTCHA_WAIT); return }
    setBusy(true)
    const { data, error } = await db().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: origin(), captchaToken: captcha.token, data: { fullName: parsed.data.fullName, phone: parsed.data.phone, hostel: parsed.data.hostel } },
    })
    setBusy(false)
    captcha.reset()
    if (isCaptchaError(error?.message)) { setProblem(CAPTCHA_FAILED); return }
    if (rateLimited(error?.message)) { setProblem('Too many sign-ups from this network. Wait a minute, then try again.'); return }
    if (error && !/registered/i.test(error.message)) { setProblem(error.message); return }
    // With confirmation off, Supabase signs in straight away; otherwise ask for the emailed code.
    if (data?.session) { navigate('/menu', { replace: true }); return }
    setCodeFor(parsed.data.email)
  }

  const from = (location.state as { from?: string } | null)?.from
  return (
    <AuthFrame title="Join Campus Food">
      {codeFor ? (
        <CodeStep email={codeFor} type="signup" onBack={() => setCodeFor(null)} onDone={() => navigate(from && from.startsWith('/') ? from : '/menu', { replace: true })} />
      ) : (
        <form onSubmit={submit} noValidate className="relative mt-10 flex flex-col gap-6">
          <Bait value={bait} onChange={setBait} />
          <GoogleButton next={from ?? '/menu'} />
          <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
          <TextField label="M-Pesa phone number" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="For payment prompts and SMS updates." />
          <TextField label="Delivery address: hostel, office or room (optional)" value={form.hostel} onChange={set('hostel')} />
          <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
          <TextField label="Type it again" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
          {captcha.widget}
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          <button type="submit" className="btn w-full py-4" disabled={busy || !supabaseConfigured}>{busy ? 'Registering…' : 'Register'}</button>
          <p className="text-center text-muted">Already have an account? <Link to="/login" state={location.state} className="link font-bold">Sign in</Link></p>
        </form>
      )}
    </AuthFrame>
  )
}

/** Sends the reset email. Always answers the same way, so it never reveals which emails have accounts. */
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const captcha = useCaptcha()
  useEffect(() => setTitle('Forgot password'), [])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = emailOnlySchema.safeParse({ email })
    if (!parsed.success) { setError(parsed.error.issues[0]!.message); return }
    if (!captcha.ready) { setError(CAPTCHA_WAIT); return }
    setBusy(true); setError(null)
    const { error } = await db().auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin()}/reset-password`, captchaToken: captcha.token })
    setBusy(false)
    captcha.reset()
    if (isCaptchaError(error?.message)) { setError(CAPTCHA_FAILED); return }
    if (rateLimited(error?.message)) { setError('Too many requests. Wait a minute, then try again.'); return }
    setSentTo(parsed.data.email)
  }
  return (
    <AuthFrame title="Reset password">
      {sentTo ? (
        <div className="mt-10 flex flex-col gap-6">
          <Notice tone="success">If an account exists for {sentTo}, a reset link is on its way. It works once and expires after 1 hour.</Notice>
          <p className="text-muted">Nothing after a few minutes? Check spam, or <button type="button" className="link font-bold" onClick={() => setSentTo(null)}>try again</button>.</p>
          <Link to="/login" className="link font-bold">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-10 flex flex-col gap-7">
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={error ?? undefined} />
          {captcha.widget}
          <button type="submit" className="btn w-full py-4" disabled={busy || !supabaseConfigured}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <Link to="/login" className="link text-center font-bold">Back to sign in</Link>
        </form>
      )}
    </AuthFrame>
  )
}

/** Opened from the reset email: the link signs the person in for this one purpose. */
export function ResetPassword() {
  const navigate = useNavigate()
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors<typeof form>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setTitle('Choose a new password'), [])
  useEffect(() => {
    if (!supabase) { setState('invalid'); return }
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (hash.get('error_code')) { setState('invalid'); return }
    let done = false
    const finish = (ok: boolean) => { if (!done) { done = true; setState(ok ? 'ready' : 'invalid') } }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) finish(true)
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) finish(true); else setTimeout(() => finish(false), 1500) })
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    return () => sub.subscription.unsubscribe()
  }, [])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = newPasswordSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<typeof form>(parsed.error)); return }
    setErrors({}); setBusy(true); setProblem(null)
    const { error } = await db().auth.updateUser({ password: parsed.data.password })
    setBusy(false)
    if (error) { setProblem(/same|different/i.test(error.message) ? 'Choose a password you have not used before.' : error.message); return }
    navigate('/menu', { replace: true })
  }
  return (
    <AuthFrame title="New password">
      {state === 'checking' ? <p className="mt-10 text-muted">Checking your reset link…</p> : null}
      {state === 'invalid' ? (
        <div className="mt-10 flex flex-col gap-6">
          <Notice tone="error">This reset link has expired or was already used. Links work once and last 1 hour.</Notice>
          <Link to="/forgot-password" className="link font-bold">Send a new reset link</Link>
        </div>
      ) : null}
      {state === 'ready' ? (
        <form onSubmit={submit} noValidate className="mt-10 flex flex-col gap-7">
          <TextField label="New password" type="password" autoComplete="new-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} error={errors.password} />
          <TextField label="Type it again" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} error={errors.confirmPassword} />
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          <button type="submit" className="btn w-full py-4" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
      ) : null}
    </AuthFrame>
  )
}
