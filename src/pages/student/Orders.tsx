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
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 text-sm sm:px-6">
      <h1 className="sr-only">My orders</h1>
      {loading && !data.orders.length ? <p className="mt-10 text-muted">Loading your orders…</p> : null}
      {!loading && !data.orders.length ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <PlateDrawing className="h-36 w-36 text-ink" />
          <p className="mt-4 text-muted">No orders yet.</p>
          <Link to="/menu" className="btn mt-6">Order something</Link>
        </div>
      ) : null}
      <div className="flex flex-col gap-8">
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
    if (!window.confirm(`Cancel ${order.reference}?`)) return
    try { await rpc('cancelUnpaidOrder', { pOrderId: order.id }); onChange() } catch (e) { setMessage(friendly(e)) }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-line">
      {/* Reference, hotel, date, status and receipt */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="headline text-2xl leading-none">{order.reference}</p>
          <p className="mt-1 text-muted">{order.vendors?.name} · {dateTime(order.createdAt)} · {count} item{count === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full bg-ink/5 px-3 py-1 text-xs font-extrabold ${statusTone(order.status)}`}>{ORDER_STATUS_LABEL[order.status]}</span>
          {order.paidAt ? (
            <a href={`/r/${order.receiptToken}`} target="_blank" rel="noopener" title="Download receipt" aria-label={`Download receipt for ${order.reference}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-brand hover:text-brand">
              <ReceiptIcon className="h-5 w-5" />
            </a>
          ) : null}
        </div>
      </header>

      {/* Dishes */}
      <ul className="divide-y divide-line px-5 sm:px-6">
        {items.map((i) => (
          <li key={i.id} className="flex gap-4 py-4">
            <FoodImage path={i.menuItems?.imagePath} name={i.itemName} width={160} className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{i.itemName}</p>
              {i.menuItems?.description ? <p className="mt-0.5 line-clamp-2 text-muted">{i.menuItems.description}</p> : null}
              <p className="mt-1 text-muted">{i.quantity} × {kes(i.unitPrice)}</p>
            </div>
            <p className="shrink-0 font-extrabold">{kes(i.lineTotal)}</p>
          </li>
        ))}
      </ul>

      {/* Money, payment and delivery */}
      <div className="grid gap-6 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-6">
        <dl className="flex flex-col gap-1">
          <div className="flex justify-between"><dt className="text-muted">Food</dt><dd>{kes(order.foodSubtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{kes(order.deliveryFee)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Platform fee</dt><dd>{kes(order.platformFee)}</dd></div>
          <div className="mt-1 flex justify-between border-t-2 border-ink pt-2 text-lg font-extrabold"><dt>Total</dt><dd>{kes(order.totalAmount)}</dd></div>
          {Number(order.refundedAmount) > 0 ? <div className="flex justify-between text-ok"><dt>Refunded</dt><dd>{kes(order.refundedAmount)}</dd></div> : null}
        </dl>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Payment</p>
            {payment ? (
              <p className="mt-1">M-Pesa{payment.mpesaReceiptNumber ? <> · <strong>{payment.mpesaReceiptNumber}</strong></> : null}<br />
                <span className="text-muted">{kes(payment.amount)} from {payment.phone.replace(/^\+?254/, '0')} · {dateTime(payment.completedAt ?? order.paidAt)}</span></p>
            ) : order.paidAt ? (
              <p className="mt-1">Paid {dateTime(order.paidAt)}</p>
            ) : (
              <p className="mt-1 text-muted">Not paid yet. The money goes straight to {order.vendors?.name ?? 'the hotel'}.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Delivery</p>
            <p className="mt-1">{order.deliveryLocation}</p>
            {order.deliveredAt ? <p className="text-muted">Delivered {dateTime(order.deliveredAt)}</p> : null}
          </div>
        </div>
      </div>

      {/* What you can still do */}
      <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-6">
        {unpaid ? <Link to={`/orders/${order.id}`} className="btn py-2.5">{order.status === 'paymentPending' ? 'Check payment' : 'Pay now'}</Link>
          : <Link to={`/orders/${order.id}`} className="btn btn-ghost py-2.5">Track order</Link>}
        {CANCELLABLE.includes(order.status) ? <button type="button" onClick={cancel} className="btn btn-ghost py-2.5">Cancel</button> : null}
        {order.paidAt && ['paid', 'accepted', 'preparing'].includes(order.status) ? (
          <button type="button" disabled={!refundOpen} onClick={() => setPanel(panel === 'refund' ? null : 'refund')}
            className="btn btn-ghost py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
            title={refundOpen ? undefined : 'Refunds close once the kitchen starts cooking'}>
            {refundOpen ? `Refund · ${refundLeft} min left` : 'Refund closed'}
          </button>
        ) : null}
        {RATEABLE.includes(order.status) ? (
          rating ? <span className="flex items-center gap-2 text-muted">Your rating <Stars n={rating} /></span>
            : <button type="button" onClick={() => setPanel(panel === 'rate' ? null : 'rate')} className="btn btn-ghost py-2.5">Rate this order</button>
        ) : null}
        {message ? <span className="text-muted">{message}</span> : null}
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
    <form onSubmit={send} className="flex flex-col gap-4 border-t border-line bg-ink/[0.03] px-5 py-5 sm:px-6">
      <TextArea label="Why do you need a refund?" value={reason} onChange={setReason} rows={2} error={hint ?? undefined} />
      <button type="submit" className="btn self-start" disabled={busy}>{busy ? 'Sending…' : 'Request refund'}</button>
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
    <form onSubmit={send} className="flex flex-col gap-4 border-t border-line bg-ink/[0.03] px-5 py-5 sm:px-6">
      <StarPicker value={rating} onChange={setRating} />
      <TextArea label="Anything to tell the kitchen? (optional)" value={comment} onChange={setComment} rows={2} />
      {hint ? <Notice>{hint}</Notice> : null}
      <button type="submit" className="btn self-start" disabled={busy}>{busy ? 'Sending…' : 'Send rating'}</button>
    </form>
  )
}
