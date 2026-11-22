import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScooterDrawing } from '../../components/Drawings'
import { Notice, StarPicker, TextArea, TextField } from '../../components/form'
import { useLoad, useSettings } from '../../lib/data'
import { dateTime, kes, minutesUntil, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, PROGRESS, progressIndex, statusTone, timeOnly } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { callFunction, db, rpc, supabase } from '../../lib/supabase'
import type { Order, OrderStatus, Payment } from '../../lib/types'
import { Stroke } from '../../components/Stroke'
import { OrderSteps } from '../../components/OrderSteps'

const PROGRESS_LABEL: Record<string, string> = { paid: 'Paid', accepted: 'Accepted', preparing: 'Cooking', readyForPickup: 'Ready', outForDelivery: 'On the way', delivered: 'Delivered' }
const UNPAID: OrderStatus[] = ['draft', 'awaitingPayment', 'paymentPending', 'paymentFailed']

/** One order: pay with M-Pesa, then follow it live until it reaches the hostel. */
export function OrderDetail() {
  const { id = '' } = useParams()
  const { data: settings } = useSettings()
  const { data, loading, error, reload } = useLoad(async () => {
    const [o, p] = await Promise.all([
      db().from('orders').select('*, orderItems(*), vendors(name,location,phone)').eq('id', id).maybeSingle(),
      db().from('payments').select('*').eq('orderId', id).order('initiatedAt', { ascending: false }),
    ])
    if (o.error) throw o.error
    return { order: o.data as Order | null, payments: (p.data ?? []) as Payment[] }
  }, { order: null as Order | null, payments: [] as Payment[] }, [id])
  const order = data.order
  useEffect(() => setTitle(order ? order.reference : 'Order'), [order])

  // Live: status changes from the hotel, rider and M-Pesa callback arrive without refreshing.
  useEffect(() => {
    if (!supabase || !id) return
    const ch = supabase.channel(`order-${id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `orderId=eq.${id}` }, () => reload())
      .subscribe()
    return () => { void supabase?.removeChannel(ch) }
  }, [id, reload])

  // While a prompt is out, also poll (realtime can be slow on campus data).
  const waiting = order?.status === 'paymentPending' || order?.status === 'awaitingPayment'
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(reload, 5000)
    return () => clearInterval(t)
  }, [waiting, reload])

  if (loading && !order) return <p className="px-6 py-32 text-center text-muted">Loading your order…</p>
  if (error) return <p className="px-6 py-32 text-center text-danger">{error}</p>
  if (!order) return <p className="px-6 py-32 text-center text-muted">Order not found. <Link to="/orders" className="link">See your orders</Link></p>

  const step = progressIndex(order.status)
  const eta = minutesUntil(order.estimatedDeliveryAt)
  const paidPayment = data.payments.find((p) => p.status === 'paid')
  const refundOpen = order.paidAt && ['paid', 'accepted'].includes(order.status) && Date.now() < new Date(order.paidAt).getTime() + settings.refundWindowMinutes * 60000

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-4 text-sm sm:px-6">
      <OrderSteps step={UNPAID.includes(order.status) ? 2 : 3} className="mb-8" />
      <p className="text-xs text-muted">{order.vendors?.name}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="sr-only">{order.reference}</h1>
        <p className={`text-xl font-extrabold ${statusTone(order.status)}`}>{ORDER_STATUS_LABEL[order.status]}</p>
      </div>
      {UNPAID.includes(order.status) ? <PayNow order={order} payments={data.payments} onChange={reload} draftMinutes={settings.draftLifetimeMinutes} /> : null}

      {step >= 0 ? (
        <section className="mt-12" aria-label="Progress">
          <ol className="grid grid-cols-6 gap-1">
            {PROGRESS.map((s, i) => (
              <li key={s} className="flex flex-col gap-2">
                <span className={`h-2 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} />
                <span className={`text-[0.62rem] font-bold leading-tight sm:text-xs sm:uppercase sm:tracking-wider ${i <= step ? 'text-ink' : 'text-muted'}`}>{PROGRESS_LABEL[s]}</span>
              </li>
            ))}
          </ol>
          {order.status !== 'delivered' && order.estimatedDeliveryAt ? (
            <p className="mt-6 flex items-center gap-4 text-lg">
              <ScooterDrawing className="h-12 w-20 text-ink" />
              <span>Estimated arrival {timeOnly(order.estimatedDeliveryAt)}{eta !== null && eta > 0 ? ` (about ${eta} min)` : ''}. <span className="story text-muted">This is an estimate; it updates as the hotel works.</span></span>
            </p>
          ) : null}
          {order.status === 'delivered' ? <p className="mt-6 text-lg">Delivered {dateTime(order.deliveredAt)}. Enjoy your meal.</p> : null}
        </section>
      ) : null}

      {order.status === 'rejected' ? <Notice tone="error">The hotel could not take this order: {order.rejectionReason}. Your refund is being processed.</Notice> : null}

      <div className="mt-14 grid gap-14 lg:grid-cols-2">
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">What you ordered</h2>
          <ul className="mt-4">
            {(order.orderItems ?? []).map((i) => (
              <li key={i.id} className="flex justify-between border-b border-line py-3">
                <span><strong>{i.quantity} ×</strong> {i.itemName}</span><span>{kes(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-col gap-1">
            <div className="flex justify-between"><dt className="text-muted">Food</dt><dd>{kes(order.foodSubtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{kes(order.deliveryFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Platform fee</dt><dd>{kes(order.platformFee)}</dd></div>
            <div className="mt-2 flex justify-between border-t-2 border-ink pt-2 text-xl font-extrabold"><dt>Total</dt><dd>{kes(order.totalAmount)}</dd></div>
            {Number(order.refundedAmount) > 0 ? <div className="flex justify-between text-ok"><dt>Refunded</dt><dd>{kes(order.refundedAmount)}</dd></div> : null}
          </dl>
        </section>
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Delivery</h2>
          <p className="mt-4 text-lg">{order.deliveryLocation}</p>
          {order.deliveryInstructions ? <p className="text-muted">{order.deliveryInstructions}</p> : null}
          <p className="mt-2 text-muted">Contact {order.contactPhone}</p>
          {paidPayment ? (
            <p className="mt-6">Paid {dateTime(paidPayment.completedAt)}{paidPayment.mpesaReceiptNumber ? <> · M-Pesa <strong>{paidPayment.mpesaReceiptNumber}</strong></> : null}</p>
          ) : null}
          {order.paidAt ? <Link to={`/r/${order.receiptToken}`} className="btn btn-ghost mt-6">Open receipt</Link> : null}
        </section>
      </div>

      {refundOpen ? <RefundRequest order={order} windowMinutes={settings.refundWindowMinutes} onDone={reload} /> : null}
      {['delivered', 'refunded', 'partiallyRefunded', 'rejected'].includes(order.status) ? <RateOrder order={order} /> : null}
    </div>
  )
}

function PayNow({ order, payments, onChange, draftMinutes }: { order: Order; payments: Payment[]; onChange: () => void; draftMinutes: number }) {
  const [phone, setPhone] = useState(order.contactPhone.replace('+254', '0'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)
  const last = payments[0]
  async function pay(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const r = await callFunction<{ message: string }>('mpesa-stk-push', { orderId: order.id, phone })
      setMessage({ tone: 'success', text: r.message })
      onChange()
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }
  async function cancel() {
    try { await rpc('cancelUnpaidOrder', { pOrderId: order.id }); onChange() } catch (err) { setMessage({ tone: 'error', text: (err as Error).message }) }
  }
  const pending = order.status === 'paymentPending'
  return (
    <section className="mt-10 grid items-center gap-8 border-y-2 border-ink py-10 sm:grid-cols-[auto_1fr]">
      <img src="/brand/mpesa-logo.svg" alt="M-PESA" className="mx-auto h-auto w-40 sm:w-48" />
      <div>
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">{pending ? 'Enter your M-Pesa PIN' : `Pay ${kes(order.totalAmount)} with M-Pesa`}</h2>
        <p className="mt-2 text-muted">
          {pending
            ? 'A prompt was sent to your phone. Enter your PIN there; this page updates by itself.'
            : `The money goes straight to ${order.vendors?.name ?? 'the hotel'}. Unpaid orders are cleared after ${Math.round(draftMinutes / 60)} hours.`}
        </p>
        {order.status === 'paymentFailed' && last ? <Notice tone="error">Last attempt: {PAYMENT_STATUS_LABEL[last.status]}{last.resultDesc ? ` (${last.resultDesc})` : ''}. You can try again.</Notice> : null}
        <form onSubmit={pay} className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end">
          <TextField label="M-Pesa number" type="tel" inputMode="tel" value={phone} onChange={setPhone} className="sm:w-64" />
          <button type="submit" className="btn py-3" disabled={busy}>{busy ? 'Sending prompt…' : pending ? 'Send the prompt again' : 'Pay now'}</button>
        </form>
        {message ? <div className="mt-4"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
        {!pending ? <button type="button" onClick={cancel} className="link mt-5 text-sm font-bold">Cancel this order</button> : null}
      </div>
    </section>
  )
}

function RefundRequest({ order, windowMinutes, onDone }: { order: Order; windowMinutes: number; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const left = Math.max(0, Math.ceil((new Date(order.paidAt!).getTime() + windowMinutes * 60000 - Date.now()) / 60000))
  async function send(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 3) { setProblem('Tell us why you need a refund'); return }
    try { await rpc('requestRefund', { pOrderId: order.id, pReason: reason }); onDone() } catch (err) { setProblem((err as Error).message) }
  }
  return (
    <section className="mt-16">
      <Stroke color="var(--color-line)" seed="pages/student/OrderDetail.tsx1" className="mb-10" /><h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Need a refund?</h2>
      <p className="mt-2 text-muted">You can ask for {left} more minute{left === 1 ? '' : 's'}. After that the kitchen has started and refunds close.</p>
      <form onSubmit={send} className="mt-6 flex max-w-xl flex-col gap-5">
        <TextArea label="Reason" value={reason} onChange={setReason} rows={2} error={problem ?? undefined} />
        <button type="submit" className="btn btn-ghost self-start">Request refund</button>
      </form>
    </section>
  )
}

function RateOrder({ order }: { order: Order }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  async function send(e: FormEvent) {
    e.preventDefault()
    if (!rating) { setProblem('Choose a rating'); return }
    try { await rpc('submitFeedback', { pOrderId: order.id, pRating: rating, pComment: comment, pDisplayName: null, pContactEmail: null }); setDone(true) } catch (err) { setProblem((err as Error).message) }
  }
  return (
    <section className="mt-16">
      <Stroke color="var(--color-line)" seed="pages/student/OrderDetail.tsx2" className="mb-10" /><h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">How was it?</h2>
      {done ? <p className="hand mt-4 text-lg text-brand">thank you!</p> : (
        <form onSubmit={send} className="mt-6 flex max-w-xl flex-col gap-6">
          <StarPicker value={rating} onChange={setRating} />
          <TextArea label="Anything to tell the kitchen? (optional)" value={comment} onChange={setComment} rows={2} />
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          <button type="submit" className="btn self-start">Send rating</button>
        </form>
      )}
    </section>
  )
}
