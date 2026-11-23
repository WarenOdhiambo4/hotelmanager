import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { FoodImage } from '../../components/FoodImage'
import { Checkbox, Notice, Select, TextArea, TextField } from '../../components/form'
import { useLoad } from '../../lib/data'
import { dateTime, daysAgoIso, kes, todayIso } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db, friendly, rpc, uploadImage } from '../../lib/supabase'
import type { DailySummaryRow, MenuItem, Offer } from '../../lib/types'
import { fieldErrors, vendorSchema, type FieldErrors } from '../../lib/validation'
import { useVendor } from './VendorLayout'
import { VendorFees } from './VendorFees'
import { DateRange } from '../../components/DateRange'
import { PhoneValue, ProfileCard, shortDate } from '../../components/ProfileCard'
import { HeaderActions, Sheet } from '../../components/HeaderBar'
import { Facts, Stat, Tile, Tiles, orderTone } from '../../components/Tiles'
import { AnalyticsBoard } from '../../components/Analytics'
import { MetricsPanel } from '../../components/Metrics'
import { ORDER_STATUS_LABEL } from '../../lib/format'
import type { Order } from '../../lib/types'

/** Every order the hotel has received (the live queue keeps only the last day and a half). Search lives in the header bar. */
function OrderHistory({ vendorId, q }: { vendorId: string; q: string }) {
  const [limit, setLimit] = useState(48)
  const { data: orders } = useLoad(async () => {
    let query = db().from('orders').select('id,reference,customerName,contactPhone,status,foodSubtotal,createdAt,deliveryLocation').eq('vendorId', vendorId).order('createdAt', { ascending: false }).limit(limit)
    const term = q.trim().replace(/[%,()]/g, '')
    if (term) query = query.or(`reference.ilike.%${term}%,contactPhone.ilike.%${term}%,customerName.ilike.%${term}%`)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Order[]
  }, [] as Order[], [vendorId, q, limit])
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">Order history{q ? ` · matching “${q}”` : ''}</h2>
      {orders.length === 0 ? <p className="text-sm text-muted">No orders found.</p> : (
        <Tiles min="13rem">
          {orders.map((o) => (
            <Tile key={o.id} tone={orderTone(o.status)} kicker={ORDER_STATUS_LABEL[o.status]} title={o.reference} figure={kes(o.foodSubtotal)}>
              <Facts items={[['Customer', o.customerName || '—'], ['Phone', o.contactPhone], ['Placed', dateTime(o.createdAt)]]} />
            </Tile>
          ))}
        </Tiles>
      )}
      {orders.length === limit ? <button type="button" className="link mt-4 text-xs font-bold" onClick={() => setLimit(limit + 96)}>Show more</button> : null}
    </section>
  )
}

export type VendorForm = { name: string; location: string; phone: string; paymentType: 'paybill' | 'till'; mpesaShortcode: string; headOfficeNumber: string; mpesaAccountName: string }

export function MpesaFields({ form, set, errors }: { form: VendorForm; set: (f: Partial<VendorForm>) => void; errors: FieldErrors<VendorForm> }) {
  return (
    <>
      <Select label="How customers pay you" value={form.paymentType} onChange={(v) => set({ paymentType: v as 'paybill' | 'till' })}
        options={[{ value: 'paybill', label: 'M-Pesa Paybill' }, { value: 'till', label: 'M-Pesa Buy Goods Till' }]} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label={form.paymentType === 'till' ? 'Till number' : 'Paybill number'} inputMode="numeric" value={form.mpesaShortcode} onChange={(v) => set({ mpesaShortcode: v })} error={errors.mpesaShortcode} />
        {form.paymentType === 'till' ? (
          <TextField label="Head Office (store) number" inputMode="numeric" value={form.headOfficeNumber} onChange={(v) => set({ headOfficeNumber: v })} error={errors.headOfficeNumber}
            hint="On your M-Pesa Org Portal; often different from the Till." />
        ) : null}
      </div>
      <TextField label="Name on the M-Pesa account" value={form.mpesaAccountName} onChange={(v) => set({ mpesaAccountName: v })} hint="Customers see this name on the PIN prompt." />
    </>
  )
}

