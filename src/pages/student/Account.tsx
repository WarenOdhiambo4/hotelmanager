import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Checkbox, Notice, TextField } from '../../components/form'
import { ThemePicker } from '../../components/ThemePicker'
import { UserAvatar } from '../../components/UserAvatar'
import { setTitle } from '../../lib/site'
import { callFunction, db, friendly, rpc, uploadImage } from '../../lib/supabase'
import { kenyanPhone } from '../../lib/validation'
import { Stroke } from '../../components/Stroke'

/** Profile, phone verification by SMS code, message channels and theme. */
export function Account() {
  const { profile, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', hostel: '', phone: '', smsOptIn: true, whatsappOptIn: false })
  const [saved, setSaved] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)
  useEffect(() => setTitle('Account'), [])
  useEffect(() => {
    if (profile) setForm({ fullName: profile.fullName, hostel: profile.hostel ?? '', phone: profile.phone ?? '', smsOptIn: profile.smsOptIn, whatsappOptIn: profile.whatsappOptIn })
  }, [profile])
  if (!profile) return null

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaved(null); setProblem(null)
    const phone = form.phone ? kenyanPhone.safeParse(form.phone) : null
    if (phone && !phone.success) { setProblem(phone.error.issues[0]!.message); return }
    const { error } = await db().from('profiles').update({
      fullName: form.fullName.trim(), hostel: form.hostel.trim() || null, phone: form.phone ? form.phone : null,
      smsOptIn: form.smsOptIn, whatsappOptIn: form.whatsappOptIn,
    }).eq('id', profile!.id)
    if (error) { setProblem(friendly(error)); return }
    await refresh()
    setSaved('Saved.')
  }

  async function sendCode() {
    setVerifyMsg(null)
    try {
      const r = await callFunction<{ message: string }>('phone-verify', { phone: form.phone || profile!.phone })
      setCodeSent(true)
      setVerifyMsg({ tone: 'success', text: r.message })
    } catch (err) { setVerifyMsg({ tone: 'error', text: (err as Error).message }) }
  }
  async function confirm(e: FormEvent) {
    e.preventDefault()
    try {
      const ok = await rpc<boolean>('confirmPhoneCode', { pCode: code })
      if (!ok) { setVerifyMsg({ tone: 'error', text: 'That code is not right. Check the SMS and try again.' }); return }
      await refresh()
      setCodeSent(false)
      setVerifyMsg({ tone: 'success', text: 'Phone number verified.' })
    } catch (err) { setVerifyMsg({ tone: 'error', text: (err as Error).message }) }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 text-sm sm:px-6">
      <h1 className="sr-only">Your account</h1>
      <p className="mt-2 text-muted">{profile.email} · {profile.role === 'vendorStaff' ? 'Hotel staff' : profile.role === 'admin' ? 'Administrator' : profile.role === 'rider' ? 'Rider' : 'Customer'}</p>

      <label className="mt-6 flex cursor-pointer items-center gap-4">
        <UserAvatar path={profile.avatarPath} className="h-16 w-16" />
        <span className="flex flex-col"><span className="link text-sm font-bold">{profile.avatarPath ? 'Change your photo' : 'Add your photo'}</span><span className="story text-xs text-muted">Shown to your hotel team and riders. JPG, PNG or WebP up to 5 MB.</span></span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return
          try { const p = await uploadImage(`profiles/${profile.id}`, f); const { error } = await db().from('profiles').update({ avatarPath: p }).eq('id', profile.id); if (error) throw error; await refresh(); setSaved('Photo updated.') } catch (err) { setProblem(friendly(err)) }
        }} />
      </label>
      <form onSubmit={save} noValidate className="mt-8 flex flex-col gap-7">
        <TextField label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} autoComplete="name" />
        <TextField label="Hostel, block and room" value={form.hostel} onChange={(v) => setForm({ ...form, hostel: v })} hint="Filled in for you at checkout." />
        <TextField label="M-Pesa phone number" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })}
          hint={profile.phoneVerified ? 'Verified' : 'Not verified yet. Verify below so hotels can trust the number.'} />
        <div className="flex flex-col gap-3">
          <Checkbox label="Order updates by SMS" checked={form.smsOptIn} onChange={(v) => setForm({ ...form, smsOptIn: v })} hint="Receipts and delivery alerts always come by SMS, even without data bundles." />
          <Checkbox label="Order updates on WhatsApp" checked={form.whatsappOptIn} onChange={(v) => setForm({ ...form, whatsappOptIn: v })} hint="If WhatsApp is slow, we send an SMS instead." />
        </div>
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        {saved ? <Notice tone="success">{saved}</Notice> : null}
        <button type="submit" className="btn self-start">Save</button>
      </form>

      {!profile.phoneVerified ? (
        <section className="mt-16">
          <Stroke color="var(--color-line)" seed="pages/student/Account.tsx1" className="mb-10" /><h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Verify your phone</h2>
          {codeSent ? (
            <form onSubmit={confirm} className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end">
              <TextField label="Code" inputMode="numeric" maxLength={6} value={code} onChange={setCode} className="sm:w-40" autoComplete="one-time-code" />
              <button type="submit" className="btn">Confirm</button>
              <button type="button" className="link text-sm font-bold" onClick={sendCode}>Send a new code</button>
            </form>
          ) : <button type="button" className="btn btn-ghost mt-6" onClick={sendCode} disabled={!form.phone && !profile.phone}>Send code</button>}
          {verifyMsg ? <div className="mt-4"><Notice tone={verifyMsg.tone}>{verifyMsg.text}</Notice></div> : null}
        </section>
      ) : null}

      <section className="mt-16">
        <Stroke color="var(--color-line)" seed="pages/student/Account.tsx2" className="mb-10" /><h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Theme</h2>
        <div className="mt-6"><ThemePicker /></div>
      </section>

      <section className="mt-16">
        <Stroke color="var(--color-line)" seed="pages/student/Account.tsx3" className="mb-10" /><button type="button" className="btn btn-ghost" onClick={async () => { await signOut(); navigate('/') }}>Sign out</button>
      </section>
    </div>
  )
}
