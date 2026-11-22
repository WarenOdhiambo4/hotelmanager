import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { AnalyticsBoard } from '../../components/Analytics'
import { FoodImage } from '../../components/FoodImage'
import { CartoonAvatar } from '../../components/Icons'
import { HeaderActions, Sheet } from '../../components/HeaderBar'
import { MetricsPanel } from '../../components/Metrics'
import { Facts, Initial, Stat, Tile, Tiles, orderTone, type Tone } from '../../components/Tiles'
import { Checkbox, Notice, Stars, TextArea, TextField } from '../../components/form'
import { useLoad, useSettings } from '../../lib/data'
import type { SiteImage } from '../../lib/data'
import { dateTime, daysAgoIso, kes, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, todayIso } from '../../lib/format'
import { setTitle, youtubeId } from '../../lib/site'
import { db, friendly, mediaUrl, rpc, supabase, uploadImage } from '../../lib/supabase'
import type { DailySummaryRow, DeliveryZone, MenuItem, Offer, Order, OrderStatus, Payment, PaymentStatus, PlatformSettings, Refund, SiteVideo, Vendor } from '../../lib/types'
import { fieldErrors, vendorEditSchema, vendorSchema, type FieldErrors } from '../../lib/validation'
import { MpesaFields, type VendorForm } from '../vendor/VendorPages'
import { Stroke } from '../../components/Stroke'
import { DateRange } from '../../components/DateRange'
import { PhoneValue, ProfileCard, shortDate } from '../../components/ProfileCard'

const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]
const label = 'text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-muted'
type Msg = { tone: 'error' | 'success'; text: string } | null

/** Page body for the staff portal: no heading or panel; the title only names the browser tab. */
function Page({ title, children, tools }: { title: string; children: ReactNode; tools?: ReactNode }) {
  useEffect(() => setTitle(`Admin · ${title}`), [title])
  return (
    <div>
      <h1 className="sr-only">{title}</h1>
      {tools ? <HeaderActions>{tools}</HeaderActions> : null}
      {children}
    </div>
  )
}

