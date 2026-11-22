import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { PlateDrawing } from '../../components/Drawings'
import { useLoad } from '../../lib/data'
import { dateTime, kes, ORDER_STATUS_LABEL, statusTone } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db } from '../../lib/supabase'
import type { Order } from '../../lib/types'

export function Orders() {
  const { session } = useAuth()
  useEffect(() => setTitle('My orders'), [])
  const { data: orders, loading, error } = useLoad(async () => {
    const { data, error } = await db().from('orders').select('*, vendors(name)').eq('studentId', session!.user.id).order('createdAt', { ascending: false }).limit(50)
    if (error) throw error
    return (data ?? []) as Order[]
  }, [], [session?.user.id])

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-4 text-sm sm:px-6">
      <h1 className="sr-only">My orders</h1>
      {error ? <p className="mt-6 text-danger">{error}</p> : null}
      {loading && !orders.length ? <p className="mt-10 text-muted">Loading…</p> : null}
      {!loading && !orders.length ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <PlateDrawing className="h-36 w-36 text-ink" />
          <p className="mt-4 text-muted">No orders yet.</p>
          <Link to="/menu" className="btn mt-6">Order something</Link>
        </div>
      ) : null}
      <ul className="mt-10">
        {orders.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-5 hover:text-brand sm:grid-cols-[8rem_1fr_auto_auto]">
              <span className="headline text-2xl">{o.reference}</span>
              <span className="order-3 text-muted sm:order-none">{o.vendors?.name} · {dateTime(o.createdAt)}</span>
              <span className={`order-2 font-extrabold sm:order-none ${statusTone(o.status)}`}>{ORDER_STATUS_LABEL[o.status]}</span>
              <span className="order-4 text-right font-extrabold sm:order-none">{kes(o.totalAmount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
