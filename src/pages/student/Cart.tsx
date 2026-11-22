import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ChapatiDrawing } from '../../components/Drawings'
import { FoodImage } from '../../components/FoodImage'
import { Notice, Select, TextArea, TextField } from '../../components/form'
import { useCart } from '../../lib/cart'
import { useLoad, useSettings, useZones } from '../../lib/data'
import { kes } from '../../lib/format'
import { setTitle, whatsappLink } from '../../lib/site'
import { db, rpc } from '../../lib/supabase'
import { checkoutSchema, fieldErrors, type FieldErrors } from '../../lib/validation'
import { MpesaMethod, OrderSteps } from '../../components/OrderSteps'

type Form = { deliveryZoneId: string; deliveryLocation: string; deliveryInstructions: string; contactPhone: string }
type Placed = { orderId: string; reference: string; totalAmount: number }

/** Cart and checkout on one page: review, delivery details, then the order is created and paid. */
export function Cart() {
  const { cart, subtotal, setQuantity, clear } = useCart()
  const { session, profile } = useAuth()
  const { data: zones } = useZones()
  const { data: settings } = useSettings()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>({ deliveryZoneId: '', deliveryLocation: '', deliveryInstructions: '', contactPhone: '' })
  const [errors, setErrors] = useState<FieldErrors<Form>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<'web' | 'whatsapp' | null>(null)
  useEffect(() => setTitle('Your cart'), [])
  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, contactPhone: f.contactPhone || profile.phone || '', deliveryLocation: f.deliveryLocation || profile.hostel || '' }))
  }, [profile])

  // A seller can have its own platform fee (for example KES 0 for student sellers); the database charges the same.
  const { data: sellerFee } = useLoad(async () => {
    if (!cart.vendorId) return null
    const { data } = await db().from('vendors').select('platformFee').eq('id', cart.vendorId).maybeSingle()
    const f = (data as { platformFee: number | string | null } | null)?.platformFee
    return f === null || f === undefined ? null : Number(f)
  }, null as number | null, [cart.vendorId])
  const platformFee = sellerFee ?? settings.platformFee

  const zone = zones.find((z) => z.id === form.deliveryZoneId)
  const deliveryFee = zone?.fee ?? 0
  const total = subtotal + deliveryFee + platformFee

  async function place(channel: 'web' | 'whatsapp', e?: FormEvent) {
    e?.preventDefault()
    setProblem(null)
    if (!session) { navigate('/login', { state: { from: '/cart' } }); return }
    const parsed = checkoutSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<Form>(parsed.error)); return }
    setErrors({})
    setBusy(channel)
    // WhatsApp must open in the same tap (pop-up blockers), so the window is opened first.
    const waWindow = channel === 'whatsapp' ? window.open('about:blank', '_blank') : null
    try {
      const placed = await rpc<Placed>('placeOrder', {
        pVendorId: cart.vendorId,
        pItems: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        pDeliveryZoneId: parsed.data.deliveryZoneId,
        pDeliveryLocation: parsed.data.deliveryLocation,
        pDeliveryInstructions: parsed.data.deliveryInstructions,
        pContactPhone: parsed.data.contactPhone,
        pChannel: channel,
      })
      clear()
      if (channel === 'whatsapp') {
        const link = whatsappLink(
          `Hi Campus Food, I'd like to confirm order ${placed.reference} from ${cart.vendorName}: ${cart.lines.map((l) => `${l.quantity} x ${l.name}`).join(', ')}. Total ${kes(placed.totalAmount)}. Deliver to ${parsed.data.deliveryLocation}.`,
          settings.whatsappNumber ?? undefined,
        )
        if (link && waWindow) waWindow.location.href = link
        else waWindow?.close()
      }
      navigate(`/orders/${placed.orderId}`, { state: { justPlaced: true } })
    } catch (err) {
      waWindow?.close()
      setProblem((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!cart.lines.length) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center px-6 py-28 text-center">
        <ChapatiDrawing className="h-32 w-32 text-ink" />
        <h1 className="sr-only">Your cart is empty</h1>
        <Link to="/menu" className="btn mt-8">See the menu</Link>
      </section>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl px-4 pb-16 pt-4 text-sm sm:px-6 gap-x-16 gap-y-10 lg:grid-cols-[1.1fr_1fr]">
      <OrderSteps step={1} className="lg:col-span-2" />
      <section>
        <p className="text-xs text-muted">From <strong className="text-ink">{cart.vendorName}</strong></p>
        <h1 className="sr-only">Your order</h1>
        <ul className="mt-8">
          {cart.lines.map((l) => (
            <li key={l.menuItemId} className="flex items-center gap-3 border-b border-line py-4 sm:gap-4">
              <FoodImage path={l.imagePath} name={l.name} width={160} shape="circle" className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold leading-snug">{l.name}</p>
                <p className="text-sm text-muted">{kes(l.price)} each</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3" aria-label={`Quantity of ${l.name}`}>
                    <button type="button" className="h-8 w-8 rounded-full border-2 border-ink font-extrabold" onClick={() => setQuantity(l.menuItemId, l.quantity - 1)} aria-label="One less">−</button>
                    <span className="w-6 text-center font-extrabold">{l.quantity}</span>
                    <button type="button" className="h-8 w-8 rounded-full border-2 border-ink font-extrabold" onClick={() => setQuantity(l.menuItemId, l.quantity + 1)} aria-label="One more">+</button>
                  </div>
                  <p className="shrink-0 font-extrabold">{kes(l.price * l.quantity)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-6 flex flex-col gap-2">
          <div className="flex justify-between"><dt className="text-muted">Food</dt><dd>{kes(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Delivery{zone ? ` to ${zone.name}` : ''}</dt><dd>{zone ? kes(deliveryFee) : 'Choose a delivery area'}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Platform fee</dt><dd>{platformFee === 0 ? 'Free' : kes(platformFee)}</dd></div>
          <div className="mt-2 flex justify-between border-t-2 border-ink pt-3 text-2xl font-extrabold"><dt>Total</dt><dd>{kes(total)}</dd></div>
        </dl>
        <button type="button" onClick={clear} className="link mt-6 text-sm font-bold">Empty the cart</button>
      </section>

      <section>
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Where should we bring it?</h2>
        <form onSubmit={(e) => place('web', e)} noValidate className="mt-8 flex flex-col gap-7">
          <Select label="Delivery area" value={form.deliveryZoneId} onChange={(v) => setForm({ ...form, deliveryZoneId: v })} error={errors.deliveryZoneId}
            placeholder={zones.length ? 'Choose your hostel or area' : 'No delivery areas yet'}
            options={zones.map((z) => ({ value: z.id, label: `${z.name} · ${kes(z.fee)}` }))} />
          <TextField label="Block, room or apartment" value={form.deliveryLocation} onChange={(v) => setForm({ ...form, deliveryLocation: v })} error={errors.deliveryLocation} placeholder="Hostel B, Block 2, Room 14" />
          <TextArea label="Notes for the rider (optional)" value={form.deliveryInstructions} onChange={(v) => setForm({ ...form, deliveryInstructions: v })} rows={2} placeholder="Call me at the gate" />
          <TextField label="M-Pesa phone number" type="tel" inputMode="tel" autoComplete="tel" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} error={errors.contactPhone} hint="The payment prompt and order updates go to this number." />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Payment method</p>
            <MpesaMethod hotel={cart.vendorName} />
          </div>
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          {!session ? <Notice>Sign in or register to place the order. Your cart stays here.</Notice> : null}
          <button type="submit" className="btn w-full py-4 text-base" disabled={busy !== null}>{busy === 'web' ? 'Placing your order…' : session ? `Place order · ${kes(total)}` : 'Sign in to order'}</button>
          {session && whatsappLink('x', settings.whatsappNumber ?? undefined) ? (
            <button type="button" className="btn btn-ghost w-full py-3" disabled={busy !== null} onClick={() => place('whatsapp')}>
              {busy === 'whatsapp' ? 'Opening WhatsApp…' : 'Continue on WhatsApp'}
            </button>
          ) : null}
        </form>
      </section>
    </div>
  )
}