/** Compact controls for the header bar. */
const barField = 'field !w-auto !py-1 !text-xs'
function BarDate({ label: l, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="flex flex-col text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted">{l}<input type="date" className={barField} value={value} onChange={(e) => onChange(e.target.value)} /></label>
}
function BarSelect({ label: l, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <label className="flex flex-col text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted">{l}
      <select className={barField} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
function BarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input className="glass w-56 rounded-full px-4 py-1.5 text-xs outline-none" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><h2 className={label}>{title}</h2>{aside}</div>
      {children}
    </section>
  )
}

const payTone = (s: PaymentStatus): Tone => (s === 'paid' ? 'ok' : ['failed', 'expired', 'cancelled'].includes(s) ? 'danger' : 'gold')

/* ------------------------------------------------------------------------------------------ */
/* Overview                                                                                    */
/* ------------------------------------------------------------------------------------------ */
export function AdminOverview() {
  const [from, setFrom] = useState(daysAgoIso(29))
  const [to, setTo] = useState(todayIso())
  const { data } = useLoad(async () => {
    const today = todayIso()
    const [summary, pendingVendors, refunds, failed, open, featured] = await Promise.all([
      // Support staff do not see money summaries; the call is refused for them, so fall back to none.
      rpc<DailySummaryRow[]>('dailySummary', { pFrom: today, pTo: today, pVendorId: null }).catch(() => [] as DailySummaryRow[]),
      db().from('vendors').select('id,name,logoPath,createdAt').eq('mpesaVerified', false),
      db().from('refunds').select('id', { count: 'exact', head: true }).in('status', ['requested', 'approved']),
      db().from('payments').select('id', { count: 'exact', head: true }).in('status', ['failed', 'expired']).gte('initiatedAt', new Date(Date.now() - 86400000).toISOString()),
      db().from('orders').select('id,reference,status,paidAt,estimatedReadyAt,totalAmount,customerName,vendors(name)').in('status', ['paid', 'accepted', 'preparing']).order('paidAt').limit(60),
      db().from('menuItems').select('*').eq('isSignature', true).not('imagePath', 'is', null).limit(6),
    ])
    const now = Date.now()
    const live = (open.data ?? []) as unknown as (Order & { vendors: { name: string } | null })[]
    return {
      rows: summary ?? [], pendingVendors: (pendingVendors.data ?? []) as Vendor[], refunds: refunds.count ?? 0, failed: failed.count ?? 0,
      late: live.filter((o) => o.status !== 'paid' && o.estimatedReadyAt && new Date(o.estimatedReadyAt).getTime() < now),
      waiting: live.filter((o) => o.status === 'paid'),
      featured: (featured.data ?? []) as MenuItem[],
    }
  }, { rows: [] as DailySummaryRow[], pendingVendors: [] as Vendor[], refunds: 0, failed: 0, late: [] as (Order & { vendors: { name: string } | null })[], waiting: [] as (Order & { vendors: { name: string } | null })[], featured: [] as MenuItem[] })
  const sum = (k: keyof DailySummaryRow) => data.rows.reduce((n, r) => n + Number(r[k] ?? 0), 0)
  const hero = data.featured[new Date().getHours() % Math.max(1, data.featured.length)]
  return (
    <Page title="Overview" tools={<><DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} /></>}>
      <div className="grid gap-10 xl:grid-cols-[1fr_18rem]">
        <div>
          <Tiles min="10rem" className="!gap-y-8">
            <Stat label="Orders today" value={sum('ordersPlaced')} note={`${sum('ordersPaid')} paid · ${sum('ordersDelivered')} delivered`} />
            <Stat label="Food sales" value={kes(sum('foodSales'))} tone="leaf" note="paid to hotels" />
            <Stat label="Platform revenue" value={kes(sum('platformRevenue'))} tone="ok" note={`${kes(sum('platformFees'))} fees · ${kes(sum('deliveryCollections'))} delivery`} />
            <Stat label="Refunds paid" value={kes(sum('refunds'))} tone="danger" />
          </Tiles>
          <Section title="Needs attention">
            <Tiles min="13rem">
              <Tile tone={data.refunds ? 'brand' : 'muted'} title="Refunds" to="/refunds" figure={data.refunds} figureNote="to decide or complete" />
              <Tile tone={data.pendingVendors.length ? 'gold' : 'muted'} title="Hotels to verify" to="/vendors" figure={data.pendingVendors.length} figureNote="waiting for M-Pesa" />
              <Tile tone={data.failed ? 'danger' : 'muted'} title="Failed payments" to="/payments" figure={data.failed} figureNote="last 24 hours" />
              <Tile tone={data.waiting.length ? 'brand' : 'muted'} title="Not yet accepted" to="/orders" figure={data.waiting.length} figureNote="paid, hotel has not accepted" />
            </Tiles>
          </Section>
          <Section title="Running late">
            {data.late.length === 0 ? null : (
              <Tiles min="14rem">
                {data.late.map((o) => (
                  <Tile key={o.id} tone="danger" kicker={o.vendors?.name} title={o.reference} to={`/orders/${o.id}`} figure={kes(o.totalAmount)}>
                    <p className="text-xs text-danger">Due {dateTime(o.estimatedReadyAt)} · {ORDER_STATUS_LABEL[o.status]}</p>
                  </Tile>
                ))}
              </Tiles>
            )}
          </Section>
        </div>
        {/* The dish of the hour, shown crisp and bright (no blur, no blended glow). */}
        <aside className="w-full max-w-[18rem]">
          {hero ? (
            <figure className="flex items-center gap-4 xl:block">
              <FoodImage path={hero.imagePath} name={hero.name} width={480} className="h-28 w-28 shrink-0 !rounded-[1.25rem] xl:aspect-[4/3] xl:h-auto xl:w-full" />
              <figcaption className="mt-3"><span className={label}>Signature on the menu</span><span className="block font-extrabold">{hero.name} · {kes(hero.price)}</span></figcaption>
            </figure>
          ) : null}
        </aside>
      </div>
      <div className="mt-14"><AnalyticsBoard from={from} to={to} /></div>
      <div className="mt-14"><MetricsPanel from={from} to={to} /></div>
    </Page>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Orders                                                                                      */
/* ------------------------------------------------------------------------------------------ */
export function AdminOrders() {
  const [status, setStatus] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [from, setFrom] = useState(daysAgoIso(2))
  const [q, setQ] = useState('')
  const { data: vendors } = useLoad(async () => ((await db().from('vendors').select('id,name').order('name')).data ?? []) as Vendor[], [])
  const { data: orders, error } = useLoad(async () => {
    let query = db().from('orders').select('*, vendors(name,logoPath)').gte('createdAt', `${from}T00:00:00+03:00`).order('createdAt', { ascending: false }).limit(300)
    if (status) query = query.eq('status', status)
    if (vendorId) query = query.eq('vendorId', vendorId)
    const term = q.trim().replace(/[%,()]/g, '')
    if (term) query = query.or(`reference.ilike.%${term}%,contactPhone.ilike.%${term}%,customerName.ilike.%${term}%`)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as (Order & { vendors: { name: string; logoPath: string | null } | null })[]
  }, [], [status, vendorId, from, q])
  return (
    <Page title="Orders" tools={<>
      <BarSearch value={q} onChange={setQ} placeholder="Reference, name or phone" />
      <BarSelect label="Status" value={status} onChange={setStatus} placeholder="All" options={ORDER_STATUSES.map((st) => ({ value: st, label: ORDER_STATUS_LABEL[st] }))} />
      <BarSelect label="Hotel" value={vendorId} onChange={setVendorId} placeholder="All" options={vendors.map((v) => ({ value: v.id, label: v.name }))} />
      <BarDate label="Since" value={from} onChange={setFrom} />
      <span className="ml-auto self-center text-xs text-muted">{orders.length} orders</span>
    </>}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {orders.length === 0 ? null : (
        <Tiles>
          {orders.map((o) => (
            <Tile key={o.id} tone={orderTone(o.status)} kicker={ORDER_STATUS_LABEL[o.status]} title={o.reference} to={`/orders/${o.id}`} figure={kes(o.totalAmount)}
              visual={<FoodImage path={o.vendors?.logoPath} name={o.vendors?.name ?? 'Hotel'} width={120} shape="circle" className="h-11 w-11" />}>
              <Facts items={[['Hotel', o.vendors?.name], ['Customer', o.customerName || '—'], ['Phone', o.contactPhone], ['Placed', dateTime(o.createdAt)], ['Deliver to', o.deliveryLocation]]} />
            </Tile>
          ))}
        </Tiles>
      )}
    </Page>
  )
}

type HistoryRow = { id: number; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: string }
type DetailItem = { id: string; itemName: string; quantity: number; unitPrice: number; lineTotal: number; menuItems: { imagePath: string | null } | null }

export function AdminOrderDetail() {
  const { id = '' } = useParams()
  const [problem, setProblem] = useState<string | null>(null)
  const { data, reload } = useLoad(async () => {
    const [o, h, p, r] = await Promise.all([
      db().from('orders').select('*, orderItems(*, menuItems(imagePath)), vendors(name,location,phone,logoPath)').eq('id', id).maybeSingle(),
      db().from('orderStatusHistory').select('*').eq('orderId', id).order('createdAt'),
      db().from('payments').select('*').eq('orderId', id).order('initiatedAt'),
      db().from('refunds').select('*').eq('orderId', id).order('createdAt'),
    ])
    return { order: o.data as (Omit<Order, 'vendors' | 'orderItems'> & { vendors: Vendor | null; orderItems: DetailItem[] }) | null, history: (h.data ?? []) as HistoryRow[], payments: (p.data ?? []) as Payment[], refunds: (r.data ?? []) as Refund[] }
  }, { order: null as (Omit<Order, 'vendors' | 'orderItems'> & { vendors: Vendor | null; orderItems: DetailItem[] }) | null, history: [] as HistoryRow[], payments: [] as Payment[], refunds: [] as Refund[] }, [id])
  const o = data.order
  if (!o) return <p className="text-muted">Loading…</p>
  const cancel = async () => { try { await rpc('updateOrderStatus', { pOrderId: o.id, pStatus: 'cancelled', pNote: 'Cancelled by admin' }); reload() } catch (e) { setProblem((e as Error).message) } }
  return (
    <Page title={o.reference}>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <Tiles min="15rem">
        <Tile tone={orderTone(o.status)} kicker={ORDER_STATUS_LABEL[o.status]} title={o.reference} figure={kes(o.totalAmount)}
          figureNote={Number(o.refundedAmount) ? `refunded ${kes(o.refundedAmount)}` : undefined}>
          <Facts items={[['Food', kes(o.foodSubtotal)], ['Delivery', kes(o.deliveryFee)], ['Platform fee', kes(o.platformFee)], ['Placed', dateTime(o.createdAt)], ['Paid', o.paidAt ? dateTime(o.paidAt) : 'not paid']]} />
          {['draft', 'awaitingPayment', 'paymentPending', 'paymentFailed'].includes(o.status) ? <button type="button" className="btn btn-ghost self-start" onClick={cancel}>Cancel unpaid order</button> : null}
        </Tile>
        <Tile tone="leaf" kicker="Hotel" title={o.vendors?.name ?? 'Hotel'} visual={<FoodImage path={o.vendors?.logoPath} name={o.vendors?.name ?? 'Hotel'} width={120} shape="circle" className="h-11 w-11" />}>
          <Facts items={[['Location', o.vendors?.location ?? '—'], ['Kitchen', o.vendors?.phone ? <a className="link" href={`tel:${o.vendors.phone}`}>{o.vendors.phone}</a> : '—']]} />
        </Tile>
        <Tile tone="gold" kicker="Customer" title={o.customerName || 'Customer'} visual={<CartoonAvatar className="h-11 w-11" />}>
          <Facts items={[['Phone', <a key="p" className="link" href={`tel:${o.contactPhone}`}>{o.contactPhone}</a>], ['Deliver to', o.deliveryLocation], ['Notes', o.deliveryInstructions ?? '—']]} />
        </Tile>
      </Tiles>

      <Section title="What was ordered">
        <Tiles min="11rem">
          {o.orderItems.map((i) => (
            <article key={i.id} className="flex flex-col gap-2">
              <FoodImage path={i.menuItems?.imagePath} name={i.itemName} width={400} className="aspect-square w-full !rounded-[1.5rem]" />
              <p className="font-extrabold">{i.quantity} × {i.itemName}</p>
              <p className="text-xs text-muted">{kes(i.unitPrice)} each · {kes(i.lineTotal)}</p>
            </article>
          ))}
        </Tiles>
      </Section>

      <Section title="Timeline">
        <div className="no-scrollbar flex gap-6 overflow-x-auto pb-2">
          {data.history.map((h) => (
            <div key={h.id} className="w-40 shrink-0">
              <Stroke seed={h.id} className="mb-2" />
              <p className="text-sm font-extrabold">{ORDER_STATUS_LABEL[h.toStatus]}</p>
              <p className="text-xs text-muted">{dateTime(h.createdAt)}</p>
              {h.note ? <p className="mt-1 text-xs">{h.note}</p> : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Payment attempts">
        {data.payments.length === 0 ? null : (
          <Tiles min="15rem">
            {data.payments.map((p) => (
              <Tile key={p.id} tone={payTone(p.status)} kicker={PAYMENT_STATUS_LABEL[p.status]} title={p.mpesaReceiptNumber ?? 'No receipt'} figure={kes(p.amount)}>
                <Facts items={[['Phone', p.phone], ['Pays to', p.transactionType === 'CustomerBuyGoodsOnline' ? 'Till' : 'Paybill'], ['Started', dateTime(p.initiatedAt)], ['Confirmed by', p.source ?? '—']]} />
                {p.resultDesc ? <p className="text-xs text-muted">{p.resultDesc}</p> : null}
              </Tile>
            ))}
          </Tiles>
        )}
      </Section>

      {data.refunds.length ? (
        <Section title="Refunds">
          <Tiles min="15rem">
            {data.refunds.map((r) => (
              <Tile key={r.id} tone={r.status === 'completed' ? 'ok' : r.status === 'rejected' ? 'muted' : 'brand'} kicker={r.status} title={r.mpesaReference ?? 'No reversal yet'} figure={kes(r.amount)}>
                <p className="text-xs">“{r.reason}”</p>
              </Tile>
            ))}
          </Tiles>
        </Section>
      ) : null}
    </Page>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Refunds                                                                                     */
/* ------------------------------------------------------------------------------------------ */
export function AdminRefunds() {
  const [msg, setMsg] = useState<string | null>(null)
  const { data: refunds, reload } = useLoad(async () => {
    const { data, error } = await db().from('refunds').select('*, orders(reference,customerName,contactPhone,totalAmount,vendorId,status,vendors(name))').order('createdAt', { ascending: false }).limit(100)
    if (error) throw error
    return (data ?? []) as Refund[]
  }, [])
  const open = refunds.filter((r) => r.status === 'requested' || r.status === 'approved')
  const closed = refunds.filter((r) => r.status === 'rejected' || r.status === 'completed')
  return (
    <Page title="Refunds">
      {msg ? <Notice tone="error">{msg}</Notice> : null}
      <Section title={`Open · ${open.length}`}>
        {open.length === 0 ? null : (
          <Tiles min="18rem">{open.map((r) => <RefundTile key={r.id} refund={r} onDone={reload} onError={setMsg} />)}</Tiles>
        )}
      </Section>
      {closed.length ? (
        <Section title={`Closed · ${closed.length}`}>
          <Tiles min="15rem">
            {closed.map((r) => (
              <Tile key={r.id} tone={r.status === 'completed' ? 'ok' : 'muted'} kicker={r.status === 'completed' ? 'Refunded' : 'Declined'} title={r.orders?.reference ?? 'Order'} to={`/orders/${r.orderId}`} figure={kes(r.amount)}>
                <p className="text-xs text-muted">{r.orders?.vendors?.name} · {r.status === 'completed' ? r.mpesaReference : r.decisionNote ?? r.reason}</p>
              </Tile>
            ))}
          </Tiles>
        </Section>
      ) : null}
    </Page>
  )
}

function RefundTile({ refund: r, onDone, onError }: { refund: Refund; onDone: () => void; onError: (m: string | null) => void }) {
  const [note, setNote] = useState('')
  const [ref, setRef] = useState('')
  const { profile } = useAuth()
  const canDecide = profile?.role === 'admin'
  const canComplete = profile?.role === 'admin' || profile?.role === 'finance'
  const run = async (fn: () => Promise<unknown>) => { onError(null); try { await fn(); onDone() } catch (e) { onError((e as Error).message) } }
  return (
    <Tile tone={r.status === 'approved' ? 'gold' : 'brand'} kicker={r.status === 'approved' ? 'Approved · reverse on M-Pesa' : 'Requested'} title={r.orders?.reference ?? 'Order'} to={`/orders/${r.orderId}`} figure={kes(r.amount)}
      visual={<CartoonAvatar className="h-11 w-11" />}>
      <Facts items={[['Hotel', r.orders?.vendors?.name], ['Customer', r.orders?.customerName], ['Phone', r.orders?.contactPhone], ['Asked', dateTime(r.createdAt)]]} />
      <p className="text-sm">“{r.reason}”</p>
      {r.status === 'requested' && !canDecide ? <p className="text-xs font-bold text-muted">Waiting for an administrator.</p>
        : r.status === 'approved' && !canComplete ? <p className="text-xs font-bold text-muted">Finance records the M-Pesa reversal.</p>
          : r.status === 'requested' ? (
            <>
              <input className="field !text-sm" placeholder="Note to the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Decision note" />
              <div className="flex gap-3">
                <button type="button" className="btn" onClick={() => run(() => rpc('decideRefund', { pRefundId: r.id, pApprove: true, pNote: note || null }))}>Approve</button>
                <button type="button" className="btn btn-ghost" onClick={() => run(() => rpc('decideRefund', { pRefundId: r.id, pApprove: false, pNote: note || null }))}>Decline</button>
              </div>
            </>
          ) : (
            <>
              <input className="field !text-sm uppercase" placeholder="M-Pesa reversal code" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="M-Pesa reversal code" />
              <button type="button" className="btn self-start" disabled={ref.trim().length < 6} onClick={() => run(() => rpc('completeRefund', { pRefundId: r.id, pMpesaReference: ref }))}>Mark refunded</button>
            </>
          )}
    </Tile>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Payments                                                                                    */
/* ------------------------------------------------------------------------------------------ */
export function AdminPayments() {
  const [status, setStatus] = useState('')
  const { data: payments } = useLoad(async () => {
    let q = db().from('payments').select('*, orders(reference), vendors(name,logoPath)').order('initiatedAt', { ascending: false }).limit(200)
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as (Payment & { orders: { reference: string } | null; vendors: { name: string; logoPath: string | null } | null })[]
  }, [], [status])
  const paid = payments.filter((p) => p.status === 'paid')
  return (
    <Page title="Payments" tools={<BarSelect label="Status" value={status} onChange={setStatus} placeholder="All attempts" options={Object.entries(PAYMENT_STATUS_LABEL).map(([value, l]) => ({ value, label: l }))} />}>
      <Tiles min="10rem" className="mb-10">
        <Stat label="Attempts shown" value={payments.length} tone="muted" />
        <Stat label="Paid" value={paid.length} tone="ok" note={kes(paid.reduce((n, p) => n + Number(p.amount), 0))} />
        <Stat label="Failed or expired" value={payments.filter((p) => ['failed', 'expired', 'cancelled'].includes(p.status)).length} tone="danger" />
      </Tiles>
      {payments.length === 0 ? null : (
        <Tiles>
          {payments.map((p) => (
            <Tile key={p.id} tone={payTone(p.status)} kicker={`${PAYMENT_STATUS_LABEL[p.status]}${p.source === 'query' ? ' · by status query' : ''}`}
              title={p.orders?.reference ?? 'Order'} to={`/orders/${p.orderId}`} figure={kes(p.amount)}
              visual={<FoodImage path={p.vendors?.logoPath} name={p.vendors?.name ?? 'Hotel'} width={120} shape="circle" className="h-11 w-11" />}>
              <Facts items={[['Hotel', p.vendors?.name], ['Phone', p.phone], ['M-Pesa', p.mpesaReceiptNumber ?? '—'], ['When', dateTime(p.initiatedAt)]]} />
              {p.status !== 'paid' && p.resultDesc ? <p className="text-xs text-muted">{p.resultDesc}</p> : null}
            </Tile>
          ))}
        </Tiles>
      )}
    </Page>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Finance                                                                                     */
/* ------------------------------------------------------------------------------------------ */
type Balance = { vendorId: string; vendorName: string; feesOwed: number; settled: number; balance: number }

export function AdminFinance() {
  const [from, setFrom] = useState(daysAgoIso(6))
  const [to, setTo] = useState(todayIso())
  const [vendorId, setVendorId] = useState('')
  const { data, reload } = useLoad(async () => {
    const [rows, balances] = await Promise.all([
      rpc<DailySummaryRow[]>('dailySummary', { pFrom: from, pTo: to, pVendorId: vendorId || null }),
      rpc<Balance[]>('vendorBalances'),
    ])
    return { rows: rows ?? [], balances: balances ?? [] }
  }, { rows: [] as DailySummaryRow[], balances: [] as Balance[] }, [from, to, vendorId])
  const total = (k: keyof DailySummaryRow) => data.rows.reduce((n, r) => n + Number(r[k] ?? 0), 0)
  const csv = () => {
    const head = ['day', 'vendorName', 'ordersPlaced', 'ordersPaid', 'ordersDelivered', 'ordersCancelled', 'foodSales', 'deliveryCollections', 'platformFees', 'refunds', 'vendorPayable', 'platformRevenue'] as const
    const body = [head.join(','), ...data.rows.map((r) => head.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }))
    a.download = `campus-food-${from}-to-${to}.csv`
    a.click()
  }
  return (
    <Page title="Finance" tools={<>
      <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
      <BarSelect label="Hotel" value={vendorId} onChange={setVendorId} placeholder="All hotels" options={data.balances.map((b) => ({ value: b.vendorId, label: b.vendorName }))} />
      <button type="button" className="btn btn-ghost ml-auto" onClick={csv}>Export CSV</button>
    </>}>
      <Tiles min="10rem">
        <Stat label="Food sales" value={kes(total('foodSales'))} tone="leaf" note="belongs to hotels" />
        <Stat label="Delivery fees" value={kes(total('deliveryCollections'))} tone="gold" />
        <Stat label="Platform fees" value={kes(total('platformFees'))} tone="brand" />
        <Stat label="Refunds" value={kes(total('refunds'))} tone="danger" />
        <Stat label="Hotels keep" value={kes(total('vendorPayable'))} tone="leaf" />
        <Stat label="Platform revenue" value={kes(total('platformRevenue'))} tone="ok" />
      </Tiles>

      <Section title="What each hotel owes">
        {data.balances.length === 0 ? null : (
          <Tiles min="16rem">{data.balances.map((b) => <BalanceTile key={b.vendorId} balance={b} onDone={reload} />)}</Tiles>
        )}
      </Section>

      <Section title="Day by day">
        {data.rows.length === 0 ? null : (
          <Tiles min="15rem">
            {data.rows.map((r) => (
              <Tile key={`${r.day}-${r.vendorId}`} tone="brand" kicker={r.day} title={r.vendorName} figure={kes(r.platformRevenue)} figureNote="platform revenue">
                <Facts items={[['Orders', `${r.ordersPlaced} placed · ${r.ordersPaid} paid`], ['Delivered', r.ordersDelivered], ['Cancelled', r.ordersCancelled], ['Food sales', kes(r.foodSales)],
                  ['Delivery', kes(r.deliveryCollections)], ['Platform fees', kes(r.platformFees)], ['Refunds', kes(r.refunds)], ['Hotel keeps', kes(r.vendorPayable)]]} />
              </Tile>
            ))}
          </Tiles>
        )}
      </Section>
    </Page>
  )
}

function BalanceTile({ balance: b, onDone }: { balance: Balance; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [msg, setMsg] = useState<Msg>(null)
  async function record(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    try { await rpc('recordSettlement', { pVendorId: b.vendorId, pAmount: Number(amount), pMemo: memo }); setAmount(''); setMemo(''); setMsg({ tone: 'success', text: 'Settlement recorded.' }); onDone() } catch (err) { setMsg({ tone: 'error', text: (err as Error).message }) }
  }
  return (
    <Tile tone={Number(b.balance) > 0 ? 'brand' : 'ok'} kicker={Number(b.balance) > 0 ? 'Owes the platform' : 'Settled'} title={b.vendorName} figure={kes(b.balance)}
      visual={<Initial text={b.vendorName} tone={Number(b.balance) > 0 ? 'brand' : 'ok'} />}>
      <Facts items={[['Fees collected', kes(b.feesOwed)], ['Settled so far', kes(b.settled)]]} />
      <form onSubmit={record} className="flex flex-wrap items-end gap-2">
        <input className="field w-24 !text-sm" inputMode="decimal" placeholder="KES" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount received" />
        <input className="field min-w-0 flex-1 !text-sm" placeholder="M-Pesa code or note" value={memo} onChange={(e) => setMemo(e.target.value)} aria-label="Reference" />
        <button type="submit" className="btn" disabled={!(Number(amount) > 0)}>Record</button>
      </form>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </Tile>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Hotels                                                                                      */
/* ------------------------------------------------------------------------------------------ */
export function AdminVendors() {
  const [registering, setRegistering] = useState(false)
  const { data: vendors, reload } = useLoad(async () => {
    const { data, error } = await db().from('vendors').select('*').order('mpesaVerified').order('name')
    if (error) throw error
    return (data ?? []) as Vendor[]
  }, [])
  const live = vendors.filter((v) => v.isActive).length
  return (
    <Page title="Hotels" tools={<button type="button" className="btn" onClick={() => setRegistering(true)}>+ Hotel</button>}>
      <Sheet open={registering} title="Register a hotel" onClose={() => setRegistering(false)}>
        <RegisterHotelForm onDone={reload} onClose={() => setRegistering(false)} />
      </Sheet>
      <Tiles min="10rem">
        <Stat label="Hotels" value={vendors.length} tone="muted" />
        <Stat label="Live" value={live} tone="ok" />
        <Stat label="Waiting for verification" value={vendors.filter((v) => !v.mpesaVerified).length} tone="gold" />
      </Tiles>
      <div className="mt-10">
        {vendors.length === 0 ? null : (
          <Tiles min="19rem">{vendors.map((v) => <HotelTile key={v.id} vendor={v} onChange={reload} />)}</Tiles>
        )}
      </div>
    </Page>
  )
}

/** Only administrators create hotels. The manager needs a Campus Food account; they can also be appointed later. */
function RegisterHotelForm({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const blank: VendorForm = { name: '', location: '', phone: '', paymentType: 'paybill', mpesaShortcode: '', headOfficeNumber: '', mpesaAccountName: '' }
  const [form, setForm] = useState<VendorForm>(blank)
  const [manager, setManager] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors<VendorForm>>({})
  const [msg, setMsg] = useState<Msg>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = vendorSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<VendorForm>(parsed.error)); return }
    setErrors({}); setMsg(null)
    try {
      const vendorId = await rpc<string>('createVendor', {
        pName: parsed.data.name, pLocation: parsed.data.location, pPhone: parsed.data.phone, pPaymentType: parsed.data.paymentType,
        pShortcode: parsed.data.mpesaShortcode, pHeadOffice: parsed.data.headOfficeNumber || null, pAccountName: parsed.data.mpesaAccountName || null,
        pManagerEmail: manager.trim() || null,
      })
      // Hotel images go to Storage under vendors/<id>/brand and their paths onto the hotel row.
      const logoPath = logo ? await uploadImage(`vendors/${vendorId}/brand`, logo) : null
      const coverPath = cover ? await uploadImage(`vendors/${vendorId}/brand`, cover) : null
      if (logoPath || coverPath) await db().from('vendors').update({ ...(logoPath ? { logoPath } : {}), ...(coverPath ? { coverPath } : {}) }).eq('id', vendorId)
      setMsg({ tone: 'success', text: `${parsed.data.name} registered and offline. Verify its M-Pesa on its tile to put it live.` })
      setForm(blank); setManager(''); setLogo(null); setCover(null); onDone()
    } catch (err) { setMsg({ tone: 'error', text: (err as Error).message }) }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <TextField label="Hotel name" value={form.name} onChange={(x) => setForm({ ...form, name: x })} error={errors.name} />
        <TextField label="Where it is" value={form.location} onChange={(x) => setForm({ ...form, location: x })} error={errors.location} />
        <TextField label="Kitchen phone (order alerts by SMS)" type="tel" value={form.phone} onChange={(x) => setForm({ ...form, phone: x })} error={errors.phone} />
        <TextField label="Manager email (their Campus Food account)" type="email" value={manager} onChange={setManager} hint="Optional now; appoint later from the hotel's tile." />
        <ImagePick label="Logo" file={logo} onPick={setLogo} />
        <ImagePick label="Cover photo (shown above its dishes)" file={cover} onPick={setCover} />
      </div>
      <div className="flex flex-col gap-6">
        <MpesaFields form={form} set={(f) => setForm({ ...form, ...f })} errors={errors} />
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <div className="flex gap-4"><button type="submit" className="btn">Register hotel</button><button type="button" className="link text-sm font-bold" onClick={onClose}>Close</button></div>
      </div>
    </form>
  )
}

/** Admin edits a hotel's details. Changing the Paybill/Till takes the hotel offline until it is verified again (database rule). */
type HotelEdit = VendorForm & { description: string; openingHours: string; prepMinutes: string }
function EditHotelForm({ vendor: v, onDone, onClose }: { vendor: Vendor; onDone: () => void; onClose: () => void }) {
  const [form, setForm] = useState<HotelEdit>({
    name: v.name, location: v.location ?? '', phone: v.phone ?? '', paymentType: v.paymentType ?? 'paybill', mpesaShortcode: v.mpesaShortcode ?? '',
    headOfficeNumber: v.headOfficeNumber ?? '', mpesaAccountName: v.mpesaAccountName ?? '', description: v.description ?? '',
    openingHours: v.openingHours ?? '', prepMinutes: String(v.prepMinutes ?? 20),
  })
  const [errors, setErrors] = useState<FieldErrors<HotelEdit>>({})
  const [msg, setMsg] = useState<Msg>(null)
  // Seller's own platform fee (blank = the standard fee) and seller type; only administrators can change these.
  const [fee, setFee] = useState(v.platformFee === null || v.platformFee === undefined ? '' : String(Number(v.platformFee)))
  const [studentSeller, setStudentSeller] = useState(Boolean(v.isStudentSeller))
  const [feeError, setFeeError] = useState<string | undefined>()
  const { data: settings } = useSettings()
  const set = (f: Partial<HotelEdit>) => setForm({ ...form, ...f })
  const moneyChanged = form.paymentType !== (v.paymentType ?? 'paybill') || form.mpesaShortcode.trim() !== (v.mpesaShortcode ?? '') || form.headOfficeNumber.trim() !== (v.headOfficeNumber ?? '')
  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = vendorEditSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<HotelEdit>(parsed.error)); return }
    const feeValue = fee.trim() === '' ? null : Number(fee)
    if (feeValue !== null && (!Number.isFinite(feeValue) || feeValue < 0 || feeValue > 500)) { setFeeError('Enter an amount from 0 to 500, or leave it blank for the standard fee.'); return }
    setErrors({}); setFeeError(undefined); setMsg(null)
    const d = parsed.data
    const phone = d.phone ? (d.phone.startsWith('+') ? d.phone : `+254${d.phone.replace(/^(?:254|0)/, '')}`) : null
    const { error } = await db().from('vendors').update({
      name: d.name, location: d.location, phone, paymentType: d.paymentType, mpesaShortcode: d.mpesaShortcode || null,
      headOfficeNumber: d.paymentType === 'till' ? d.headOfficeNumber || null : null, mpesaAccountName: d.mpesaAccountName || null,
      description: d.description || null, openingHours: d.openingHours || null, prepMinutes: d.prepMinutes,
      platformFee: feeValue, isStudentSeller: studentSeller,
    }).eq('id', v.id)
    if (error) { setMsg({ tone: 'error', text: friendly(error) }); return }
    setMsg({ tone: 'success', text: moneyChanged && v.mpesaVerified ? 'Saved. The M-Pesa details changed, so the hotel is offline until you verify it again.' : 'Saved.' })
    onDone()
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <TextField label="Hotel name" value={form.name} onChange={(x) => set({ name: x })} error={errors.name} />
      <TextField label="Where it is" value={form.location} onChange={(x) => set({ location: x })} error={errors.location} />
      <TextArea label="Short description (shown to customers)" value={form.description} onChange={(x) => set({ description: x })} error={errors.description} />
      <TextField label="Opening hours" value={form.openingHours} onChange={(x) => set({ openingHours: x })} hint="For example: Mon to Sat, 7:00 am to 10:00 pm" error={errors.openingHours} />
      <TextField label="Usual preparation time (minutes)" type="number" value={form.prepMinutes} onChange={(x) => set({ prepMinutes: x })} error={errors.prepMinutes} />
      <TextField label="Kitchen phone (order alerts by SMS)" type="tel" value={form.phone} onChange={(x) => set({ phone: x })} error={errors.phone} hint="Leave blank until the hotel gives you one." />
      <MpesaFields form={form} set={(f) => set(f)} errors={errors} />
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand">Campus Food fee</p>
        <Checkbox label="Student or small seller (not a hotel)" checked={studentSeller}
          onChange={(x) => { setStudentSeller(x); if (x && fee.trim() === '') setFee('0') }} />
        <TextField label="Platform fee per order (KES)" inputMode="decimal" value={fee} onChange={(x) => setFee(x.replace(/[^\d.]/g, ''))} error={feeError}
          hint={`Leave blank to use the standard fee (KES ${Number(settings.platformFee)}). Use 0 for student sellers and mama mboga. Applies to new orders.`} />
      </div>
      {moneyChanged && v.mpesaVerified ? <Notice tone="error">Changing the Paybill or Till takes {v.name} offline until you verify it again.</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex gap-4"><button type="submit" className="btn">Save changes</button><button type="button" className="link text-sm font-bold" onClick={onClose}>Close</button></div>
    </form>
  )
}

function HotelTile({ vendor: v, onChange }: { vendor: Vendor; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [passkey, setPasskey] = useState('')
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('manager')
  const [msg, setMsg] = useState<Msg>(null)
  const [editing, setEditing] = useState(false)
  const { data: hasKey, reload: reloadKey } = useLoad(async () => rpc<boolean>('vendorHasPasskey', { pVendorId: v.id }), false, [v.id])
  const { data: team, reload: reloadTeam } = useLoad(() => rpc<{ userId: string; fullName: string; email: string; memberRole: string }[]>('vendorTeam', { pVendorId: v.id }), [], [v.id])
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null)
    try { await fn(); setMsg({ tone: 'success', text: ok }); onChange(); reloadKey(); reloadTeam() } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }) }
  }
  const tone: Tone = v.isActive ? 'ok' : v.mpesaVerified ? 'muted' : 'gold'
  const manager = team.find((m) => m.memberRole === 'manager')
  return (
    <Tile wide={open} tone={tone} kicker={v.isActive ? 'Live' : v.mpesaVerified ? 'Verified, offline' : 'Needs M-Pesa verification'} title={v.name}
      visual={<FoodImage path={v.logoPath} name={v.name} width={120} shape="circle" className="h-11 w-11" />}
      figure={<button type="button" className="btn btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Manage'}</button>}>
      <Facts items={[['Location', v.location ?? '—'], [v.paymentType === 'till' ? 'Till' : 'Paybill', v.mpesaShortcode ?? '—'], ['Passkey', hasKey ? 'On file' : 'Missing'],
        ['Manager', manager ? manager.fullName || manager.email : 'Not appointed'],
        ['Platform fee', v.platformFee === null || v.platformFee === undefined ? 'Standard' : `KES ${Number(v.platformFee)}${v.isStudentSeller ? ' · student seller' : ''}`]]} />
      <Sheet open={editing} title={`Edit ${v.name}`} onClose={() => setEditing(false)}>
        <EditHotelForm vendor={v} onDone={onChange} onClose={() => setEditing(false)} />
      </Sheet>
      {open ? (
        <div className="mt-3 grid gap-x-10 gap-y-8 lg:grid-cols-3">
          <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
            <button type="button" className="btn" onClick={() => setEditing(true)}>Edit details</button>
            <button type="button" className="btn btn-ghost !text-danger" onClick={() => {
              if (window.confirm(`Delete ${v.name}? Its menu, team and offers are removed too, and this cannot be undone. Hotels with orders cannot be deleted; take them offline instead.`)) {
                void run(() => rpc('deleteVendor', { pVendorId: v.id }), `${v.name} deleted.`)
              }
            }}>Delete hotel</button>
          </div>
          <div className="flex flex-col gap-2">
            <p className={label}>Pictures</p>
            <div className="flex items-end gap-3">
              <label className="cursor-pointer text-center text-[0.65rem] text-muted">
                <FoodImage path={v.logoPath} name={`${v.name} logo`} width={160} shape="circle" className="h-16 w-16" /><span className="mt-1 block font-bold text-brand">{v.logoPath ? 'Change logo' : 'Upload logo'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => { const p = await uploadImage(`vendors/${v.id}/brand`, f); const { error } = await db().from('vendors').update({ logoPath: p }).eq('id', v.id); if (error) throw error }, 'Logo updated.') }} />
              </label>
              <label className="cursor-pointer text-center text-[0.65rem] text-muted">
                <FoodImage path={v.coverPath} name={`${v.name} cover`} width={320} className="h-16 w-28 !rounded-xl" /><span className="mt-1 block font-bold text-brand">{v.coverPath ? 'Change cover' : 'Upload cover'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => { const p = await uploadImage(`vendors/${v.id}/brand`, f); const { error } = await db().from('vendors').update({ coverPath: p }).eq('id', v.id); if (error) throw error }, 'Cover updated.') }} />
              </label>
            </div>
            {v.logoPath || v.coverPath ? (
              <div className="flex gap-3 text-[0.7rem] font-bold text-danger">
                {v.logoPath ? <button type="button" onClick={() => window.confirm('Remove this logo?') && run(async () => { await rpc('forgetMedia', { pPath: v.logoPath }); await supabase!.storage.from('media').remove([v.logoPath!]) }, 'Logo removed.')}>Remove logo</button> : null}
                {v.coverPath ? <button type="button" onClick={() => window.confirm('Remove this cover photo?') && run(async () => { await rpc('forgetMedia', { pPath: v.coverPath }); await supabase!.storage.from('media').remove([v.coverPath!]) }, 'Cover removed.')}>Remove cover</button> : null}
              </div>
            ) : null}
            <p className={`${label} mt-3`}>M-Pesa details</p>
            <Facts items={[['Pays by', v.paymentType === 'till' ? 'Buy Goods Till' : 'Paybill'], [v.paymentType === 'till' ? 'Till' : 'Paybill', v.mpesaShortcode ?? '—'],
              ...(v.paymentType === 'till' ? [['Head Office', v.headOfficeNumber ?? '—'] as [ReactNode, ReactNode]] : []),
              ['Account name', v.mpesaAccountName ?? '—'], ['Kitchen phone', v.phone ?? '—'], ['Registered', dateTime(v.createdAt)]]} />
          </div>
          <div className="flex flex-col gap-4">
            <p className={label}>Verify</p>
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => rpc('setVendorPasskey', { pVendorId: v.id, pPasskey: passkey }), 'Passkey saved.').then(() => setPasskey('')) }}>
              <input className="field min-w-0 flex-1 !text-sm" type="password" autoComplete="off" placeholder="Lipa Na M-Pesa Online passkey" value={passkey} onChange={(e) => setPasskey(e.target.value)} aria-label="Passkey" />
              <button type="submit" className="btn" disabled={passkey.trim().length < 20}>Save key</button>
            </form>
            <input className="field !text-sm" placeholder="Note, e.g. KES 1 test received, ref SBL…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Verification note" />
            <div className="flex flex-wrap gap-2">
              {!v.mpesaVerified || !v.isActive ? <button type="button" className="btn" onClick={() => run(() => rpc('verifyVendor', { pVendorId: v.id, pVerified: true, pActive: true, pNote: note || null }), 'Verified and live.')}>Verify and go live</button> : null}
              {v.isActive ? <button type="button" className="btn btn-ghost" onClick={() => run(() => rpc('verifyVendor', { pVendorId: v.id, pVerified: true, pActive: false, pNote: note || null }), 'Taken offline.')}>Take offline</button> : null}
              {v.mpesaVerified ? <button type="button" className="text-xs font-bold text-danger" onClick={() => run(() => rpc('verifyVendor', { pVendorId: v.id, pVerified: false, pActive: false, pNote: note || null }), 'Verification removed.')}>Remove verification</button> : null}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <p className={label}>Team</p>
            <div className="flex flex-wrap gap-3">
              {team.length === 0 ? <span className="text-xs text-muted">No one appointed yet.</span> : team.map((m) => (
                <span key={m.userId} className="flex items-center gap-2 text-xs"><CartoonAvatar className="h-7 w-7" /><span><strong>{m.fullName || m.email}</strong><span className="block text-muted">{m.memberRole}</span></span></span>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void run(() => rpc('addVendorMember', { pVendorId: v.id, pEmail: email, pMemberRole: role }), 'Appointed. They see the hotel dashboard on their next sign-in.').then(() => setEmail('')) }} className="flex flex-wrap items-end gap-2">
              <input className="field min-w-0 flex-1 !text-sm" type="email" placeholder="Their Campus Food email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Team member email" />
              <select className="field w-auto !text-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="manager">Manager</option><option value="staff">Kitchen staff</option></select>
              <button type="submit" className="btn" disabled={!email.includes('@')}>Appoint</button>
            </form>
          </div>
          {msg ? <div className="lg:col-span-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
        </div>
      ) : null}
    </Tile>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* People                                                                                      */
/* ------------------------------------------------------------------------------------------ */
type Person = { id: string; fullName: string; email: string; phone: string | null; phoneVerified: boolean; role: string; createdAt: string; avatarPath: string | null; hostel: string | null }
const ROLE_OPTIONS = [
  { value: 'rider', label: 'Rider' }, { value: 'finance', label: 'Finance / operations' }, { value: 'support', label: 'Customer support' },
  { value: 'admin', label: 'Administrator' }, { value: 'vendorStaff', label: 'Hotel staff' }, { value: 'student', label: 'Customer' },
]
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((o) => [o.value, o.label]))

export function AdminPeople() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('rider')
  const [filter, setFilter] = useState('')
  const [msg, setMsg] = useState<Msg>(null)
  const { data: people, reload } = useLoad(async () => {
    const { data } = await db().from('profiles').select('id,fullName,email,phone,phoneVerified,role,createdAt,avatarPath,hostel').neq('role', 'student').order('role').order('fullName')
    return (data ?? []) as Person[]
  }, [])
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    try { await rpc('setUserRole', { pEmail: email, pRole: role }); setMsg({ tone: 'success', text: `${email} is now ${ROLE_LABEL[role]}.` }); setEmail(''); reload() } catch (err) { setMsg({ tone: 'error', text: (err as Error).message }) }
  }
  const shown = people.filter((p) => !filter || p.role === filter)
  const count = (r: string) => people.filter((p) => p.role === r).length
  return (
    <Page title="People and roles" tools={<>
      <div className="flex flex-wrap gap-1.5">
        {[['', `Everyone · ${people.length}`], ...['admin', 'finance', 'support', 'rider', 'vendorStaff'].map((r) => [r, `${ROLE_LABEL[r]} · ${count(r)}`])].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFilter(v!)} className={`rounded-full border px-3 py-1 text-xs font-bold ${filter === v ? 'border-brand bg-brand text-white' : 'glass-line hover:border-brand'}`}>{l}</button>
        ))}
      </div>
      <form onSubmit={save} className="ml-auto flex items-end gap-2">
        <input className="glass w-56 rounded-full px-4 py-1.5 text-xs outline-none" type="email" placeholder="Account email to give a role" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Account email" />
        <select className={barField} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">{ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <button type="submit" className="btn" disabled={!email.includes('@')}>Save role</button>
      </form>
    </>}>
      {msg ? <div className="mb-6"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      {shown.length === 0 ? null : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{shown.map((p) => <PersonTile key={p.id} person={p} onChange={reload} />)}</div>
      )}
    </Page>
  )
}

