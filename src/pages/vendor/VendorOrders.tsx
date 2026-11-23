import { useCallback, useEffect, useRef, useState } from 'react'
import { HeaderActions } from '../../components/HeaderBar'
import { Notice } from '../../components/form'
import { useLoad } from '../../lib/data'
import { kes, minutesUntil, ORDER_STATUS_LABEL, timeOnly } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db, friendly, rpc, supabase } from '../../lib/supabase'
import type { Order, OrderStatus } from '../../lib/types'
import { useVendor } from './VendorLayout'
import { useFeeBalance } from './VendorFees'

const LANES: { title: string; statuses: OrderStatus[]; note: string }[] = [
  { title: 'New', statuses: ['paid'], note: 'Paid by M-Pesa. Accept or reject.' },
  { title: 'In the kitchen', statuses: ['accepted', 'preparing'], note: 'Accepted and cooking.' },
  { title: 'Ready', statuses: ['readyForPickup', 'assignedForDelivery'], note: 'Waiting for a rider.' },
  { title: 'On the way', statuses: ['outForDelivery'], note: 'Left the kitchen.' },
  { title: 'Needs attention', statuses: ['cancellationRequested', 'refundPending'], note: 'Refund requested or approved: reverse the M-Pesa payment.' },
]

/** A short two-tone chime made with Web Audio (no sound files). */
function chime() {
  try {
    const ctx = new AudioContext()
    ;[880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.4)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.18)
      o.stop(ctx.currentTime + i * 0.18 + 0.45)
    })
  } catch { /* audio blocked until the page is tapped */ }
}

