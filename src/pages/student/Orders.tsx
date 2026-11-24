import { askConfirm } from '../../components/Confirm'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { PlateDrawing } from '../../components/Drawings'
import { FoodImage } from '../../components/FoodImage'
import { Notice, StarPicker, Stars, TextArea } from '../../components/form'
import { ReceiptIcon } from '../../components/Icons'
import { useLoad, useSettings } from '../../lib/data'
import { dateTime, kes, ORDER_STATUS_LABEL, statusTone } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db, friendly, rpc } from '../../lib/supabase'
import type { Order, OrderItem, OrderStatus, Payment } from '../../lib/types'

type Line = OrderItem & { menuItems?: { imagePath: string | null; description: string | null } | null }
type FullOrder = Omit<Order, 'orderItems'> & { orderItems?: Line[] }
type Loaded = { orders: FullOrder[]; paid: Record<string, Payment>; ratings: Record<string, number> }

const UNPAID: OrderStatus[] = ['draft', 'awaitingPayment', 'paymentPending', 'paymentFailed']
const CANCELLABLE: OrderStatus[] = ['draft', 'awaitingPayment', 'paymentFailed']
const RATEABLE: OrderStatus[] = ['delivered', 'refunded', 'partiallyRefunded', 'rejected']

/** Every order in full: dishes with photos, money, M-Pesa details, receipt, and what you can still do with it. */
export function Orders() {
  const { session } = useAuth()
  const { data: settings } = useSettings()
  useEffect(() => setTitle('My orders'), [])
  const { data, loading, reload } = useLoad<Loaded>(async () => {
    const { data: rows, error } = await db().from('orders')
      .select('*, vendors(name,location,phone), orderItems(*, menuItems(imagePath,description))')
      .eq('studentId', session!.user.id).order('createdAt', { ascending: false }).limit(50)
    if (error) throw error
    const orders = (rows ?? []) as FullOrder[]
    const ids = orders.map((o) => o.id)
    if (!ids.length) return { orders, paid: {}, ratings: {} }
    const [p, f] = await Promise.all([
      db().from('payments').select('*').in('orderId', ids).eq('status', 'paid'),
      db().from('feedback').select('orderId,rating').in('orderId', ids),
    ])
    const paid: Record<string, Payment> = {}
    for (const x of (p.data ?? []) as Payment[]) paid[x.orderId] = x
    const ratings: Record<string, number> = {}
    for (const x of (f.data ?? []) as { orderId: string; rating: number }[]) ratings[x.orderId] = x.rating
    return { orders, paid, ratings }
  }, { orders: [], paid: {}, ratings: {} }, [session?.user.id])

  // Re-render every 20 s so the refund countdown stays true.
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 20000); return () => clearInterval(t) }, [])

  return (
    <div className="px-4 pb-16 pt-4 text-sm sm:px-8">
      <h1 className="sr-only">My orders</h1>
      {loading && !data.orders.length ? <p className="mt-10 text-center text-muted">Loading your orders…</p> : null}
      {!loading && !data.orders.length ? (
        <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center text-center">
          <PlateDrawing className="h-36 w-36 text-ink" />
          <p className="mt-4 text-muted">No orders yet.</p>
          <Link to="/menu" className="btn mt-6">Order something</Link>
        </div>
      ) : null}
      <div className="menu-font grid items-start gap-3 text-[0.8rem] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {data.orders.map((o) => (
          <OrderCard key={o.id} order={o} payment={data.paid[o.id]} rating={data.ratings[o.id]} refundWindow={settings.refundWindowMinutes} onChange={reload} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order, payment, rating, refundWindow, onChange }: {
  order: FullOrder; payment?: Payment; rating?: number; refundWindow: number; onChange: () => void
}) {
  const [panel, setPanel] = useState<'refund' | 'rate' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const unpaid = UNPAID.includes(order.status)
  const refundEnds = order.paidAt ? new Date(order.paidAt).getTime() + refundWindow * 60000 : 0
  const refundLeft = Math.ceil((refundEnds - Date.now()) / 60000)
  const refundOpen = !!order.paidAt && ['paid', 'accepted'].includes(order.status) && refundLeft > 0
  const items = order.orderItems ?? []
  const count = items.reduce((n, i) => n + i.quantity, 0)

  async function cancel() {
    if (!(await askConfirm(`Cancel ${order.reference}? You can always order again.`, { yes: 'Yes, cancel', danger: true }))) return
    try { await rpc('cancelUnpaidOrder', { pOrderId: order.id }); onChange() } catch (e) { setMessage(friendly(e)) }
  }

  const SMALL = 'btn !px-3 !py-1.5 !text-xs'
  const GHOST = 'btn btn-ghost !px-3 !py-1.5 !text-xs'
  return (
    <article className="rounded-xl bg-ink/[0.04] p-3 sm:p-4">
      {/* Reference, hotel, date, status and receipt */}
      <header className="flex items-start justify-between gap-3">
        <p className="leading-snug">
          <span className="text-sm font-bold">{order.reference}</span>
          <span className="text-muted"> · {order.vendors?.name} · {dateTime(order.createdAt)} · {count} item{count === 1 ? '' : 's'}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-xs ${statusTone(order.status)}`}>{ORDER_STATUS_LABEL[order.status]}</span>
          {order.paidAt ? (
            <a href={`/r/${order.receiptToken}`} target="_blank" rel="noopener" title="Download receipt" aria-label={`Download receipt for ${order.reference}`}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/10 hover:text-brand">
              <ReceiptIcon className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </header>

      {/* Dishes */}
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <FoodImage path={i.menuItems?.imagePath} name={i.itemName} width={96} className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate">{i.itemName} <span className="text-muted">· {i.quantity} × {kes(i.unitPrice)}</span></p>
              {i.menuItems?.description && i.menuItems.description !== i.itemName ? <p className="truncate text-xs text-muted">{i.menuItems.description}</p> : null}
            </div>
            <p className="shrink-0">{kes(i.lineTotal)}</p>
          </li>
        ))}
      </ul>

      {/* Money, payment and delivery */}
      <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
        <p>Food {kes(order.foodSubtotal)} · Delivery {kes(order.deliveryFee)} · Fee {kes(order.platformFee)} · <span className="text-sm font-bold text-ink">Total {kes(order.totalAmount)}</span>
          {Number(order.refundedAmount) > 0 ? <span className="text-ok"> · Refunded {kes(order.refundedAmount)}</span> : null}</p>
        <p>{payment
          ? <>Paid by M-Pesa{payment.mpesaReceiptNumber ? <> <span className="text-ink">{payment.mpesaReceiptNumber}</span></> : null} · {payment.phone.replace(/^\+?254/, '0')} · {dateTime(payment.completedAt ?? order.paidAt)}</>
          : order.paidAt ? <>Paid {dateTime(order.paidAt)}</> : <>Not paid yet · goes straight to {order.vendors?.name ?? 'the hotel'}</>}</p>
        <p>To {order.deliveryLocation}{order.deliveredAt ? ` · delivered ${dateTime(order.deliveredAt)}` : ''}</p>
      </div>

      {/* What you can still do */}
      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {unpaid ? <Link to={`/orders/${order.id}`} className={SMALL}>{order.status === 'paymentPending' ? 'Check payment' : 'Pay now'}</Link>
          : <Link to={`/orders/${order.id}`} className={GHOST}>Track</Link>}
        {CANCELLABLE.includes(order.status) ? <button type="button" onClick={cancel} className={GHOST}>Cancel</button> : null}
        {order.paidAt && ['paid', 'accepted', 'preparing'].includes(order.status) ? (
          <button type="button" disabled={!refundOpen} onClick={() => setPanel(panel === 'refund' ? null : 'refund')}
            className={`${GHOST} disabled:cursor-not-allowed disabled:opacity-40`}
            title={refundOpen ? undefined : 'Refunds close once the kitchen starts cooking'}>
            {refundOpen ? `Refund · ${refundLeft} min left` : 'Refund closed'}
          </button>
        ) : null}
        {RATEABLE.includes(order.status) ? (
          rating ? <span className="flex items-center gap-1 text-xs text-muted">Your rating <Stars n={rating} /></span>
            : <button type="button" onClick={() => setPanel(panel === 'rate' ? null : 'rate')} className={GHOST}>Rate</button>
        ) : null}
        {message ? <span className="text-xs text-muted">{message}</span> : null}
      </footer>

      {panel === 'refund' && refundOpen ? <RefundForm order={order} onDone={() => { setPanel(null); onChange() }} /> : null}
      {panel === 'rate' && !rating ? <RateForm order={order} onDone={() => { setPanel(null); onChange() }} /> : null}
    </article>
  )
}

function RefundForm({ order, onDone }: { order: FullOrder; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function send(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 3) { setHint('Tell us why you need a refund.'); return }
    setBusy(true)
    try { await rpc('requestRefund', { pOrderId: order.id, pReason: reason }); onDone() } catch (err) { setHint(friendly(err)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={send} className="mt-3 flex flex-col gap-3">
      <TextArea label="Why do you need a refund?" value={reason} onChange={setReason} rows={2} error={hint ?? undefined} />
      <button type="submit" className="btn self-start !px-3 !py-1.5 !text-xs" disabled={busy}>{busy ? 'Sending…' : 'Request refund'}</button>
    </form>
  )
}

function RateForm({ order, onDone }: { order: FullOrder; onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function send(e: FormEvent) {
    e.preventDefault()
    if (!rating) { setHint('Choose a rating.'); return }
    setBusy(true)
    try { await rpc('submitFeedback', { pOrderId: order.id, pRating: rating, pComment: comment, pDisplayName: null, pContactEmail: null }); onDone() }
    catch (err) { setHint(friendly(err)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={send} className="mt-3 flex flex-col gap-3">
      <StarPicker value={rating} onChange={setRating} />
      <TextArea label="Anything to tell the kitchen? (optional)" value={comment} onChange={setComment} rows={2} />
      {hint ? <Notice>{hint}</Notice> : null}
      <button type="submit" className="btn self-start !px-3 !py-1.5 !text-xs" disabled={busy}>{busy ? 'Sending…' : 'Send rating'}</button>
    </form>
  )
}