function PersonTile({ person: p, onChange }: { person: Person; onChange: () => void }) {
  const { profile } = useAuth()
  const [role, setRole] = useState(p.role)
  const [msg, setMsg] = useState<Msg>(null)
  const save = async () => {
    setMsg(null)
    try { await rpc('setUserRole', { pEmail: p.email, pRole: role }); onChange() } catch (err) { setMsg({ tone: 'error', text: (err as Error).message }) }
  }
  return (
    <ProfileCard name={p.fullName || p.email} avatarPath={p.avatarPath} role={ROLE_LABEL[p.role] ?? p.role}
      roleTone={p.role === 'admin' ? 'brand' : p.role === 'rider' ? 'ok' : 'muted'}
      badge={p.id === profile?.id ? <span className="text-xs font-bold text-muted">You</span> : null}
      details={[['Email', p.email], ['Phone', <PhoneValue key="p" phone={p.phone} verified={p.phoneVerified} />], ...(p.hostel ? [['Hostel', p.hostel] as [string, string]] : []),
                ['Member since', shortDate(p.createdAt)]]}>
      {p.id === profile?.id ? null : (
        <div className="flex items-end gap-2">
          <select className="field !text-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label={`Role for ${p.email}`}>
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" className="btn" disabled={role === p.role} onClick={save}>Change</button>
        </div>
      )}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </ProfileCard>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Fees and zones                                                                              */
/* ------------------------------------------------------------------------------------------ */
export function AdminSettings() {
  const [s, setS] = useState<PlatformSettings | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [zone, setZone] = useState({ name: '', fee: '', travelMinutes: '10' })
  const [zoneOpen, setZoneOpen] = useState(false)
  const { data: zones, reload } = useLoad(async () => ((await db().from('deliveryZones').select('*').order('sortOrder').order('name')).data ?? []) as DeliveryZone[], [])
  useEffect(() => { db().from('platformSettings').select('*').maybeSingle().then(({ data }) => setS(data as PlatformSettings)) }, [])
  async function save(e: FormEvent) {
    e.preventDefault(); if (!s) return; setMsg(null)
    const { error } = await db().from('platformSettings').update({
      platformFee: Number(s.platformFee), refundWindowMinutes: Number(s.refundWindowMinutes), draftLifetimeMinutes: Number(s.draftLifetimeMinutes),
      serviceHours: s.serviceHours, supportPhone: s.supportPhone || null, supportEmail: s.supportEmail || null, whatsappNumber: s.whatsappNumber || null, heroTagline: s.heroTagline,
      feePaybill: s.feePaybill || null, feeAccountName: s.feeAccountName || null,
    }).eq('id', true)
    setMsg(error ? { tone: 'error', text: friendly(error) } : { tone: 'success', text: 'Saved. The site shows the new values now.' })
  }
  async function addZone(e: FormEvent) {
    e.preventDefault()
    const { error } = await db().from('deliveryZones').insert({ name: zone.name.trim(), fee: Number(zone.fee) || 0, travelMinutes: Number(zone.travelMinutes) || 10, sortOrder: zones.length })
    if (error) { setMsg({ tone: 'error', text: friendly(error) }); return }
    setZone({ name: '', fee: '', travelMinutes: '10' }); setZoneOpen(false); reload()
  }
  const zonePhoto = async (z: DeliveryZone, f?: File) => {
    if (!f) return
    try { const p = await uploadImage('site/zones', f); const { error } = await db().from('deliveryZones').update({ imagePath: p }).eq('id', z.id); if (error) throw error; reload() } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  const toggleZone = async (z: DeliveryZone) => { await db().from('deliveryZones').update({ isActive: !z.isActive }).eq('id', z.id); reload() }
  const set = (k: keyof PlatformSettings) => (v: string) => setS((x) => (x ? { ...x, [k]: v } : x))
  return (
    <Page title="Fees and zones" tools={<button type="button" className="btn" onClick={() => setZoneOpen(true)}>+ Delivery zone</button>}>
      {s ? (
        <form onSubmit={save}>
          <Tiles min="14rem">
            <div className="flex flex-col gap-4">
              <Stroke seed="Money" />
              <p className={label}>Money</p>
              <TextField label="Platform fee per order (KES)" inputMode="decimal" value={String(s.platformFee)} onChange={set('platformFee')} />
              <TextField label="Refund window (minutes)" inputMode="numeric" value={String(s.refundWindowMinutes)} onChange={set('refundWindowMinutes')} />
              <TextField label="Unpaid orders kept (minutes)" inputMode="numeric" value={String(s.draftLifetimeMinutes)} onChange={set('draftLifetimeMinutes')} />
              <TextField label="Campus Food Paybill (hotel fees)" inputMode="numeric" value={s.feePaybill ?? ''} onChange={set('feePaybill')} />
              <TextField label="Name on that Paybill" value={s.feeAccountName ?? ''} onChange={set('feeAccountName')} />
            </div>
            <div className="flex flex-col gap-4">
              <Stroke color="var(--color-gold)" seed="Home page" />
              <p className={label}>Home page</p>
              <TextField label="Service hours line" value={s.serviceHours} onChange={set('serviceHours')} />
              <TextField label="Tagline" value={s.heroTagline} onChange={set('heroTagline')} />
            </div>
            <div className="flex flex-col gap-4">
              <Stroke color="var(--color-leaf)" seed="Support contacts" />
              <p className={label}>Support contacts</p>
              <TextField label="Phone" value={s.supportPhone ?? ''} onChange={set('supportPhone')} />
              <TextField label="Email" value={s.supportEmail ?? ''} onChange={set('supportEmail')} />
              <TextField label="WhatsApp business number" value={s.whatsappNumber ?? ''} onChange={set('whatsappNumber')} hint="Digits with country code, e.g. 254712345678." />
            </div>
          </Tiles>
          <div className="mt-6 flex items-center gap-4"><button type="submit" className="btn">Save settings</button>{msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}</div>
        </form>
      ) : <p className="text-muted">Loading…</p>}

      <Section title={`Delivery zones · ${zones.length}`}>
        <Tiles min="13rem">
          {zones.map((z) => (
            <Tile key={z.id} tone={z.isActive ? 'ok' : 'muted'} kicker={z.isActive ? 'Delivering' : 'Paused'} title={z.name} figure={kes(z.fee)} figureNote={`about ${z.travelMinutes} min`}
              visual={<label className="cursor-pointer"><FoodImage path={z.imagePath} name={z.name} width={160} shape="circle" className="h-11 w-11" /><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => zonePhoto(z, e.target.files?.[0])} /></label>}>
              <Checkbox label={z.isActive ? 'Active' : 'Off'} checked={z.isActive} onChange={() => toggleZone(z)} />
            </Tile>
          ))}
        </Tiles>
        <Sheet open={zoneOpen} title="Add a delivery zone" onClose={() => setZoneOpen(false)}>
          <form onSubmit={addZone} className="flex flex-col gap-4">
            <input className="field !text-sm" placeholder="Hostel C" value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} aria-label="Zone name" />
            <div className="flex gap-2">
              <input className="field !text-sm" inputMode="decimal" placeholder="Fee" value={zone.fee} onChange={(e) => setZone({ ...zone, fee: e.target.value })} aria-label="Fee" />
              <input className="field !text-sm" inputMode="numeric" placeholder="Minutes" value={zone.travelMinutes} onChange={(e) => setZone({ ...zone, travelMinutes: e.target.value })} aria-label="Travel minutes" />
            </div>
            <button type="submit" className="btn self-start" disabled={zone.name.trim().length < 2}>Add zone</button>
          </form>
        </Sheet>
      </Section>
    </Page>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Site content                                                                                */
/* ------------------------------------------------------------------------------------------ */
const PLACEMENTS = [{ value: 'hero', label: 'Home hero (first photo shown)' }, { value: 'gallery', label: 'Plates of the day' }, { value: 'together', label: 'The deal (arches)' }, { value: 'hotels', label: 'For hotel owners' }, { value: 'feedback', label: 'Talk to the team' }]
const TOPICS = [{ value: 'orderProcess', label: 'Ordering' }, { value: 'vendor', label: 'For hotels' }, { value: 'interface', label: 'Using the site' }, { value: 'admin', label: 'Behind the counter' }, { value: 'trust', label: 'Payments and refunds' }]

export function AdminContent() {
  const [video, setVideo] = useState({ title: '', youtubeUrl: '', topic: 'orderProcess' })
  const [offer, setOffer] = useState({ title: '', body: '', eventDate: todayIso() })
  const [file, setFile] = useState<File | null>(null)
  const [photo, setPhoto] = useState<{ file: File | null; placement: string; caption: string }>({ file: null, placement: 'gallery', caption: '' })
  const [msg, setMsg] = useState<Msg>(null)
  const { data, reload } = useLoad(async () => {
    const [v, o, p] = await Promise.all([
      db().from('siteVideos').select('*').order('sortOrder'),
      db().from('offers').select('*').is('vendorId', null).order('eventDate', { ascending: false }),
      db().from('siteImages').select('*').order('placement').order('sortOrder'),
    ])
    return { videos: (v.data ?? []) as SiteVideo[], offers: (o.data ?? []) as Offer[], photos: (p.data ?? []) as SiteImage[] }
  }, { videos: [] as SiteVideo[], offers: [] as Offer[], photos: [] as SiteImage[] })
  const remove = async (table: 'siteVideos' | 'offers' | 'siteImages', id: string) => { await db().from(table).delete().eq('id', id); reload() }
  async function addPhoto(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    if (!photo.file) return
    try {
      const imagePath = await uploadImage('site/photos', photo.file)
      const { error } = await db().from('siteImages').insert({ imagePath, placement: photo.placement, caption: photo.caption.trim() || null, sortOrder: data.photos.length })
      if (error) throw error
      setPhoto({ file: null, placement: photo.placement, caption: '' }); reload()
    } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  async function addVideo(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    if (!youtubeId(video.youtubeUrl)) { setMsg({ tone: 'error', text: 'Paste a YouTube link (youtube.com/watch?v=…, youtu.be/…, or a Shorts link).' }); return }
    const { error } = await db().from('siteVideos').insert({ ...video, sortOrder: data.videos.length })
    if (error) { setMsg({ tone: 'error', text: friendly(error) }); return }
    setVideo({ title: '', youtubeUrl: '', topic: 'orderProcess' }); reload()
  }
  async function addOffer(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    try {
      const imagePath = file ? await uploadImage('site/offers', file) : null
      const { error } = await db().from('offers').insert({ title: offer.title.trim(), body: offer.body.trim() || null, eventDate: offer.eventDate, imagePath })
      if (error) throw error
      setOffer({ title: '', body: '', eventDate: todayIso() }); setFile(null); reload()
    } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  const [sheet, setSheet] = useState<'photo' | 'video' | 'offer' | null>(null)
  const addTile = 'flex flex-col gap-4'
  return (
    <Page title="Site content" tools={<>
      <button type="button" className="btn" onClick={() => setSheet('photo')}>Add a photo</button>
      <button type="button" className="btn btn-ghost" onClick={() => setSheet('video')}>Add a video</button>
      <button type="button" className="btn btn-ghost" onClick={() => setSheet('offer')}>Post an offer</button>
    </>}>
      {msg ? <div className="mb-6"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      <Section title={`Site photos · ${data.photos.length}`}>
        <Tiles min="12rem">
          {data.photos.map((p) => (
            <article key={p.id} className="flex flex-col gap-2">
              <FoodImage path={p.imagePath} name={p.caption ?? 'Site photo'} width={480} className="aspect-[4/5] w-full !rounded-[1.5rem]" />
              <p className="text-xs"><strong>{PLACEMENTS.find((x) => x.value === p.placement)?.label ?? p.placement}</strong>{p.caption ? ` · ${p.caption}` : ''}</p>
              <button type="button" className="self-start text-xs font-bold text-danger" onClick={() => remove('siteImages', p.id)}>Remove</button>
            </article>
          ))}
        </Tiles>
        <Sheet open={sheet === 'photo'} title="Add a site photo" onClose={() => setSheet(null)}>
          <form onSubmit={async (e) => { await addPhoto(e); setSheet(null) }} className={addTile}>
            <label className="link cursor-pointer text-sm font-bold">{photo.file ? photo.file.name : 'Choose a photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => setPhoto({ ...photo, file: e.target.files?.[0] ?? null })} /></label>
            <select className="field !text-sm" value={photo.placement} onChange={(e) => setPhoto({ ...photo, placement: e.target.value })} aria-label="Where it shows">{PLACEMENTS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
            <input className="field !text-sm" placeholder="Caption (optional)" value={photo.caption} onChange={(e) => setPhoto({ ...photo, caption: e.target.value })} aria-label="Caption" />
            <button type="submit" className="btn self-start" disabled={!photo.file}>Upload</button>
          </form>
        </Sheet>
      </Section>

      <Section title={`Videos above the footer · ${data.videos.length}`}>
        <Tiles min="15rem">
          {data.videos.map((v) => {
            const yid = youtubeId(v.youtubeUrl)
            return (
              <article key={v.id} className="flex flex-col gap-2">
                {yid ? <img src={`https://i.ytimg.com/vi/${yid}/mqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-full rounded-[1.25rem] object-cover" /> : null}
                <p className="font-extrabold">{v.title}</p>
                <p className="text-xs text-muted">{TOPICS.find((t) => t.value === v.topic)?.label ?? v.topic}</p>
                <button type="button" className="self-start text-xs font-bold text-danger" onClick={() => remove('siteVideos', v.id)}>Remove</button>
              </article>
            )
          })}
        </Tiles>
        <Sheet open={sheet === 'video'} title="Add a video" onClose={() => setSheet(null)}>
          <form onSubmit={async (e) => { await addVideo(e); setSheet(null) }} className={addTile}>
            <input className="field !text-sm" placeholder="Title" value={video.title} onChange={(e) => setVideo({ ...video, title: e.target.value })} aria-label="Video title" />
            <input className="field !text-sm" placeholder="YouTube link" value={video.youtubeUrl} onChange={(e) => setVideo({ ...video, youtubeUrl: e.target.value.trim() })} aria-label="YouTube link" />
            <select className="field !text-sm" value={video.topic} onChange={(e) => setVideo({ ...video, topic: e.target.value })} aria-label="Topic">{TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <button type="submit" className="btn self-start" disabled={video.title.trim().length < 2}>Add video</button>
          </form>
        </Sheet>
      </Section>

      <Section title={`Campus-wide offers · ${data.offers.length}`}>
        <Tiles min="14rem">
          {data.offers.map((o) => (
            <article key={o.id} className="flex flex-col gap-2">
              <FoodImage path={o.imagePath} name={o.title} width={480} className="aspect-[4/3] w-full !rounded-[1.25rem]" />
              <p className="font-extrabold">{o.title}</p>
              <p className="text-xs text-muted">{o.eventDate}{o.body ? ` · ${o.body}` : ''}</p>
              <button type="button" className="self-start text-xs font-bold text-danger" onClick={() => remove('offers', o.id)}>Remove</button>
            </article>
          ))}
        </Tiles>
        <Sheet open={sheet === 'offer'} title="Post a campus-wide offer" onClose={() => setSheet(null)}>
          <form onSubmit={async (e) => { await addOffer(e); setSheet(null) }} className={addTile}>
            <input className="field !text-sm" placeholder="Free delivery Friday" value={offer.title} onChange={(e) => setOffer({ ...offer, title: e.target.value })} aria-label="Offer title" />
            <TextArea label="Details" value={offer.body} onChange={(v) => setOffer({ ...offer, body: v })} rows={2} />
            <input className="field !text-sm" type="date" value={offer.eventDate} onChange={(e) => setOffer({ ...offer, eventDate: e.target.value })} aria-label="Date" />
            <label className="link cursor-pointer text-sm font-bold">{file ? file.name : 'Add a photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <button type="submit" className="btn self-start" disabled={offer.title.trim().length < 3}>Post offer</button>
          </form>
        </Sheet>
      </Section>
    </Page>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Feedback                                                                                    */
/* ------------------------------------------------------------------------------------------ */
type FeedbackRow = { id: string; rating: number; comment: string | null; displayName: string | null; contactEmail: string | null; isPublished: boolean; adminReply: string | null; createdAt: string; orderId: string | null; vendors: { name: string } | null }

export function AdminFeedback() {
  const { data: rows, reload } = useLoad(async () => {
    const { data } = await db().from('feedback').select('*, vendors(name)').order('createdAt', { ascending: false }).limit(200)
    return (data ?? []) as FeedbackRow[]
  }, [])
  const avg = useMemo(() => (rows.length ? rows.reduce((n, r) => n + r.rating, 0) / rows.length : 0), [rows])
  const update = async (id: string, patch: Partial<FeedbackRow>) => { await db().from('feedback').update(patch).eq('id', id); reload() }
  return (
    <Page title="Feedback">
      <Tiles min="10rem" className="mb-10">
        <Stat label="Messages" value={rows.length} tone="muted" />
        <Stat label="Average rating" value={rows.length ? `${avg.toFixed(1)} / 5` : '—'} tone="gold" />
        <Stat label="On the home page" value={rows.filter((r) => r.isPublished).length} tone="ok" />
      </Tiles>
      {rows.length === 0 ? null : (
        <Tiles min="18rem">
          {rows.map((r) => (
            <Tile key={r.id} tone={r.rating >= 4 ? 'ok' : r.rating <= 2 ? 'danger' : 'gold'} kicker={r.vendors ? `About ${r.vendors.name}` : 'General'} title={r.displayName ?? 'Customer'}
              visual={<CartoonAvatar className="h-11 w-11" />} figure={<Stars n={r.rating} />} figureNote={dateTime(r.createdAt)}>
              {r.comment ? <p className="text-sm">“{r.comment}”</p> : null}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <Checkbox label="Show on the home page" checked={r.isPublished} onChange={(v) => update(r.id, { isPublished: v })} />
                {r.contactEmail ? <a className="link font-bold" href={`mailto:${r.contactEmail}`}>Reply by email</a> : null}
                {r.orderId ? <Link className="link font-bold" to={`/orders/${r.orderId}`}>Open order</Link> : null}
              </div>
            </Tile>
          ))}
        </Tiles>
      )}
    </Page>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Audit and messages                                                                          */
/* ------------------------------------------------------------------------------------------ */
type AuditRow = { id: number; tableName: string; entityId: string; action: string; summary: string | null; actorId: string | null; createdAt: string }
type NoteRow = { id: string; channel: string; recipient: string; template: string; status: string; attempts: number; sentBy: string | null; lastError: string | null; createdAt: string }

export function AdminAudit() {
  const [tab, setTab] = useState<'audit' | 'messages'>('audit')
  const { data } = useLoad(async () => {
    const [a, n] = await Promise.all([
      db().from('auditLogs').select('*').order('createdAt', { ascending: false }).limit(150),
      db().from('notifications').select('*').order('createdAt', { ascending: false }).limit(100),
    ])
    return { audit: (a.data ?? []) as AuditRow[], notes: (n.data ?? []) as NoteRow[] }
  }, { audit: [] as AuditRow[], notes: [] as NoteRow[] })
  const pill = (t: typeof tab, l: string) => (
    <button type="button" onClick={() => setTab(t)} className={`rounded-full border px-3 py-1 text-xs font-bold ${tab === t ? 'border-brand bg-brand text-white' : 'glass-line hover:border-brand'}`}>{l}</button>
  )
  return (
    <Page title="Audit and messages" tools={<div className="flex gap-2">{pill('audit', `Audit trail · ${data.audit.length}`)}{pill('messages', `SMS and WhatsApp · ${data.notes.length}`)}</div>}>
      {tab === 'audit' ? (
        data.audit.length === 0 ? null : (
          <Tiles min="16rem">
            {data.audit.map((a) => (
              <Tile key={a.id} tone={a.action === 'DELETE' ? 'danger' : a.action === 'ACTION' ? 'brand' : 'muted'} kicker={`${a.action} · ${a.tableName}`}
                title={a.action === 'ACTION' ? a.summary ?? 'Action' : `${a.tableName} ${a.entityId?.slice(0, 8) ?? ''}`}>
                <p className="text-xs text-muted">{dateTime(a.createdAt)} · {a.actorId ? `by ${a.actorId.slice(0, 8)}` : 'system'}</p>
              </Tile>
            ))}
          </Tiles>
        )
      ) : data.notes.length === 0 ? null : (
        <Tiles min="16rem">
          {data.notes.map((n) => (
            <Tile key={n.id} tone={n.status === 'sent' ? 'ok' : n.status === 'failed' ? 'danger' : n.status === 'skipped' ? 'muted' : 'gold'} kicker={`${n.status} · ${n.channel}`} title={n.recipient} figure={n.template}>
              <p className="text-xs text-muted">{dateTime(n.createdAt)} · tries {n.attempts}{n.sentBy ? ` · by ${n.sentBy}` : ''}</p>
              {n.lastError ? <p className="text-xs text-danger">{n.lastError}</p> : null}
            </Tile>
          ))}
        </Tiles>
      )}
    </Page>
  )
}

/** File picker with a preview, for forms in side sheets. */
function ImagePick({ label: l, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  const preview = file ? URL.createObjectURL(file) : null
  return (
    <label className="flex cursor-pointer items-center gap-3">
      {preview ? <img src={preview} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed glass-line text-xs text-muted">+</span>}
      <span className="flex flex-col"><span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{l}</span><span className="link text-sm font-bold">{file ? file.name : 'Choose an image'}</span></span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Images: every file in Storage, where it is used, and delete                                 */
/* ------------------------------------------------------------------------------------------ */
type MediaFile = { path: string; bytes: number; createdAt: string; usedBy: string | null }
const MEDIA_KINDS: [string, string][] = [['all', 'All images'], ['vendors', 'Hotels and dishes'], ['site', 'Site'], ['profiles', 'Profile photos'], ['unused', 'Not used anywhere']]

export function AdminMedia() {
  const [kind, setKind] = useState('all')
  const [msg, setMsg] = useState<Msg>(null)
  const { data: files, reload, error } = useLoad(async () => (await rpc<MediaFile[]>('listMedia')) ?? [], [] as MediaFile[])
  const shown = files.filter((f) => kind === 'all' || (kind === 'unused' ? !f.usedBy : f.path.startsWith(`${kind}/`)))
  const total = files.reduce((n, f) => n + Number(f.bytes), 0)
  async function remove(f: MediaFile) {
    const where = f.usedBy ? ` It is used as: ${f.usedBy}. Those places will show a drawing instead.` : ''
    if (!window.confirm(`Delete this image permanently?${where} This cannot be undone.`)) return
    setMsg(null)
    try {
      await rpc('forgetMedia', { pPath: f.path })
      const { error: e } = await supabase!.storage.from('media').remove([f.path])
      if (e) throw e
      setMsg({ tone: 'success', text: 'Image deleted.' }); reload()
    } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  return (
    <Page title="Images" tools={<>
      <select className="field !w-auto !py-1 !text-xs" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Show images">
        {MEDIA_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span className="self-center text-xs text-muted">{files.length} files · {(total / 1048576).toFixed(1)} MB</span>
    </>}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {shown.length === 0 ? null : (
        <Tiles min="12rem">
          {shown.map((f) => (
            <Tile key={f.path} tone={f.usedBy ? 'ok' : 'muted'} kicker={f.usedBy ? 'In use' : 'Not used'} title={f.path.split('/').pop() ?? f.path}>
              <img src={mediaUrl(f.path) ?? ''} alt={f.usedBy ?? f.path} loading="lazy" className="aspect-[4/3] w-full rounded-[1rem] bg-ink/5 object-cover" />
              <Facts items={[['Used as', f.usedBy ?? '—'], ['Size', `${Math.max(1, Math.round(Number(f.bytes) / 1024))} KB`], ['Added', dateTime(f.createdAt)]]} />
              <p className="truncate text-[0.65rem] text-muted" title={f.path}>{f.path}</p>
              <button type="button" className="self-start text-xs font-bold text-danger" onClick={() => remove(f)}>Delete image</button>
            </Tile>
          ))}
        </Tiles>
      )}
    </Page>
  )
}