/** Managers edit the hotel profile and M-Pesa details. Changing M-Pesa details takes the hotel offline until re-verified. */
export function VendorSettings() {
  const { vendor, reloadVendor } = useVendor()
  const v = vendor!
  const [form, setForm] = useState<VendorForm>({
    name: v.name, location: v.location ?? '', phone: v.phone ?? '', paymentType: v.paymentType ?? 'paybill',
    mpesaShortcode: v.mpesaShortcode ?? '', headOfficeNumber: v.headOfficeNumber ?? '', mpesaAccountName: v.mpesaAccountName ?? '',
  })
  const [extra, setExtra] = useState({ description: v.description ?? '', openingHours: v.openingHours ?? '', prepMinutes: String(v.prepMinutes), isOpen: v.isOpen })
  const [logo, setLogo] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors<VendorForm>>({})
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setTitle('Hotel settings'), [])
  const mpesaChanged = form.paymentType !== (v.paymentType ?? 'paybill') || form.mpesaShortcode !== (v.mpesaShortcode ?? '') || (form.paymentType === 'till' && form.headOfficeNumber !== (v.headOfficeNumber ?? ''))

  async function save(e: FormEvent) {
    e.preventDefault()
    const parsed = vendorSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<VendorForm>(parsed.error)); return }
    if (mpesaChanged && !window.confirm('Changing M-Pesa details takes your hotel offline until Campus Food verifies the new number. Continue?')) return
    setErrors({}); setBusy(true); setMsg(null)
    try {
      const logoPath = logo ? await uploadImage(`vendors/${v.id}/brand`, logo) : v.logoPath
      const coverPath = cover ? await uploadImage(`vendors/${v.id}/brand`, cover) : v.coverPath
      const { error } = await db().from('vendors').update({
        name: parsed.data.name, location: parsed.data.location, phone: parsed.data.phone.startsWith('+') ? parsed.data.phone : `+254${parsed.data.phone.replace(/^(\+?254|0)/, '')}`,
        paymentType: parsed.data.paymentType, mpesaShortcode: parsed.data.mpesaShortcode,
        headOfficeNumber: parsed.data.paymentType === 'till' ? parsed.data.headOfficeNumber : null, mpesaAccountName: parsed.data.mpesaAccountName || null,
        description: extra.description || null, openingHours: extra.openingHours || null,
        prepMinutes: Math.min(120, Math.max(5, Number(extra.prepMinutes) || 20)), isOpen: extra.isOpen, logoPath, coverPath,
      }).eq('id', v.id)
      if (error) throw error
      reloadVendor()
      setMsg({ tone: 'success', text: mpesaChanged ? 'Saved. Your hotel is offline until the new M-Pesa details are verified.' : 'Saved.' })
    } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} noValidate className="mt-10 grid max-w-5xl gap-14 lg:grid-cols-2">
      <section className="flex flex-col gap-6">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Hotel profile</h2>
        <Checkbox label="Open for orders now" checked={extra.isOpen} onChange={(b) => setExtra({ ...extra, isOpen: b })} hint="Turn off when the kitchen closes or is too busy." />
        <TextField label="Hotel name" value={form.name} onChange={(x) => setForm({ ...form, name: x })} error={errors.name} />
        <TextField label="Where it is" value={form.location} onChange={(x) => setForm({ ...form, location: x })} error={errors.location} />
        <TextField label="Kitchen phone" type="tel" value={form.phone} onChange={(x) => setForm({ ...form, phone: x })} error={errors.phone} />
        <TextArea label="About the hotel" value={extra.description} onChange={(x) => setExtra({ ...extra, description: x })} rows={2} />
        <div className="grid grid-cols-2 gap-6">
          <TextField label="Opening hours" value={extra.openingHours} onChange={(x) => setExtra({ ...extra, openingHours: x })} placeholder="7 AM – 10 PM" />
          <TextField label="Usual prep time (min)" inputMode="numeric" value={extra.prepMinutes} onChange={(x) => setExtra({ ...extra, prepMinutes: x.replace(/\D/g, '') })} />
        </div>
        <label className="flex cursor-pointer items-center gap-4">
          <FoodImage path={v.logoPath} name={v.name} width={160} shape="circle" className="h-16 w-16" />
          <span className="link font-bold">{logo ? logo.name : 'Upload a logo'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex cursor-pointer items-center gap-4">
          <FoodImage path={v.coverPath} name={`${v.name} cover`} width={320} className="h-16 w-28" />
          <span><span className="link font-bold">{cover ? cover.name : 'Upload a cover photo'}</span><span className="story block text-xs text-muted">Shown above your dishes on the menu.</span></span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
        </label>
      </section>
      <section className="flex flex-col gap-6">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">M-Pesa</h2>
        <p className={`font-bold ${v.mpesaVerified ? 'text-ok' : 'text-danger'}`}>
          {v.mpesaVerified ? `Verified ${v.verifiedAt ? dateTime(v.verifiedAt) : ''}` : 'Not verified yet. Campus Food will contact you for a KES 1 test payment.'}
        </p>
        <MpesaFields form={form} set={(f) => setForm({ ...form, ...f })} errors={errors} />
        {mpesaChanged ? <Notice tone="error">Saving these M-Pesa details takes the hotel offline until they are verified again.</Notice> : null}
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <button type="submit" className="btn self-start" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </section>
    </form>
  )
}