/** Live order queue: new paid orders appear with a chime and a browser notification. */
export function VendorOrders() {
  const { vendor } = useVendor()
  const seen = useRef<Set<string> | null>(null)
  const [alerts, setAlerts] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted')
  useEffect(() => setTitle('Hotel orders'), [])
  const { data: feesOwed } = useFeeBalance(vendor?.id)

  const { data: orders, reload, error } = useLoad(async () => {
    const since = new Date(Date.now() - 36 * 3600_000).toISOString()
    const { data, error } = await db().from('orders').select('*, orderItems(*)').eq('vendorId', vendor!.id).gte('createdAt', since).order('createdAt', { ascending: false })
    if (error) throw error
    return (data ?? []) as Order[]
  }, [], [vendor?.id])

  // Alert on paid orders we have not seen before.
  useEffect(() => {
    const paid = orders.filter((o) => o.status === 'paid').map((o) => o.id)
    if (seen.current === null) { seen.current = new Set(paid); return }
    const fresh = paid.filter((id) => !seen.current!.has(id))
    fresh.forEach((id) => seen.current!.add(id))
    if (fresh.length) {
      chime()
      if (alerts && 'Notification' in window) new Notification('New Campus Food order', { body: `${fresh.length} new paid order${fresh.length > 1 ? 's' : ''}` })
    }
  }, [orders, alerts])

  useEffect(() => {
    if (!supabase || !vendor) return
    const ch = supabase.channel(`vendor-${vendor.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `vendorId=eq.${vendor.id}` }, () => reload())
      .subscribe()
    const t = setInterval(reload, 30000)
    return () => { void supabase?.removeChannel(ch); clearInterval(t) }
  }, [vendor, reload])

  const done = orders.filter((o) => ['delivered', 'rejected', 'refunded', 'cancelled'].includes(o.status)).slice(0, 12)
  return (
    <div className="mt-4">
      <h2 className="sr-only">Live orders</h2>
      <HeaderActions>
        <span className="self-center text-xs font-bold"><span className="text-brand">{orders.filter((o) => o.status === 'paid').length}</span> waiting · updates live</span>
        <a href="/hotel/reports" className="self-center text-xs font-bold hover:text-brand">Campus Food fees owed: <span className="text-brand">{kes(Math.max(feesOwed, 0))}</span></a>
        {'Notification' in window && !alerts ? (
          <button type="button" className="btn btn-ghost ml-auto" onClick={async () => { setAlerts((await Notification.requestPermission()) === 'granted'); chime() }}>Turn on order alerts</button>
        ) : null}
      </HeaderActions>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="mt-6 grid gap-x-10 gap-y-14 lg:grid-cols-2">
        {LANES.map((lane) => {
          const list = orders.filter((o) => lane.statuses.includes(o.status))
          if (lane.title === 'Needs attention' && list.length === 0) return null
          return (
            <section key={lane.title}>
              <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">{lane.title} <span className="text-brand">{list.length}</span></h2>
              <p className="story text-sm text-muted">{lane.note}</p>
              {list.length === 0 ? <p className="story mt-4 text-muted">Nothing here.</p> : (
                <ul className="mt-2">{list.map((o) => <OrderRow key={o.id} order={o} onChange={reload} />)}</ul>
              )}
            </section>
          )
        })}
      </div>
      {done.length ? (
        <section className="mt-16">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Recently finished</h2>
          <ul className="mt-3">
            {done.map((o) => (
              <li key={o.id} className="flex justify-between border-b border-line py-2 text-sm">
                <span><strong>{o.reference}</strong> · {o.customerName} · {timeOnly(o.createdAt)}</span>
                <span className="font-bold">{ORDER_STATUS_LABEL[o.status]} · {kes(o.foodSubtotal)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function OrderRow({ order, onChange }: { order: Order; onChange: () => void }) {
  const [prep, setPrep] = useState(String(order.prepMinutes ?? 20))
  const [reason, setReason] = useState('')
  const [rider, setRider] = useState('')
  const [mode, setMode] = useState<'idle' | 'reject' | 'rider'>('idle')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setProblem(null)
    try { await fn(); setMode('idle'); onChange() } catch (e) { setProblem(friendly(e)) } finally { setBusy(false) }
  }, [onChange])
  const move = (status: OrderStatus, note?: string, prepMinutes?: number) =>
    act(() => rpc('updateOrderStatus', { pOrderId: order.id, pStatus: status, pNote: note ?? null, pPrepMinutes: prepMinutes ?? null }))
  const late = order.estimatedReadyAt && (minutesUntil(order.estimatedReadyAt) ?? 0) < 0 && ['accepted', 'preparing'].includes(order.status)

  return (
    <li className="border-b-2 border-line py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="headline text-2xl">{order.reference} <span className="font-sans text-sm font-bold normal-case text-muted">paid {timeOnly(order.paidAt)}</span></p>
        <p className="font-extrabold">{kes(order.foodSubtotal)}</p>
      </div>
      <ul className="mt-2">
        {(order.orderItems ?? []).map((i) => <li key={i.id} className="text-lg"><strong>{i.quantity} ×</strong> {i.itemName}</li>)}
      </ul>
      <p className="mt-2 text-sm"><strong>{order.customerName || 'Customer'}</strong> · <a className="link" href={`tel:${order.contactPhone}`}>{order.contactPhone}</a></p>
      <p className="text-sm">Deliver to <strong>{order.deliveryLocation}</strong>{order.deliveryInstructions ? ` · ${order.deliveryInstructions}` : ''}</p>
      {order.estimatedReadyAt && ['accepted', 'preparing'].includes(order.status) ? (
        <p className={`text-sm font-bold ${late ? 'text-danger' : 'text-muted'}`}>Ready by {timeOnly(order.estimatedReadyAt)}{late ? ' (late)' : ''}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {order.status === 'paid' ? (
          <>
            <label className="flex items-end gap-2 text-sm font-bold">
              <input className="field w-16 text-center" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value.replace(/\D/g, ''))} aria-label="Minutes to prepare" />
              <span className="pb-2">min</span>
            </label>
            <button type="button" className="btn px-5 py-2" disabled={busy} onClick={() => move('accepted', undefined, Number(prep) || 20)}>Accept</button>
            <button type="button" className="btn btn-ghost px-5 py-2" disabled={busy} onClick={() => setMode(mode === 'reject' ? 'idle' : 'reject')}>Reject</button>
          </>
        ) : null}
        {order.status === 'accepted' ? <button type="button" className="btn px-5 py-2" disabled={busy} onClick={() => move('preparing')}>Start preparing</button> : null}
        {order.status === 'preparing' ? <button type="button" className="btn px-5 py-2" disabled={busy} onClick={() => move('readyForPickup')}>Food is ready</button> : null}
        {['accepted', 'preparing', 'readyForPickup', 'assignedForDelivery'].includes(order.status) ? (
          <button type="button" className="btn btn-ghost px-5 py-2" disabled={busy} onClick={() => setMode(mode === 'rider' ? 'idle' : 'rider')}>{order.riderId ? 'Change rider' : 'Assign rider'}</button>
        ) : null}
        {['readyForPickup', 'assignedForDelivery'].includes(order.status) ? <button type="button" className="btn px-5 py-2" disabled={busy} onClick={() => move('outForDelivery')}>Out for delivery</button> : null}
        {order.status === 'outForDelivery' ? <button type="button" className="btn px-5 py-2" disabled={busy} onClick={() => move('delivered')}>Delivered</button> : null}
      </div>

      {mode === 'reject' ? (
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void move('rejected', reason) }}>
          <input className="field max-w-sm" placeholder="Reason, e.g. out of pilau" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for rejecting" />
          <button type="submit" className="btn px-5 py-2" disabled={busy || reason.trim().length < 3}>Reject and refund</button>
        </form>
      ) : null}
      {mode === 'rider' ? (
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void act(() => rpc('assignRider', { pOrderId: order.id, pRiderEmail: rider })) }}>
          <input className="field max-w-sm" type="email" placeholder="Rider's Campus Food email" value={rider} onChange={(e) => setRider(e.target.value)} aria-label="Rider email" />
          <button type="submit" className="btn px-5 py-2" disabled={busy || !rider.includes('@')}>Assign</button>
        </form>
      ) : null}
      {order.status === 'cancellationRequested' ? <p className="mt-3 text-sm text-brand">The customer asked for a refund within the refund window. Campus Food will confirm; do not start cooking.</p> : null}
      {order.status === 'refundPending' ? <p className="mt-3 text-sm text-brand">Refund approved: reverse {kes(order.totalAmount)} from your M-Pesa to {order.contactPhone}, then send the reversal code to Campus Food.</p> : null}
      {problem ? <div className="mt-3"><Notice tone="error">{problem}</Notice></div> : null}
    </li>
  )
}
