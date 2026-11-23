import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { ScooterDrawing } from '../../components/Drawings'
import { Notice } from '../../components/form'
import { useLoad } from '../../lib/data'
import { kes, ORDER_STATUS_LABEL, timeOnly } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db, friendly, rpc, supabase } from '../../lib/supabase'
import type { Order } from '../../lib/types'

/** Riders see only the orders assigned to them: pickup, destination, contact, and two buttons. */
export function RiderDeliveries() {
  const { session } = useAuth()
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => setTitle('Deliveries'), [])
  const { data: orders, reload } = useLoad(async () => {
    const { data, error } = await db().from('orders').select('*, orderItems(*), vendors(name,location,phone)')
      .eq('riderId', session!.user.id).in('status', ['readyForPickup', 'assignedForDelivery', 'outForDelivery', 'accepted', 'preparing'])
      .order('createdAt')
    if (error) throw error
    return (data ?? []) as Order[]
  }, [], [session?.user.id])
  useEffect(() => {
    if (!supabase || !session) return
    const ch = supabase.channel(`rider-${session.user.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `riderId=eq.${session.user.id}` }, () => reload())
      .subscribe()
    return () => { void supabase?.removeChannel(ch) }
  }, [session, reload])
  const move = async (id: string, status: 'outForDelivery' | 'delivered') => {
    setProblem(null)
    try { await rpc('updateOrderStatus', { pOrderId: id, pStatus: status }); reload() } catch (e) { setProblem(friendly(e)) }
  }
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 text-sm sm:px-6">
      <h1 className="sr-only">Your deliveries</h1>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {orders.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center text-muted"><ScooterDrawing className="h-24 w-40 text-ink" /><p className="mt-4">No deliveries assigned right now.</p></div>
      ) : null}
      <ul className="mt-8">
        {orders.map((o) => (
          <li key={o.id} className="border-b-2 border-line py-6">
            <p className="flex justify-between"><span className="headline text-lg">{o.reference}</span><span className="font-bold text-brand">{ORDER_STATUS_LABEL[o.status]}</span></p>
            <p className="mt-2"><span className="text-muted">Pick up from</span> <strong>{o.vendors?.name}</strong>{o.vendors?.location ? `, ${o.vendors.location}` : ''}</p>
            <p><span className="text-muted">Deliver to</span> <strong>{o.deliveryLocation}</strong>{o.deliveryInstructions ? ` · ${o.deliveryInstructions}` : ''}</p>
            <p><span className="text-muted">Customer</span> {o.customerName} · <a className="link font-bold" href={`tel:${o.contactPhone}`}>{o.contactPhone}</a></p>
            <p className="text-sm text-muted">{(o.orderItems ?? []).map((i) => `${i.quantity} × ${i.itemName}`).join(', ')} · {kes(o.totalAmount)} already paid{o.estimatedReadyAt ? ` · ready about ${timeOnly(o.estimatedReadyAt)}` : ''}</p>
            <div className="mt-4 flex gap-3">
              {['readyForPickup', 'assignedForDelivery'].includes(o.status) ? <button type="button" className="btn" onClick={() => move(o.id, 'outForDelivery')}>Picked up</button> : null}
              {o.status === 'outForDelivery' ? <button type="button" className="btn" onClick={() => move(o.id, 'delivered')}>Delivered</button> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