type TeamMember = { userId: string; fullName: string; email: string; phone: string | null; phoneVerified: boolean; avatarPath: string | null
  memberRole: string; joinedAt: string; accountSince: string }

export function VendorStaff() {
  const { vendor } = useVendor()
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  useEffect(() => setTitle('Hotel staff'), [])
  const { data: members, reload } = useLoad(async () => {
    try {
      return (await rpc<TeamMember[]>('vendorTeamProfiles', { pVendorId: vendor!.id })) ?? []
    } catch {
      // Before migration 23 is live: the older team lookup (no phone or dates).
      const [rows, photos] = await Promise.all([
        rpc<{ userId: string; fullName: string; email: string; memberRole: string }[]>('vendorTeam', { pVendorId: vendor!.id }),
        rpc<{ userId: string; avatarPath: string | null }[]>('vendorTeamPhotos', { pVendorId: vendor!.id }).catch(() => []),
      ])
      return (rows ?? []).map((r) => ({ ...r, phone: null, phoneVerified: false, joinedAt: '', accountSince: '',
        avatarPath: (photos ?? []).find((x) => x.userId === r.userId)?.avatarPath ?? null }))
    }
  }, [] as TeamMember[], [vendor?.id])

  async function add(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    try { await rpc('addVendorMember', { pVendorId: vendor!.id, pEmail: email, pMemberRole: role }); setEmail(''); setOpen(false); reload() } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  async function remove(userId: string) {
    try { await rpc('removeVendorMember', { pVendorId: vendor!.id, pUserId: userId }); reload() } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  return (
    <div className="mt-4">
      <h2 className="sr-only">Staff at {vendor!.name}</h2>
      <HeaderActions>
        <button type="button" className="btn" onClick={() => setOpen(true)}>+ Team member</button>
        <span className="ml-auto self-center text-xs text-muted">{members.length} people at {vendor!.name}</span>
      </HeaderActions>
      {msg && !open ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => (
          <ProfileCard key={m.userId} name={m.fullName || m.email} avatarPath={m.avatarPath}
            role={m.memberRole === 'manager' ? 'Manager' : 'Kitchen staff'} roleTone={m.memberRole === 'manager' ? 'brand' : 'muted'}
            badge={m.userId === session?.user.id ? <span className="text-xs font-bold text-muted">You</span> : null}
            details={[['Email', m.email], ['Phone', <PhoneValue key="p" phone={m.phone} verified={m.phoneVerified} />], ['Hotel', vendor!.name],
                      ['On the team since', shortDate(m.joinedAt)], ['Account since', shortDate(m.accountSince)]]}>
            {m.userId !== session?.user.id ? <button type="button" className="btn btn-ghost px-4 py-1.5 text-danger" onClick={() => remove(m.userId)}>Remove from team</button> : null}
          </ProfileCard>
        ))}
      </div>
      <Sheet open={open} title="Add a team member" onClose={() => setOpen(false)}>
        <form onSubmit={add} className="flex flex-col gap-6">
          <TextField label="Their email" type="email" value={email} onChange={setEmail} />
          <Select label="Role" value={role} onChange={setRole} options={[{ value: 'staff', label: 'Kitchen staff' }, { value: 'manager', label: 'Manager' }]} />
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <button type="submit" className="btn self-start" disabled={!email.includes('@')}>Add</button>
        </form>
      </Sheet>
    </div>
  )
}

/** Sales, success measures and full order history for this hotel. Dates and search sit in the header bar. */
export function VendorReports() {
  const { vendor } = useVendor()
  const [from, setFrom] = useState(daysAgoIso(13))
  const [to, setTo] = useState(todayIso())
  const [q, setQ] = useState('')
  useEffect(() => setTitle('Sales and history'), [])
  const { data, error } = useLoad(async () => {
    const [rows, bal] = await Promise.all([
      rpc<DailySummaryRow[]>('dailySummary', { pFrom: from, pTo: to, pVendorId: vendor!.id }),
      rpc<{ vendorId: string; balance: number; feesOwed: number; settled: number }[]>('vendorBalances'),
    ])
    return { rows: rows ?? [], balance: (bal ?? []).find((b) => b.vendorId === vendor!.id) }
  }, { rows: [] as DailySummaryRow[], balance: undefined as { balance: number; feesOwed: number; settled: number } | undefined }, [vendor?.id, from, to])
  const sum = (k: keyof DailySummaryRow) => data.rows.reduce((n, r) => n + Number(r[k] ?? 0), 0)
  return (
    <div className="mt-4">
      <h2 className="sr-only">Sales and history</h2>
      <HeaderActions>
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
        <input className="glass ml-auto w-60 rounded-full px-4 py-1.5 text-xs outline-none" placeholder="Search orders: reference, name or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
      </HeaderActions>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <VendorFees />
      <Tiles min="10rem">
        <Stat label="Paid orders" value={sum('ordersPaid')} tone="brand" />
        <Stat label="Food sales" value={kes(sum('foodSales'))} tone="leaf" note="yours, paid to your M-Pesa" />
        <Stat label="Refunds" value={kes(sum('refunds'))} tone="danger" />
        <Stat label="Fees owed to Campus Food" value={kes(data.balance?.balance ?? 0)} tone="gold" note="delivery and platform fees" />
      </Tiles>
      <div className="mt-12"><AnalyticsBoard vendorId={vendor!.id} from={from} to={to} /></div>
      <div className="mt-12"><MetricsPanel vendorId={vendor!.id} title="How your kitchen is performing" from={from} to={to} /></div>
      <OrderHistory vendorId={vendor!.id} q={q} />
    </div>
  )
}

/** Weekend offers and dinners the hotel posts on the home page. */
export function VendorOffers() {
  const { vendor } = useVendor()
  const [form, setForm] = useState({ title: '', body: '', eventDate: todayIso(), menuItemId: '' })
  const [file, setFile] = useState<File | null>(null)
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  useEffect(() => setTitle('Hotel offers'), [])
  const { data, reload } = useLoad(async () => {
    const [o, i] = await Promise.all([
      db().from('offers').select('*').eq('vendorId', vendor!.id).order('eventDate', { ascending: false }),
      db().from('menuItems').select('id,name,imagePath').eq('vendorId', vendor!.id).order('name'),
    ])
    return { offers: (o.data ?? []) as Offer[], items: (i.data ?? []) as Pick<MenuItem, 'id' | 'name' | 'imagePath'>[] }
  }, { offers: [] as Offer[], items: [] as Pick<MenuItem, 'id' | 'name' | 'imagePath'>[] }, [vendor?.id])
  async function add(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (form.title.trim().length < 3) { setMsg({ tone: 'error', text: 'Give the offer a title' }); return }
    try {
      const imagePath = file ? await uploadImage(`vendors/${vendor!.id}/offers`, file) : null
      const { error } = await db().from('offers').insert({ vendorId: vendor!.id, title: form.title.trim(), body: form.body.trim() || null, eventDate: form.eventDate, menuItemId: form.menuItemId || null, imagePath })
      if (error) throw error
      setForm({ title: '', body: '', eventDate: todayIso(), menuItemId: '' }); setFile(null); setOpen(false); reload()
    } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  async function toggle(o: Offer) {
    await db().from('offers').update({ isPublished: !o.isPublished }).eq('id', o.id)
    reload()
  }
  return (
    <div className="mt-4">
      <h2 className="sr-only">Offers</h2>
      <HeaderActions>
        <button type="button" className="btn" onClick={() => setOpen(true)}>+ Offer</button>
        <span className="ml-auto self-center text-xs text-muted">{data.offers.filter((o) => o.isPublished).length} showing on the home page</span>
      </HeaderActions>
      {data.offers.length === 0 ? null : (
        <Tiles min="14rem">
          {data.offers.map((o) => {
            const dish = data.items.find((i) => i.id === o.menuItemId)
            return (
              <article key={o.id} className="flex flex-col gap-2">
                <FoodImage path={o.imagePath ?? dish?.imagePath} name={o.title} width={480} className="aspect-[4/3] w-full !rounded-[1.25rem]" />
                <p className="font-extrabold">{o.title}</p>
                <p className="text-xs text-muted">{o.eventDate}{dish ? ` · ${dish.name}` : ''}</p>
                <Checkbox label={o.isPublished ? 'Showing' : 'Hidden'} checked={o.isPublished} onChange={() => toggle(o)} />
              </article>
            )
          })}
        </Tiles>
      )}
      <Sheet open={open} title="Post an offer" onClose={() => setOpen(false)}>
        <form onSubmit={add} className="flex flex-col gap-6">
          <TextField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Friday pilau night" />
          <TextArea label="Details" value={form.body} onChange={(v) => setForm({ ...form, body: v })} rows={2} />
          <div className="grid grid-cols-2 gap-6">
            <TextField label="Date" type="date" value={form.eventDate} onChange={(v) => setForm({ ...form, eventDate: v })} />
            <Select label="Featured dish" value={form.menuItemId} onChange={(v) => setForm({ ...form, menuItemId: v })} placeholder="None" options={data.items.map((i) => ({ value: i.id, label: i.name }))} />
          </div>
          <label className="link cursor-pointer font-bold">{file ? file.name : 'Add a photo (optional)'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <button type="submit" className="btn self-start">Post offer</button>
        </form>
      </Sheet>
    </div>
  )
}
